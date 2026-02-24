import path from "path";
import fs from "fs-extra";
import os from "os";
import chalk from "chalk";
import ora from "ora";

/**
 * C2.7: Error recovery and validation system
 */
export class ErrorRecovery {
  private backupDir: string;

  constructor() {
    this.backupDir = path.join(os.homedir(), ".kaven", "backups");
  }

  /**
   * Create a backup of the project state before operation
   */
  async createBackup(projectPath: string, operationName: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
    const backupName = `${operationName}-${timestamp}`;
    const backupPath = path.join(this.backupDir, backupName);

    try {
      await fs.ensureDir(this.backupDir);

      // Backup key files
      const files = ["package.json", "pnpm-lock.yaml", ".env", "prisma/schema.prisma"];

      for (const file of files) {
        const source = path.join(projectPath, file);
        const dest = path.join(backupPath, file);

        if (await fs.pathExists(source)) {
          await fs.ensureDir(path.dirname(dest));
          await fs.copy(source, dest);
        }
      }

      return backupPath;
    } catch (error) {
      throw new Error(
        `Failed to create backup: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Rollback from backup
   */
  async rollback(projectPath: string, backupPath: string): Promise<void> {
    try {
      if (!(await fs.pathExists(backupPath))) {
        throw new Error(`Backup not found at ${backupPath}`);
      }

      const files = ["package.json", "pnpm-lock.yaml", ".env", "prisma/schema.prisma"];

      for (const file of files) {
        const source = path.join(backupPath, file);
        const dest = path.join(projectPath, file);

        if (await fs.pathExists(source)) {
          await fs.copy(source, dest, { overwrite: true });
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to rollback: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Pre-operation validation
   */
  async validatePreConditions(projectPath: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Check package.json exists
    if (!(await fs.pathExists(path.join(projectPath, "package.json")))) {
      errors.push("package.json not found");
    }

    // Check node_modules exists
    if (!(await fs.pathExists(path.join(projectPath, "node_modules")))) {
      errors.push("Dependencies not installed. Run: pnpm install");
    }

    // Check if git repo (for safety)
    const gitDir = path.join(projectPath, ".git");
    if (!(await fs.pathExists(gitDir))) {
      errors.push("Not a git repository. Initialize with: git init && git add . && git commit");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Post-operation health check
   */
  async validatePostConditions(projectPath: string): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check package.json is valid JSON
    try {
      const packageJson = await fs.readJson(path.join(projectPath, "package.json"));
      if (!packageJson.name) {
        issues.push("package.json missing name field");
      }
    } catch {
      issues.push("package.json is invalid JSON");
    }

    // Check prisma schema if it exists
    const schemaPath = path.join(projectPath, "prisma", "schema.prisma");
    if (await fs.pathExists(schemaPath)) {
      const content = await fs.readFile(schemaPath, "utf-8");
      if (!content.includes("datasource db")) {
        issues.push("prisma/schema.prisma missing datasource");
      }
    }

    // Check .env exists or .env.example exists
    const envPath = path.join(projectPath, ".env");
    const envExamplePath = path.join(projectPath, ".env.example");
    if (!(await fs.pathExists(envPath)) && !(await fs.pathExists(envExamplePath))) {
      issues.push("No .env or .env.example file found");
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  /**
   * Run operation with automatic rollback on failure
   */
  async withRollback<T>(
    projectPath: string,
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // Pre-validation
    const preCheck = await this.validatePreConditions(projectPath);
    if (!preCheck.valid) {
      throw new Error(
        `Pre-conditions not met:\n${preCheck.errors.map((e) => `  - ${e}`).join("\n")}`
      );
    }

    // Create backup
    const spinner = ora("Creating backup...").start();
    const backupPath = await this.createBackup(projectPath, operationName);
    spinner.succeed(`Backup created at ${backupPath}`);

    try {
      // Run operation
      const result = await operation();

      // Post-validation
      const postCheck = await this.validatePostConditions(projectPath);
      if (!postCheck.healthy) {
        spinner.warn("Post-operation issues detected:");
        for (const issue of postCheck.issues) {
          console.log(chalk.yellow(`  ⚠ ${issue}`));
        }
      }

      return result;
    } catch (error) {
      // Rollback on failure
      spinner.start("Rolling back...");
      try {
        await this.rollback(projectPath, backupPath);
        spinner.succeed("Rolled back successfully");
      } catch (rollbackError) {
        spinner.fail(`Rollback failed: ${rollbackError}`);
        console.error(chalk.red("Manual intervention required:"));
        console.error(chalk.gray(`Backup available at: ${backupPath}`));
      }

      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<
    Array<{ name: string; path: string; timestamp: string }>
  > {
    if (!(await fs.pathExists(this.backupDir))) {
      return [];
    }

    const entries = await fs.readdir(this.backupDir);
    return entries.map((name) => ({
      name,
      path: path.join(this.backupDir, name),
      timestamp: name.substring(name.lastIndexOf("-") + 1),
    }));
  }

  /**
   * Clean old backups (keep last N)
   */
  async cleanupBackups(keepCount: number = 5): Promise<void> {
    const backups = await this.listBackups();

    if (backups.length <= keepCount) {
      return;
    }

    const toDelete = backups.slice(keepCount);
    for (const backup of toDelete) {
      await fs.remove(backup.path);
    }
  }
}
