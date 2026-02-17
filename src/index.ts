#!/usr/bin/env node
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
import { buildLicenseCommand } from "./commands/license/index.js";

export const main = () => {
  const program = new Command();

  program
    .name("kaven")
    .description("CLI oficial para o ecossistema Kaven")
    .version("0.1.0-alpha.1");

  /**
   * Modules Group
   */
  const moduleCommand = program
    .command("module")
    .alias("m")
    .description("Gerenciamento de módulos e integridade");

  moduleCommand
    .command("doctor")
    .description("Verifica integridade do projeto e dos módulos instalados")
    .option("--fix", "Attempt to fix issues")
    .action((options) => moduleDoctor(options));

  moduleCommand
    .command("add <path>")
    .description("Instala um módulo a partir de um manifest local")
    .action((path) => moduleAdd(path));

  moduleCommand
    .command("remove <name>")
    .description("Remove um módulo e limpa injeções de código")
    .action((name) => moduleRemove(name));

  /**
   * Auth Group
   */
  const authCommand = program
    .command("auth")
    .description("Autenticação e gerenciamento de sessão");

  authCommand
    .command("login")
    .description("Inicia o fluxo de login interativo")
    .action(() => authLogin());

  authCommand
    .command("logout")
    .description("Encerra a sessão local")
    .action(() => authLogout());

  authCommand
    .command("whoami")
    .description("Exibe informações do usuário autenticado")
    .action(() => authWhoami());

  /**
   * Marketplace Group
   */
  const marketplaceCommand = program
    .command("marketplace")
    .alias("mkt")
    .alias("market")
    .description("Explorar e instalar módulos do Marketplace oficial");

  marketplaceCommand
    .command("list")
    .description("Lista todos os módulos disponíveis no marketplace")
    .option("--category <category>", "Filter by category")
    .option(
      "--sort <field>",
      "Sort order: newest (default), popular, name",
      "newest"
    )
    .option("--page <n>", "Page number (default: 1)", "1")
    .option("--limit <n>", "Results per page (default: 20, max: 100)", "20")
    .option("--json", "Output raw JSON")
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
    .description("Baixa e instala um módulo via Marketplace")
    .option("--version <ver>", "Install specific version (default: latest)")
    .option("--force", "Skip overwrite confirmation")
    .option("--skip-env", "Skip environment variable injection")
    .option("--env-file <path>", "Target .env file (default: .env)")
    .action((moduleId, options) =>
      marketplaceInstall(moduleId, {
        version: options.version,
        force: options.force ?? false,
        skipEnv: options.skipEnv ?? false,
        envFile: options.envFile,
      })
    );

  /**
   * Telemetry Group
   */
  const telemetryCommand = program
    .command("telemetry")
    .description("Observabilidade e auditoria de comandos");

  telemetryCommand
    .command("view")
    .description("Visualiza os últimos eventos de telemetria locais")
    .option("-l, --limit <number>", "Número de eventos a exibir", "10")
    .action((options) => telemetryView(parseInt(options.limit)));

  /**
   * License Group
   */
  program.addCommand(buildLicenseCommand());

  program.parse();
};

if (require.main === module) {
  main();
}
