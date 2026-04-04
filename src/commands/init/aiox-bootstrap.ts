import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import ora from "ora";
import chalk from "chalk";

/**
 * Options for AIOX environment bootstrap
 */
export interface BootstrapOptions {
  skipAiox?: boolean;
}

/**
 * Runs the AIOX environment bootstrap process.
 * This identifies the project stack and generates .aiox/ runtime configs.
 */
export async function runEnvironmentBootstrap(
  projectDir: string,
  options: BootstrapOptions = {}
): Promise<void> {
  if (options.skipAiox) return;

  // Check if AIOX Core is installed
  const aioxCorePath = path.join(projectDir, ".aiox-core");
  if (!fs.existsSync(aioxCorePath)) {
    // If not found in .aiox-core, check if it's a symlink (Dev environment)
    const isDevLink = fs.existsSync(path.join(projectDir, ".aiox"));
    if (!isDevLink) {
      return; // Silent skip if AIOX is not present
    }
  }

  const spinner = ora("Bootstrapping AIOX environment...").start();

  try {
    // The AIOX Core exposes a CLI at bin/aiox.js
    // We call: node .aiox-core/bin/aiox.js devops environment-bootstrap --quiet
    
    // Determine the bin path
    const binPath = fs.existsSync(path.join(projectDir, ".aiox-core/bin/aiox.js"))
      ? ".aiox-core/bin/aiox.js"
      : ".aiox/bin/aiox.js"; // Fallback for dev symlink

    execSync(`node ${binPath} devops environment-bootstrap --quiet`, {
      cwd: projectDir,
      stdio: "pipe",
      timeout: 60000, // 1 minute timeout
    });

    spinner.succeed("AIOX environment bootstrapped");
  } catch (error) {
    spinner.warn("AIOX environment bootstrap failed");
    console.log(
      chalk.yellow(
        "  ⚠  Run manually inside the project: kaven aiox bootstrap"
      )
    );
    if (process.env.KAVEN_DEBUG) {
      console.error(chalk.gray(`  Error: ${(error as Error).message}`));
    }
  }
}
