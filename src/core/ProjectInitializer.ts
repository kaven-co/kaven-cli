import fs from "fs-extra";
import path from "path";
import { spawn } from "child_process";

export interface InitOptions {
  defaults?: boolean;
  skipInstall?: boolean;
  skipGit?: boolean;
  force?: boolean;
  dbUrl?: string;
  emailProvider?: string;
  locale?: string;
  currency?: string;
}

export interface InitPromptAnswers {
  dbUrl: string;
  emailProvider: string;
  locale: string;
  currency: string;
}

const TEMPLATE_REPO = "https://github.com/kaven-co/kaven-template.git";

/** Run a shell command via spawn, returning exit code. */
function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  onData?: (chunk: string) => void
): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: onData ? "pipe" : "inherit" });

    if (onData && proc.stdout) {
      proc.stdout.on("data", (d: Buffer) => onData(d.toString()));
    }
    if (onData && proc.stderr) {
      proc.stderr.on("data", (d: Buffer) => onData(d.toString()));
    }

    proc.on("error", reject);
    proc.on("close", (code) => resolve(code ?? 0));
  });
}

export class ProjectInitializer {
  /** Validate that the project name only contains alphanumerics and hyphens. */
  validateName(name: string): { valid: boolean; reason?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, reason: "Project name cannot be empty" };
    }
    if (/\s/.test(name)) {
      return { valid: false, reason: "Project name cannot contain spaces" };
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
      return {
        valid: false,
        reason:
          "Project name must only contain lowercase letters, numbers, and hyphens",
      };
    }
    return { valid: true };
  }

  /** Clone the template repo with --depth 1 into targetDir. */
  async cloneTemplate(targetDir: string): Promise<void> {
    const exitCode = await runCommand(
      "git",
      ["clone", "--depth", "1", TEMPLATE_REPO, targetDir],
      process.cwd()
    );

    if (exitCode !== 0) {
      throw new Error(`git clone failed with exit code ${exitCode}`);
    }
  }

  /** Remove the .git directory from the cloned project. */
  async removeGitDir(targetDir: string): Promise<void> {
    const gitDir = path.join(targetDir, ".git");
    if (await fs.pathExists(gitDir)) {
      await fs.remove(gitDir);
    }
  }

  /** Replace placeholders in key project files. */
  async replacePlaceholders(
    targetDir: string,
    values: InitPromptAnswers & { projectName: string }
  ): Promise<void> {
    const replacements: Record<string, string> = {
      "{{PROJECT_NAME}}": values.projectName,
      "{{DATABASE_URL}}": values.dbUrl,
      "{{DEFAULT_LOCALE}}": values.locale,
      "{{DEFAULT_CURRENCY}}": values.currency,
    };

    const filesToProcess = [
      "package.json",
      ".env.example",
      "prisma/schema.prisma",
      "apps/api/package.json",
    ];

    for (const relFile of filesToProcess) {
      const filePath = path.join(targetDir, relFile);
      if (!(await fs.pathExists(filePath))) continue;

      let content = await fs.readFile(filePath, "utf-8");
      for (const [placeholder, value] of Object.entries(replacements)) {
        content = content.split(placeholder).join(value);
      }
      await fs.writeFile(filePath, content, "utf-8");
    }
  }

  /** Run pnpm install in the target directory. */
  async runInstall(targetDir: string): Promise<void> {
    const exitCode = await runCommand("pnpm", ["install"], targetDir);
    if (exitCode !== 0) {
      throw new Error(`pnpm install failed with exit code ${exitCode}`);
    }
  }

  /** Initialize git and create an initial commit. */
  async initGit(targetDir: string): Promise<void> {
    await runCommand("git", ["init"], targetDir);
    await runCommand("git", ["add", "."], targetDir);
    await runCommand(
      "git",
      ["commit", "-m", "chore: initial kaven setup"],
      targetDir
    );
  }

  /** Health check after project initialization. */
  async healthCheck(
    targetDir: string
  ): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check key files exist
    const requiredFiles = ["package.json", ".env.example", "prisma/schema.prisma"];
    for (const file of requiredFiles) {
      if (!(await fs.pathExists(path.join(targetDir, file)))) {
        issues.push(`Missing required file: ${file}`);
      }
    }

    // Check node_modules exists (if install was run)
    const hasNodeModules = await fs.pathExists(path.join(targetDir, "node_modules"));
    if (!hasNodeModules) {
      issues.push(
        "Dependencies not installed. Run: pnpm install"
      );
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }
}
