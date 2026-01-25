import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TransactionalFileSystem } from "../../src/infrastructure/TransactionalFileSystem";
import fs from "fs-extra";
import path from "path";
import os from "os";

describe("TransactionalFileSystem", () => {
  let testDir: string;
  let tx: TransactionalFileSystem;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `kaven-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.ensureDir(testDir);
    tx = new TransactionalFileSystem(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it("should create backup of files", async () => {
    const testFile = path.join(testDir, "test.txt");
    await fs.writeFile(testFile, "original content");

    await tx.backup(["test.txt"]);

    const backupPath = path.join(
      testDir,
      ".agent/backups",
      tx.getBackupId(),
      "test.txt",
    );

    expect(await fs.pathExists(backupPath)).toBe(true);
    expect(await fs.readFile(backupPath, "utf-8")).toBe("original content");
  });

  it("should rollback changes", async () => {
    const testFile = path.join(testDir, "test.txt");
    await fs.writeFile(testFile, "original");

    await tx.backup(["test.txt"]);
    await fs.writeFile(testFile, "modified");

    await tx.rollback();
    expect(await fs.readFile(testFile, "utf-8")).toBe("original");
  });

  it("should commit and remove backup", async () => {
    const testFile = path.join(testDir, "test.txt");
    await fs.writeFile(testFile, "content");

    await tx.backup(["test.txt"]);
    const backupPath = path.join(testDir, ".agent/backups", tx.getBackupId());

    await tx.commit();
    expect(await fs.pathExists(backupPath)).toBe(false);
  });

  it("should handle nested files", async () => {
    const nestedFile = path.join(testDir, "src/modules/payments.ts");
    await fs.ensureDir(path.dirname(nestedFile));
    await fs.writeFile(nestedFile, "code");

    await tx.backup(["src/modules/payments.ts"]);
    await fs.writeFile(nestedFile, "modified code");
    await tx.rollback();

    expect(await fs.readFile(nestedFile, "utf-8")).toBe("code");
  });

  it("should throw if backing up non-existent file", async () => {
    await expect(tx.backup(["nonexistent.txt"])).rejects.toThrow(
      "File not found",
    );
  });
});
