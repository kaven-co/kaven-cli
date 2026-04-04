import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { MODULE_REGISTRY } from "../../lib/module-registry";
import { isModuleActive } from "../../lib/schema-modifier";

/**
 * Finds the Prisma schema file in the project
 */
function findSchemaPath(root?: string): string {
  const searchPath = root || process.cwd();
  const paths = [
    path.join(searchPath, "packages/database/prisma/schema.extended.prisma"),
    path.join(searchPath, "prisma/schema.prisma"),
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error("Prisma schema file not found.");
}

export async function marketplaceList(root?: string) {
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
      console.log(`\\n  ${chalk.yellow("INACTIVE")}`);
      inactive.forEach(m => {
        const deps = m.dependsOn.length > 0 ? chalk.gray(` (requires: ${m.dependsOn.join(", ")})`) : "";
        console.log(`  ${chalk.gray("○")} ${m.id.padEnd(15)} ${m.name} (${m.models.length} models)${deps}`);
      });
    }
    console.log();
  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
  }
}
