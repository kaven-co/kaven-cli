import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import chalk from "chalk";

// ──────────────────────────────────────────────────────────────
// IMPORTANT: vi.mock factories are hoisted ABOVE all variable declarations.
// So factories CANNOT reference outer `const` variables.
// Instead, each factory creates its own fns internally, and we access
// them after import via vi.mocked().
// ──────────────────────────────────────────────────────────────

// Spinner object — used inside ora factory, safe because it's an object literal
// (actually not safe — must use vi.hoisted)
const mockSpinner = vi.hoisted(() => ({
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  text: "",
}));

const mockTelemetry = vi.hoisted(() => ({
  capture: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("ora", () => ({
  default: vi.fn(() => mockSpinner),
}));

vi.mock("../../../../src/infrastructure/TelemetryBuffer", () => ({
  TelemetryBuffer: {
    getInstance: vi.fn(() => mockTelemetry),
  },
}));

vi.mock("../../../../src/core/AuthService", () => ({
  AuthService: vi.fn(() => ({
    getValidToken: vi.fn(),
    isAuthenticated: vi.fn(),
  })),
}));

vi.mock("../../../../src/infrastructure/MarketplaceClient", () => ({
  MarketplaceClient: vi.fn(() => ({
    getModule: vi.fn(),
    createDownloadToken: vi.fn(),
    getReleaseInfo: vi.fn(),
    resolveUrl: vi.fn((p: string) => Promise.resolve(`https://api.kaven.sh${p}`)),
  })),
}));

vi.mock("../../../../src/core/ModuleInstaller", () => ({
  ModuleInstaller: vi.fn(() => ({
    install: vi.fn(),
    isModuleInstalled: vi.fn(),
  })),
}));

vi.mock("../../../../src/core/MarkerService", () => ({
  MarkerService: vi.fn(() => ({})),
}));

vi.mock("tar", () => ({
  x: vi.fn(),
}));

vi.mock("fs-extra", () => {
  const fns = {
    mkdtemp: vi.fn(),
    ensureDir: vi.fn(),
    remove: vi.fn(),
    pathExists: vi.fn(),
    readJson: vi.fn(),
    stat: vi.fn(),
    createWriteStream: vi.fn(),
  };
  return { default: fns, ...fns };
});

// ── Imports (after mocks) ──
import { marketplaceInstall } from "../../../../src/commands/marketplace/install";
import {
  AuthenticationError,
  LicenseRequiredError,
  NetworkError,
} from "../../../../src/infrastructure/errors";
import type { Module, DownloadToken } from "../../../../src/types/marketplace";
import { AuthService } from "../../../../src/core/AuthService";
import { MarketplaceClient } from "../../../../src/infrastructure/MarketplaceClient";
import { ModuleInstaller } from "../../../../src/core/ModuleInstaller";
import * as tarModule from "tar";
import fs from "fs-extra";

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function makeModule(overrides: Partial<Module> = {}): Module {
  return {
    id: "module-abc",
    slug: "payments",
    name: "Payments",
    description: "Payment processing",
    category: "payments",
    tier: "starter",
    latestVersion: "1.2.0",
    author: "kaven",
    installCount: 42,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeDownloadToken(overrides: Partial<DownloadToken> = {}): DownloadToken {
  return {
    token: "tok_test_abc123",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    downloadUrl: "/artifacts/tok_test_abc123",
    ...overrides,
  };
}

function makeManifest() {
  return {
    name: "payments",
    version: "1.2.0",
    injections: [],
  };
}

/** Build a mock WriteStream that resolves the 'finish' event immediately. */
function makeMockWriteStream() {
  return {
    write: vi.fn().mockReturnValue(true),
    end: vi.fn(),
    once: vi.fn((event: string, cb: () => void) => {
      if (event === "finish") setImmediate(cb);
    }),
  };
}

/** Build a mock fetch Response that streams a tiny buffer. */
function makeFetchResponse(contentLengthBytes?: number): Response {
  const headers = new Headers();
  if (contentLengthBytes !== undefined) {
    headers.set("content-length", String(contentLengthBytes));
  }
  const body = new Uint8Array([1, 2, 3]);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    },
  });
  return new Response(stream, { status: 200, statusText: "OK", headers });
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe("marketplaceInstall (C1.5)", () => {
  // Per-test instances of mocked class methods
  let mockGetValidToken: ReturnType<typeof vi.fn>;
  let mockIsAuthenticated: ReturnType<typeof vi.fn>;
  let mockGetModule: ReturnType<typeof vi.fn>;
  let mockCreateDownloadToken: ReturnType<typeof vi.fn>;
  let mockGetReleaseInfo: ReturnType<typeof vi.fn>;
  let mockInstall: ReturnType<typeof vi.fn>;
  let mockIsModuleInstalled: ReturnType<typeof vi.fn>;

  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    chalk.level = 0;

    // Re-apply spinner mock implementations after clearAllMocks
    mockSpinner.start.mockReturnThis();
    mockSpinner.stop.mockReturnThis();
    mockSpinner.fail.mockReturnThis();
    mockSpinner.succeed.mockReturnThis();
    mockSpinner.text = "";

    // Re-apply telemetry
    mockTelemetry.capture.mockReturnValue(undefined);
    mockTelemetry.flush.mockResolvedValue(undefined);

    // Set up per-test mock function references using fresh vi.fn()
    mockGetValidToken = vi.fn().mockResolvedValue("fake-token");
    mockIsAuthenticated = vi.fn().mockResolvedValue(true);
    mockGetModule = vi.fn().mockResolvedValue(makeModule());
    mockCreateDownloadToken = vi.fn().mockResolvedValue(makeDownloadToken());
    mockGetReleaseInfo = vi.fn().mockResolvedValue({
      id: "rel-1",
      moduleId: "module-abc",
      version: "1.2.0",
      changelog: "",
      installCount: 0,
      createdAt: "2026-01-01T00:00:00Z",
    });
    mockInstall = vi.fn().mockResolvedValue(undefined);
    mockIsModuleInstalled = vi.fn().mockResolvedValue(false);

    // Re-configure class mocks to return instances with our per-test fns
    (AuthService as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getValidToken: mockGetValidToken,
      isAuthenticated: mockIsAuthenticated,
    }));

    (MarketplaceClient as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getModule: mockGetModule,
      createDownloadToken: mockCreateDownloadToken,
      getReleaseInfo: mockGetReleaseInfo,
      resolveUrl: vi.fn((p: string) => Promise.resolve(`https://api.kaven.sh${p}`)),
    }));

    (ModuleInstaller as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      install: mockInstall,
      isModuleInstalled: mockIsModuleInstalled,
    }));

    // Re-apply tar mock
    (tarModule.x as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    // Re-apply fs-extra mocks
    (fs.mkdtemp as ReturnType<typeof vi.fn>).mockResolvedValue(
      "/tmp/kaven-install-abc"
    );
    (fs.ensureDir as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (fs.remove as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (fs.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (fs.readJson as ReturnType<typeof vi.fn>).mockResolvedValue(makeManifest());
    (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
    (fs.createWriteStream as ReturnType<typeof vi.fn>).mockReturnValue(
      makeMockWriteStream()
    );

    // Console / process spies
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as (code?: number) => never);

    fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(makeFetchResponse());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits with auth error when getValidToken throws", async () => {
    mockGetValidToken.mockRejectedValue(
      new Error("Not authenticated. Run 'kaven auth login' to authenticate.")
    );

    await marketplaceInstall("payments");

    const errOutput = consoleErrorSpy.mock.calls
      .map((args) => String(args[0]))
      .join("\n");
    expect(errOutput).toContain(
      "Authentication required. Run: kaven auth login"
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with auth error when AuthenticationError is thrown by getModule", async () => {
    mockGetModule.mockRejectedValue(new AuthenticationError("Token expired"));

    await marketplaceInstall("payments");

    const errOutput = consoleErrorSpy.mock.calls
      .map((args) => String(args[0]))
      .join("\n");
    expect(errOutput).toContain(
      "Authentication required. Run: kaven auth login"
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("shows tier info and upgrade command on LicenseRequiredError", async () => {
    mockCreateDownloadToken.mockRejectedValue(
      new LicenseRequiredError("pro", "Pro license required")
    );

    await marketplaceInstall("payments");

    const errOutput = consoleErrorSpy.mock.calls
      .map((args) => String(args[0]))
      .join("\n");
    expect(errOutput).toContain("pro");
    expect(errOutput).toContain("kaven upgrade pro");
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("shows already installed warning when module is installed and no --force", async () => {
    mockIsModuleInstalled.mockResolvedValue(true);

    await marketplaceInstall("payments", { force: false });

    const allOutput = consoleLogSpy.mock.calls
      .map((args) => String(args[0]))
      .join("\n");
    expect(allOutput).toContain("already installed");
    expect(allOutput).toContain("--force");
    expect(mockCreateDownloadToken).not.toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("proceeds when --force is set even if already installed", async () => {
    mockIsModuleInstalled.mockResolvedValue(true);

    await marketplaceInstall("payments", { force: true });

    expect(mockCreateDownloadToken).toHaveBeenCalled();
    expect(mockInstall).toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("calls getModule, createDownloadToken, fetch, tar.x, and install in full pipeline", async () => {
    const module = makeModule();
    const token = makeDownloadToken();
    mockGetModule.mockResolvedValue(module);
    mockCreateDownloadToken.mockResolvedValue(token);

    await marketplaceInstall("payments");

    expect(mockGetModule).toHaveBeenCalledWith("payments");
    expect(mockCreateDownloadToken).toHaveBeenCalledWith(
      "payments",
      module.latestVersion
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `https://api.kaven.sh${token.downloadUrl}`
    );
    expect(tarModule.x).toHaveBeenCalled();
    expect(mockInstall).toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("uses --version flag instead of latestVersion when provided", async () => {
    const module = makeModule();
    mockGetModule.mockResolvedValue(module);

    await marketplaceInstall("payments", { version: "1.0.0" });

    expect(mockCreateDownloadToken).toHaveBeenCalledWith("payments", "1.0.0");
  });

  it("shows download size from Content-Length header in spinner text", async () => {
    fetchSpy.mockResolvedValue(makeFetchResponse(251000)); // ~245 KB

    // Track all text assignments during execution
    const textValues: string[] = [];
    let currentText = "";
    Object.defineProperty(mockSpinner, "text", {
      get: () => currentText,
      set: (val: string) => {
        currentText = val;
        textValues.push(val);
      },
      configurable: true,
    });

    await marketplaceInstall("payments");

    // One of the spinner text assignments should contain "245 KB"
    expect(textValues.some((t) => t.includes("245 KB"))).toBe(true);

    // Restore
    Object.defineProperty(mockSpinner, "text", {
      value: "",
      writable: true,
      configurable: true,
    });
  });

  it("shows network error and exits on NetworkError", async () => {
    mockCreateDownloadToken.mockRejectedValue(
      new NetworkError("Connection refused")
    );

    await marketplaceInstall("payments");

    const errOutput = consoleErrorSpy.mock.calls
      .map((args) => String(args[0]))
      .join("\n");
    expect(errOutput).toContain("Could not reach marketplace");
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("always cleans up temp dir even when installer.install fails", async () => {
    mockInstall.mockRejectedValue(
      new Error("Injection failed: anchor not found")
    );

    await marketplaceInstall("payments");

    expect(fs.remove).toHaveBeenCalledWith(
      expect.stringContaining("kaven-install")
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("shows success spinner message on successful install", async () => {
    await marketplaceInstall("payments");

    expect(mockSpinner.succeed).toHaveBeenCalled();
    const successMsg = mockSpinner.succeed.mock.calls[0][0] as string;
    expect(successMsg).toContain("payments");
    expect(successMsg).toContain("installed successfully");
    expect(processExitSpy).not.toHaveBeenCalled();
  });
});
