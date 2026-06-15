import { Command } from "commander";
import pc from "picocolors";
import { spinner } from "@clack/prompts";
import { runEnvironmentBootstrap } from "../init/aiox-bootstrap.js";
import { ProjectInitializer } from "../../core/ProjectInitializer.js";

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

  aiox
    .command("install-squad")
    .description("Install or repair kaven-squad in current project (resumes incomplete kaven init)")
    .action(async () => {
      const projectDir = process.cwd();
      const initializer = new ProjectInitializer();
      const s = spinner();

      s.start("Installing kaven-squad...");
      const squadResult = await initializer.installSquad(projectDir);

      if (squadResult.installed) {
        s.stop(pc.green("kaven-squad installed ✓"));

        s.start("Installing AIOX Core runtime...");
        const coreResult = await initializer.installAIOXCore(projectDir);
        if (coreResult.installed) {
          s.stop(pc.green("AIOX Core installed ✓"));
        } else {
          s.stop(pc.yellow(`AIOX Core skipped: ${coreResult.reason}`));
          console.log(pc.dim("  Run manually: npx aiox-core@latest install --quiet"));
        }
      } else if (squadResult.reason === "already-exists") {
        s.stop(pc.yellow("kaven-squad already installed — nothing to do"));
        console.log(pc.dim("  To reinstall: remove squads/kaven-squad/ and re-run"));
      } else {
        s.stop(pc.red(`Squad install failed: ${squadResult.reason}`));
        console.log(pc.dim("  Manual fallback: git clone https://github.com/bychrisr/kaven-squad squads/kaven-squad"));
        process.exit(1);
      }
    });
}
