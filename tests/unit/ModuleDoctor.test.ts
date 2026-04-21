import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
    expect(errors).toHaveLength(0);
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

    expect(missingHooksError).toBeDefined();
    expect(missingHooksError!.severity).toBe("error");
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

    expect(missingInjection).toBeDefined();
    expect(missingInjection!.fixable).toBe(true);
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

    expect(missingDep).toBeDefined();
    expect(missingDep!.severity).toBe("warning");
  });
});
