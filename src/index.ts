#!/usr/bin/env node
import { Command } from "commander";
import { moduleDoctor } from "./commands/module/doctor";
import { moduleAdd } from "./commands/module/add";
import { moduleRemove } from "./commands/module/remove";
import { modulePublish } from "./commands/module/publish";
import { authLogin } from "./commands/auth/login";
import { authLogout } from "./commands/auth/logout";
import { authWhoami } from "./commands/auth/whoami";
import { marketplaceList } from "./commands/marketplace/list";
import { marketplaceInstall } from "./commands/marketplace/install";
import { marketplaceBrowse } from "./commands/marketplace/browse";
import { telemetryView } from "./commands/telemetry/view";
import { buildLicenseCommand } from "./commands/license/index.js";
import { initProject } from "./commands/init/index";
import { upgradeCommand } from "./commands/upgrade/index";
import { cacheStatus, cacheClear } from "./commands/cache/index";

export const main = () => {
  const program = new Command();

  program
    .name("kaven")
    .description("The official CLI for the Kaven SaaS boilerplate ecosystem")
    .version("0.2.0-alpha.1")
    .addHelpText(
      "after",
      `
Examples:
  $ kaven init my-saas-app          Bootstrap a new Kaven project
  $ kaven auth login                Authenticate with Kaven Marketplace
  $ kaven marketplace list          Browse available modules
  $ kaven marketplace install auth  Install the auth module
  $ kaven upgrade                   Upgrade your license tier
  $ kaven module doctor             Check project health

Documentation: https://docs.kaven.sh/cli
Support:       https://github.com/kaven-co/kaven-cli/issues
`
    );

  /**
   * Init command — Bootstrap a new Kaven project
   */
  program
    .command("init [project-name]")
    .description(
      "Bootstrap a new Kaven project from the official template"
    )
    .option("--defaults", "Skip interactive prompts and use default values")
    .option("--skip-install", "Skip running pnpm install after setup")
    .option("--skip-git", "Skip git init and initial commit")
    .option("--force", "Overwrite existing directory if it exists")
    .addHelpText(
      "after",
      `
Examples:
  $ kaven init my-app               Interactive setup
  $ kaven init my-app --defaults    Use defaults (no prompts)
  $ kaven init my-app --skip-git   Skip git initialization
`
    )
    .action((name, opts) =>
      initProject(name, {
        defaults: opts.defaults,
        skipInstall: opts.skipInstall,
        skipGit: opts.skipGit,
        force: opts.force,
      })
    );

  /**
   * Modules Group
   */
  const moduleCommand = program
    .command("module")
    .alias("m")
    .description("Manage Kaven modules: install, remove, publish, and diagnose")
    .addHelpText(
      "after",
      `
Examples:
  $ kaven module doctor             Check module integrity
  $ kaven module doctor --fix       Auto-fix detected issues
  $ kaven module add ./my-module    Install a local module
  $ kaven module remove payments    Remove a module
  $ kaven module publish            Publish module to marketplace
`
    );

  moduleCommand
    .command("doctor")
    .description(
      "Run comprehensive project and module health checks"
    )
    .option("--fix", "Attempt to auto-fix detected issues (pnpm install, prisma generate, env vars)")
    .option("--json", "Output results as machine-readable JSON")
    .addHelpText(
      "after",
      `
Exit codes:
  0  All checks passed
  1  One or more errors found
  2  Warnings only (no errors)

Examples:
  $ kaven module doctor
  $ kaven module doctor --fix
  $ kaven module doctor --json
`
    )
    .action((options) => moduleDoctor({ fix: options.fix, json: options.json }));

  moduleCommand
    .command("add <path>")
    .description("Install a module from a local manifest file")
    .addHelpText(
      "after",
      `
Examples:
  $ kaven module add ./modules/payments/module.json
  $ kaven module add /absolute/path/to/module.json
`
    )
    .action((path) => moduleAdd(path));

  moduleCommand
    .command("remove <name>")
    .description("Remove an installed module and clean up injected code")
    .addHelpText(
      "after",
      `
Examples:
  $ kaven module remove payments
  $ kaven module remove notifications
`
    )
    .action((name) => moduleRemove(name));

  moduleCommand
    .command("publish")
    .description(
      "Publish the current directory as a module to Kaven Marketplace"
    )
    .option("--dry-run", "Validate and package the module without uploading")
    .option("--changelog <text>", "Release notes for this version")
    .addHelpText(
      "after",
      `
Requirements:
  - module.json must exist in the current directory
  - Must be authenticated: run 'kaven auth login' first

Examples:
  $ kaven module publish
  $ kaven module publish --dry-run
  $ kaven module publish --changelog "Added dark mode support"
`
    )
    .action((opts) =>
      modulePublish({
        dryRun: opts.dryRun,
        changelog: opts.changelog,
      })
    );

  /**
   * Auth Group
   */
  const authCommand = program
    .command("auth")
    .description("Manage authentication and session tokens")
    .addHelpText(
      "after",
      `
Examples:
  $ kaven auth login    Start device code authentication flow
  $ kaven auth whoami   Show current user info
  $ kaven auth logout   End the local session
`
    );

  authCommand
    .command("login")
    .description(
      "Start the interactive device code authentication flow (RFC 8628)"
    )
    .action(() => authLogin());

  authCommand
    .command("logout")
    .description("Clear the local authentication session")
    .action(() => authLogout());

  authCommand
    .command("whoami")
    .description("Display information about the currently authenticated user")
    .action(() => authWhoami());

  /**
   * Marketplace Group
   */
  const marketplaceCommand = program
    .command("marketplace")
    .alias("mkt")
    .alias("market")
    .description("Explore, browse, and install modules from the Kaven Marketplace")
    .addHelpText(
      "after",
      `
Examples:
  $ kaven marketplace list
  $ kaven marketplace list --category auth --sort popular
  $ kaven marketplace install payments
  $ kaven marketplace browse
`
    );

  marketplaceCommand
    .command("list")
    .description("List all modules available in the marketplace")
    .option("--category <category>", "Filter modules by category")
    .option(
      "--sort <field>",
      "Sort order: newest (default), popular, name",
      "newest"
    )
    .option("--page <n>", "Page number (default: 1)", "1")
    .option("--limit <n>", "Results per page (default: 20, max: 100)", "20")
    .option("--json", "Output raw JSON instead of formatted table")
    .action((options) =>
      marketplaceList({
        category: options.category,
        sort: options.sort as "newest" | "popular" | "name",
        page: parseInt(options.page, 10),
        limit: parseInt(options.limit, 10),
        json: options.json ?? false,
      })
    );

  marketplaceCommand
    .command("install <moduleId>")
    .description(
      "Download and install a module from the Kaven Marketplace"
    )
    .option("--version <ver>", "Install a specific version (default: latest)")
    .option("--force", "Skip overwrite confirmation")
    .option("--skip-env", "Skip environment variable injection")
    .option("--env-file <path>", "Target .env file (default: .env)")
    .addHelpText(
      "after",
      `
Examples:
  $ kaven marketplace install payments
  $ kaven marketplace install payments --version 1.2.0
  $ kaven marketplace install auth --skip-env
`
    )
    .action((moduleId, options) =>
      marketplaceInstall(moduleId, {
        version: options.version,
        force: options.force ?? false,
        skipEnv: options.skipEnv ?? false,
        envFile: options.envFile,
      })
    );

  marketplaceCommand
    .command("browse")
    .description(
      "Interactive TUI module browser — explore modules by category"
    )
    .addHelpText(
      "after",
      `
Navigate with arrow keys, press Enter to select.
Supports category filtering and pagination.
`
    )
    .action(() => marketplaceBrowse());

  /**
   * Upgrade command — Tier upgrade via Paddle checkout
   */
  program
    .command("upgrade")
    .description("Upgrade your Kaven license to a higher tier")
    .option("--no-browser", "Print the checkout URL instead of opening the browser")
    .addHelpText(
      "after",
      `
This command creates a Paddle checkout session and polls for completion.
The upgrade is confirmed automatically when payment is processed (max 10 min).

Examples:
  $ kaven upgrade
  $ kaven upgrade --no-browser

Need help? https://kaven.sh/pricing
`
    )
    .action((opts) =>
      upgradeCommand({
        browser: opts.browser !== false,
      })
    );

  /**
   * Telemetry Group
   */
  const telemetryCommand = program
    .command("telemetry")
    .description("View observability and command audit logs");

  telemetryCommand
    .command("view")
    .description("Display the most recent local telemetry events")
    .option("-l, --limit <number>", "Number of events to display", "10")
    .action((options) => telemetryView(parseInt(options.limit)));

  /**
   * License Group
   */
  program.addCommand(buildLicenseCommand());

  /**
   * Cache Group
   */
  const cacheCommand = program
    .command("cache")
    .description("Manage the local API response cache")
    .addHelpText(
      "after",
      `
Cache directory: ~/.kaven/cache (max 50 MB)
Cached data: module listings (24h TTL), manifests (7d), license status (1h)

Examples:
  $ kaven cache status
  $ kaven cache clear
`
    );

  cacheCommand
    .command("status")
    .description("Show cache statistics (size, entry count, age)")
    .action(() => cacheStatus());

  cacheCommand
    .command("clear")
    .description("Delete all locally cached API responses")
    .action(() => cacheClear());

  program.parse();
};

if (require.main === module) {
  main();
}
