import { Command } from "commander";
import { runEnvironmentBootstrap } from "../init/aiox-bootstrap.js";

/**
 * Registers the AIOX integration commands
 */
export function registerAioxCommand(program: Command) {
  const aiox = program
    .command("aiox")
    .description("AIOX integration utilities");

  aiox
    .command("bootstrap")
    .description("Run AIOX environment bootstrap in current project")
    .option("--skip-aiox", "Skip AIOX logic (for testing)")
    .action(async (options) => {
      const projectDir = process.cwd();
      await runEnvironmentBootstrap(projectDir, options);
    });
}
