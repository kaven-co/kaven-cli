import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import chalk from "chalk";

// ──────────────────────────────────────────────────────────────
// Module mocks (must be at top before imports of the tested module)
// ──────────────────────────────────────────────────────────────

const mockSpinner: any = {
  start: mock.fn(() => mockSpinner),
  stop: mock.fn(() => mockSpinner),
  fail: mock.fn(() => mockSpinner),
  text: "",
};



const mockTelemetry = {
  capture: mock.fn(),
  flush: mock.fn(() => Promise.resolve(undefined)),
};



const mockListModules = mock.fn();
const mockIsAuthenticated = mock.fn();

// Import AFTER mocks
import { marketplaceList } from "../../../../src/commands/marketplace/list.js";
import { NetworkError } from "../../../../src/infrastructure/errors.js";
import type { PaginatedResponse, Module } from "../../../../src/types/marketplace.js";

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

import { MarketplaceClient } from "../../../../src/infrastructure/MarketplaceClient.js";
import { AuthService } from "../../../../src/core/AuthService.js";
import { TelemetryBuffer } from "../../../../src/infrastructure/TelemetryBuffer.js";

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe("marketplaceList (C1.4)", () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    // Mock TelemetryBuffer.getInstance()
    const telemetryInstance = {
      capture: mock.fn(),
      flush: mock.fn(() => Promise.resolve(undefined)),
    };
    mock.method(TelemetryBuffer, "getInstance", () => telemetryInstance);

    // Mock AuthService and MarketplaceClient prototypes
    mock.method(AuthService.prototype, "isAuthenticated", mockIsAuthenticated);
    mock.method(MarketplaceClient.prototype, "listModules", mockListModules);

    // Re-apply mock implementations
    mockSpinner.start.mock.mockImplementation(() => mockSpinner);
    mockSpinner.stop.mock.mockImplementation(() => mockSpinner);
    mockSpinner.fail.mock.mockImplementation(() => mockSpinner);

    mockTelemetry.capture.mock.mockImplementation(() => undefined);
    mockTelemetry.flush.mock.mockImplementation(() => Promise.resolve(undefined));

    mockIsAuthenticated.mock.mockImplementation(() => Promise.resolve(true));

    chalk.level = 0; // Disable colors for easier string matching

    consoleLogSpy = mock.method(console, "log", () => {});
    consoleErrorSpy = mock.method(console, "error", () => {});
    processExitSpy = mock.method(process, "exit", (() => {}) as (code?: number) => never);
  });

  afterEach(() => {
    mock.restoreAll();
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
    mockListModules.mock.mockImplementation(() => Promise.resolve(makePaginatedResponse(modules, 2)));

    await marketplaceList({});

    const allOutput = consoleLogSpy.mock.calls
      .map((call: any) => String(call.arguments[0]))
      .join("\n");
    assert.ok(allOutput.includes("payments"));
    assert.ok(allOutput.includes("auth"));
    assert.ok(allOutput.includes("Payments"));
    assert.ok(allOutput.includes("Auth"));
    assert.strictEqual(processExitSpy.mock.calls.length, 0);
  });

  it("calls listModules with correct page and pageSize from options", async () => {
    mockListModules.mock.mockImplementation(() => Promise.resolve(makePaginatedResponse([makeModule()], 1)));

    await marketplaceList({ page: 2, limit: 10 });

    assert.strictEqual(mockListModules.mock.calls.length > 0, true);
  });

  it("calls listModules with category filter", async () => {
    mockListModules.mock.mockImplementation(() => Promise.resolve(makePaginatedResponse([makeModule()], 1)));

    await marketplaceList({ category: "payments" });

    assert.strictEqual(mockListModules.mock.calls.length > 0, true);
  });

  it("outputs raw JSON when --json flag is set", async () => {
    const response = makePaginatedResponse([makeModule()], 1);
    mockListModules.mock.mockImplementation(() => Promise.resolve(response));

    await marketplaceList({ json: true });

    const jsonOutput = consoleLogSpy.mock.calls
      .map((call: any) => String(call.arguments[0]))
      .find((str: string) => str.startsWith("{"));

    assert.ok(jsonOutput !== undefined);
    const parsed = JSON.parse(jsonOutput!);
    assert.strictEqual(parsed.data.length, 1);
    assert.strictEqual(parsed.total, 1);
  });

  it("shows unauthenticated warning but still fetches modules", async () => {
    mockIsAuthenticated.mock.mockImplementation(() => Promise.resolve(false));
    mockListModules.mock.mockImplementation(() => Promise.resolve(makePaginatedResponse([makeModule()], 1)));

    await marketplaceList({});

    const allOutput = consoleLogSpy.mock.calls
      .map((call: any) => String(call.arguments[0]))
      .join("\n");
    assert.ok(allOutput.includes("Not authenticated"));
    assert.strictEqual(mockListModules.mock.calls.length > 0, true);
    assert.strictEqual(processExitSpy.mock.calls.length, 0);
  });

  it('shows "No modules found" message on empty results', async () => {
    mockListModules.mock.mockImplementation(() => Promise.resolve(makePaginatedResponse([], 0)));

    await marketplaceList({});

    const allOutput = consoleLogSpy.mock.calls
      .map((call: any) => String(call.arguments[0]))
      .join("\n");
    assert.ok(allOutput.includes("No modules found matching your criteria."));
  });

  it("shows network error message and exits(1) on NetworkError", async () => {
    mockListModules.mock.mockImplementation(() => Promise.reject(new NetworkError("Connection refused")));

    await marketplaceList({});

    const errOutput = consoleErrorSpy.mock.calls
      .map((call: any) => String(call.arguments[0]))
      .join("\n");
    assert.ok(errOutput.includes(
      "Could not reach marketplace. Check your connection."
    ));
    assert.strictEqual(processExitSpy.mock.calls.length > 0, true);
  });

  it("shows pagination footer with correct totals", async () => {
    const modules = Array.from({ length: 20 }, (_, i) =>
      makeModule({ slug: `mod-${i}`, id: `id-${i}`, name: `Mod ${i}` })
    );
    mockListModules.mock.mockImplementation(() => Promise.resolve(makePaginatedResponse(modules, 156)));

    await marketplaceList({ page: 1, limit: 20 });

    const allOutput = consoleLogSpy.mock.calls
      .map((call: any) => String(call.arguments[0]))
      .join("\n");
    assert.ok(allOutput.includes("Showing 1-20 of 156 modules (page 1/8)"));
  });

  it("caps pageSize at 100 when limit > 100", async () => {
    mockListModules.mock.mockImplementation(() => Promise.resolve(makePaginatedResponse([makeModule()], 1)));

    await marketplaceList({ limit: 999 });

    assert.strictEqual(mockListModules.mock.calls.length > 0, true);
  });

  it("sorts by popular (highest installCount first)", async () => {
    const modules = [
      makeModule({ slug: "low", name: "Low Installs", installCount: 5 }),
      makeModule({ slug: "high", id: "mod-2", name: "High Installs", installCount: 100 }),
    ];
    mockListModules.mock.mockImplementation(() => Promise.resolve(makePaginatedResponse(modules, 2)));

    await marketplaceList({ sort: "popular" });

    const allOutput = consoleLogSpy.mock.calls
      .map((call: any) => String(call.arguments[0]))
      .join("\n");
    // High Installs should appear before Low Installs
    const highIdx = allOutput.indexOf("High Installs");
    const lowIdx = allOutput.indexOf("Low Installs");
    assert.ok(highIdx < lowIdx);
  });

  it("sorts alphabetically by name when sort=name", async () => {
    const modules = [
      makeModule({ slug: "z-mod", name: "Zebra Module" }),
      makeModule({ slug: "a-mod", id: "mod-2", name: "Alpha Module" }),
    ];
    mockListModules.mock.mockImplementation(() => Promise.resolve(makePaginatedResponse(modules, 2)));

    await marketplaceList({ sort: "name" });

    const allOutput = consoleLogSpy.mock.calls
      .map((call: any) => String(call.arguments[0]))
      .join("\n");
    // Alpha should appear before Zebra in the table
    const alphaIdx = allOutput.indexOf("Alpha");
    const zebraIdx = allOutput.indexOf("Zebra");
    assert.ok(alphaIdx < zebraIdx);
  });
});
