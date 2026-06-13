import { select, confirm, text, multiselect, isCancel, cancel } from "@clack/prompts";
import pc from "picocolors";
import fs from "fs-extra";
import path from "node:path";
import { ALL_CAPABILITIES, TIER_DEFAULTS, type FeatureTier } from "../../lib/capabilities-catalog.js";
import { I18nService } from "../../core/I18nService.js";
export type { FeatureTier };

export interface FeaturesOptions {
  tier?: FeatureTier;
  list?: boolean;
  force?: boolean;
  dryRun?: boolean;
  outputPath?: string;
}

function handleCancel(value: unknown) {
  if (isCancel(value)) {
    cancel("Cancelled.");
    process.exit(0);
  }
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
    const i18n = await I18nService.getInstance();
    printList(i18n);
    return;
  }

  if (options.tier) {
    await applyTierDirect(options.tier, outputPath, options);
    return;
  }

  await runInteractive(outputPath, options);
}

function printList(i18n: I18nService): void {
  console.log();
  console.log(pc.bold(pc.underline(i18n.t("config.features.catalogHeader"))));
  console.log(pc.dim(i18n.t("config.features.capabilitiesTotal", { count: ALL_CAPABILITIES.length }) + "\n"));

  const categories = [...new Set(ALL_CAPABILITIES.map(c => c.category))];
  for (const category of categories) {
    const caps = ALL_CAPABILITIES.filter(c => c.category === category);
    console.log(pc.bold(pc.cyan(`  ${category} (${caps.length})`)));
    for (const cap of caps) {
      console.log(`    ${pc.white(cap.key.padEnd(30))} ${pc.dim(`[${cap.type}]`)}`);
      console.log(`      ${pc.dim(cap.description)}`);
    }
    console.log();
  }

  console.log(pc.bold(i18n.t("config.features.tierPresets")));
  for (const tier of ["starter", "complete", "pro", "enterprise"]) {
    console.log(`  ${pc.white(tier.padEnd(12))}`);
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
  const i18n = await I18nService.getInstance();

  console.log();
  console.log(pc.bold(pc.underline(i18n.t("config.features.tuiHeader"))));

  const selectedTier = await select({
    message: i18n.t("config.features.selectTier"),
    options: [
      { label: "Starter — Essential SaaS features", value: "starter" },
      { label: "Complete — White-label + Custom Domains", value: "complete" },
      { label: "Pro — Extended API + Limits", value: "pro" },
      { label: "Enterprise — Unlimited everything", value: "enterprise" },
      { label: pc.dim(i18n.t("common.cancel")), value: "cancel" },
    ],
  });
  handleCancel(selectedTier);
  if (selectedTier === "cancel") return;

  const tier = selectedTier as FeatureTier;
  const defaults = TIER_DEFAULTS[tier] || {};
  const selections: Record<string, string | boolean> = {};

  const customize = await confirm({
    message: i18n.t("config.features.customize"),
    initialValue: false,
  });
  handleCancel(customize);

  if (!customize) {
    return applyTierDirect(tier, outputPath, options);
  }

  const categories = [...new Set(ALL_CAPABILITIES.map(c => c.category))];
  for (const category of categories) {
    const caps = ALL_CAPABILITIES.filter(c => c.category === category);
    const boolCaps = caps.filter(c => c.type === "boolean");
    const numCaps = caps.filter(c => c.type === "numeric");

    if (boolCaps.length > 0) {
      const initialValues = boolCaps
        .filter(c => tier === "enterprise" || defaults[c.key] === true)
        .map(c => c.key);

      const selected = await multiselect({
        message: `${category} features:`,
        options: boolCaps.map(c => ({
          label: `${c.key.padEnd(30)} — ${c.description}`,
          value: c.key,
        })),
        initialValues,
        required: false,
      });
      handleCancel(selected);

      for (const cap of boolCaps) {
        selections[cap.key] = (selected as string[]).includes(cap.key);
      }
    }

    for (const cap of numCaps) {
      const defVal = tier === "enterprise" ? "-1" : (defaults[cap.key] as string || cap.defaultValue);
      const val = await text({
        message: `${cap.key} (${cap.description}):`,
        placeholder: defVal,
        defaultValue: defVal,
      });
      handleCancel(val);
      selections[cap.key] = val as string;
    }
  }

  await saveSeedFile(selections, outputPath, options, tier);
}

async function saveSeedFile(selections: Record<string, string | boolean>, outputPath: string, options: FeaturesOptions, tier: string): Promise<void> {
  const i18n = await I18nService.getInstance();

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
    console.log(pc.bold("\n" + i18n.t("config.features.dryRunHeader")));
    console.log(content);
    return;
  }

  if (fs.existsSync(outputPath) && !options.force) {
    const overwrite = await confirm({
      message: i18n.t("config.features.confirmOverwrite"),
      initialValue: false,
    });
    handleCancel(overwrite);
    if (!overwrite) return;
  }

  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, content, "utf-8");

  console.log(pc.green(`\n✅ ${i18n.t("config.features.seedWritten", { path: outputPath })}`));
  console.log(pc.dim(i18n.t("config.features.runSeed")));
}
