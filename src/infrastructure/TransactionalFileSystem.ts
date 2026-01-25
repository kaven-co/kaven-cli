import fs from "fs-extra";
import path from "path";
import { glob } from "glob";

export class TransactionalFileSystem {
  private backupDir: string;
  private backupId: string;
  private filesToBackup: string[] = [];

  constructor(
    private projectRoot: string,
    backupDir = ".agent/backups",
  ) {
    this.backupDir = path.join(projectRoot, backupDir);
    this.backupId = `backup_${Date.now()}`;
  }

  async backup(filePaths: string[]): Promise<void> {
    const backupPath = path.join(this.backupDir, this.backupId);
    await fs.ensureDir(backupPath);

    for (const file of filePaths) {
      const absolutePath = path.resolve(this.projectRoot, file);

      if (!(await fs.pathExists(absolutePath))) {
        throw new Error(`File not found for backup: ${file}`);
      }

      const relativePath = path.relative(this.projectRoot, absolutePath);
      const backupFile = path.join(backupPath, relativePath);

      await fs.ensureDir(path.dirname(backupFile));
      await fs.copy(absolutePath, backupFile);

      this.filesToBackup.push(absolutePath);
    }

    console.log(`📦 Backup created: ${this.backupId}`);
  }

  async rollback(): Promise<void> {
    const backupPath = path.join(this.backupDir, this.backupId);

    if (!(await fs.pathExists(backupPath))) {
      throw new Error(`Backup not found: ${this.backupId}`);
    }

    const files = await glob(`${backupPath}/**/*`, { nodir: true });

    for (const backupFile of files) {
      const relativePath = path.relative(backupPath, backupFile);
      const targetFile = path.join(this.projectRoot, relativePath);

      await fs.ensureDir(path.dirname(targetFile));
      await fs.copy(backupFile, targetFile, { overwrite: true });
    }

    console.log(`♻️  Rollback complete: ${this.backupId}`);
  }

  async commit(): Promise<void> {
    const backupPath = path.join(this.backupDir, this.backupId);

    if (await fs.pathExists(backupPath)) {
      await fs.remove(backupPath);
    }

    console.log(`✅ Transaction committed`);
  }

  getBackupId(): string {
    return this.backupId;
  }

  async cleanup(): Promise<void> {
    if (!(await fs.pathExists(this.backupDir))) return;
    
    const backups = await fs.readdir(this.backupDir);
    const now = Date.now();
    const weekInMs = 7 * 24 * 60 * 60 * 1000;

    for (const backup of backups) {
      const match = backup.match(/backup_(\d+)/);
      if (match) {
        const timestamp = parseInt(match[1]);
        if (now - timestamp > weekInMs) {
          await fs.remove(path.join(this.backupDir, backup));
        }
      }
    }
  }
}
