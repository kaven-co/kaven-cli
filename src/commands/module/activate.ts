import chalk from "chalk";
import ora from "ora";
import path from "node:path";
import { confirm } from "@inquirer/prompts";
import {
  SchemaActivator,
  KAVEN_MODULES,
  type KavenModuleDef,
  type ModuleStatus,
} from "../../core/SchemaActivator.js";
import { TelemetryBuffer } from "../../infrastructure/TelemetryBuffer.js";
import { ensureError } from "../../infrastructure/errors.js";

// ============================================================
// Types
// ============================================================

export interface ActivationOptions {
  withDeps?: boolean;
  skipMigrate?: boolean;
  dryRun?: boolean;
  yes?: boolean;
}

// ============================================================
// Helpers
// ============================================================

function findModuleDef(moduleId: string): KavenModuleDef | undefined {
  return KAVEN_MODULES.find((m) => m.id === moduleId.toLowerCase());
}

function assertSchemaExists(exists: boolean, root: string): void {
  if (!exists) {
    const fullPath = path.join(
      root,
      "packages",
      "database",
      "prisma",
      "schema.extended.prisma",
    );
    console.error(
      chalk.red(
        `\nError: Schema not found at: ${fullPath}`,
      ),
    );
    console.error(
      chalk.gray(
        "Make sure you are in the root of a valid Kaven project.",
      ),
    );
    process.exit(1);
  }
}

// ============================================================
// kaven module activate <name>
// ============================================================

export async function moduleActivate(
  moduleName: string,
  projectRoot?: string,
  options: ActivationOptions = {},
): Promise<void> {
  const telemetry = TelemetryBuffer.getInstance();
  const startTime = Date.now();
  telemetry.capture("cli.module.activate.start", { moduleName });

  const root = projectRoot ?? process.cwd();
  const activator = new SchemaActivator(root);
  const spinner = ora(`Activating module ${moduleName}...`).start();

  try {
    // 1. Validate schema exists
    const exists = await activator.exists();
    spinner.stop();
    assertSchemaExists(exists, root);

    // 2. Validate module is known
    const def = findModuleDef(moduleName);
    if (!def) {
      console.error(
        chalk.red(`\nUnknown module: "${moduleName}".`),
      );
      console.error(
        chalk.gray(
          `Available modules: ${KAVEN_MODULES.map((m) => m.id).join(", ")}`,
        ),
      );
      process.exit(1);
    }

    // 3. Check dependencies
    if (def.dependsOn.length > 0) {
      spinner.start("Checking dependencies...");
      const depStatuses: ModuleStatus[] = [];

      for (const depId of def.dependsOn) {
        const depDef = findModuleDef(depId);
        if (!depDef) continue;
        const status = await activator.getModuleStatus(depDef);
        depStatuses.push(status);
      }

      const missing = depStatuses.filter((s) => !s.active);
      if (missing.length > 0) {
        spinner.stop();

        // Auto-activate deps if --with-deps
        if (options.withDeps) {
          for (const dep of missing) {
            await moduleActivate(dep.id, projectRoot, { ...options, withDeps: true });
          }
        } else {
          console.error(
            chalk.red(
              `\nInactive dependencies for "${moduleName}": ${missing.map((m) => m.id).join(", ")}`,
            ),
          );
          console.error(
            chalk.gray(
              `Activate them first:\n${missing.map((m) => `  kaven module activate ${m.id}`).join("\n")}`,
            ),
          );
          console.log(chalk.gray("\nOr use --with-deps to activate them automatically."));
          process.exit(1);
        }
      }
      spinner.stop();
    }

    // 4. Check if already active
    const current = await activator.getModuleStatus(def);
    if (current.active) {
      console.log(
        chalk.yellow(`\nModule "${def.label}" is already active.`),
      );
      return;
    }

    // 5. Confirm if not --yes
    if (!options.yes) {
      const ok = await confirm({
        message: `Activate module "${def.label}"? This will uncomment ${def.models.length} model(s) in the schema.`,
        default: true,
      });
      if (!ok) {
        console.log(chalk.gray("\nActivation aborted."));
        return;
      }
    }

    // 6. Dry run
    if (options.dryRun) {
      console.log(chalk.bold(`\n--- DRY RUN: Activating ${def.label} ---`));
      console.log(`Models to uncomment: ${def.models.join(", ")}`);
      if (def.enums.length > 0) {
        console.log(`Enums to uncomment: ${def.enums.join(", ")}`);
      }
      return;
    }

    // 7. Activate
    spinner.start(`Uncommenting ${def.label} models in schema...`);
    await activator.activateModule(def);
    spinner.succeed(
      chalk.green(
        `\nModule ${def.label} activated. ${def.models.length} models added: ${def.models.join(", ")}`,
      ),
    );

    if (!options.skipMigrate) {
      console.log(
        chalk.cyan(
          "\nNext step: Run `pnpm db:generate && pnpm db:migrate` to apply changes.",
        ),
      );
    }

    telemetry.capture(
      "cli.module.activate.success",
      { moduleName: def.id, models: def.models.length },
      Date.now() - startTime,
    );
    await telemetry.flush();
  } catch (err: unknown) { const error = ensureError(err);
    spinner.fail(
      chalk.red(
        `Failed to activate module: ${error.message}`,
      ),
    );
    telemetry.capture(
      "cli.module.activate.error",
      { moduleName, error: error.message },
      Date.now() - startTime,
    );
    await telemetry.flush();
    process.exit(1);
  }
}

// ============================================================
// kaven module deactivate <name>
// ============================================================

export async function moduleDeactivate(
  moduleName: string,
  projectRoot?: string,
  options: ActivationOptions = {},
): Promise<void> {
  const telemetry = TelemetryBuffer.getInstance();
  const startTime = Date.now();
  telemetry.capture("cli.module.deactivate.start", { moduleName });

  const root = projectRoot ?? process.cwd();
  const activator = new SchemaActivator(root);
  const spinner = ora(`Deactivating module ${moduleName}...`).start();

  try {
    // 1. Validate schema exists
    const exists = await activator.exists();
    spinner.stop();
    assertSchemaExists(exists, root);

    // 2. Validate module
    const def = findModuleDef(moduleName);
    if (!def) {
      console.error(
        chalk.red(`\nUnknown module: "${moduleName}".`),
      );
      console.error(
        chalk.gray(
          `Available modules: ${KAVEN_MODULES.map((m) => m.id).join(", ")}`,
        ),
      );
      process.exit(1);
    }

    // 3. Check for active dependents
    spinner.start("Checking reverse dependencies...");
    const dependents: string[] = [];

    for (const candidate of KAVEN_MODULES) {
      if (candidate.id === def.id) continue;
      if (!candidate.dependsOn.includes(def.id)) continue;

      const status = await activator.getModuleStatus(candidate);
      if (status.active) {
        dependents.push(candidate.id);
      }
    }

    if (dependents.length > 0) {
      spinner.stop();
      console.error(
        chalk.red(
          `\nCannot deactivate "${moduleName}": the following active modules depend on it:`,
        ),
      );
      console.error(chalk.gray(`  ${dependents.join(", ")}`));
      console.error(
        chalk.gray(
          `Deactivate them first:\n${dependents.map((d) => `  kaven module deactivate ${d}`).join("\n")}`,
        ),
      );
      process.exit(1);
    }

    // 4. Check if already inactive
    const current = await activator.getModuleStatus(def);
    if (!current.active) {
      spinner.stop();
      console.log(
        chalk.yellow(`\nModule "${def.label}" is already inactive.`),
      );
      return;
    }

    // 5. Dry run
    if (options.dryRun) {
      spinner.stop();
      console.log(chalk.bold(`\n--- DRY RUN: Deactivating ${def.label} ---`));
      console.log(`Models to comment: ${def.models.join(", ")}`);
      return;
    }

    // 6. Deactivate
    spinner.start(`Commenting ${def.label} models in schema...`);
    await activator.deactivateModule(def);
    spinner.succeed(
      chalk.green(`\nModule ${def.label} deactivated successfully.`),
    );

    if (!options.skipMigrate) {
      console.log(
        chalk.cyan(
          "\nNext step: Run `pnpm db:generate && pnpm db:migrate` to apply changes.",
        ),
      );
    }

    telemetry.capture(
      "cli.module.deactivate.success",
      { moduleName: def.id },
      Date.now() - startTime,
    );
    await telemetry.flush();
  } catch (err: unknown) { const error = ensureError(err);
    spinner.fail(
      chalk.red(
        `Failed to deactivate module: ${error.message}`,
      ),
    );
    telemetry.capture(
      "cli.module.deactivate.error",
      { moduleName, error: error.message },
      Date.now() - startTime,
    );
    await telemetry.flush();
    process.exit(1);
  }
}

// ============================================================
// kaven module list
// ============================================================

export async function moduleListActivation(
  projectRoot?: string,
): Promise<void> {
  const root = projectRoot ?? process.cwd();
  const activator = new SchemaActivator(root);

  const schemaExists = await activator.exists();

  // Table header
  const COL = {
    module: 18,
    status: 10,
    models: 44,
    deps: 20,
  };

  const header =
    chalk.bold("Module".padEnd(COL.module)) +
    chalk.bold("Status".padEnd(COL.status)) +
    chalk.bold("Models".padEnd(COL.models)) +
    chalk.bold("Depends on");

  const divider = "─".repeat(COL.module + COL.status + COL.models + COL.deps);

  console.log();
  console.log(chalk.blue("Kaven Schema Modules\n"));
  console.log(header);
  console.log(chalk.gray(divider));

  if (!schemaExists) {
    for (const def of KAVEN_MODULES) {
      const modCol = def.id.padEnd(COL.module);
      const statusCol = chalk.gray("unknown".padEnd(COL.status));
      const modelsCol = def.models.join(", ").padEnd(COL.models);
      const depsCol =
        def.dependsOn.length > 0 ? def.dependsOn.join(", ") : "—";
      console.log(`${modCol}${statusCol}${modelsCol}${depsCol}`);
    }

    console.log();
    console.log(
      chalk.yellow(
        "Warning: schema.extended.prisma not found. Status cannot be determined.",
      ),
    );
    console.log(
      chalk.gray(
        "Run this command in the root of a Kaven project to see real status.",
      ),
    );
    return;
  }

  for (const def of KAVEN_MODULES) {
    const status = await activator.getModuleStatus(def);

    const modCol = def.id.padEnd(COL.module);
    const statusText = status.active ? "active" : "inactive";
    const statusColored = status.active
      ? chalk.green(statusText.padEnd(COL.status))
      : chalk.gray(statusText.padEnd(COL.status));
    const modelsCol = def.models.join(", ").padEnd(COL.models);
    const depsCol =
      def.dependsOn.length > 0 ? def.dependsOn.join(", ") : "—";

    console.log(`${modCol}${statusColored}${modelsCol}${depsCol}`);
  }

  console.log();
  console.log(
    chalk.gray(
      "To activate: kaven module activate <name>  |  To deactivate: kaven module deactivate <name>",
    ),
  );
}
