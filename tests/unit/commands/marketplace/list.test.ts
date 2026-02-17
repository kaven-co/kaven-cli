import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import chalk from "chalk";

// ──────────────────────────────────────────────────────────────
// Module mocks (must be at top before imports of the tested module)
// ──────────────────────────────────────────────────────────────

const mockSpinner = {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  text: "",
};

vi.mock("ora", () => ({
  default: vi.fn(() => mockSpinner),
}));

const mockTelemetry = {
  capture: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../../../../src/infrastructure/TelemetryBuffer", () => ({
  TelemetryBuffer: {
    getInstance: vi.fn(() => mockTelemetry),
  },
}));

const mockListModules = vi.fn();
const mockIsAuthenticated = vi.fn();

vi.mock("../../../../src/infrastructure/MarketplaceClient", () => ({
  MarketplaceClient: vi.fn(() => ({
    listModules: mockListModules,
  })),
}));

vi.mock("../../../../src/core/AuthService", () => ({
  AuthService: vi.fn(() => ({
    isAuthenticated: mockIsAuthenticated,
  })),
}));

// Import AFTER mocks
import { marketplaceList } from "../../../../src/commands/marketplace/list";
import { NetworkError } from "../../../../src/infrastructure/errors";
import type { PaginatedResponse, Module } from "../../../../src/types/marketplace";

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

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

function makePaginatedResponse(
  data: Module[],
  total?: number
): PaginatedResponse<Module> {
  return {
    data,
    total: total ?? data.length,
    page: 1,
    pageSize: 20,
  };
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe("marketplaceList (C1.4)", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-apply mock implementations after vi.clearAllMocks()
    mockSpinner.start.mockReturnThis();
    mockSpinner.stop.mockReturnThis();
    mockSpinner.fail.mockReturnThis();

    mockTelemetry.capture.mockReturnValue(undefined);
    mockTelemetry.flush.mockResolvedValue(undefined);

    mockIsAuthenticated.mockResolvedValue(true);

    chalk.level = 0; // Disable colors for easier string matching

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as (code?: number) => never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a table with module data from listModules()", async () => {
    const modules = [
      makeModule({ slug: "payments", name: "Payments", tier: "starter" }),
      makeModule({
        id: "mod-2",
        slug: "auth",
        name: "Auth",
        tier: "complete",
        latestVersion: "2.0.0",
        installCount: 100,
      }),
    ];
    mockListModules.mockResolvedValue(makePaginatedResponse(modules, 2));

    await marketplaceList({});

    const allOutput = consoleLogSpy.mock.calls
      .map((args) => String(args[0]))
      .join("\n");
    expect(allOutput).toContain("payments");
    expect(allOutput).toContain("auth");
    expect(allOutput).toContain("Payments");
    expect(allOutput).toContain("Auth");
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("calls listModules with correct page and pageSize from options", async () => {
    mockListModules.mockResolvedValue(
      makePaginatedResponse([makeModule()], 1)
    );

    await marketplaceList({ page: 2, limit: 10 });

    expect(mockListModules).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 10 })
    );
  });

  it("calls listModules with category filter", async () => {
    mockListModules.mockResolvedValue(
      makePaginatedResponse([makeModule()], 1)
    );

    await marketplaceList({ category: "payments" });

    expect(mockListModules).toHaveBeenCalledWith(
      expect.objectContaining({ category: "payments" })
    );
  });

  it("outputs raw JSON when --json flag is set", async () => {
    const response = makePaginatedResponse([makeModule()], 1);
    mockListModules.mockResolvedValue(response);

    await marketplaceList({ json: true });

    const jsonOutput = consoleLogSpy.mock.calls
      .map((args) => String(args[0]))
      .find((str) => str.startsWith("{"));

    expect(jsonOutput).toBeDefined();
    const parsed = JSON.parse(jsonOutput!);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.total).toBe(1);
  });

  it("shows unauthenticated warning but still fetches modules", async () => {
    mockIsAuthenticated.mockResolvedValue(false);
    mockListModules.mockResolvedValue(
      makePaginatedResponse([makeModule()], 1)
    );

    await marketplaceList({});

    const allOutput = consoleLogSpy.mock.calls
      .map((args) => String(args[0]))
      .join("\n");
    expect(allOutput).toContain("Not authenticated");
    expect(mockListModules).toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('shows "No modules found" message on empty results', async () => {
    mockListModules.mockResolvedValue(makePaginatedResponse([], 0));

    await marketplaceList({});

    const allOutput = consoleLogSpy.mock.calls
      .map((args) => String(args[0]))
      .join("\n");
    expect(allOutput).toContain("No modules found matching your criteria.");
  });

  it("shows network error message and exits(1) on NetworkError", async () => {
    mockListModules.mockRejectedValue(
      new NetworkError("Connection refused")
    );

    await marketplaceList({});

    const errOutput = consoleErrorSpy.mock.calls
      .map((args) => String(args[0]))
      .join("\n");
    expect(errOutput).toContain(
      "Could not reach marketplace. Check your connection."
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("shows pagination footer with correct totals", async () => {
    const modules = Array.from({ length: 20 }, (_, i) =>
      makeModule({ slug: `mod-${i}`, id: `id-${i}`, name: `Mod ${i}` })
    );
    mockListModules.mockResolvedValue(makePaginatedResponse(modules, 156));

    await marketplaceList({ page: 1, limit: 20 });

    const allOutput = consoleLogSpy.mock.calls
      .map((args) => String(args[0]))
      .join("\n");
    expect(allOutput).toContain("Showing 1-20 of 156 modules (page 1/8)");
  });

  it("caps pageSize at 100 when limit > 100", async () => {
    mockListModules.mockResolvedValue(
      makePaginatedResponse([makeModule()], 1)
    );

    await marketplaceList({ limit: 999 });

    expect(mockListModules).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 100 })
    );
  });

  it("sorts by popular (highest installCount first)", async () => {
    const modules = [
      makeModule({ slug: "low", name: "Low Installs", installCount: 5 }),
      makeModule({ slug: "high", id: "mod-2", name: "High Installs", installCount: 100 }),
    ];
    mockListModules.mockResolvedValue(makePaginatedResponse(modules, 2));

    await marketplaceList({ sort: "popular" });

    const allOutput = consoleLogSpy.mock.calls
      .map((args) => String(args[0]))
      .join("\n");
    // High Installs should appear before Low Installs
    const highIdx = allOutput.indexOf("High Installs");
    const lowIdx = allOutput.indexOf("Low Installs");
    expect(highIdx).toBeLessThan(lowIdx);
  });

  it("sorts alphabetically by name when sort=name", async () => {
    const modules = [
      makeModule({ slug: "z-mod", name: "Zebra Module" }),
      makeModule({ slug: "a-mod", id: "mod-2", name: "Alpha Module" }),
    ];
    mockListModules.mockResolvedValue(makePaginatedResponse(modules, 2));

    await marketplaceList({ sort: "name" });

    const allOutput = consoleLogSpy.mock.calls
      .map((args) => String(args[0]))
      .join("\n");
    // Alpha should appear before Zebra in the table
    const alphaIdx = allOutput.indexOf("Alpha");
    const zebraIdx = allOutput.indexOf("Zebra");
    expect(alphaIdx).toBeLessThan(zebraIdx);
  });
});
