import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import chalk from "chalk";

// ──────────────────────────────────────────────────────────────
// IMPORTANT: vi.mock factories are hoisted ABOVE all variable declarations.
// So factories CANNOT reference outer `const` variables.
// Instead, each factory creates its own fns internally, and we access
// them after import via .
// ──────────────────────────────────────────────────────────────

// Spinner object — used inside ora factory, safe because it's an object literal
// (actually not safe — must use vi.hoisted)
const mockSpinner = {
  start: mock.fn(() => mockSpinner),
  stop: mock.fn(() => mockSpinner),
  fail: mock.fn(() => mockSpinner),
  succeed: mock.fn(() => mockSpinner),
  text: "",
};

const mockTelemetry = {
  capture: mock.fn(),
  flush: mock.fn(() => Promise.resolve(undefined)),
};







/** Build a mock fetch Response that streams a tiny buffer. */
import { marketplaceInstall, tar, ui } from "../../../../src/commands/marketplace/install.js";
import {
  AuthenticationError,
  LicenseRequiredError,
  NetworkError,
} from "../../../../src/infrastructure/errors.js";
import type { Module, DownloadToken } from "../../../../src/types/marketplace.js";
import { AuthService } from "../../../../src/core/AuthService.js";
import { MarketplaceClient } from "../../../../src/infrastructure/MarketplaceClient.js";
import { ModuleInstaller } from "../../../../src/core/ModuleInstaller.js";
import { TelemetryBuffer } from "../../../../src/infrastructure/TelemetryBuffer.js";
import fs from "fs-extra";

function makeModule(overrides: Partial<Module> = {}): Module {
  return {
    id: "mod-1",
    slug: "payments",
    name: "Payments",
    description: "Stripe payment integration",
    category: "payments",
    tier: "starter",
    latestVersion: "1.0.0",
    author: "kaven",
    installCount: 42,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeDownloadToken(): DownloadToken {
  return {
    token: "fake-token-123",
    expiresAt: "2026-01-01T01:00:00Z",
  };
}

function makeManifest(): any {
  return {
    name: "payments",
    version: "1.0.0",
    kaven: {
      id: "module-abc",
    },
  };
}

function makeMockWriteStream(): any {
  const mockStream = {
    on: mock.fn((event: string, cb: () => void) => {
      if (event === "finish") setTimeout(cb, 10);
      return mockStream;
    }),
    once: mock.fn((event: string, cb: () => void) => {
      if (event === "finish") setTimeout(cb, 10);
      return mockStream;
    }),
    write: mock.fn(() => true),
    end: mock.fn(),
  };
  return mockStream;
}

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
  let mockGetValidToken: any;
  let mockIsAuthenticated: any;
  let mockGetModule: any;
  let mockCreateDownloadToken: any;
  let mockGetReleaseInfo: any;
  let mockInstall: any;
  let mockIsModuleInstalled: any;

  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;
  let fetchSpy: any;

  beforeEach(() => {
    
    chalk.level = 0;

    // Mock TelemetryBuffer.getInstance()
    const telemetryInstance = {
      capture: mock.fn(),
      flush: mock.fn(() => Promise.resolve(undefined)),
    };
    mock.method(TelemetryBuffer, "getInstance", () => telemetryInstance);

    // Mock UI
    mock.method(ui, "ora", () => mockSpinner);
    
    // Re-apply spinner mock implementations
    mockSpinner.start.mock.resetCalls();
    mockSpinner.stop.mock.resetCalls();
    mockSpinner.fail.mock.resetCalls();
    mockSpinner.succeed.mock.resetCalls();
    mockSpinner.start.mock.mockImplementation(() => mockSpinner);
    mockSpinner.stop.mock.mockImplementation(() => mockSpinner);
    mockSpinner.fail.mock.mockImplementation(() => mockSpinner);
    mockSpinner.succeed.mock.mockImplementation(() => mockSpinner);
    mockSpinner.text = "";

    // Re-apply telemetry
    mockTelemetry.capture.mock.mockImplementation(() => undefined);
    mockTelemetry.flush.mock.mockImplementation(() => Promise.resolve(undefined));

    // Set up per-test mock function references using fresh mock.fn()
    mockGetValidToken = mock.fn(() => Promise.resolve("fake-token"));
    mockIsAuthenticated = mock.fn(() => Promise.resolve(true));
    mockGetModule = mock.fn(() => Promise.resolve(makeModule()));
    mockCreateDownloadToken = mock.fn(() => Promise.resolve(makeDownloadToken()));
    mockGetReleaseInfo = mock.fn(() => Promise.resolve({
      id: "rel-1",
      moduleId: "module-abc",
      version: "1.2.0",
      changelog: "",
      installCount: 0,
      createdAt: "2026-01-01T00:00:00Z",
    }));
    mockInstall = mock.fn(() => Promise.resolve(undefined));
    mockIsModuleInstalled = mock.fn(() => Promise.resolve(false));

    // Re-configure class mocks using prototypes
    mock.method(AuthService.prototype, "getValidToken", mockGetValidToken);
    mock.method(AuthService.prototype, "isAuthenticated", mockIsAuthenticated);

    mock.method(MarketplaceClient.prototype, "getModule", mockGetModule);
    mock.method(MarketplaceClient.prototype, "createDownloadToken", mockCreateDownloadToken);
    mock.method(MarketplaceClient.prototype, "getReleaseInfo", mockGetReleaseInfo);
    mock.method(MarketplaceClient.prototype, "resolveUrl", mock.fn((p: string) => Promise.resolve(`https://marketplace.kaven.site${p}`)));

    mock.method(ModuleInstaller.prototype, "install", mockInstall);
    mock.method(ModuleInstaller.prototype, "isModuleInstalled", mockIsModuleInstalled);

    // Re-apply tar mock
    mock.method(tar, "x", () => Promise.resolve(undefined));

    // Re-apply fs-extra mocks
    mock.method(fs, "mkdtemp", () => Promise.resolve("/tmp/kaven-install-abc"));
    mock.method(fs, "ensureDir", () => Promise.resolve(undefined));
    mock.method(fs, "remove", () => Promise.resolve(undefined));
    mock.method(fs, "pathExists", () => Promise.resolve(true));
    mock.method(fs, "readJson", () => Promise.resolve(makeManifest()));
    mock.method(fs, "stat", () => Promise.resolve({ size: 1024 }));
    mock.method(fs, "createWriteStream", () => makeMockWriteStream());

    // Console / process spies
    consoleLogSpy = mock.method(console, "log", () => {});
    consoleErrorSpy = mock.method(console, "error", () => {});
    processExitSpy = mock.method(process, "exit", (() => {}) as (code?: number) => never);

    fetchSpy = mock.method(global, "fetch", () => Promise.resolve(makeFetchResponse()));
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("exits with auth error when getValidToken throws", async () => {
    mockGetValidToken.mock.mockImplementation(() => Promise.reject(new Error("Not authenticated. Run 'kaven auth login' to authenticate.")));

    await marketplaceInstall("payments");

    const errOutput = consoleErrorSpy.mock.calls
      .map((args: any) => String(args.arguments[0]))
      .join("\n");
    assert.ok(errOutput.includes(
      "Authentication required. Run: kaven auth login"
    ));
    assert.strictEqual(processExitSpy.mock.calls.length, 1);
    assert.strictEqual(processExitSpy.mock.calls[0].arguments[0], 1);
  });

  it("exits with auth error when AuthenticationError is thrown by getModule", async () => {
    mockGetModule.mock.mockImplementation(() => Promise.reject(new AuthenticationError("Token expired")));

    await marketplaceInstall("payments");

    const errOutput = consoleErrorSpy.mock.calls
      .map((args: any) => String(args.arguments[0]))
      .join("\n");
    assert.ok(errOutput.includes(
      "Authentication required. Run: kaven auth login"
    ));
    assert.strictEqual(processExitSpy.mock.calls.length > 0, true);
  });

  it("shows tier info and upgrade command on LicenseRequiredError", async () => {
    mockCreateDownloadToken.mock.mockImplementation(() => Promise.reject(new LicenseRequiredError("pro", "Pro license required")));

    await marketplaceInstall("payments");

    const errOutput = consoleErrorSpy.mock.calls
      .map((args: any) => String(args.arguments[0]))
      .join("\n");
    assert.ok(errOutput.includes("pro"));
    assert.ok(errOutput.includes("kaven upgrade pro"));
    assert.strictEqual(processExitSpy.mock.calls.length > 0, true);
  });

  it("shows already installed warning when module is installed and no --force", async () => {
    mockIsModuleInstalled.mock.mockImplementation(() => Promise.resolve(true));

    await marketplaceInstall("payments", { force: false });

    const allOutput = consoleLogSpy.mock.calls
      .map((args: any) => String(args.arguments[0]))
      .join("\n");
    assert.ok(allOutput.includes("already installed"));
    assert.ok(allOutput.includes("--force"));
    assert.strictEqual(mockCreateDownloadToken.mock.calls.length, 0);
    assert.strictEqual(processExitSpy.mock.calls.length, 0);
  });

  it("proceeds when --force is set even if already installed", async () => {
    mockIsModuleInstalled.mock.mockImplementation(() => Promise.resolve(true));

    await marketplaceInstall("payments", { force: true });

    assert.strictEqual(mockCreateDownloadToken.mock.calls.length > 0, true);
    assert.strictEqual(mockInstall.mock.calls.length > 0, true);
    assert.strictEqual(processExitSpy.mock.calls.length, 0);
  });

  it("calls getModule, createDownloadToken, fetch, tar.x, and install in full pipeline", async () => {
    const module = makeModule();
    const token = makeDownloadToken();
    mockGetModule.mock.mockImplementation(() => Promise.resolve(module));
    mockCreateDownloadToken.mock.mockImplementation(() => Promise.resolve(token));

    await marketplaceInstall("payments");

    assert.strictEqual(mockGetModule.mock.calls.length > 0, true);
    assert.strictEqual(mockCreateDownloadToken.mock.calls.length > 0, true);
    assert.strictEqual(fetchSpy.mock.calls.length > 0, true);
    assert.strictEqual(tar.x.mock.calls.length > 0, true);
    assert.strictEqual(mockInstall.mock.calls.length > 0, true);
    assert.strictEqual(processExitSpy.mock.calls.length, 0);
  });

  it("uses --version flag instead of latestVersion when provided", async () => {
    const module = makeModule();
    mockGetModule.mock.mockImplementation(() => Promise.resolve(module));

    await marketplaceInstall("payments", { version: "1.0.0" });

    assert.strictEqual(mockCreateDownloadToken.mock.calls.length > 0, true);
  });

  it("shows download size from Content-Length header in spinner text", async () => {
    fetchSpy.mock.mockImplementation(() => Promise.resolve(makeFetchResponse(251000))); // ~245 KB

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
    assert.strictEqual(textValues.some((t) => t.includes("245 KB")), true);

    // Restore
    Object.defineProperty(mockSpinner, "text", {
      value: "",
      writable: true,
      configurable: true,
    });
  });

  it("shows network error and exits on NetworkError", async () => {
    mockCreateDownloadToken.mock.mockImplementation(() => Promise.reject(new NetworkError("Connection refused")));

    await marketplaceInstall("payments");

    const errOutput = consoleErrorSpy.mock.calls
      .map((args: any) => String(args.arguments[0]))
      .join("\n");
    assert.ok(errOutput.includes("Could not reach marketplace"));
    assert.strictEqual(processExitSpy.mock.calls.length > 0, true);
  });

  it("always cleans up temp dir even when installer.install fails", async () => {
    mockInstall.mock.mockImplementation(() => Promise.reject(new Error("Injection failed: anchor not found")));

    await marketplaceInstall("payments");

    assert.strictEqual(fs.remove.mock.calls.length > 0, true);
    assert.strictEqual(processExitSpy.mock.calls.length > 0, true);
  });

  it("shows success spinner message on successful install", async () => {
    await marketplaceInstall("payments");

    assert.strictEqual(mockSpinner.succeed.mock.calls.length, 1);
    const successMsg = mockSpinner.succeed.mock.calls[0].arguments[0] as string;
    assert.ok(successMsg.includes("payments"));
    assert.ok(successMsg.includes("installed successfully"));
    assert.strictEqual(processExitSpy.mock.calls.length, 0);
  });
});
