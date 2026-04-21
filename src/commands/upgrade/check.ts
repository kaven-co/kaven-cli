import chalk from "chalk";
import ora from "ora";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve package.json relative to this file (works in both src/ and dist/)
function getPackageJson() {
  const possiblePaths = [
    path.join(__dirname, "../../package.json"),      // src/commands/upgrade/check.ts
    path.join(__dirname, "../../../package.json"),   // dist/chunks/...
    path.join(process.cwd(), "package.json"),        // fallback to cwd
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, string>;
      } catch {
        continue;
      }
    }
  }
  return { version: "0.4.2-alpha.0" }; // Hardcoded fallback
}

const PACKAGE_JSON = getPackageJson();
const CURRENT_VERSION = PACKAGE_JSON.version;
const CLI_NAME = "kaven-cli";

/**
 * C2.3: Check for CLI updates
 */
export async function upgradeCheck(): Promise<void> {
  const spinner = ora("Checking for updates...").start();

  try {
    const response = await fetch(`https://registry.npmjs.org/${CLI_NAME}`);
    if (!response.ok) {
      spinner.fail("Could not check for updates");
      return;
    }

    const data = (await response.json()) as { "dist-tags": Record<string, string> };
    const distTags = data["dist-tags"];
    const latestVersion = distTags?.latest || CURRENT_VERSION;

    spinner.stop();

    console.log();
    console.log(chalk.bold("Version Check:"));
    console.log(`  Current:  ${chalk.cyan(CURRENT_VERSION)}`);
    console.log(`  Latest:   ${chalk.cyan(latestVersion)}`);
    console.log();

    if (latestVersion === CURRENT_VERSION) {
      console.log(chalk.green("✅ You're on the latest version!"));
      return;
    }

    const current = parseVersion(CURRENT_VERSION);
    const latest = parseVersion(latestVersion);

    if (
      latest.major > current.major ||
      (latest.major === current.major && latest.minor > current.minor) ||
      (latest.major === current.major &&
        latest.minor === current.minor &&
        latest.patch > current.patch)
    ) {
      console.log(chalk.yellow(`⚠ Update available: ${latestVersion}`));
      console.log();
      console.log(chalk.bold("To upgrade, run:"));
      console.log(chalk.cyan(`  npm install -g ${CLI_NAME}@latest`));
      console.log(chalk.cyan(`  or`));
      console.log(chalk.cyan(`  pnpm add -g ${CLI_NAME}@latest`));
      console.log();
      console.log(
        chalk.gray(
          "Release notes: https://github.com/kaven-co/kaven-cli/releases"
        )
      );
    } else {
      console.log(chalk.green("✅ You're on the latest version!"));
    }
  } catch (error) {
    spinner.fail(
      `Check failed: ${error instanceof Error ? error.message : String(error)}`
    );
    console.log(chalk.gray("You can manually check at: https://www.npmjs.com/package/kaven-cli"));
  }
}

/**
 * C2.3: Install latest CLI version
 */
export async function upgradeInstall(): Promise<void> {
  console.log();
  const spinner = ora("Fetching latest version...").start();

  try {
    const response = await fetch(`https://registry.npmjs.org/${CLI_NAME}`);
    if (!response.ok) {
      throw new Error("Failed to fetch package info");
    }

    const data = (await response.json()) as { "dist-tags": Record<string, string> };
    const distTags = data["dist-tags"];
    const latestVersion = distTags?.latest || CURRENT_VERSION;

    if (latestVersion === CURRENT_VERSION) {
      spinner.succeed("Already on latest version");
      return;
    }

    spinner.text = `Installing ${CLI_NAME}@${latestVersion}...`;

    const packageManager = process.env.npm_config_user_agent?.includes("pnpm")
      ? "pnpm"
      : "npm";

    const exitCode = await runCommand(packageManager, [
      "install",
      "-g",
      `${CLI_NAME}@${latestVersion}`,
    ]);

    if (exitCode !== 0) {
      spinner.fail(`Installation failed with exit code ${exitCode}`);
      console.error(chalk.gray(`Try: ${packageManager} install -g ${CLI_NAME}@latest`));
      process.exit(1);
      return;
    }

    spinner.succeed(`Updated to ${latestVersion}`);

    const healthSpinner = ora("Running health check...").start();
    const health = await verifyInstallation();

    if (health.ok) {
      healthSpinner.succeed("Installation verified");
      console.log();
      console.log(chalk.green("✅ CLI upgraded successfully!"));
      console.log(chalk.gray("Try: kaven --version"));
    } else {
      healthSpinner.warn("Installation verification failed");
      console.log(chalk.yellow(health.errors.join("\n")));
    }
  } catch (error) {
    spinner.fail(
      `Installation failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

async function verifyInstallation(): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    const code = await runCommand("kaven", ["--version"], { stdio: "pipe" });
    if (code !== 0) {
      errors.push("kaven command not available in PATH");
    }
  } catch {
    errors.push("Could not execute kaven command");
  }

  return { ok: errors.length === 0, errors };
}

function runCommand(
  cmd: string,
  args: string[],
  options?: Record<string, unknown>
): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, options || { stdio: "inherit" });
    proc.on("error", reject);
    proc.on("close", (code) => resolve(code ?? 0));
  });
}

function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
} {
  const cleaned = version.replace(/^v/, "").split("-")[0];
  const [major, minor, patch] = cleaned.split(".").map(Number);
  return {
    major: major || 0,
    minor: minor || 0,
    patch: patch || 0,
  };
}
