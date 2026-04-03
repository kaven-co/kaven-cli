import chalk from "chalk";
import fs from "fs-extra";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeatureTier = "starter" | "complete" | "pro" | "enterprise";
export type CapabilitySensitivity = "NORMAL" | "SENSITIVE" | "HIGHLY_SENSITIVE" | "CRITICAL";
export type CapabilityScope = "GLOBAL" | "TENANT" | "SPACE" | "ASSIGNED";

export interface CapabilityDefinition {
  code: string;
  resource: string;
  action: string;
  description: string;
  category: string;
  sensitivity: CapabilitySensitivity;
  scope: CapabilityScope;
  requiresMFA?: boolean;
  requiresApproval?: boolean;
}

export interface FeaturesOptions {
  tier?: FeatureTier;
  list?: boolean;
  /** Override output path — used in tests to avoid process.chdir() */
  outputPath?: string;
}

// ---------------------------------------------------------------------------
// Capability catalog (63 capabilities, 5 categories)
// Mirrors packages/database/prisma/seeds/capabilities.seed.ts in kaven-framework
// Support: 14 | DevOps: 15 | Finance: 12 | Marketing: 10 | Management: 12
// ---------------------------------------------------------------------------

export const ALL_CAPABILITIES: CapabilityDefinition[] = [
  // ===========================
  // SUPPORT (14 capabilities)
  // ===========================
  {
    code: "tickets.read",
    resource: "tickets",
    action: "read",
    description: "View support tickets",
    category: "Support",
    sensitivity: "NORMAL",
    scope: "SPACE",
  },
  {
    code: "tickets.create",
    resource: "tickets",
    action: "create",
    description: "Create new tickets",
    category: "Support",
    sensitivity: "NORMAL",
    scope: "SPACE",
  },
  {
    code: "tickets.update",
    resource: "tickets",
    action: "update",
    description: "Update existing tickets",
    category: "Support",
    sensitivity: "NORMAL",
    scope: "ASSIGNED",
  },
  {
    code: "tickets.delete",
    resource: "tickets",
    action: "delete",
    description: "Delete tickets",
    category: "Support",
    sensitivity: "SENSITIVE",
    scope: "SPACE",
    requiresApproval: true,
  },
  {
    code: "tickets.assign",
    resource: "tickets",
    action: "assign",
    description: "Assign tickets to agents",
    category: "Support",
    sensitivity: "NORMAL",
    scope: "SPACE",
  },
  {
    code: "tickets.close",
    resource: "tickets",
    action: "close",
    description: "Close resolved tickets",
    category: "Support",
    sensitivity: "NORMAL",
    scope: "ASSIGNED",
  },
  {
    code: "tickets.reopen",
    resource: "tickets",
    action: "reopen",
    description: "Reopen closed tickets",
    category: "Support",
    sensitivity: "NORMAL",
    scope: "SPACE",
  },
  {
    code: "tickets.export",
    resource: "tickets",
    action: "export",
    description: "Export ticket data",
    category: "Support",
    sensitivity: "SENSITIVE",
    scope: "SPACE",
  },
  {
    code: "customers.read",
    resource: "customers",
    action: "read",
    description: "View customer data",
    category: "Support",
    sensitivity: "SENSITIVE",
    scope: "TENANT",
  },
  {
    code: "customers.update",
    resource: "customers",
    action: "update",
    description: "Update customer data",
    category: "Support",
    sensitivity: "SENSITIVE",
    scope: "TENANT",
  },
  {
    code: "kb.read",
    resource: "kb",
    action: "read",
    description: "View knowledge base",
    category: "Support",
    sensitivity: "NORMAL",
    scope: "GLOBAL",
  },
  {
    code: "kb.manage",
    resource: "kb",
    action: "manage",
    description: "Manage knowledge base articles",
    category: "Support",
    sensitivity: "NORMAL",
    scope: "SPACE",
  },
  {
    code: "auth.2fa_reset.request",
    resource: "auth",
    action: "2fa_reset_request",
    description: "Request 2FA reset for a user",
    category: "Support",
    sensitivity: "HIGHLY_SENSITIVE",
    scope: "TENANT",
  },
  {
    code: "auth.2fa_reset.execute",
    resource: "auth",
    action: "2fa_reset_execute",
    description: "Execute 2FA reset for a user",
    category: "Support",
    sensitivity: "CRITICAL",
    scope: "TENANT",
    requiresMFA: true,
    requiresApproval: true,
  },

  // ===========================
  // DEVOPS (15 capabilities)
  // ===========================
  {
    code: "servers.read",
    resource: "servers",
    action: "read",
    description: "View server information",
    category: "DevOps",
    sensitivity: "SENSITIVE",
    scope: "GLOBAL",
  },
  {
    code: "servers.manage",
    resource: "servers",
    action: "manage",
    description: "Manage server configurations",
    category: "DevOps",
    sensitivity: "CRITICAL",
    scope: "GLOBAL",
    requiresMFA: true,
    requiresApproval: true,
  },
  {
    code: "deployments.read",
    resource: "deployments",
    action: "read",
    description: "View deployment history",
    category: "DevOps",
    sensitivity: "NORMAL",
    scope: "GLOBAL",
  },
  {
    code: "deployments.create",
    resource: "deployments",
    action: "create",
    description: "Create new deployments",
    category: "DevOps",
    sensitivity: "CRITICAL",
    scope: "GLOBAL",
    requiresMFA: true,
  },
  {
    code: "deployments.rollback",
    resource: "deployments",
    action: "rollback",
    description: "Rollback deployments",
    category: "DevOps",
    sensitivity: "CRITICAL",
    scope: "GLOBAL",
    requiresMFA: true,
    requiresApproval: true,
  },
  {
    code: "logs.read",
    resource: "logs",
    action: "read",
    description: "View system logs",
    category: "DevOps",
    sensitivity: "SENSITIVE",
    scope: "GLOBAL",
  },
  {
    code: "logs.export",
    resource: "logs",
    action: "export",
    description: "Export system logs",
    category: "DevOps",
    sensitivity: "HIGHLY_SENSITIVE",
    scope: "GLOBAL",
    requiresApproval: true,
  },
  {
    code: "monitoring.read",
    resource: "monitoring",
    action: "read",
    description: "View monitoring metrics",
    category: "DevOps",
    sensitivity: "NORMAL",
    scope: "GLOBAL",
  },
  {
    code: "monitoring.manage",
    resource: "monitoring",
    action: "manage",
    description: "Manage alerts and dashboards",
    category: "DevOps",
    sensitivity: "SENSITIVE",
    scope: "GLOBAL",
  },
  {
    code: "database.read",
    resource: "database",
    action: "read",
    description: "View database information",
    category: "DevOps",
    sensitivity: "HIGHLY_SENSITIVE",
    scope: "GLOBAL",
    requiresMFA: true,
  },
  {
    code: "database.backup",
    resource: "database",
    action: "backup",
    description: "Create database backups",
    category: "DevOps",
    sensitivity: "CRITICAL",
    scope: "GLOBAL",
    requiresMFA: true,
  },
  {
    code: "database.restore",
    resource: "database",
    action: "restore",
    description: "Restore database backups",
    category: "DevOps",
    sensitivity: "CRITICAL",
    scope: "GLOBAL",
    requiresMFA: true,
    requiresApproval: true,
  },
  {
    code: "secrets.read",
    resource: "secrets",
    action: "read",
    description: "View secrets and environment variables",
    category: "DevOps",
    sensitivity: "CRITICAL",
    scope: "GLOBAL",
    requiresMFA: true,
  },
  {
    code: "secrets.manage",
    resource: "secrets",
    action: "manage",
    description: "Manage secrets and environment variables",
    category: "DevOps",
    sensitivity: "CRITICAL",
    scope: "GLOBAL",
    requiresMFA: true,
    requiresApproval: true,
  },
  {
    code: "incidents.manage",
    resource: "incidents",
    action: "manage",
    description: "Manage production incidents",
    category: "DevOps",
    sensitivity: "SENSITIVE",
    scope: "GLOBAL",
  },

  // ===========================
  // FINANCE (12 capabilities)
  // ===========================
  {
    code: "invoices.read",
    resource: "invoices",
    action: "read",
    description: "View invoices",
    category: "Finance",
    sensitivity: "SENSITIVE",
    scope: "TENANT",
  },
  {
    code: "invoices.create",
    resource: "invoices",
    action: "create",
    description: "Create new invoices",
    category: "Finance",
    sensitivity: "SENSITIVE",
    scope: "TENANT",
  },
  {
    code: "invoices.update",
    resource: "invoices",
    action: "update",
    description: "Update existing invoices",
    category: "Finance",
    sensitivity: "SENSITIVE",
    scope: "TENANT",
    requiresApproval: true,
  },
  {
    code: "invoices.delete",
    resource: "invoices",
    action: "delete",
    description: "Delete invoices",
    category: "Finance",
    sensitivity: "HIGHLY_SENSITIVE",
    scope: "TENANT",
    requiresMFA: true,
    requiresApproval: true,
  },
  {
    code: "payments.read",
    resource: "payments",
    action: "read",
    description: "View payments",
    category: "Finance",
    sensitivity: "SENSITIVE",
    scope: "TENANT",
  },
  {
    code: "payments.process",
    resource: "payments",
    action: "process",
    description: "Process payments",
    category: "Finance",
    sensitivity: "HIGHLY_SENSITIVE",
    scope: "TENANT",
    requiresMFA: true,
  },
  {
    code: "refunds.create",
    resource: "refunds",
    action: "create",
    description: "Create refunds",
    category: "Finance",
    sensitivity: "HIGHLY_SENSITIVE",
    scope: "TENANT",
    requiresApproval: true,
  },
  {
    code: "refunds.approve",
    resource: "refunds",
    action: "approve",
    description: "Approve refunds",
    category: "Finance",
    sensitivity: "CRITICAL",
    scope: "TENANT",
    requiresMFA: true,
  },
  {
    code: "subscriptions.read",
    resource: "subscriptions",
    action: "read",
    description: "View subscriptions",
    category: "Finance",
    sensitivity: "SENSITIVE",
    scope: "TENANT",
  },
  {
    code: "subscriptions.manage",
    resource: "subscriptions",
    action: "manage",
    description: "Manage subscriptions",
    category: "Finance",
    sensitivity: "SENSITIVE",
    scope: "TENANT",
  },
  {
    code: "reports.financial",
    resource: "reports",
    action: "financial",
    description: "Generate financial reports",
    category: "Finance",
    sensitivity: "HIGHLY_SENSITIVE",
    scope: "GLOBAL",
  },
  {
    code: "analytics.revenue",
    resource: "analytics",
    action: "revenue",
    description: "View revenue analytics",
    category: "Finance",
    sensitivity: "HIGHLY_SENSITIVE",
    scope: "GLOBAL",
  },

  // ===========================
  // MARKETING (10 capabilities)
  // ===========================
  {
    code: "campaigns.read",
    resource: "campaigns",
    action: "read",
    description: "View marketing campaigns",
    category: "Marketing",
    sensitivity: "NORMAL",
    scope: "SPACE",
  },
  {
    code: "campaigns.create",
    resource: "campaigns",
    action: "create",
    description: "Create new campaigns",
    category: "Marketing",
    sensitivity: "NORMAL",
    scope: "SPACE",
  },
  {
    code: "campaigns.update",
    resource: "campaigns",
    action: "update",
    description: "Update existing campaigns",
    category: "Marketing",
    sensitivity: "NORMAL",
    scope: "SPACE",
  },
  {
    code: "campaigns.delete",
    resource: "campaigns",
    action: "delete",
    description: "Delete campaigns",
    category: "Marketing",
    sensitivity: "SENSITIVE",
    scope: "SPACE",
    requiresApproval: true,
  },
  {
    code: "emails.send",
    resource: "emails",
    action: "send",
    description: "Send marketing emails",
    category: "Marketing",
    sensitivity: "SENSITIVE",
    scope: "SPACE",
  },
  {
    code: "emails.templates",
    resource: "emails",
    action: "templates",
    description: "Manage email templates",
    category: "Marketing",
    sensitivity: "NORMAL",
    scope: "SPACE",
  },
  {
    code: "analytics.marketing",
    resource: "analytics",
    action: "marketing",
    description: "View marketing analytics",
    category: "Marketing",
    sensitivity: "NORMAL",
    scope: "SPACE",
  },
  {
    code: "leads.read",
    resource: "leads",
    action: "read",
    description: "View leads",
    category: "Marketing",
    sensitivity: "SENSITIVE",
    scope: "SPACE",
  },
  {
    code: "leads.manage",
    resource: "leads",
    action: "manage",
    description: "Manage leads",
    category: "Marketing",
    sensitivity: "SENSITIVE",
    scope: "SPACE",
  },
  {
    code: "content.publish",
    resource: "content",
    action: "publish",
    description: "Publish content",
    category: "Marketing",
    sensitivity: "NORMAL",
    scope: "SPACE",
  },

  // ===========================
  // MANAGEMENT (11 capabilities)
  // ===========================
  {
    code: "users.read",
    resource: "users",
    action: "read",
    description: "View users",
    category: "Management",
    sensitivity: "SENSITIVE",
    scope: "TENANT",
  },
  {
    code: "users.create",
    resource: "users",
    action: "create",
    description: "Create new users",
    category: "Management",
    sensitivity: "SENSITIVE",
    scope: "TENANT",
  },
  {
    code: "users.update",
    resource: "users",
    action: "update",
    description: "Update existing users",
    category: "Management",
    sensitivity: "SENSITIVE",
    scope: "TENANT",
  },
  {
    code: "users.delete",
    resource: "users",
    action: "delete",
    description: "Delete users",
    category: "Management",
    sensitivity: "HIGHLY_SENSITIVE",
    scope: "TENANT",
    requiresApproval: true,
  },
  {
    code: "roles.read",
    resource: "roles",
    action: "read",
    description: "View roles and permissions",
    category: "Management",
    sensitivity: "SENSITIVE",
    scope: "SPACE",
  },
  {
    code: "roles.manage",
    resource: "roles",
    action: "manage",
    description: "Manage roles and permissions",
    category: "Management",
    sensitivity: "CRITICAL",
    scope: "SPACE",
    requiresMFA: true,
    requiresApproval: true,
  },
  {
    code: "audit.read",
    resource: "audit",
    action: "read",
    description: "View audit logs",
    category: "Management",
    sensitivity: "HIGHLY_SENSITIVE",
    scope: "GLOBAL",
  },
  {
    code: "audit.export",
    resource: "audit",
    action: "export",
    description: "Export audit logs",
    category: "Management",
    sensitivity: "CRITICAL",
    scope: "GLOBAL",
    requiresMFA: true,
    requiresApproval: true,
  },
  {
    code: "settings.read",
    resource: "settings",
    action: "read",
    description: "View platform settings",
    category: "Management",
    sensitivity: "SENSITIVE",
    scope: "GLOBAL",
  },
  {
    code: "settings.manage",
    resource: "settings",
    action: "manage",
    description: "Manage platform settings",
    category: "Management",
    sensitivity: "CRITICAL",
    scope: "GLOBAL",
    requiresMFA: true,
    requiresApproval: true,
  },
  {
    code: "impersonate.user",
    resource: "impersonate",
    action: "user",
    description: "Impersonate other users",
    category: "Management",
    sensitivity: "CRITICAL",
    scope: "GLOBAL",
    requiresMFA: true,
    requiresApproval: true,
  },
  {
    code: "users.export",
    resource: "users",
    action: "export",
    description: "Export user list (CSV)",
    category: "Management",
    sensitivity: "HIGHLY_SENSITIVE",
    scope: "TENANT",
    requiresMFA: true,
    requiresApproval: true,
  },
];

// ---------------------------------------------------------------------------
// Tier presets — which capability codes are enabled per tier
// ---------------------------------------------------------------------------

const TIER_PRESETS: Record<FeatureTier, string[]> = {
  starter: [
    // Support basics
    "tickets.read",
    "tickets.create",
    "tickets.update",
    "tickets.assign",
    "tickets.close",
    "tickets.reopen",
    "customers.read",
    "kb.read",
    // Management basics
    "users.read",
    "users.create",
    "users.update",
    "roles.read",
    "settings.read",
  ],
  complete: [
    // All Starter capabilities
    "tickets.read",
    "tickets.create",
    "tickets.update",
    "tickets.assign",
    "tickets.close",
    "tickets.reopen",
    "tickets.delete",
    "tickets.export",
    "customers.read",
    "customers.update",
    "kb.read",
    "kb.manage",
    // DevOps basics
    "deployments.read",
    "logs.read",
    "monitoring.read",
    "monitoring.manage",
    "incidents.manage",
    // Finance basics
    "invoices.read",
    "invoices.create",
    "payments.read",
    "subscriptions.read",
    "subscriptions.manage",
    // Marketing
    "campaigns.read",
    "campaigns.create",
    "campaigns.update",
    "emails.templates",
    "analytics.marketing",
    "leads.read",
    "content.publish",
    // Management
    "users.read",
    "users.create",
    "users.update",
    "users.delete",
    "roles.read",
    "roles.manage",
    "settings.read",
    "settings.manage",
  ],
  pro: [
    // All Complete capabilities
    "tickets.read",
    "tickets.create",
    "tickets.update",
    "tickets.assign",
    "tickets.close",
    "tickets.reopen",
    "tickets.delete",
    "tickets.export",
    "customers.read",
    "customers.update",
    "kb.read",
    "kb.manage",
    "auth.2fa_reset.request",
    // DevOps extended
    "servers.read",
    "deployments.read",
    "deployments.create",
    "logs.read",
    "logs.export",
    "monitoring.read",
    "monitoring.manage",
    "database.read",
    "incidents.manage",
    // Finance extended
    "invoices.read",
    "invoices.create",
    "invoices.update",
    "payments.read",
    "payments.process",
    "refunds.create",
    "refunds.approve",
    "subscriptions.read",
    "subscriptions.manage",
    "reports.financial",
    "analytics.revenue",
    // Marketing full
    "campaigns.read",
    "campaigns.create",
    "campaigns.update",
    "campaigns.delete",
    "emails.send",
    "emails.templates",
    "analytics.marketing",
    "leads.read",
    "leads.manage",
    "content.publish",
    // Management extended
    "users.read",
    "users.create",
    "users.update",
    "users.delete",
    "users.export",
    "roles.read",
    "roles.manage",
    "audit.read",
    "settings.read",
    "settings.manage",
  ],
  enterprise: ALL_CAPABILITIES.map((c) => c.code),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sensitivityBadge(s: CapabilitySensitivity): string {
  switch (s) {
    case "NORMAL":
      return chalk.green("[NORMAL]");
    case "SENSITIVE":
      return chalk.yellow("[SENSITIVE]");
    case "HIGHLY_SENSITIVE":
      return chalk.red("[HIGH]");
    case "CRITICAL":
      return chalk.bgRed.white("[CRITICAL]");
  }
}

function groupByCategory(
  caps: CapabilityDefinition[]
): Map<string, CapabilityDefinition[]> {
  const map = new Map<string, CapabilityDefinition[]>();
  for (const cap of caps) {
    const existing = map.get(cap.category) ?? [];
    existing.push(cap);
    map.set(cap.category, existing);
  }
  return map;
}

function tierLabel(tier: FeatureTier): string {
  const labels: Record<FeatureTier, string> = {
    starter: chalk.green("Starter"),
    complete: chalk.yellow("Complete"),
    pro: chalk.magenta("Pro"),
    enterprise: chalk.cyan("Enterprise"),
  };
  return labels[tier];
}

// ---------------------------------------------------------------------------
// Seed file generator
// ---------------------------------------------------------------------------

export function generateSeedFile(selectedCodes: string[]): string {
  const selectedSet = new Set(selectedCodes);
  const selected = ALL_CAPABILITIES.filter((c) => selectedSet.has(c.code));
  const grouped = groupByCategory(selected);

  const blocks: string[] = [];

  for (const [category, caps] of grouped) {
    const items = caps
      .map((c) => {
        const lines: string[] = [
          `    {`,
          `      code: '${c.code}',`,
          `      resource: '${c.resource}',`,
          `      action: '${c.action}',`,
          `      description: '${c.description}',`,
          `      category: '${c.category}',`,
          `      sensitivity: CapabilitySensitivity.${c.sensitivity},`,
          `      scope: CapabilityScope.${c.scope},`,
        ];
        if (c.requiresMFA) lines.push(`      requiresMFA: true,`);
        if (c.requiresApproval) lines.push(`      requiresApproval: true,`);
        lines.push(`    },`);
        return lines.join("\n");
      })
      .join("\n");

    blocks.push(`    // ===========================\n    // ${category.toUpperCase()} (${caps.length} capabilities)\n    // ===========================\n${items}`);
  }

  return `import { PrismaClient, CapabilitySensitivity, CapabilityScope } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed de Capabilities gerado por: kaven config features
 * Generated at: ${new Date().toISOString()}
 *
 * Total: ${selected.length} capabilities
 * Categories: ${[...grouped.keys()].join(', ')}
 */

export async function seedCapabilities() {
  console.log('🔐 Seeding Capabilities...');

  const capabilities = [
${blocks.join("\n\n")}
  ];

  let created = 0;
  let skipped = 0;

  for (const capability of capabilities) {
    const existing = await prisma.capability.findUnique({
      where: { code: capability.code },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.capability.create({
      data: capability,
    });
    created++;
  }

  console.log(\`✅ Capabilities: \${created} criadas, \${skipped} já existiam\`);
  console.log(\`📊 Total de capabilities: \${capabilities.length}\`);
}
`;
}

// ---------------------------------------------------------------------------
// --list mode
// ---------------------------------------------------------------------------

function printList(): void {
  const grouped = groupByCategory(ALL_CAPABILITIES);

  console.log();
  console.log(chalk.bold.underline("Kaven Framework — Capability Catalog"));
  console.log(chalk.gray(`${ALL_CAPABILITIES.length} capabilities total\n`));

  for (const [category, caps] of grouped) {
    console.log(chalk.bold.cyan(`  ${category} (${caps.length})`));
    for (const cap of caps) {
      const flags: string[] = [];
      if (cap.requiresMFA) flags.push(chalk.red("MFA"));
      if (cap.requiresApproval) flags.push(chalk.yellow("APPROVAL"));
      const flagStr = flags.length > 0 ? ` ${flags.join(" ")}` : "";
      console.log(
        `    ${chalk.white(cap.code.padEnd(30))} ${sensitivityBadge(cap.sensitivity)}${flagStr}`
      );
      console.log(`      ${chalk.gray(cap.description)}`);
    }
    console.log();
  }

  console.log(chalk.bold("Tier presets:"));
  for (const tier of ["starter", "complete", "pro", "enterprise"] as FeatureTier[]) {
    console.log(
      `  ${tierLabel(tier).padEnd(20)} ${chalk.gray(`${TIER_PRESETS[tier].length} capabilities`)}`
    );
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Non-interactive --tier mode
// ---------------------------------------------------------------------------

async function applyTierDirect(
  tier: FeatureTier,
  outputPath: string
): Promise<void> {
  const codes = TIER_PRESETS[tier];
  console.log();
  console.log(
    `${chalk.bold("Applying tier:")} ${tierLabel(tier)} (${codes.length} capabilities)`
  );

  const content = generateSeedFile(codes);
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, content, "utf-8");

  console.log(chalk.green(`✅ Seed file written to: ${outputPath}`));
  console.log(
    chalk.gray(
      "Run `pnpm prisma db seed` to apply capabilities to your database."
    )
  );
  console.log();
}

// ---------------------------------------------------------------------------
// Interactive TUI mode
// ---------------------------------------------------------------------------

async function runInteractive(outputPath: string): Promise<void> {
  const { select, confirm } = await import("@inquirer/prompts");

  // checkbox está disponível em runtime via @inquirer/prompts mas a definição de tipos
  // não resolve @inquirer/checkbox no node_modules direto (pacote linkado via pnpm store).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const checkboxMod = require("@inquirer/prompts") as {
    checkbox: <T = string>(opts: {
      message: string;
      choices: Array<{ name: string; value: T; checked?: boolean }>;
    }) => Promise<T[]>;
  };
  const checkbox = checkboxMod.checkbox;

  console.log();
  console.log(chalk.bold.underline("Kaven Feature Flag Configuration"));
  console.log(
    chalk.gray(
      "Select a base tier and optionally customize individual capabilities.\n"
    )
  );

  // Step 1: Base tier selection
  const tierChoices = (
    ["starter", "complete", "pro", "enterprise"] as FeatureTier[]
  ).map((t) => ({
    name: `${tierLabel(t)} — ${TIER_PRESETS[t].length} capabilities`,
    value: t,
  }));

  tierChoices.push({ name: chalk.red("Cancel"), value: "cancel" as FeatureTier });

  const selectedTier = await select({
    message: "Select a base tier:",
    choices: tierChoices,
  });

  if ((selectedTier as string) === "cancel") {
    console.log(chalk.yellow("Cancelled."));
    return;
  }

  const baseCodes = new Set(TIER_PRESETS[selectedTier]);
  console.log(
    `\n${chalk.green("✓")} Base: ${tierLabel(selectedTier)} — ${baseCodes.size} capabilities loaded\n`
  );

  // Step 2: Optional customization per category
  const customize = await confirm({
    message: "Customize individual capabilities?",
    default: false,
  });

  let finalCodes: string[];

  if (!customize) {
    finalCodes = [...baseCodes];
  } else {
    const grouped = groupByCategory(ALL_CAPABILITIES);
    const customSelected: string[] = [];

    for (const [category, caps] of grouped) {
      console.log(`\n${chalk.bold.cyan(`  ${category}`)}`);

      const choices = caps.map((c) => {
        const flags: string[] = [];
        if (c.requiresMFA) flags.push("MFA");
        if (c.requiresApproval) flags.push("APPROVAL");
        const flagStr = flags.length > 0 ? ` [${flags.join(",")}]` : "";
        return {
          name: `${c.code.padEnd(32)} ${sensitivityBadge(c.sensitivity)}${flagStr} — ${c.description}`,
          value: c.code,
          checked: baseCodes.has(c.code),
        };
      });

      const selected = await checkbox({
        message: `${category} capabilities:`,
        choices,
      });

      customSelected.push(...selected);
    }

    finalCodes = customSelected;
  }

  if (finalCodes.length === 0) {
    console.log(chalk.yellow("\nNo capabilities selected. Seed file not written."));
    return;
  }

  // Step 3: Preview and confirm
  const grouped = groupByCategory(
    ALL_CAPABILITIES.filter((c) => finalCodes.includes(c.code))
  );

  console.log();
  console.log(chalk.bold.underline("Summary:"));
  for (const [category, caps] of grouped) {
    console.log(`  ${chalk.cyan(category)}: ${caps.length} capabilities`);
  }
  console.log(`  ${chalk.bold("Total:")} ${finalCodes.length} capabilities`);
  console.log(`  ${chalk.bold("Output:")} ${chalk.dim(outputPath)}`);
  console.log();

  const proceed = await confirm({
    message: "Write capabilities.seed.ts?",
    default: true,
  });

  if (!proceed) {
    console.log(chalk.yellow("Cancelled."));
    return;
  }

  const content = generateSeedFile(finalCodes);
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, content, "utf-8");

  console.log(chalk.green(`\n✅ Seed file written to: ${outputPath}`));
  console.log(
    chalk.gray(
      "Run `pnpm prisma db seed` to apply capabilities to your database.\n"
    )
  );
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

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

  // --list: just print the catalog, no writes
  if (options.list) {
    printList();
    return;
  }

  // --tier: non-interactive direct apply
  if (options.tier) {
    const validTiers: FeatureTier[] = ["starter", "complete", "pro", "enterprise"];
    if (!validTiers.includes(options.tier)) {
      console.error(
        chalk.red(
          `Error: Invalid tier "${options.tier}". Valid options: ${validTiers.join(", ")}`
        )
      );
      process.exit(1);
    }
    await applyTierDirect(options.tier, outputPath);
    return;
  }

  // Interactive TUI
  await runInteractive(outputPath);
}
