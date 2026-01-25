import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";

describe("E2E: kaven module add/remove", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `kaven-test-${Math.random().toString(36).slice(2)}`);
    await fs.ensureDir(tmpDir);

    // Criar um arquivo alvo para injeção
    await fs.writeFile(
      path.join(tmpDir, "routes.ts"),
      "// ROUTES_ANCHOR\nexport const routes = [];",
    );

    // Garantir que o projeto está buildado para o teste E2E
    // (Em um ambiente real, o vitest-register ou ts-node facilitariam,
    // mas aqui vamos assumir que o dist existe ou usar o src via ts-node se disponível)
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it("deve adicionar e remover um módulo com sucesso", async () => {
    const manifest = {
      name: "test-module",
      version: "1.0.0",
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

    // Simular o comando 'kaven module add'
    // Como estamos testando o código TypeScript, vamos importar e chamar as funções diretamente
    // para evitar a complexidade de rodar o binário compilado que pode estar desatualizado.
    
    // Importações dinâmicas para evitar carregar tudo no topo
    const { moduleAdd } = await import("../../src/commands/module/add");
    const { moduleRemove } = await import("../../src/commands/module/remove");

    // 1. Instalação
    await moduleAdd(manifestPath, tmpDir);

      // Verificar injeção
    const contentAfterAdd = await fs.readFile(
      path.join(tmpDir, "routes.ts"),
      "utf-8",
    );
    expect(contentAfterAdd).toContain("// [KAVEN_MODULE:test-module BEGIN]");
    expect(contentAfterAdd).toContain("console.log('injected');");

      // Verificar kaven.json
      const config = await fs.readJson(path.join(tmpDir, "kaven.json"));
      expect(config.modules["test-module"]).toBe("1.0.0");

      // Verificar cache do manifest
      expect(await fs.pathExists(path.join(tmpDir, ".kaven/modules/test-module/module.json"))).toBe(true);

      // 2. Remoção
      await moduleRemove("test-module", tmpDir);

      // Verificar limpeza
      const contentAfterRemove = await fs.readFile(
        path.join(tmpDir, "routes.ts"),
        "utf-8",
      );
      expect(contentAfterRemove).not.toContain("// [KAVEN_MODULE:test-module]");
      expect(contentAfterRemove).toContain("// ROUTES_ANCHOR");
      expect(contentAfterRemove).toContain("export const routes = [];");

      // Verificar kaven.json limpo
      const configAfter = await fs.readJson(path.join(tmpDir, "kaven.json"));
      expect(configAfter.modules["test-module"]).toBeUndefined();

      // Verificar cache deletado
      expect(
        await fs.pathExists(path.join(tmpDir, ".kaven/modules/test-module")),
      ).toBe(false);
  });
});
