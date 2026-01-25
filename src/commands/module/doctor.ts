import chalk from "chalk";
import { ModuleDoctor, DoctorCheckResult } from "../../core/ModuleDoctor";
import { MarkerService } from "../../core/MarkerService";
import { ManifestParser } from "../../core/ManifestParser";

export interface DoctorOptions {
  fix?: boolean;
}

export async function moduleDoctor(options: DoctorOptions): Promise<void> {
  console.log(chalk.blue("🔍 Running module doctor...\n"));

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
    console.error(chalk.red(`❌ Heavy failure during doctor audit: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }

  if (results.length === 0) {
    console.log(
      chalk.green("✅ All checks passed! Your modules are healthy.\n"),
    );
    return;
  }

  // Grupar por severidade
  const errors = results.filter((r) => r.severity === "error");
  const warnings = results.filter((r) => r.severity === "warning");

  if (errors.length > 0) {
    console.log(chalk.red(`❌ Found ${errors.length} error(s):\n`));
    for (const err of errors) {
      console.log(chalk.red(`   ${err.message}`));
      if (err.file) console.log(chalk.gray(`      file: ${err.file}`));
      if (err.fixable)
        console.log(
          chalk.yellow(`      (💡 tip: run with --fix to attempt repair)`),
        );
      console.log();
    }
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow(`⚠️  Found ${warnings.length} warning(s):\n`));
    for (const warn of warnings) {
      console.log(chalk.yellow(`   ${warn.message}`));
      if (warn.file) console.log(chalk.gray(`      file: ${warn.file}`));
      console.log();
    }
  }

  if (options.fix) {
    console.log(chalk.blue("🔧 Attempting to fix issues...\n"));

    const fixable = results.filter((r) => r.fixable);

    if (fixable.length === 0) {
      console.log(chalk.gray("   No issues are automatically fixable yet."));
    }

    for (const result of fixable) {
      // Nota: No roadmap Week 2, a reparação real pode ser um placeholder
      // ou apenas o log de tentativa, dependendo da complexidade.
      // Por enquanto, apenas reportamos que a reparação automática
      // será implementada conforme o ModuleInstaller for refinado.
      console.log(
        chalk.yellow(
          `   🚧 Manual repair required for: ${result.message}. Autofix coming in future release.`,
        ),
      );
    }

    console.log(
      chalk.green("\n✅ Audit complete. Fixes were logged for manual action.\n"),
    );
  } else {
    console.log(
      chalk.blue("💡 Tip: Run with --fix to see potential repairs\n"),
    );
  }

  process.exit(errors.length > 0 ? 1 : 0);
}
