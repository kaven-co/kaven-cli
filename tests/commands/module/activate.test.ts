import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}));

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const emitter: any = { on: vi.fn() };
    emitter.on.mockImplementation((event: string, cb: (arg?: any) => void) => {
      if (event === "close") cb(0);
      return emitter;
    });
    return emitter;
  }),
}));

// Mock @inquirer/prompts — confirmado por padrão (usuário "pressiona Enter")
vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn().mockResolvedValue(true),
}));

import { confirm } from "@inquirer/prompts";
import { moduleActivate, moduleDeactivate, moduleListActivation } from "../../../src/commands/module/activate.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeBillingSchema(active: boolean): string {
  // SchemaActivator requires BEGIN/END markers to activate/deactivate modules
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
    vi.clearAllMocks();
    // confirm retorna true por padrão
    vi.mocked(confirm).mockResolvedValue(true);
  });

  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  // ── 1. kaven module activate billing — sucesso, schema modificado ─────────

  it("activate billing — schema modificado quando confirmado", async () => {
    tmpDir = await setupProject(makeBillingSchema(false));

    await moduleActivate("billing", tmpDir, { yes: true });

    const schemaPath = path.join(tmpDir, "packages", "database", "prisma", "schema.extended.prisma");
    const content = await fs.readFile(schemaPath, "utf-8");
    expect(content).toContain("model Invoice {");
    expect(content).not.toMatch(/^\/\/ model Invoice \{/m);
  });

  // ── 2. kaven module activate billing --skip-migrate ──────────────────────

  it("activate billing --skip-migrate — schema modificado, migrate não roda", async () => {
    const { spawn } = await import("node:child_process");
    tmpDir = await setupProject(makeBillingSchema(false));

    await moduleActivate("billing", tmpDir, { yes: true, skipMigrate: true });

    const schemaPath = path.join(tmpDir, "packages", "database", "prisma", "schema.extended.prisma");
    const content = await fs.readFile(schemaPath, "utf-8");
    expect(content).toContain("model Invoice {");
    // spawn não deve ter sido chamado (migrate skipped)
    expect(spawn).not.toHaveBeenCalled();
  });

  // ── 3. kaven module activate billing --yes — sem prompt de confirmação ────

  it("activate billing --yes — confirm() não é chamado", async () => {
    tmpDir = await setupProject(makeBillingSchema(false));

    await moduleActivate("billing", tmpDir, { yes: true, skipMigrate: true });

    expect(confirm).not.toHaveBeenCalled();
  });

  // ── 4. kaven module activate sem argumento — erro tratado ─────────────────

  it("activate com módulo inexistente — retorna sem modificar schema", async () => {
    tmpDir = await setupProject(makeBillingSchema(false));
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code?: string | number | null | undefined) => {
      throw new Error("process.exit called");
    });

    await expect(moduleActivate("nonexistent-module", tmpDir, { yes: true })).rejects.toThrow();
    exitSpy.mockRestore();
  });

  // ── 5. kaven module deactivate billing — sucesso, schema comentado ────────

  it("deactivate billing — schema comentado quando confirmado", async () => {
    tmpDir = await setupProject(makeBillingSchema(true));

    await moduleDeactivate("billing", tmpDir, { yes: true, skipMigrate: true });

    const schemaPath = path.join(tmpDir, "packages", "database", "prisma", "schema.extended.prisma");
    const content = await fs.readFile(schemaPath, "utf-8");
    expect(content).toContain("// model Invoice {");
  });

  // ── 6. kaven module list — lista módulos com status ───────────────────────

  it("list — executa sem lançar erro com schema válido", async () => {
    tmpDir = await setupProject(makeBillingSchema(true));
    // Não deve lançar exceção
    await expect(moduleListActivation(tmpDir)).resolves.toBeUndefined();
  });

  // ── 7. Dependência: ativar módulo que requer outro não-ativo → erro ────────

  it("activate com dependência inativa — encerra com erro informativo", async () => {
    // billing depende de core; montar schema SEM core models para forçar o erro
    const schemaWithoutCore = `// schema sem core\n\n// model Invoice {}\n`;
    tmpDir = await setupProject(schemaWithoutCore);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code?: string | number | null | undefined) => {
      throw new Error("process.exit called");
    });

    await expect(moduleActivate("billing", tmpDir, { yes: true })).rejects.toThrow();
    exitSpy.mockRestore();
  });

  // ── 8. Módulo já ativo — mensagem informativa, não erro ──────────────────

  it("activate módulo já ativo — retorna sem erro", async () => {
    tmpDir = await setupProject(makeBillingSchema(true));

    // Não deve lançar exceção nem chamar process.exit
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code?: string | number | null | undefined) => {
      throw new Error("process.exit called");
    });

    await expect(moduleActivate("billing", tmpDir, { yes: true })).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  // ── 9. Prompt de confirmação — aborta quando usuário recusa ──────────────

  it("activate — aborta quando usuário recusa confirmação", async () => {
    vi.mocked(confirm).mockResolvedValue(false);
    tmpDir = await setupProject(makeBillingSchema(false));

    await moduleActivate("billing", tmpDir, {}); // sem --yes

    // Schema não deve ter sido modificado
    const schemaPath = path.join(tmpDir, "packages", "database", "prisma", "schema.extended.prisma");
    const content = await fs.readFile(schemaPath, "utf-8");
    expect(content).not.toContain("\nmodel Invoice {");
  });
});
