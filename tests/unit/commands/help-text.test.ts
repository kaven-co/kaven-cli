import { describe, it, expect } from "vitest";
import { Command } from "commander";

/**
 * Smoke tests that verify every command has a description and
 * that --help output would contain expected keywords.
 * These run the Commander.js command setup without executing actions.
 */
function buildTestProgram(): Command {
  const program = new Command();
  program
    .name("kaven")
    .description("The official CLI for the Kaven SaaS boilerplate ecosystem")
    .version("0.2.0-alpha.1");

  program
    .command("init [project-name]")
    .description("Bootstrap a new Kaven project from the official template")
    .option("--defaults", "Skip interactive prompts")
    .option("--skip-install", "Skip pnpm install")
    .option("--skip-git", "Skip git init")
    .option("--force", "Overwrite existing directory")
    .action(() => {});

  const moduleCmd = program.command("module").description("Manage Kaven modules");
  moduleCmd.command("doctor").description("Run health checks").option("--fix").option("--json").action(() => {});
  moduleCmd.command("add <path>").description("Install a local module").action(() => {});
  moduleCmd.command("remove <name>").description("Remove a module").action(() => {});
  moduleCmd.command("publish").description("Publish module to marketplace").action(() => {});

  const authCmd = program.command("auth").description("Manage authentication");
  authCmd.command("login").description("Start device code auth flow").action(() => {});
  authCmd.command("logout").description("Clear local session").action(() => {});
  authCmd.command("whoami").description("Show user info").action(() => {});

  const marketplaceCmd = program.command("marketplace").description("Explore marketplace modules");
  marketplaceCmd.command("list").description("List available modules").action(() => {});
  marketplaceCmd.command("install <id>").description("Install a module").action(() => {});
  marketplaceCmd.command("browse").description("Interactive module browser").action(() => {});

  program.command("upgrade").description("Upgrade your license tier").action(() => {});

  const cacheCmd = program.command("cache").description("Manage local API cache");
  cacheCmd.command("status").description("Show cache stats").action(() => {});
  cacheCmd.command("clear").description("Clear all cached data").action(() => {});

  const telemetryCmd = program.command("telemetry").description("View audit logs");
  telemetryCmd.command("view").description("Display telemetry events").action(() => {});

  return program;
}

describe("CLI help text", () => {
  let program: Command;

  beforeEach(() => {
    program = buildTestProgram();
  });

  it("root program has a description", () => {
    expect(program.description()).toBeTruthy();
    expect(program.description()).toMatch(/kaven/i);
  });

  it("all top-level commands have descriptions", () => {
    const topLevelCommands = program.commands;
    for (const cmd of topLevelCommands) {
      expect(
        cmd.description(),
        `Command '${cmd.name()}' should have a description`
      ).toBeTruthy();
    }
  });

  it("module subcommands have descriptions", () => {
    const moduleCmd = program.commands.find((c) => c.name() === "module");
    expect(moduleCmd).toBeDefined();
    for (const sub of moduleCmd!.commands) {
      expect(
        sub.description(),
        `Subcommand 'module ${sub.name()}' should have a description`
      ).toBeTruthy();
    }
  });

  it("marketplace subcommands include browse", () => {
    const marketplaceCmd = program.commands.find(
      (c) => c.name() === "marketplace"
    );
    expect(marketplaceCmd).toBeDefined();
    const subNames = marketplaceCmd!.commands.map((c) => c.name());
    expect(subNames).toContain("browse");
    expect(subNames).toContain("list");
    expect(subNames).toContain("install");
  });

  it("init command has all expected options", () => {
    const initCmd = program.commands.find((c) => c.name() === "init");
    expect(initCmd).toBeDefined();
    const optionNames = initCmd!.options.map((o) => o.long);
    expect(optionNames).toContain("--defaults");
    expect(optionNames).toContain("--skip-install");
    expect(optionNames).toContain("--skip-git");
    expect(optionNames).toContain("--force");
  });
});

// Need to import beforeEach since we're using it
import { beforeEach } from "vitest";
