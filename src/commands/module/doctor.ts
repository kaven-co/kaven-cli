import chalk from "chalk";
import { execSync } from "child_process";
import path from "path";
import fs from "fs-extra";
import { ModuleDoctor, DoctorCheckResult } from "../../core/ModuleDoctor";
import { MarkerService } from "../../core/MarkerService";
import { ManifestParser } from "../../core/ManifestParser";

export interface DoctorOptions {
  fix?: boolean;
  json?: boolean;
}

function severityPrefix(severity: DoctorCheckResult["severity"]): string {
  switch (severity) {
    case "error":
      return chalk.red("[ERROR]");
    case "warning":
      return chalk.yellow("[WARN] ");
    case "info":
      return chalk.cyan("[INFO] ");
    default:
      return chalk.green("[OK]   ");
  }
}

/** Attempt auto-fixes for fixable issues. */
async function applyFixes(
  results: DoctorCheckResult[],
  projectRoot: string
): Promise<void> {
  const fixable = results.filter((r) => r.fixable);

  if (fixable.length === 0) {
    console.log(chalk.gray("   No automatically fixable issues found."));
    return;
  }

  for (const result of fixable) {
    const msg = result.message.toLowerCase();

    // Missing npm deps: run pnpm install
    if (msg.includes("missing npm dependency") || msg.includes("pnpm install")) {
      console.log(chalk.blue(`  Fixing: ${result.message}`));
      try {
        execSync("pnpm install", { cwd: projectRoot, stdio: "inherit" });
        console.log(chalk.green("  ✓ pnpm install completed"));
      } catch {
        console.log(chalk.red("  ✗ pnpm install failed"));
      }
      continue;
    }

    // Stale Prisma: run prisma generate
    if (msg.includes("prisma")) {
      console.log(chalk.blue(`  Fixing: ${result.message}`));
      try {
        execSync("npx prisma generate", { cwd: projectRoot, stdio: "inherit" });
        console.log(chalk.green("  ✓ npx prisma generate completed"));
      } catch {
        console.log(chalk.red("  ✗ npx prisma generate failed"));
      }
      continue;
    }

    // Missing env vars: append placeholder
    if (msg.includes("missing env vars") && result.file === ".env") {
      const envPath = path.join(projectRoot, ".env");
      const envExamplePath = path.join(projectRoot, ".env.example");
      console.log(chalk.blue(`  Fixing: ${result.message}`));
      try {
        const exampleContent = await fs.readFile(envExamplePath, "utf-8");
        const envContent = (await fs.pathExists(envPath))
          ? await fs.readFile(envPath, "utf-8")
          : "";

        const parseKeys = (content: string): Set<string> => {
          const keys = new Set<string>();
          for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
            const key = trimmed.split("=")[0].trim();
            if (key) keys.add(key);
          }
          return keys;
        };

        const exampleKeys = parseKeys(exampleContent);
        const envKeys = parseKeys(envContent);

        let appendContent = "\n# Added by kaven doctor --fix\n";
        for (const key of exampleKeys) {
          if (!envKeys.has(key)) {
            appendContent += `${key}=PLACEHOLDER\n`;
          }
        }

        await fs.appendFile(envPath, appendContent);
        console.log(chalk.green("  ✓ Placeholder env vars appended to .env"));
      } catch {
        console.log(chalk.red("  ✗ Could not append env vars"));
      }
      continue;
    }

    // Generic fallback
    console.log(
      chalk.yellow(
        `  Manual action required: ${result.message}`
      )
    );
  }
}

export async function moduleDoctor(options: DoctorOptions): Promise<void> {
  if (!options.json) {
    console.log(chalk.blue("Running module doctor...\n"));
  }

  const markerService = new MarkerService();
  const manifestParser = new ManifestParser();
  const doctor = new ModuleDoctor(
    process.cwd(),
    markerService,
    manifestParser,
  );

  let results: DoctorCheckResult[] = [];
  try {
    results = await doctor.checkAll();
  } catch (error) {
    if (options.json) {
      console.log(
        JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error), results: [] })
      );
    } else {
      console.error(
        chalk.red(
          `[ERROR] Heavy failure during doctor audit: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
    process.exit(1);
    return;
  }

  // JSON output mode
  if (options.json) {
    const errors = results.filter((r) => r.severity === "error");
    const warnings = results.filter((r) => r.severity === "warning");
    console.log(
      JSON.stringify(
        {
          success: errors.length === 0,
          errors: errors.length,
          warnings: warnings.length,
          results,
        },
        null,
        2
      )
    );
    process.exit(errors.length > 0 ? 1 : warnings.length > 0 ? 2 : 0);
    return;
  }

  // Human-readable output
  for (const result of results) {
    const prefix = severityPrefix(result.severity);
    console.log(`${prefix} ${result.message}`);
    if (result.file) {
      console.log(chalk.gray(`         file: ${result.file}`));
    }
    if (result.fixable && !options.fix) {
      console.log(chalk.gray(`         (fixable: run with --fix)`));
    }
  }

  const errors = results.filter((r) => r.severity === "error");
  const warnings = results.filter((r) => r.severity === "warning");

  console.log();

  if (errors.length === 0 && warnings.length === 0) {
    console.log(chalk.green("[OK]    All checks passed! Your project is healthy."));
  } else {
    if (errors.length > 0) {
      console.log(chalk.red(`[ERROR] Found ${errors.length} error(s)`));
    }
    if (warnings.length > 0) {
      console.log(chalk.yellow(`[WARN]  Found ${warnings.length} warning(s)`));
    }

    if (!options.fix) {
      console.log(chalk.gray("\nTip: Run with --fix to attempt automatic repairs"));
      console.log(chalk.gray("Try: kaven module doctor --fix"));
    }
  }

  if (options.fix) {
    console.log();
    console.log(chalk.blue("Applying auto-fixes...\n"));
    await applyFixes(results, process.cwd());
    console.log(chalk.green("\nAuto-fix completed."));
  }

  // Exit codes: 0=all pass, 1=errors, 2=warnings only
  if (errors.length > 0) process.exit(1);
  if (warnings.length > 0) process.exit(2);
}
