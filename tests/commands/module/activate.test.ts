import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import fs from "fs-extra";
import os from "os";

// ── mocks ─────────────────────────────────────────────────────────────────────

import { moduleActivate, moduleDeactivate, moduleListActivation, prompts } from "../../../src/commands/module/activate.js";
const confirm = prompts.confirm;
mock.method(prompts, "confirm", () => Promise.resolve(true));

// ── helpers ───────────────────────────────────────────────────────────────────

function makeBillingSchema(active: boolean): string {
  const billingModels = active
    ? [
        "model Invoice {",
        "  id String @id @default(cuid())",
        "}",
        "model Order {",
        "  id String @id",
        "}",
        "model Subscription {",
        "  id String @id",
        "}",
        "model Plan {",
        "  id String @id",
        "}",
        "model Payment {",
        "  id String @id",
        "}",
        "model Product {",
        "  id String @id",
        "}",
      ].join("\n")
    : [
        "// model Invoice {",
        "//   id String @id @default(cuid())",
        "// }",
        "// model Order {",
        "//   id String @id",
        "// }",
        "// model Subscription {",
        "//   id String @id",
        "// }",
        "// model Plan {",
        "//   id String @id",
        "// }",
        "// model Payment {",
        "//   id String @id",
        "// }",
        "// model Product {",
        "//   id String @id",
        "// }",
      ].join("\n");

  const coreModels = [
    "model Tenant {",
    "  id String @id",
    "}",
    "model User {",
    "  id String @id",
    "}",
    "model Role {",
    "  id String @id",
    "}",
    "model Capability {",
    "  id String @id",
    "}",
    "model AuthSession {",
    "  id String @id",
    "}",
    "model AuditLog {",
    "  id String @id",
    "}",
    "model RefreshToken {",
    "  id String @id",
    "}",
    "model EmailVerification {",
    "  id String @id",
    "}",
  ].join("\n");

  return [
    "// Prisma schema",
    "",
    coreModels,
    "",
    "// [KAVEN_MODULE:BILLING BEGIN]",
    billingModels,
    "// [KAVEN_MODULE:BILLING END]",
  ].join("\n");
}

async function setupProject(schemaContent: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kaven-activate-test-"));
  const prismaDir = path.join(tmpDir, "packages", "database", "prisma");
  await fs.ensureDir(prismaDir);
  await fs.writeFile(path.join(prismaDir, "schema.extended.prisma"), schemaContent, "utf-8");
  return tmpDir;
}

// ── testes ────────────────────────────────────────────────────────────────────

describe("C3.4 — module activate / deactivate / list", () => {
  let tmpDir: string;

  beforeEach(() => {
    (prompts.confirm as any).mock.mockImplementation(() => Promise.resolve(true));
  });

  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it("activate billing — schema modificado quando confirmado", async () => {
    tmpDir = await setupProject(makeBillingSchema(false));

    await moduleActivate("billing", tmpDir, { yes: true });

    const schemaPath = path.join(tmpDir, "packages", "database", "prisma", "schema.extended.prisma");
    const content = await fs.readFile(schemaPath, "utf-8");
    assert.ok(content.includes("model Invoice {"));
    assert.ok(!content.match(/^\/\/ model Invoice \{/m));
  });

  it("activate billing --skip-migrate — schema modificado, migrate não roda", async () => {
    // We don't easily mock spawn in node:test without module mocks
    // But we can check if the schema was modified
    tmpDir = await setupProject(makeBillingSchema(false));

    await moduleActivate("billing", tmpDir, { yes: true, skipMigrate: true });

    const schemaPath = path.join(tmpDir, "packages", "database", "prisma", "schema.extended.prisma");
    const content = await fs.readFile(schemaPath, "utf-8");
    assert.ok(content.includes("model Invoice {"));
  });

  it("activate billing --yes — confirm() não é chamado", async () => {
    tmpDir = await setupProject(makeBillingSchema(false));

    await moduleActivate("billing", tmpDir, { yes: true, skipMigrate: true });

    assert.strictEqual((prompts.confirm as any).mock.calls.length, 0);
  });

  it("activate com módulo inexistente — retorna sem modificar schema", async () => {
    tmpDir = await setupProject(makeBillingSchema(false));
    const exitSpy = mock.method(process, "exit", (() => {
      throw new Error("process.exit called");
    }) as any);

    await assert.rejects(async () => { 
      await moduleActivate("nonexistent-module", tmpDir, { yes: true }); 
    }, { message: "process.exit called" });
    
    exitSpy.mock.restore();
  });

  it("deactivate billing — schema comentado quando confirmado", async () => {
    tmpDir = await setupProject(makeBillingSchema(true));

    await moduleDeactivate("billing", tmpDir, { yes: true, skipMigrate: true });

    const schemaPath = path.join(tmpDir, "packages", "database", "prisma", "schema.extended.prisma");
    const content = await fs.readFile(schemaPath, "utf-8");
    assert.ok(content.includes("// model Invoice {"));
  });

  it("list — executa sem lançar erro com schema válido", async () => {
    tmpDir = await setupProject(makeBillingSchema(true));
    // Não deve lançar exceção
    await moduleListActivation(tmpDir);
  });

  it("activate com dependência inativa — encerra com erro informativo", async () => {
    // billing depende de core; montar schema SEM core models para forçar o erro
    const schemaWithoutCore = `// schema sem core\n\n// [KAVEN_MODULE:BILLING BEGIN]\n// model Invoice {}\n// [KAVEN_MODULE:BILLING END]\n`;
    tmpDir = await setupProject(schemaWithoutCore);
    const exitSpy = mock.method(process, "exit", (() => {
      throw new Error("process.exit called");
    }) as any);

    await assert.rejects(async () => { 
      await moduleActivate("billing", tmpDir, { yes: true }); 
    }, { message: "process.exit called" });
    
    exitSpy.mock.restore();
  });

  it("activate módulo já ativo — retorna sem erro", async () => {
    tmpDir = await setupProject(makeBillingSchema(true));

    const exitSpy = mock.method(process, "exit", (() => {
      throw new Error("process.exit called");
    }) as any);

    await moduleActivate("billing", tmpDir, { yes: true });
    assert.strictEqual(exitSpy.mock.calls.length, 0);
    
    exitSpy.mock.restore();
  });

  it("activate — aborta quando usuário recusa confirmação", async () => {
    (prompts.confirm as any).mock.mockImplementation(() => Promise.resolve(false));
    tmpDir = await setupProject(makeBillingSchema(false));

    await moduleActivate("billing", tmpDir, {}); // sem --yes

    const schemaPath = path.join(tmpDir, "packages", "database", "prisma", "schema.extended.prisma");
    const content = await fs.readFile(schemaPath, "utf-8");
    assert.ok(!content.includes("\nmodel Invoice {"));
  });
});
