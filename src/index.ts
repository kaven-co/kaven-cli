import { Command } from "commander";
import { moduleDoctor } from "./commands/module/doctor";
import { moduleAdd } from "./commands/module/add";
import { moduleRemove } from "./commands/module/remove";
import { authLogin } from "./commands/auth/login";
import { authLogout } from "./commands/auth/logout";
import { authWhoami } from "./commands/auth/whoami";
import { marketplaceList } from "./commands/marketplace/list";
import { marketplaceInstall } from "./commands/marketplace/install";
import { telemetryView } from "./commands/telemetry/view";

export const main = () => {
  const program = new Command();

  program
    .name("kaven")
    .description("Kaven CLI - The official command line tool for Kaven")
    .version("0.1.0-alpha.0");

  /**
   * Modules Group
   */
  const moduleCommand = program
    .command("module")
    .description("Module management commands");

  moduleCommand
    .command("doctor")
    .description("Check module health")
    .option("--fix", "Attempt to fix issues")
    .action((options) => moduleDoctor(options));

  moduleCommand
    .command("add <manifest>")
    .description("Add a module to the project")
    .action((manifest) => moduleAdd(manifest));

  moduleCommand
    .command("remove <name>")
    .description("Remove a module from the project")
    .action((name) => moduleRemove(name));

  /**
   * Auth Group
   */
  const authCommand = program
    .command("auth")
    .description("Authentication commands");

  authCommand
    .command("login")
    .description("Log in to Kaven Cloud")
    .action(() => authLogin());

  authCommand
    .command("logout")
    .description("Log out from Kaven Cloud")
    .action(() => authLogout());

  authCommand
    .command("whoami")
    .description("Check current login status")
    .action(() => authWhoami());

  /**
   * Marketplace Group
   */
  const marketplaceCommand = program
    .command("marketplace")
    .alias("mkt")
    .alias("market")
    .description("Kaven Marketplace commands");

  marketplaceCommand
    .command("list")
    .description("List available modules in the marketplace")
    .action(() => marketplaceList());

  marketplaceCommand
    .command("install <moduleId>")
    .description("Install a module from the marketplace")
    .action((moduleId) => marketplaceInstall(moduleId));

  /**
   * Telemetry Group
   */
  const telemetryCommand = program
    .command("telemetry")
    .description("Telemetry and observability commands");

  telemetryCommand
    .command("view")
    .description("View recent telemetry events")
    .option("-l, --limit <number>", "Number of events to show", "10")
    .action((options) => telemetryView(parseInt(options.limit)));

  program.parse();
};

if (require.main === module) {
  main();
}
