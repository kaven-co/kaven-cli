import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import { ModuleDoctor } from "../../src/core/ModuleDoctor.js";
import { MarkerService } from "../../src/core/MarkerService.js";
import { ManifestParser } from "../../src/core/ManifestParser.js";
import fs from "fs-extra";
import path from "path";
import os from "os";

describe("ModuleDoctor", () => {
  let testDir: string;
  let doctor: ModuleDoctor;

  beforeEach(async () => {
    testDir = path.join(
      os.tmpdir(),
      `doctor-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.ensureDir(testDir);

    // Setup estrutura padrão esperada pela CLI
    await fs.ensureDir(path.join(testDir, "apps/api/src"));

    await fs.writeFile(
      path.join(testDir, "apps/api/src/app.ts"),
      "// [KAVEN_MODULE_IMPORTS]\n// [KAVEN_MODULE_HOOKS]\n// [KAVEN_MODULE_REGISTRATION]\n",
    );

    const markerService = new MarkerService();
    const manifestParser = new ManifestParser();
    doctor = new ModuleDoctor(testDir, markerService, manifestParser);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it("should detect all anchors present", async () => {
    const results = await doctor.checkAnchors();
    const errors = results.filter((r) => r.severity === "error");
    assert.strictEqual(errors.length, 0);
  });

  it("should detect missing anchor", async () => {
    await fs.writeFile(
      path.join(testDir, "apps/api/src/app.ts"),
      "// Only one anchor\n// [KAVEN_MODULE_IMPORTS]\n",
    );

    const results = await doctor.checkAnchors();
    const missingHooksError = results.find((r) =>
      r.message.includes("KAVEN_MODULE_HOOKS"),
    );

    assert.ok(missingHooksError !== undefined);
    assert.strictEqual(missingHooksError!.severity, "error");
  });

  it("should detect missing module injection", async () => {
    // Configurar kaven.json
    await fs.writeJSON(path.join(testDir, "kaven.json"), {
      modules: [{ name: "payments", version: "1.0.0", installed: true }],
    });

    // Criar manifest fictício
    const modulePath = path.join(testDir, ".kaven/modules/payments");
    await fs.ensureDir(modulePath);
    await fs.writeJSON(path.join(modulePath, "module.json"), {
      name: "payments",
      version: "1.0.0",
      dependencies: { npm: [] },
      files: { backend: [] },
      injections: [
        {
          file: "apps/api/src/app.ts",
          anchor: "// [KAVEN_MODULE_IMPORTS]",
          moduleName: "payments",
          code: "some code",
        },
      ],
      scripts: { postInstall: null, preRemove: null },
      env: [],
    });

    // O arquivo app.ts tem a âncora mas NÃO tem o código injetado (marcas BEGIN/END)
    const results = await doctor.checkMarkers();
    const missingInjection = results.find((r) =>
      r.message.includes("not injected"),
    );

    assert.ok(missingInjection !== undefined);
    assert.strictEqual(missingInjection!.fixable, true);
  });

  it("should detect missing npm dependencies", async () => {
    await fs.writeJSON(path.join(testDir, "kaven.json"), {
      modules: [{ name: "payments", version: "1.0.0", installed: true }],
    });

    const modulePath = path.join(testDir, ".kaven/modules/payments");
    await fs.ensureDir(modulePath);
    await fs.writeJSON(path.join(modulePath, "module.json"), {
      name: "payments",
      version: "1.0.0",
      dependencies: { npm: ["stripe@^14.0.0"] },
      files: { backend: [] },
      injections: [],
      scripts: { postInstall: null, preRemove: null },
      env: [],
    });

    // package.json vazio
    await fs.writeJSON(path.join(testDir, "package.json"), {
      dependencies: {},
    });

    const results = await doctor.checkDependencies();
    const missingDep = results.find((r) => r.message.includes("stripe"));

    assert.ok(missingDep !== undefined);
    assert.strictEqual(missingDep!.severity, "warning");
  });
});
