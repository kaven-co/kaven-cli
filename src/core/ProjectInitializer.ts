import fs from "fs-extra";
import path from "path";
import { spawn } from "child_process";

export interface InitOptions {
  defaults?: boolean;
  skipInstall?: boolean;
  skipGit?: boolean;
  force?: boolean;
  withSquad?: boolean;
  dbUrl?: string;
  emailProvider?: string;
  locale?: string;
  currency?: string;
  template?: string;
}

export interface InitPromptAnswers {
  dbUrl: string;
  emailProvider: string;
  locale: string;
  currency: string;
}

const TEMPLATE_REPO = "https://github.com/kaven-co/kaven-template.git";
const KAVEN_SQUAD_REPO = "https://github.com/bychrisr/kaven-squad";

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

  /** Clone the template (from Git or local path) into targetDir. */
  async cloneTemplate(targetDir: string, templateSource?: string): Promise<void> {
    const source = templateSource || TEMPLATE_REPO;
    console.log(`[INIT] Clone Source: ${source}`);
    console.log(`[INIT] Target Dir: ${targetDir}`);
    
    // If it's a local path that exists, copy it instead of cloning
    if (await fs.pathExists(source) && (source.startsWith("/") || source.startsWith("./") || source.startsWith("../"))) {
      console.log(`[INIT] Local Path Detected. Copying...`);
      await fs.copy(source, targetDir, {
        filter: (src) => !src.includes("node_modules") && !src.includes(".git") && !src.includes(".turbo")
      });
      console.log(`[INIT] Local Copy Done.`);
      return;
    }

    const exitCode = await runCommand(
      "git",
      ["clone", "--depth", "1", source, targetDir],
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
      "packages/database/prisma/schema.prisma",
      "apps/api/package.json",
      "apps/admin/package.json",
      "apps/tenant/package.json",
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

    // Safety net: directly update root package.json name field regardless of placeholder
    const pkgPath = path.join(targetDir, "package.json");
    if (await fs.pathExists(pkgPath)) {
      const pkg = await fs.readJson(pkgPath);
      if (pkg.name !== values.projectName) {
        pkg.name = values.projectName;
        await fs.writeJson(pkgPath, pkg, { spaces: 2 });
      }
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

  /**
   * Clone kaven-squad into squads/kaven-squad/ inside the project.
   * Returns { installed: true } on success, { installed: false, reason } on failure.
   * Never throws — squad installation is non-fatal.
   */
  async installSquad(
    targetDir: string
  ): Promise<{ installed: boolean; reason?: string }> {
    const squadsDir = path.join(targetDir, "squads");
    const squadDir = path.join(squadsDir, "kaven-squad");

    // Squad already present — skip
    if (await fs.pathExists(squadDir)) {
      return { installed: false, reason: "already-exists" };
    }

    await fs.ensureDir(squadsDir);

    const exitCode = await runCommand(
      "git",
      ["clone", "--depth", "1", KAVEN_SQUAD_REPO, squadDir],
      process.cwd()
    );

    if (exitCode !== 0) {
      return {
        installed: false,
        reason: `git clone exited with code ${exitCode}`,
      };
    }

    // Remove .git — squad history not needed in user project
    const squadGitDir = path.join(squadDir, ".git");
    if (await fs.pathExists(squadGitDir)) {
      await fs.remove(squadGitDir);
    }

    return { installed: true };
  }

  /** Health check after project initialization. */
  async healthCheck(
    targetDir: string
  ): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check key files exist
    const requiredFiles = ["package.json", ".env.example", "packages/database/prisma/schema.prisma"];
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
