import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { ALL_CAPABILITIES, TIER_DEFAULTS, FeatureTier } from "../../lib/capabilities-catalog";
export { FeatureTier };

export interface FeaturesOptions {
  tier?: FeatureTier;
  list?: boolean;
  force?: boolean;
  dryRun?: boolean;
  outputPath?: string;
}

export async function configFeatures(options: FeaturesOptions): Promise<void> {
  const outputPath =
    options.outputPath ??
    path.join(
      process.cwd(),
      "packages",
      "database",
      "prisma",
      "seeds",
      "capabilities.seed.ts"
    );

  if (options.list) {
    printList();
    return;
  }

  if (options.tier) {
    await applyTierDirect(options.tier, outputPath, options);
    return;
  }

  await runInteractive(outputPath, options);
}

function printList(): void {
  console.log();
  console.log(chalk.bold.underline("Kaven Framework — Capability Catalog"));
  console.log(chalk.gray(`${ALL_CAPABILITIES.length} capabilities total\n`));

  const categories = [...new Set(ALL_CAPABILITIES.map(c => c.category))];
  for (const category of categories) {
    const caps = ALL_CAPABILITIES.filter(c => c.category === category);
    console.log(chalk.bold.cyan(`  ${category} (${caps.length})`));
    for (const cap of caps) {
      console.log(
        `    ${chalk.white(cap.key.padEnd(30))} ${chalk.gray(`[${cap.type}]`)}`
      );
      console.log(`      ${chalk.gray(cap.description)}`);
    }
    console.log();
  }

  console.log(chalk.bold("Tier presets:"));
  for (const tier of ["starter", "complete", "pro", "enterprise"]) {
    console.log(`  ${chalk.white(tier.padEnd(12))}`);
  }
  console.log();
}

async function applyTierDirect(tier: FeatureTier, outputPath: string, options: FeaturesOptions): Promise<void> {
  const defaults = TIER_DEFAULTS[tier] || {};
  const selections: Record<string, string | boolean> = {};

  for (const cap of ALL_CAPABILITIES) {
    if (tier === "enterprise") {
      selections[cap.key] = cap.type === "boolean" ? true : "-1";
    } else {
      selections[cap.key] = defaults[cap.key] ?? (cap.type === "boolean" ? false : cap.defaultValue);
    }
  }

  await saveSeedFile(selections, outputPath, options, tier);
}

async function runInteractive(outputPath: string, options: FeaturesOptions): Promise<void> {
  const { select, confirm, input } = await import("@inquirer/prompts");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const prompts = require("@inquirer/prompts") as {
    checkbox: <T = string>(opts: { message: string; choices: Array<{ name: string; value: T; checked?: boolean }> }) => Promise<T[]>;
  };
  const checkbox = prompts.checkbox;

  console.log();
  console.log(chalk.bold.underline("🛡️ Kaven Feature Flag Configuration"));

  const selectedTier = await select({
    message: "Select a base tier:",
    choices: [
      { name: "Starter (Essential SaaS features)", value: "starter" },
      { name: "Complete (White-label + Custom Domains)", value: "complete" },
      { name: "Pro (Extended API + Limits)", value: "pro" },
      { name: "Enterprise (Unlimited everything)", value: "enterprise" },
      { name: "Cancel", value: "cancel" },
    ],
  });

  if (selectedTier === "cancel") return;

  const tier = selectedTier as FeatureTier;
  const defaults = TIER_DEFAULTS[tier] || {};
  const selections: Record<string, string | boolean> = {};

  const customize = await confirm({
    message: "Customize individual capabilities?",
    default: false,
  });

  if (!customize) {
    return applyTierDirect(tier, outputPath, options);
  }

  const categories = [...new Set(ALL_CAPABILITIES.map(c => c.category))];
  for (const category of categories) {
    const caps = ALL_CAPABILITIES.filter(c => c.category === category);
    const boolCaps = caps.filter(c => c.type === "boolean");
    const numCaps = caps.filter(c => c.type === "numeric");

    if (boolCaps.length > 0) {
      const choices = boolCaps.map(c => ({
        name: `${c.key.padEnd(30)} — ${c.description}`,
        value: c.key,
        checked: tier === "enterprise" ? true : (defaults[c.key] === true),
      }));

      const selected = await checkbox({
        message: `${category} features:`,
        choices,
      });

      for (const cap of boolCaps) {
        selections[cap.key] = selected.includes(cap.key);
      }
    }

    for (const cap of numCaps) {
      const defVal = tier === "enterprise" ? "-1" : (defaults[cap.key] as string || cap.defaultValue);
      const val = await input({
        message: `${cap.key} (${cap.description}):`,
        default: defVal,
      });
      selections[cap.key] = val;
    }
  }

  await saveSeedFile(selections, outputPath, options, tier);
}

async function saveSeedFile(selections: Record<string, string | boolean>, outputPath: string, options: FeaturesOptions, tier: string): Promise<void> {
  const items = ALL_CAPABILITIES.map(c => {
    const val = selections[c.key];
    return `    { key: "${c.key}", type: "${c.type}", defaultValue: "${val}", description: "${c.description}" },`;
  }).join("\n");

  const content = `// packages/database/prisma/seeds/capabilities.seed.ts
// Generated by kaven config features — ${new Date().toISOString()}
// Tier: ${tier}

import { PrismaClient } from "@prisma/client";

export async function seedCapabilities(prisma: PrismaClient) {
  const capabilities = [
${items}
  ];

  console.log("🔐 Seeding ${ALL_CAPABILITIES.length} Capabilities...");

  for (const cap of capabilities) {
    await prisma.capability.upsert({
      where: { key: cap.key },
      update: cap,
      create: cap,
    });
  }
}
`;

  if (options.dryRun) {
    console.log(chalk.bold("\n--- DRY RUN: Generated Content ---"));
    console.log(content);
    return;
  }

  if (fs.existsSync(outputPath) && !options.force) {
    const { confirm: confirmOverwrite } = await import("@inquirer/prompts");
    const overwrite = await confirmOverwrite({
      message: "Seed file already exists. Overwrite?",
      default: false,
    });
    if (!overwrite) return;
  }

  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, content, "utf-8");

  console.log(chalk.green(`\n✅ Seed file written to: ${outputPath}`));
  console.log(chalk.gray("Run pnpm prisma db seed to apply capabilities to your database."));
}
