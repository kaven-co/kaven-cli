import path from "node:path";
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert';
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { SchemaActivator, KAVEN_MODULES } from "../../core/SchemaActivator.js";

// ============================================================
// Helpers de fixture
// ============================================================

function schemaWithMarkers(moduleId: string, active: boolean): string {
  const BEGIN = `// [KAVEN_MODULE:${moduleId.toUpperCase()} BEGIN]`;
  const END = `// [KAVEN_MODULE:${moduleId.toUpperCase()} END]`;

  const modelBlock = active
    ? `model Invoice {
  id String @id @default(cuid())
  tenantId String @map("tenant_id")
}`
    : `// model Invoice {
//   id String @id @default(cuid())
//   tenantId String @map("tenant_id")
// }`;

  return `// Schema base\n\n${BEGIN}\n${modelBlock}\n${END}\n`;
}

function schemaWithoutMarkers(active: boolean): string {
  if (active) {
    return `// Schema base\n\nmodel Project {\n  id String @id @default(cuid())\n}\n`;
  }
  return `// Schema base\n\n// model Project {\n//   id String @id @default(cuid())\n// }\n`;
}

async function setupProjectDir(schemaContent: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kaven-test-"));
  const prismaDir = path.join(tmpDir, "packages", "database", "prisma");
  await fs.ensureDir(prismaDir);
  await fs.writeFile(
    path.join(prismaDir, "schema.extended.prisma"),
    schemaContent,
    "utf-8",
  );
  return tmpDir;
}

// ============================================================
// SchemaActivator — testes unitários
// ============================================================

describe("SchemaActivator", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  describe("exists()", () => {
    it("retorna true quando schema existe", async () => {
      tmpDir = await setupProjectDir("// schema");
      const activator = new SchemaActivator(tmpDir);
      assert.strictEqual(await activator.exists(), true);
    });

    it("retorna false quando schema não existe", async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kaven-test-"));
      const activator = new SchemaActivator(tmpDir);
      assert.strictEqual(await activator.exists(), false);
    });
  });

  describe("getModuleStatus() com marcadores BEGIN/END", () => {
    it("detecta módulo ativo (linhas descomentadas)", async () => {
      tmpDir = await setupProjectDir(schemaWithMarkers("billing", true));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      const status = await activator.getModuleStatus(def);
      assert.strictEqual(status.active, true);
      assert.strictEqual(status.hasMarkers, true);
    });

    it("detecta módulo inativo (linhas comentadas)", async () => {
      tmpDir = await setupProjectDir(schemaWithMarkers("billing", false));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      const status = await activator.getModuleStatus(def);
      assert.strictEqual(status.active, false);
      assert.strictEqual(status.hasMarkers, true);
    });
  });

  describe("getModuleStatus() sem marcadores", () => {
    it("detecta módulo ativo pelo nome do model", async () => {
      tmpDir = await setupProjectDir(schemaWithoutMarkers(true));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "projects")!;

      const status = await activator.getModuleStatus(def);
      assert.strictEqual(status.active, true);
      assert.strictEqual(status.hasMarkers, false);
    });

    it("detecta módulo inativo quando todos os models estão comentados", async () => {
      tmpDir = await setupProjectDir(schemaWithoutMarkers(false));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "projects")!;

      const status = await activator.getModuleStatus(def);
      assert.strictEqual(status.active, false);
      assert.strictEqual(status.hasMarkers, false);
    });
  });

  describe("activateModule()", () => {
    it("descomenta o bloco do módulo", async () => {
      tmpDir = await setupProjectDir(schemaWithMarkers("billing", false));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      await activator.activateModule(def);

      const statusAfter = await activator.getModuleStatus(def);
      assert.strictEqual(statusAfter.active, true);
    });

    it("remove apenas um nível de comentário por linha", async () => {
      const BEGIN = "// [KAVEN_MODULE:BILLING BEGIN]";
      const END = "// [KAVEN_MODULE:BILLING END]";
      const schema = `${BEGIN}\n// // model Invoice {}\n${END}\n`;
      tmpDir = await setupProjectDir(schema);
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      await activator.activateModule(def);

      const content = await fs.readFile(
        path.join(tmpDir, "packages", "database", "prisma", "schema.extended.prisma"),
        "utf-8",
      );
      assert.ok(content.includes("// model Invoice {}"));
    });

    it("lança erro se marcadores não existem", async () => {
      tmpDir = await setupProjectDir("// schema sem marcadores");
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      await assert.rejects(
        async () => { await activator.activateModule(def); },
        /não possui uma seção marcada/
      );
    });

    it("é idempotente — ativar um módulo já ativo não altera o schema", async () => {
      tmpDir = await setupProjectDir(schemaWithMarkers("billing", true));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      const before = await fs.readFile(
        path.join(tmpDir, "packages", "database", "prisma", "schema.extended.prisma"),
        "utf-8",
      );

      await activator.activateModule(def);

      const after = await fs.readFile(
        path.join(tmpDir, "packages", "database", "prisma", "schema.extended.prisma"),
        "utf-8",
      );

      assert.strictEqual(before, after);
    });
  });

  describe("deactivateModule()", () => {
    it("comenta o bloco do módulo", async () => {
      tmpDir = await setupProjectDir(schemaWithMarkers("billing", true));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      await activator.deactivateModule(def);

      const statusAfter = await activator.getModuleStatus(def);
      assert.strictEqual(statusAfter.active, false);
    });

    it("lança erro se marcadores não existem", async () => {
      tmpDir = await setupProjectDir("// schema sem marcadores");
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      await assert.rejects(
        async () => { await activator.deactivateModule(def); },
        /não possui uma seção marcada/
      );
    });

    it("não adiciona duplo comentário em linhas já comentadas", async () => {
      tmpDir = await setupProjectDir(schemaWithMarkers("billing", false));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      await activator.deactivateModule(def);

      const content = await fs.readFile(
        path.join(tmpDir, "packages", "database", "prisma", "schema.extended.prisma"),
        "utf-8",
      );
      assert.strictEqual(content.includes("// //"), false, "Não deve conter duplo comentário");
    });
  });

  describe("round-trip activate → deactivate → activate", () => {
    it("schema permanece válido após ciclo completo", async () => {
      tmpDir = await setupProjectDir(schemaWithMarkers("billing", true));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      await activator.deactivateModule(def);
      assert.strictEqual((await activator.getModuleStatus(def)).active, false);

      await activator.activateModule(def);
      assert.strictEqual((await activator.getModuleStatus(def)).active, true);
    });
  });
});

describe("KAVEN_MODULES definitions", () => {
  it("todos os módulos têm id, label, models e dependsOn", () => {
    for (const m of KAVEN_MODULES) {
      assert.ok(m.id);
      assert.ok(m.label);
      assert.strictEqual(Array.isArray(m.models), true);
      assert.ok(m.models.length > 0);
      assert.strictEqual(Array.isArray(m.dependsOn), true);
    }
  });

  it("ids de dependências são válidos (referenciáveis)", () => {
    const ids = new Set(KAVEN_MODULES.map((m) => m.id));
    for (const m of KAVEN_MODULES) {
      for (const dep of m.dependsOn) {
        assert.strictEqual(ids.has(dep), true);
      }
    }
  });

  it("billing tem 6 models", () => {
    const billing = KAVEN_MODULES.find((m) => m.id === "billing")!;
    assert.strictEqual(billing.models.length, 6);
  });

  it("projects tem Project e Task", () => {
    const projects = KAVEN_MODULES.find((m) => m.id === "projects")!;
    assert.ok(projects.models.includes("Project"));
    assert.ok(projects.models.includes("Task"));
  });
});
