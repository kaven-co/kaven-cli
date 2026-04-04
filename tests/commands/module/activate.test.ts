import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
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
import { moduleActivate, moduleDeactivate, moduleListActivation } from "../../../src/commands/module/activate";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeBillingSchema(active: boolean): string {
  const models = active
    ? `model Invoice {\n  id String @id @default(cuid())\n}\nmodel Order {\n  id String @id\n}\nmodel Subscription {\n  id String @id\n}\nmodel Plan {\n  id String @id\n}\nmodel Payment {\n  id String @id\n}\nmodel Product {\n  id String @id\n}\n`
    : `// model Invoice {\n//   id String @id @default(cuid())\n// }\n// model Order {\n//   id String @id\n// }\n// model Subscription {\n//   id String @id\n// }\n// model Plan {\n//   id String @id\n// }\n// model Payment {\n//   id String @id\n// }\n// model Product {\n//   id String @id\n// }\n`;

  const coreModels = `model Tenant {\n  id String @id\n}\nmodel User {\n  id String @id\n}\nmodel Role {\n  id String @id\n}\nmodel Capability {\n  id String @id\n}\nmodel AuthSession {\n  id String @id\n}\nmodel AuditLog {\n  id String @id\n}\nmodel RefreshToken {\n  id String @id\n}\nmodel EmailVerification {\n  id String @id\n}\n`;

  return `// Prisma schema\n\n${coreModels}\n${models}`;
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
