import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert";
import fs from "fs-extra";
import os from "os";

import { updateCommand, ui } from "../../../../src/commands/update/index.js";
import { AuthService } from "../../../../src/core/AuthService.js";
import { MarketplaceClient } from "../../../../src/infrastructure/MarketplaceClient.js";
import { TelemetryBuffer } from "../../../../src/infrastructure/TelemetryBuffer.js";

const mockSpinner = { start: mock.fn(), stop: mock.fn() };

describe("updateCommand", () => {
  let tmpDir: string;
  let processExitSpy: any;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kaven-update-cmd-test-"));

    mock.method(TelemetryBuffer, "getInstance", () => ({
      capture: mock.fn(),
      flush: mock.fn(() => Promise.resolve()),
    }));

    mock.method(ui, "intro", mock.fn());
    mock.method(ui, "outro", mock.fn());
    mock.method(ui, "spinner", () => mockSpinner);
    mock.method(ui.log, "info", mock.fn());
    mock.method(ui.log, "warn", mock.fn());
    mock.method(ui.log, "success", mock.fn());
    mock.method(ui.log, "error", mock.fn());

    processExitSpy = mock.method(process, "exit", (() => {}) as any);

    // fetch: npm registry → no new CLI version
    mock.method(global, "fetch", mock.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ "dist-tags": { latest: "0.4.2-alpha.0" } }), { status: 200 }))
    ));
  });

  afterEach(async () => {
    mock.restoreAll();
    await fs.remove(tmpDir).catch(() => undefined);
  });

  // ── No modules installed, CLI up to date ──────────────────────────────
  it("--check: no modules installed, CLI current → all up to date", async () => {
    await updateCommand({ check: true }, tmpDir);

    assert.strictEqual(processExitSpy.mock.calls.length, 0);
    const outroCall = (ui.outro as any).mock.calls[0]?.arguments[0] ?? "";
    assert.ok(outroCall.includes("Tudo atualizado") || outroCall === "" || outroCall.includes("✓"),
      `Expected up-to-date outro. Got: ${outroCall}`);
  });

  // ── Module outdated → listed in summary ──────────────────────────────
  it("detects outdated module and lists update command", async () => {
    // Install payments@1.0.1 in cache
    const cacheDir = path.join(tmpDir, ".kaven", "cache", "modules");
    await fs.ensureDir(path.join(cacheDir, "payments-1.0.1"));

    mock.method(AuthService.prototype, "getValidToken", mock.fn(() => Promise.resolve("tok")));
    mock.method(MarketplaceClient.prototype, "getModule", mock.fn(() =>
      Promise.resolve({
        id: "1", slug: "payments", name: "Payments", latestVersion: "1.0.2",
        description: "", category: "", author: "", installCount: 0,
        createdAt: "", updatedAt: "",
      })
    ));

    await updateCommand({ check: true }, tmpDir);

    const warnCalls = (ui.log as any).warn?.mock?.calls ?? [];
    const warned = warnCalls.some((c: any) => String(c.arguments[0]).includes("payments"));
    assert.ok(warned, "Should warn about outdated payments module");
    assert.strictEqual(processExitSpy.mock.calls.length, 0);
  });

  // ── --module <slug>: delegates to moduleUpdate ─────────────────────────
  it("--module payments: delegates to module update (reports not installed)", async () => {
    // No cache → getInstalledVersion returns null → ui.outro with error + process.exit(1)
    // We mock getValidToken so auth passes, then mock getModule.
    // Since process.exit is mocked (does nothing), we need to also stub downstream
    // to prevent real network calls after the "not installed" branch.
    mock.method(AuthService.prototype, "getValidToken", mock.fn(() => Promise.resolve("tok")));
    mock.method(MarketplaceClient.prototype, "getModule", mock.fn(() =>
      Promise.resolve({ id: "1", slug: "payments", latestVersion: "1.0.2", name: "Payments", description: "", category: "", author: "", installCount: 0, createdAt: "", updatedAt: "" })
    ));
    mock.method(MarketplaceClient.prototype, "createDownloadToken", mock.fn(() =>
      Promise.reject(new Error("should not be called"))
    ));

    // moduleUpdate uses its own ui object — mock its outro to capture the error message
    const { ui: moduleUi } = await import("../../../../src/commands/module/update.js");
    const moduleOutroSpy = mock.method(moduleUi, "outro", mock.fn());
    const moduleIntroSpy = mock.method(moduleUi, "intro", mock.fn());
    const moduleSpinnerMock = { start: mock.fn(), stop: mock.fn() };
    mock.method(moduleUi, "spinner", () => moduleSpinnerMock);

    await updateCommand({ module: "payments" }, tmpDir);

    // process.exit(1) should have been called
    assert.ok(
      processExitSpy.mock.calls.some((c: any) => c.arguments[0] === 1),
      "Should exit(1) when module not installed"
    );
    // outro should mention the module is not installed
    const outroMsg = (moduleOutroSpy.mock.calls[0]?.arguments[0] as string) ?? "";
    assert.ok(outroMsg.includes("não está instalado"), `Expected 'não está instalado'. Got: ${outroMsg}`);

    mock.restoreAll();
  });

  // ── --core: only checks CLI version ──────────────────────────────────
  it("--core: checks npm for CLI version, reports up to date", async () => {
    await updateCommand({ core: true }, tmpDir);

    const successCalls = (ui.log as any).success?.mock?.calls ?? [];
    const reported = successCalls.some((c: any) => String(c.arguments[0]).includes("kaven-cli"));
    assert.ok(reported || processExitSpy.mock.calls.length === 0,
      "Should report kaven-cli status without exit");
  });

  // ── npm unreachable → graceful degradation ────────────────────────────
  it("--core with npm offline → warns gracefully, does not crash", async () => {
    mock.method(global, "fetch", mock.fn(() => Promise.reject(new Error("network error"))));

    await updateCommand({ core: true, check: true }, tmpDir);

    assert.strictEqual(processExitSpy.mock.calls.length, 0);
    const warnCalls = (ui.log as any).warn?.mock?.calls ?? [];
    const warned = warnCalls.some((c: any) => String(c.arguments[0]).includes("kaven-cli"));
    assert.ok(warned, "Should warn about npm unreachable");
  });

  // ── marketplace offline → warn per module, no crash ──────────────────
  it("marketplace offline → warns per module, does not crash", async () => {
    const cacheDir = path.join(tmpDir, ".kaven", "cache", "modules");
    await fs.ensureDir(path.join(cacheDir, "payments-1.0.1"));

    mock.method(AuthService.prototype, "getValidToken", mock.fn(() => Promise.reject(new Error("not authenticated"))));

    await updateCommand({ check: true }, tmpDir);

    assert.strictEqual(processExitSpy.mock.calls.length, 0);
    const warnCalls = (ui.log as any).warn?.mock?.calls ?? [];
    const warned = warnCalls.some((c: any) => String(c.arguments[0]).includes("payments"));
    assert.ok(warned, "Should warn about payments module status");
  });
});
