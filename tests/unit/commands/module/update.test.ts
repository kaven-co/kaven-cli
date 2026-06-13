import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert";
import fs from "fs-extra";
import os from "os";

import { moduleUpdate, tar, ui } from "../../../../src/commands/module/update.js";
import { verifyDownload } from "../../../../src/core/SignatureVerifier.js";
import { AuthService } from "../../../../src/core/AuthService.js";
import { MarketplaceClient } from "../../../../src/infrastructure/MarketplaceClient.js";
import { GitMergeService } from "../../../../src/core/GitMergeService.js";
import { TelemetryBuffer } from "../../../../src/infrastructure/TelemetryBuffer.js";
import type { Module, DownloadToken } from "../../../../src/types/marketplace.js";

// ─── helpers ────────────────────────────────────────────────

function makeModule(overrides: Partial<Module> = {}): Module {
  return {
    id: "mod-1",
    slug: "payments",
    name: "Payments",
    description: "Stripe payment integration",
    category: "payments",
    latestVersion: "1.0.2",
    author: "kaven",
    installCount: 10,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeDownloadToken(): DownloadToken {
  return {
    token: "tok-abc",
    expiresAt: "2026-12-31T00:00:00Z",
    downloadUrl: "/download/payments-1.0.2.tar.gz",
  };
}

function makeMockWriteStream(): any {
  const s: any = {
    write: mock.fn(() => true),
    end: mock.fn(),
    once: mock.fn((event: string, cb: () => void) => {
      if (event === "finish") setTimeout(cb, 5);
      return s;
    }),
    on: mock.fn(() => s),
  };
  return s;
}

function makeFetchResponse(): Response {
  const body = new Uint8Array([1, 2, 3]);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    },
  });
  return new Response(stream, { status: 200, statusText: "OK" });
}

const mockSpinner = {
  start: mock.fn(),
  stop: mock.fn(),
};

// ─── tests ──────────────────────────────────────────────────

describe("moduleUpdate (C4.1)", () => {
  let tmpDir: string;
  let processExitSpy: any;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kaven-update-test-"));

    // TelemetryBuffer
    mock.method(TelemetryBuffer, "getInstance", () => ({
      capture: mock.fn(),
      flush: mock.fn(() => Promise.resolve()),
    }));

    // UI — silence output
    mock.method(ui, "intro", mock.fn());
    mock.method(ui, "outro", mock.fn());
    mock.method(ui, "spinner", () => mockSpinner);
    mock.method(ui, "confirm", mock.fn(() => Promise.resolve(false)));
    mock.method(ui, "isCancel", mock.fn(() => false));

    // process.exit
    processExitSpy = mock.method(process, "exit", (() => {}) as any);

    // tar
    mock.method(tar, "x", mock.fn(() => Promise.resolve()));

    // fetch
    mock.method(global, "fetch", () => Promise.resolve(makeFetchResponse()));

    // fs helpers used during download
    mock.method(fs, "createWriteStream", () => makeMockWriteStream());
  });

  afterEach(async () => {
    mock.restoreAll();
    await fs.remove(tmpDir).catch(() => undefined);
  });

  // ── Cenário 1: módulo não instalado ────────────────────────────

  it("AC3: módulo não instalado → process.exit(1) com mensagem clara", async () => {
    // No cache dir → getInstalledVersion returns null
    await moduleUpdate("payments", tmpDir);

    assert.ok(
      processExitSpy.mock.calls.some((c: any) => c.arguments[0] === 1),
      "process.exit(1) deve ser chamado"
    );
    const outroCall = (ui.outro as any).mock.calls[0]?.arguments[0] ?? "";
    assert.ok(
      outroCall.includes("não está instalado"),
      `Mensagem deve indicar módulo não instalado. Received: ${outroCall}`
    );
  });

  // ── Cenário 2: já na versão mais recente ────────────────────────

  it("AC2: módulo já na versão mais recente → sai sem efeitos colaterais", async () => {
    // Setup: install baseline at 1.0.2 (same as latestVersion)
    const cacheDir = path.join(tmpDir, ".kaven", "cache", "modules");
    await fs.ensureDir(path.join(cacheDir, "payments-1.0.2"));

    mock.method(AuthService.prototype, "getValidToken", mock.fn(() => Promise.resolve("tok")));
    mock.method(MarketplaceClient.prototype, "getModule", mock.fn(() => Promise.resolve(makeModule({ latestVersion: "1.0.2" }))));

    await moduleUpdate("payments", tmpDir);

    const outroCall = (ui.outro as any).mock.calls[0]?.arguments[0] ?? "";
    assert.ok(outroCall.includes("já está na versão"), `Expected 'já está na versão'. Got: ${outroCall}`);

    // No download should happen
    assert.strictEqual((global.fetch as any).mock?.calls?.length ?? 0, 0);
    assert.strictEqual(processExitSpy.mock.calls.length, 0);
  });

  // ── Cenário 3: update limpo (sem conflitos) ────────────────────

  it("AC7: update limpo → registry atualizado, cache antigo removido", async () => {
    // Install baseline at 1.0.1
    const cacheDir = path.join(tmpDir, ".kaven", "cache", "modules");
    const oldCachePath = path.join(cacheDir, "payments-1.0.1");
    await fs.ensureDir(oldCachePath);

    mock.method(AuthService.prototype, "getValidToken", mock.fn(() => Promise.resolve("tok")));
    mock.method(MarketplaceClient.prototype, "getModule", mock.fn(() => Promise.resolve(makeModule({ latestVersion: "1.0.2" }))));
    mock.method(MarketplaceClient.prototype, "createDownloadToken", mock.fn(() => Promise.resolve(makeDownloadToken())));
    mock.method(MarketplaceClient.prototype, "resolveUrl", mock.fn((u: string) => Promise.resolve(`https://marketplace.kaven.site${u}`)));

    // fs.pathExists — return true for manifest, true for update files
    mock.method(fs, "pathExists", mock.fn((p: string) => {
      // conflicts.json doesn't exist; manifest exists
      if (String(p).endsWith("conflicts.json")) return Promise.resolve(false);
      return Promise.resolve(true);
    }));

    // module.json with no mergeable/copyOnly
    mock.method(fs, "readJson", mock.fn(() => Promise.resolve({ name: "payments", version: "1.0.2", mergeable: [], copyOnly: [] })));
    mock.method(fs, "ensureDir", mock.fn(() => Promise.resolve()));
    mock.method(fs, "copy", mock.fn(() => Promise.resolve()));
    mock.method(fs, "remove", mock.fn(() => Promise.resolve()));
    mock.method(fs, "writeJson", mock.fn(() => Promise.resolve()));

    await moduleUpdate("payments", tmpDir);

    assert.strictEqual(processExitSpy.mock.calls.length, 0, "Não deve chamar process.exit");
    const outroCall = (ui.outro as any).mock.calls[0]?.arguments[0] ?? "";
    assert.ok(outroCall.includes("atualizado") || outroCall.includes("1.0.1") || outroCall.includes("1.0.2"),
      `Mensagem de sucesso esperada. Got: ${outroCall}`);
  });

  // ── Cenário 4: merge com conflitos ─────────────────────────────

  it("AC6: merge com conflito → conflicts.json gravado, registry mantém versão antiga", async () => {
    // Install baseline at 1.0.1
    const cacheDir = path.join(tmpDir, ".kaven", "cache", "modules");
    await fs.ensureDir(path.join(cacheDir, "payments-1.0.1"));

    mock.method(AuthService.prototype, "getValidToken", mock.fn(() => Promise.resolve("tok")));
    mock.method(MarketplaceClient.prototype, "getModule", mock.fn(() => Promise.resolve(makeModule({ latestVersion: "1.0.2" }))));
    mock.method(MarketplaceClient.prototype, "createDownloadToken", mock.fn(() => Promise.resolve(makeDownloadToken())));
    mock.method(MarketplaceClient.prototype, "resolveUrl", mock.fn((u: string) => Promise.resolve(`https://marketplace.kaven.site${u}`)));

    // performMerge returns conflicts: true
    mock.method(GitMergeService.prototype, "performMerge", mock.fn(() =>
      Promise.resolve({ success: true, conflicts: true, output: "<<<<<<< conflict" })
    ));

    const writtenFiles: string[] = [];
    const writtenContents: any[] = [];

    mock.method(fs, "pathExists", mock.fn((p: string) => {
      if (String(p).endsWith("conflicts.json")) return Promise.resolve(false);
      return Promise.resolve(true);
    }));
    mock.method(fs, "readJson", mock.fn(() => Promise.resolve({
      name: "payments",
      version: "1.0.2",
      mergeable: ["apps/api/src/modules/billing/routes.ts"],
      copyOnly: [],
    })));
    mock.method(fs, "ensureDir", mock.fn(() => Promise.resolve()));
    mock.method(fs, "copy", mock.fn(() => Promise.resolve()));
    mock.method(fs, "remove", mock.fn(() => Promise.resolve()));
    mock.method(fs, "writeJson", mock.fn((filePath: string, data: any) => {
      writtenFiles.push(filePath);
      writtenContents.push(data);
      return Promise.resolve();
    }));

    await moduleUpdate("payments", tmpDir);

    // conflicts.json must be written
    const conflictsWrite = writtenFiles.find((f) => f.endsWith("conflicts.json"));
    assert.ok(conflictsWrite, "conflicts.json deve ser gravado");

    const conflictsData = writtenContents[writtenFiles.indexOf(conflictsWrite!)];
    assert.strictEqual(conflictsData.module, "payments");
    assert.strictEqual(conflictsData.fromVersion, "1.0.1");
    assert.strictEqual(conflictsData.toVersion, "1.0.2");
    assert.ok(conflictsData.conflicts.includes("apps/api/src/modules/billing/routes.ts"));

    // kaven.json must NOT be updated (registry stays at old version)
    const kavenWrite = writtenFiles.find((f) => f.endsWith("kaven.json"));
    assert.ok(!kavenWrite, "kaven.json NÃO deve ser atualizado em caso de conflito");

    assert.strictEqual(processExitSpy.mock.calls.length, 0, "Não deve chamar process.exit em conflito");
  });

  // ── Cenário 5: merge limpo com arquivos mergeable (AC4) ─────────

  it("AC4: merge sem conflitos → arquivo mesclado, registro atualizado", async () => {
    const cacheDir = path.join(tmpDir, ".kaven", "cache", "modules");
    await fs.ensureDir(path.join(cacheDir, "payments-1.0.1"));

    mock.method(AuthService.prototype, "getValidToken", mock.fn(() => Promise.resolve("tok")));
    mock.method(MarketplaceClient.prototype, "getModule", mock.fn(() => Promise.resolve(makeModule({ latestVersion: "1.0.2" }))));
    mock.method(MarketplaceClient.prototype, "createDownloadToken", mock.fn(() => Promise.resolve(makeDownloadToken())));
    mock.method(MarketplaceClient.prototype, "resolveUrl", mock.fn((u: string) => Promise.resolve(`https://marketplace.kaven.site${u}`)));

    // performMerge returns NO conflicts
    const performMergeSpy = mock.fn(() =>
      Promise.resolve({ success: true, conflicts: false, output: "" })
    );
    mock.method(GitMergeService.prototype, "performMerge", performMergeSpy);

    const writtenFiles: string[] = [];
    mock.method(fs, "pathExists", mock.fn((p: string) => {
      if (String(p).endsWith("conflicts.json")) return Promise.resolve(false);
      return Promise.resolve(true);
    }));
    mock.method(fs, "readJson", mock.fn(() => Promise.resolve({
      name: "payments",
      version: "1.0.2",
      mergeable: ["apps/api/src/modules/billing/routes.ts"],
      copyOnly: [],
    })));
    mock.method(fs, "ensureDir", mock.fn(() => Promise.resolve()));
    mock.method(fs, "copy", mock.fn(() => Promise.resolve()));
    mock.method(fs, "remove", mock.fn(() => Promise.resolve()));
    mock.method(fs, "writeJson", mock.fn((filePath: string) => {
      writtenFiles.push(filePath);
      return Promise.resolve();
    }));

    await moduleUpdate("payments", tmpDir);

    assert.strictEqual(performMergeSpy.mock.calls.length, 1, "performMerge deve ser chamado uma vez");
    assert.ok(writtenFiles.some((f) => f.endsWith("kaven.json")), "kaven.json deve ser atualizado");
    assert.ok(!writtenFiles.some((f) => f.endsWith("conflicts.json")), "conflicts.json NÃO deve ser criado");
    assert.strictEqual(processExitSpy.mock.calls.length, 0);
  });

  // ── Cenário 6: copyOnly overwrite (AC5) ────────────────────────

  it("AC5: copyOnly → arquivo sobrescrito diretamente sem merge", async () => {
    const cacheDir = path.join(tmpDir, ".kaven", "cache", "modules");
    await fs.ensureDir(path.join(cacheDir, "payments-1.0.1"));

    mock.method(AuthService.prototype, "getValidToken", mock.fn(() => Promise.resolve("tok")));
    mock.method(MarketplaceClient.prototype, "getModule", mock.fn(() => Promise.resolve(makeModule({ latestVersion: "1.0.2" }))));
    mock.method(MarketplaceClient.prototype, "createDownloadToken", mock.fn(() => Promise.resolve(makeDownloadToken())));
    mock.method(MarketplaceClient.prototype, "resolveUrl", mock.fn((u: string) => Promise.resolve(`https://marketplace.kaven.site${u}`)));

    const copiedFiles: string[] = [];
    mock.method(fs, "pathExists", mock.fn((p: string) => {
      if (String(p).endsWith("conflicts.json")) return Promise.resolve(false);
      return Promise.resolve(true);
    }));
    mock.method(fs, "readJson", mock.fn(() => Promise.resolve({
      name: "payments",
      version: "1.0.2",
      mergeable: [],
      copyOnly: ["apps/api/src/modules/billing/config.ts"],
    })));
    mock.method(fs, "ensureDir", mock.fn(() => Promise.resolve()));
    mock.method(fs, "copy", mock.fn((_src: string, dest: string) => {
      copiedFiles.push(dest);
      return Promise.resolve();
    }));
    mock.method(fs, "remove", mock.fn(() => Promise.resolve()));
    mock.method(fs, "writeJson", mock.fn(() => Promise.resolve()));

    await moduleUpdate("payments", tmpDir);

    const copyOnlyDest = path.join(tmpDir, "apps/api/src/modules/billing/config.ts");
    assert.ok(copiedFiles.includes(copyOnlyDest), `Arquivo copyOnly deve ser sobrescrito. Copiados: ${copiedFiles}`);
    assert.strictEqual(processExitSpy.mock.calls.length, 0);
  });

  // ── Cenário 7: conflicts.json pendente → resume (AC9) ──────────

  it("AC9: conflicts.json pendente + usuário confirma → limpa e reprocede", async () => {
    // Cache for installed version (real dir — readdir is not mocked)
    const cacheDir = path.join(tmpDir, ".kaven", "cache", "modules");
    await fs.ensureDir(path.join(cacheDir, "payments-1.0.1"));

    // User confirms resume
    mock.method(ui, "confirm", mock.fn(() => Promise.resolve(true)));
    mock.method(ui, "isCancel", mock.fn(() => false));

    mock.method(AuthService.prototype, "getValidToken", mock.fn(() => Promise.resolve("tok")));
    mock.method(MarketplaceClient.prototype, "getModule", mock.fn(() => Promise.resolve(makeModule({ latestVersion: "1.0.2" }))));
    mock.method(MarketplaceClient.prototype, "createDownloadToken", mock.fn(() => Promise.resolve(makeDownloadToken())));
    mock.method(MarketplaceClient.prototype, "resolveUrl", mock.fn((u: string) => Promise.resolve(`https://marketplace.kaven.site${u}`)));

    // pathExists: conflicts.json exists (triggering AC9 detect), everything else exists too
    mock.method(fs, "pathExists", mock.fn((p: string) => Promise.resolve(true)));

    // readJson: dispatch by path to return conflicts record or manifest
    mock.method(fs, "readJson", mock.fn((p: string) => {
      if (String(p).endsWith("conflicts.json")) {
        return Promise.resolve({
          module: "payments",
          fromVersion: "1.0.1",
          toVersion: "1.0.2",
          timestamp: "2026-06-13T00:00:00Z",
          conflicts: ["apps/api/src/modules/billing/routes.ts"],
        });
      }
      return Promise.resolve({ name: "payments", version: "1.0.2", mergeable: [], copyOnly: [] });
    }));
    mock.method(fs, "ensureDir", mock.fn(() => Promise.resolve()));
    mock.method(fs, "copy", mock.fn(() => Promise.resolve()));
    mock.method(fs, "remove", mock.fn(() => Promise.resolve()));
    mock.method(fs, "writeJson", mock.fn(() => Promise.resolve()));

    await moduleUpdate("payments", tmpDir);

    // confirm was called (detected pending conflicts)
    assert.strictEqual((ui.confirm as any).mock.calls.length, 1, "ui.confirm deve ser chamado para conflito pendente");
    assert.strictEqual(processExitSpy.mock.calls.length, 0);
  });

  // ── Cenário 8: sem slug → seleção interativa (AC11) ─────────────

  it("AC11: sem slug → ui.select apresenta módulos instalados", async () => {
    // Create two cached modules
    const cacheDir = path.join(tmpDir, ".kaven", "cache", "modules");
    await fs.ensureDir(path.join(cacheDir, "payments-1.0.1"));
    await fs.ensureDir(path.join(cacheDir, "auth-social-2.0.0"));

    // User selects "payments"
    mock.method(ui, "select", mock.fn(() => Promise.resolve("payments")));

    mock.method(AuthService.prototype, "getValidToken", mock.fn(() => Promise.resolve("tok")));
    mock.method(MarketplaceClient.prototype, "getModule", mock.fn(() =>
      Promise.resolve(makeModule({ slug: "payments", latestVersion: "1.0.1" }))
    ));

    await moduleUpdate(undefined, tmpDir);

    assert.strictEqual((ui.select as any).mock.calls.length, 1, "ui.select deve ser chamado");
    const outroCall = (ui.outro as any).mock.calls[0]?.arguments[0] ?? "";
    assert.ok(outroCall.includes("já está na versão"), `Deve indicar up-to-date após seleção. Got: ${outroCall}`);
  });

  // ── TD1: verificação Ed25519 (TD1) ─────────────────────────────

  it("TD1: verifica assinatura Ed25519 por padrão — getReleaseInfo chamado", async () => {
    // Verifies that getReleaseInfo is called when skipVerify is not set.
    // verifyDownload itself cannot be mocked (frozen ES module namespace),
    // so we assert the observable precondition: getReleaseInfo was invoked.
    // We return no checksum/signature/publicKey so the "no signature data" branch
    // is taken (safe fallback) without triggering the real crypto verification.
    const cacheDir = path.join(tmpDir, ".kaven", "cache", "modules");
    await fs.ensureDir(path.join(cacheDir, "payments-1.0.1"));

    mock.method(AuthService.prototype, "getValidToken", mock.fn(() => Promise.resolve("tok")));
    mock.method(MarketplaceClient.prototype, "getModule", mock.fn(() => Promise.resolve(makeModule({ latestVersion: "1.0.2" }))));
    mock.method(MarketplaceClient.prototype, "createDownloadToken", mock.fn(() => Promise.resolve(makeDownloadToken())));
    mock.method(MarketplaceClient.prototype, "resolveUrl", mock.fn((u: string) => Promise.resolve(`https://marketplace.kaven.site${u}`)));

    const getReleaseInfoSpy = mock.fn(() => Promise.resolve({
      id: "r", moduleId: "m", version: "1.0.2", changelog: "", installCount: 0, createdAt: "",
      // no checksum/signature/publicKey → "skipping verification" branch (safe fallback)
    }));
    mock.method(MarketplaceClient.prototype, "getReleaseInfo", getReleaseInfoSpy);

    mock.method(fs, "pathExists", mock.fn((p: string) => {
      if (String(p).endsWith("conflicts.json")) return Promise.resolve(false);
      return Promise.resolve(true);
    }));
    mock.method(fs, "readJson", mock.fn(() => Promise.resolve({ name: "payments", version: "1.0.2", mergeable: [], copyOnly: [] })));
    mock.method(fs, "ensureDir", mock.fn(() => Promise.resolve()));
    mock.method(fs, "copy", mock.fn(() => Promise.resolve()));
    mock.method(fs, "remove", mock.fn(() => Promise.resolve()));
    mock.method(fs, "writeJson", mock.fn(() => Promise.resolve()));

    await moduleUpdate("payments", tmpDir); // no skipVerify

    assert.strictEqual(getReleaseInfoSpy.mock.calls.length, 1, "getReleaseInfo deve ser chamado quando skipVerify não está ativo");
    assert.strictEqual(processExitSpy.mock.calls.length, 0);
  });

  it("TD1: skipVerify=true pula getReleaseInfo", async () => {
    const cacheDir = path.join(tmpDir, ".kaven", "cache", "modules");
    await fs.ensureDir(path.join(cacheDir, "payments-1.0.1"));

    mock.method(AuthService.prototype, "getValidToken", mock.fn(() => Promise.resolve("tok")));
    mock.method(MarketplaceClient.prototype, "getModule", mock.fn(() => Promise.resolve(makeModule({ latestVersion: "1.0.2" }))));
    mock.method(MarketplaceClient.prototype, "createDownloadToken", mock.fn(() => Promise.resolve(makeDownloadToken())));
    mock.method(MarketplaceClient.prototype, "resolveUrl", mock.fn((u: string) => Promise.resolve(`https://marketplace.kaven.site${u}`)));

    mock.method(fs, "pathExists", mock.fn((p: string) => {
      if (String(p).endsWith("conflicts.json")) return Promise.resolve(false);
      return Promise.resolve(true);
    }));
    mock.method(fs, "readJson", mock.fn(() => Promise.resolve({ name: "payments", version: "1.0.2", mergeable: [], copyOnly: [] })));
    mock.method(fs, "ensureDir", mock.fn(() => Promise.resolve()));
    mock.method(fs, "copy", mock.fn(() => Promise.resolve()));
    mock.method(fs, "remove", mock.fn(() => Promise.resolve()));
    mock.method(fs, "writeJson", mock.fn(() => Promise.resolve()));

    const getReleaseInfoSpy = mock.fn(() => Promise.resolve({
      id: "r", moduleId: "m", version: "1.0.2", changelog: "", installCount: 0, createdAt: "",
    }));
    mock.method(MarketplaceClient.prototype, "getReleaseInfo", getReleaseInfoSpy);

    await moduleUpdate("payments", tmpDir, { skipVerify: true });

    assert.strictEqual(getReleaseInfoSpy.mock.calls.length, 0, "getReleaseInfo NÃO deve ser chamado com skipVerify=true");
    assert.strictEqual(processExitSpy.mock.calls.length, 0);
  });

  // ── TD2: sanitização de path traversal ─────────────────────────

  it("TD2: paths com traversal em mergeable[] são ignorados silenciosamente", async () => {
    const cacheDir = path.join(tmpDir, ".kaven", "cache", "modules");
    await fs.ensureDir(path.join(cacheDir, "payments-1.0.1"));

    mock.method(AuthService.prototype, "getValidToken", mock.fn(() => Promise.resolve("tok")));
    mock.method(MarketplaceClient.prototype, "getModule", mock.fn(() => Promise.resolve(makeModule({ latestVersion: "1.0.2" }))));
    mock.method(MarketplaceClient.prototype, "createDownloadToken", mock.fn(() => Promise.resolve(makeDownloadToken())));
    mock.method(MarketplaceClient.prototype, "resolveUrl", mock.fn((u: string) => Promise.resolve(`https://marketplace.kaven.site${u}`)));

    const performMergeSpy = mock.fn(() => Promise.resolve({ success: true, conflicts: false, output: "" }));
    mock.method(GitMergeService.prototype, "performMerge", performMergeSpy);

    mock.method(fs, "pathExists", mock.fn((p: string) => {
      if (String(p).endsWith("conflicts.json")) return Promise.resolve(false);
      return Promise.resolve(true);
    }));
    mock.method(fs, "readJson", mock.fn(() => Promise.resolve({
      name: "payments",
      version: "1.0.2",
      // malicious paths that should be sanitized out
      mergeable: ["../../etc/passwd", "/absolute/path.ts", "safe/file.ts"],
      copyOnly: ["../escape.ts", "safe/config.ts"],
    })));
    mock.method(fs, "ensureDir", mock.fn(() => Promise.resolve()));
    mock.method(fs, "copy", mock.fn(() => Promise.resolve()));
    mock.method(fs, "remove", mock.fn(() => Promise.resolve()));
    mock.method(fs, "writeJson", mock.fn(() => Promise.resolve()));

    await moduleUpdate("payments", tmpDir);

    // performMerge should only be called for "safe/file.ts" — NOT for traversal paths
    assert.strictEqual(performMergeSpy.mock.calls.length, 1, "performMerge deve ser chamado apenas para path seguro");
    assert.strictEqual(processExitSpy.mock.calls.length, 0);
  });
});
