import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import { TransactionalFileSystem } from "../../src/infrastructure/TransactionalFileSystem.js";
import fs from "fs-extra";
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

    assert.strictEqual(await fs.pathExists(backupPath), true);
    assert.strictEqual(await fs.readFile(backupPath, "utf-8"), "original content");
  });

  it("should rollback changes", async () => {
    const testFile = path.join(testDir, "test.txt");
    await fs.writeFile(testFile, "original");

    await tx.backup(["test.txt"]);
    await fs.writeFile(testFile, "modified");

    await tx.rollback();
    assert.strictEqual(await fs.readFile(testFile, "utf-8"), "original");
  });

  it("should commit and remove backup", async () => {
    const testFile = path.join(testDir, "test.txt");
    await fs.writeFile(testFile, "content");

    await tx.backup(["test.txt"]);
    const backupPath = path.join(testDir, ".agent/backups", tx.getBackupId());

    await tx.commit();
    assert.strictEqual(await fs.pathExists(backupPath), false);
  });

  it("should handle nested files", async () => {
    const nestedFile = path.join(testDir, "src/modules/payments.ts");
    await fs.ensureDir(path.dirname(nestedFile));
    await fs.writeFile(nestedFile, "code");

    await tx.backup(["src/modules/payments.ts"]);
    await fs.writeFile(nestedFile, "modified code");
    await tx.rollback();

    assert.strictEqual(await fs.readFile(nestedFile, "utf-8"), "code");
  });

  it("should throw if backing up non-existent file", async () => {
    await assert.rejects(async () => { await tx.backup(["nonexistent.txt"]); }, { message: 
      "File not found for backup: nonexistent.txt",
     });
  });
});
