import { Command } from "commander";
import { moduleDoctor } from "./commands/module/doctor";
import { moduleAdd } from "./commands/module/add";
import { moduleRemove } from "./commands/module/remove";

export const main = () => {
  const program = new Command();

  program
    .name("kaven")
    .description("Kaven CLI - The official command line tool for Kaven")
    .version("0.1.0-alpha.0");

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

  program.parse();
};

if (require.main === module) {
  main();
}
