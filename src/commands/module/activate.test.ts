import { describe, it, expect, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { SchemaActivator, KAVEN_MODULES } from "../../core/SchemaActivator";

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

  // ─── exists() ───────────────────────────────────────────

  describe("exists()", () => {
    it("retorna true quando schema existe", async () => {
      tmpDir = await setupProjectDir("// schema");
      const activator = new SchemaActivator(tmpDir);
      expect(await activator.exists()).toBe(true);
    });

    it("retorna false quando schema não existe", async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kaven-test-"));
      const activator = new SchemaActivator(tmpDir);
      expect(await activator.exists()).toBe(false);
    });
  });

  // ─── getModuleStatus() com marcadores ──────────────────

  describe("getModuleStatus() com marcadores BEGIN/END", () => {
    it("detecta módulo ativo (linhas descomentadas)", async () => {
      tmpDir = await setupProjectDir(schemaWithMarkers("billing", true));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      const status = await activator.getModuleStatus(def);
      expect(status.active).toBe(true);
      expect(status.hasMarkers).toBe(true);
    });

    it("detecta módulo inativo (linhas comentadas)", async () => {
      tmpDir = await setupProjectDir(schemaWithMarkers("billing", false));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      const status = await activator.getModuleStatus(def);
      expect(status.active).toBe(false);
      expect(status.hasMarkers).toBe(true);
    });
  });

  // ─── getModuleStatus() sem marcadores ──────────────────

  describe("getModuleStatus() sem marcadores", () => {
    it("detecta módulo ativo pelo nome do model", async () => {
      tmpDir = await setupProjectDir(schemaWithoutMarkers(true));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "projects")!;

      const status = await activator.getModuleStatus(def);
      expect(status.active).toBe(true);
      expect(status.hasMarkers).toBe(false);
    });

    it("detecta módulo inativo quando todos os models estão comentados", async () => {
      tmpDir = await setupProjectDir(schemaWithoutMarkers(false));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "projects")!;

      const status = await activator.getModuleStatus(def);
      expect(status.active).toBe(false);
      expect(status.hasMarkers).toBe(false);
    });
  });

  // ─── activateModule() ──────────────────────────────────

  describe("activateModule()", () => {
    it("descomenta o bloco do módulo", async () => {
      tmpDir = await setupProjectDir(schemaWithMarkers("billing", false));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      await activator.activateModule(def);

      const statusAfter = await activator.getModuleStatus(def);
      expect(statusAfter.active).toBe(true);
    });

    it("remove apenas um nível de comentário por linha", async () => {
      const BEGIN = "// [KAVEN_MODULE:BILLING BEGIN]";
      const END = "// [KAVEN_MODULE:BILLING END]";
      // Linha com dois níveis de comentário
      const schema = `${BEGIN}\n// // model Invoice {}\n${END}\n`;
      tmpDir = await setupProjectDir(schema);
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      await activator.activateModule(def);

      const content = await fs.readFile(
        path.join(tmpDir, "packages", "database", "prisma", "schema.extended.prisma"),
        "utf-8",
      );
      // Deve remover apenas o primeiro nível
      expect(content).toContain("// model Invoice {}");
    });

    it("lança erro se marcadores não existem", async () => {
      tmpDir = await setupProjectDir("// schema sem marcadores");
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      await expect(activator.activateModule(def)).rejects.toThrow();
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

      expect(before).toBe(after);
    });
  });

  // ─── deactivateModule() ────────────────────────────────

  describe("deactivateModule()", () => {
    it("comenta o bloco do módulo", async () => {
      tmpDir = await setupProjectDir(schemaWithMarkers("billing", true));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      await activator.deactivateModule(def);

      const statusAfter = await activator.getModuleStatus(def);
      expect(statusAfter.active).toBe(false);
    });

    it("lança erro se marcadores não existem", async () => {
      tmpDir = await setupProjectDir("// schema sem marcadores");
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      await expect(activator.deactivateModule(def)).rejects.toThrow();
    });

    it("não adiciona duplo comentário em linhas já comentadas", async () => {
      // Inicia com o módulo já inativo — desativar de novo não deve duplicar //
      tmpDir = await setupProjectDir(schemaWithMarkers("billing", false));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      await activator.deactivateModule(def);

      const content = await fs.readFile(
        path.join(tmpDir, "packages", "database", "prisma", "schema.extended.prisma"),
        "utf-8",
      );
      // Não deve ter `// //`
      expect(content).not.toContain("// //");
    });
  });

  // ─── activate → deactivate → activate (round-trip) ────

  describe("round-trip activate → deactivate → activate", () => {
    it("schema permanece válido após ciclo completo", async () => {
      tmpDir = await setupProjectDir(schemaWithMarkers("billing", true));
      const activator = new SchemaActivator(tmpDir);
      const def = KAVEN_MODULES.find((m) => m.id === "billing")!;

      // Desativa
      await activator.deactivateModule(def);
      const afterDeactivate = await activator.getModuleStatus(def);
      expect(afterDeactivate.active).toBe(false);

      // Reativa
      await activator.activateModule(def);
      const afterActivate = await activator.getModuleStatus(def);
      expect(afterActivate.active).toBe(true);
    });
  });
});

// ============================================================
// KAVEN_MODULES — definições
// ============================================================

describe("KAVEN_MODULES definitions", () => {
  it("todos os módulos têm id, label, models e dependsOn", () => {
    for (const m of KAVEN_MODULES) {
      expect(m.id).toBeTruthy();
      expect(m.label).toBeTruthy();
      expect(Array.isArray(m.models)).toBe(true);
      expect(m.models.length).toBeGreaterThan(0);
      expect(Array.isArray(m.dependsOn)).toBe(true);
    }
  });

  it("ids de dependências são válidos (referenciáveis)", () => {
    const ids = new Set(KAVEN_MODULES.map((m) => m.id));
    for (const m of KAVEN_MODULES) {
      for (const dep of m.dependsOn) {
        expect(ids.has(dep)).toBe(true);
      }
    }
  });

  it("billing tem 6 models", () => {
    const billing = KAVEN_MODULES.find((m) => m.id === "billing")!;
    expect(billing.models).toHaveLength(6);
  });

  it("projects tem Project e Task", () => {
    const projects = KAVEN_MODULES.find((m) => m.id === "projects")!;
    expect(projects.models).toContain("Project");
    expect(projects.models).toContain("Task");
  });
});
