import chalk from "chalk";
import ora from "ora";
import fs from "fs-extra";
import path from "path";
import { execSync } from "node:child_process";
import { MODULE_REGISTRY } from "../../lib/module-registry";
import { activateModels, deactivateModels, isModuleActive } from "../../lib/schema-modifier";

export interface ActivationOptions {
  withDeps?: boolean;
  skipMigrate?: boolean;
  dryRun?: boolean;
  yes?: boolean;
}

function findSchemaPath(root?: string): string {
  const searchPath = root || process.cwd();
  const paths = [
    path.join(searchPath, "packages/database/prisma/schema.extended.prisma"),
    path.join(searchPath, "prisma/schema.prisma"),
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error("Prisma schema file not found. Make sure you are in a Kaven project.");
}

export async function moduleActivate(moduleName: string, root?: string, options: ActivationOptions = {}) {
  const schemaPath = findSchemaPath(root);
  const module = MODULE_REGISTRY.find(m => m.id === moduleName);

  if (!module) {
    console.error(chalk.red(`Error: Module "${moduleName}" not found in registry.`));
    process.exit(1);
  }

  let content = await fs.readFile(schemaPath, "utf-8");

  if (isModuleActive(content, module.models)) {
    console.log(chalk.yellow(`Module "${module.name}" is already active.`));
    return;
  }

  const inactiveDeps = module.dependsOn.filter(depId => {
    const dep = MODULE_REGISTRY.find(m => m.id === depId);
    return dep && !isModuleActive(content, dep.models);
  });

  if (inactiveDeps.length > 0) {
    if (options.withDeps) {
      for (const depId of inactiveDeps) {
        await moduleActivate(depId, root, { ...options, withDeps: true });
        content = await fs.readFile(schemaPath, "utf-8");
      }
    } else {
      console.error(chalk.red(`Error: Module "${module.name}" depends on inactive modules: ${inactiveDeps.join(", ")}.`));
      console.log(chalk.gray("Use --with-deps to activate them automatically."));
      process.exit(1);
    }
  }

  if (options.dryRun) {
    console.log(chalk.bold(`\n--- DRY RUN: Activating ${module.name} ---`));
    console.log(`Models to uncomment: ${module.models.join(", ")}`);
    return;
  }

  const spinner = ora(`Activating module ${chalk.bold(module.name)}...`).start();
  const updatedContent = activateModels(content, module.models);
  await fs.writeFile(schemaPath, updatedContent, "utf-8");
  spinner.succeed(`Module ${module.name} activated. ${module.models.length} models added.`);

  if (!options.skipMigrate) {
    await runMigrations(path.dirname(path.dirname(schemaPath)));
  }
}

export async function moduleDeactivate(moduleName: string, root?: string, options: ActivationOptions = {}) {
  const schemaPath = findSchemaPath(root);
  const module = MODULE_REGISTRY.find(m => m.id === moduleName);

  if (!module) {
    console.error(chalk.red(`Error: Module "${moduleName}" not found.`));
    process.exit(1);
  }

  if (module.id === "core") {
    console.error(chalk.red("Error: Core module cannot be deactivated."));
    process.exit(1);
  }

  const content = await fs.readFile(schemaPath, "utf-8");

  if (!isModuleActive(content, module.models)) {
    console.log(chalk.yellow(`Module "${module.name}" is already inactive.`));
    return;
  }

  const dependants = MODULE_REGISTRY.filter(m => m.dependsOn.includes(module.id) && isModuleActive(content, m.models));

  if (dependants.length > 0) {
    console.error(chalk.red(`Error: Cannot deactivate "${module.name}". Active modules depend on it: ${dependants.map(d => d.name).join(", ")}.`));
    process.exit(1);
  }

  if (options.dryRun) {
    console.log(chalk.bold(`\n--- DRY RUN: Deactivating ${module.name} ---`));
    console.log(`Models to comment: ${module.models.join(", ")}`);
    return;
  }

  const spinner = ora(`Deactivating module ${chalk.bold(module.name)}...`).start();
  const updatedContent = deactivateModels(content, module.models);
  await fs.writeFile(schemaPath, updatedContent, "utf-8");
  spinner.succeed(`Module ${module.name} deactivated. ${module.models.length} models commented.`);

  if (!options.skipMigrate) {
    await runMigrations(path.dirname(path.dirname(schemaPath)));
  }
}

export async function moduleListActivation(root?: string) {
  try {
    const schemaPath = findSchemaPath(root);
    const content = await fs.readFile(schemaPath, "utf-8");

    console.log(`\n  ${chalk.bold.underline("Kaven Schema Modules")}\n`);

    const active = MODULE_REGISTRY.filter(m => isModuleActive(content, m.models));
    const inactive = MODULE_REGISTRY.filter(m => !isModuleActive(content, m.models));

    console.log(chalk.green("  ACTIVE"));
    active.forEach(m => {
      const suffix = m.id === "core" ? chalk.gray(" (always active)") : "";
      console.log(`  ${chalk.green("✓")} ${m.id.padEnd(15)} ${m.name} (${m.models.length} models)${suffix}`);
    });

    if (inactive.length > 0) {
      console.log(`\n  ${chalk.yellow("INACTIVE")}`);
      inactive.forEach(m => {
        const deps = m.dependsOn.length > 0 ? chalk.gray(` (requires: ${m.dependsOn.join(", ")})`) : "";
        console.log(`  ${chalk.gray("○")} ${m.id.padEnd(15)} ${m.name} (${m.models.length} models)${deps}`);
      });
    }
    console.log();
  } catch (error: unknown) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
  }
}

async function runMigrations(dbPath: string) {
  const spinner = ora("Running Prisma generate & migrate...").start();
  try {
    execSync("pnpm prisma generate", { cwd: dbPath, stdio: "pipe" });
    spinner.succeed("Database schema synchronized.");
  } catch {
    spinner.warn("Schema modified but migrations failed. Run manualy: pnpm prisma migrate dev");
  }
}
