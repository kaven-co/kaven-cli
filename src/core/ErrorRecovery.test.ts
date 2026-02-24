import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import fs from "fs-extra";
import { ErrorRecovery } from "./ErrorRecovery";

describe("C2.7: Error Recovery", () => {
  let tempDir: string;
  let projectDir: string;
  let originalHome: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `kaven-recovery-test-${Date.now()}`);
    projectDir = path.join(tempDir, "project");
    await fs.ensureDir(projectDir);

    originalHome = process.env.HOME || "";
    process.env.HOME = tempDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await fs.remove(tempDir);
  });

  it("C2.7.1: Should create backup", async () => {
    const recovery = new ErrorRecovery();

    // Setup project
    await fs.writeJson(path.join(projectDir, "package.json"), { name: "test" });
    await fs.ensureDir(path.join(projectDir, "prisma"));
    await fs.writeFile(path.join(projectDir, "prisma", "schema.prisma"), "");

    const backupPath = await recovery.createBackup(projectDir, "test-operation");

    expect(await fs.pathExists(backupPath)).toBe(true);
    expect(await fs.pathExists(path.join(backupPath, "package.json"))).toBe(true);
  });

  it("C2.7.2: Should validate pre-conditions", async () => {
    const recovery = new ErrorRecovery();

    // Empty project - should fail
    const result1 = await recovery.validatePreConditions(projectDir);
    expect(result1.valid).toBe(false);

    // Setup proper project
    await fs.writeJson(path.join(projectDir, "package.json"), { name: "test" });
    await fs.ensureDir(path.join(projectDir, "node_modules"));
    await fs.ensureDir(path.join(projectDir, ".git"));

    const result2 = await recovery.validatePreConditions(projectDir);
    expect(result2.valid).toBe(true);
  });

  it("C2.7.3: Should validate post-conditions", async () => {
    const recovery = new ErrorRecovery();

    // Setup minimal project
    await fs.writeJson(path.join(projectDir, "package.json"), {
      name: "test",
    });
    await fs.ensureDir(path.join(projectDir, "prisma"));
    await fs.writeFile(path.join(projectDir, "prisma", "schema.prisma"), "datasource db");
    await fs.writeFile(path.join(projectDir, ".env.example"), "");

    const result = await recovery.validatePostConditions(projectDir);
    expect(result.healthy).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it("C2.7.4: Should list backups", async () => {
    const recovery = new ErrorRecovery();

    // Create a backup
    await fs.writeJson(path.join(projectDir, "package.json"), { name: "test" });
    await recovery.createBackup(projectDir, "op1");

    const backups = await recovery.listBackups();
    expect(backups.length).toBeGreaterThan(0);
  });

  it("C2.7.5: Should cleanup old backups", async () => {
    const recovery = new ErrorRecovery();

    // Create multiple backups
    for (let i = 0; i < 7; i++) {
      await fs.ensureDir(path.join(projectDir));
      await fs.writeJson(path.join(projectDir, "package.json"), { name: "test" });
      await recovery.createBackup(projectDir, `op${i}`);

      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));
    }

    let backups = await recovery.listBackups();
    const originalCount = backups.length;

    // Cleanup keeping only 3
    await recovery.cleanupBackups(3);

    backups = await recovery.listBackups();
    expect(backups.length).toBeLessThanOrEqual(3);
    expect(backups.length).toBeLessThan(originalCount);
  });

  it("C2.7.6: Should detect invalid package.json", async () => {
    const recovery = new ErrorRecovery();

    await fs.writeFile(path.join(projectDir, "package.json"), "{ invalid json");

    const result = await recovery.validatePostConditions(projectDir);
    expect(result.healthy).toBe(false);
    expect(result.issues.some((i) => i.includes("invalid JSON"))).toBe(true);
  });
});
