import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import fs from "fs-extra";
import path from "path";
import os from "os";

describe("E2E: kaven module add/remove", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kaven-add-remove-test-"));
    
    // Criar um arquivo alvo para injeção
    await fs.writeFile(
      path.join(tmpDir, "routes.ts"),
      "// ROUTES_ANCHOR\nexport const routes = [];",
    );
  });

  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it("deve adicionar e remover um módulo com sucesso", async () => {
    const manifest = {
      name: "test-module",
      version: "1.0.0",
      kaven: {
        id: "module-abc",
      },
      dependencies: {
        npm: [],
        peerModules: [],
        kavenVersion: ">=0.1.0",
      },
      files: {
        backend: [],
        frontend: [],
        database: [],
      },
      injections: [
        {
          file: "routes.ts",
          anchor: "// ROUTES_ANCHOR",
          code: "console.log('injected');",
          moduleName: "test-module",
        },
      ],
      scripts: {
        postInstall: null,
        preRemove: null,
      },
      env: [],
    };

    const manifestPath = path.join(tmpDir, "module.json");
    await fs.writeJson(manifestPath, manifest);

    // Importações dinâmicas
    const { moduleAdd } = await import("../../src/commands/module/add.js");
    const { moduleRemove } = await import("../../src/commands/module/remove.js");

    // 1. Instalação
    await moduleAdd(manifestPath, tmpDir);

    // Verificar injeção
    const contentAfterAdd = await fs.readFile(
      path.join(tmpDir, "routes.ts"),
      "utf-8",
    );
    assert.ok(contentAfterAdd.includes("// [KAVEN_MODULE:test-module BEGIN]"));
    assert.ok(contentAfterAdd.includes("console.log('injected');"));

    // Verificar kaven.json
    const config = await fs.readJson(path.join(tmpDir, "kaven.json"));
    assert.strictEqual(config.modules["test-module"], "1.0.0");

    // Verificar cache do manifest
    assert.strictEqual(await fs.pathExists(path.join(tmpDir, ".kaven/modules/test-module/module.json")), true);

    // 2. Remoção
    await moduleRemove("test-module", tmpDir);

    // Verificar limpeza
    const contentAfterRemove = await fs.readFile(
      path.join(tmpDir, "routes.ts"),
      "utf-8",
    );
    assert.ok(!contentAfterRemove.includes("// [KAVEN_MODULE:test-module]"));
    assert.ok(contentAfterRemove.includes("// ROUTES_ANCHOR"));
    assert.ok(contentAfterRemove.includes("export const routes = [];"));

    // Verificar kaven.json limpo
    const configAfter = await fs.readJson(path.join(tmpDir, "kaven.json"));
    assert.strictEqual(configAfter.modules["test-module"], undefined);

    // Verificar cache deletado
    assert.strictEqual(await fs.pathExists(path.join(tmpDir, ".kaven/modules/test-module")), false);
  });
});
