import chalk from "chalk";
import ora from "ora";
import { MarketplaceClient } from "../../infrastructure/MarketplaceClient";
import { TelemetryBuffer } from "../../infrastructure/TelemetryBuffer";

export async function marketplaceList(): Promise<void> {
  const telemetry = TelemetryBuffer.getInstance();
  const startTime = Date.now();
  telemetry.capture("cli.marketplace.list.start");

  const client = new MarketplaceClient();
  const spinner = ora("Buscando módulos no Marketplace...").start();

  try {
    const result = await client.listModules();
    spinner.stop();

    const modules = result.data;

    if (modules.length === 0) {
      console.log(chalk.yellow("Nenhum módulo encontrado no Marketplace no momento."));
      return;
    }

    console.log(chalk.blue.bold("\n Módulos Disponíveis no Marketplace:\n"));

    // Header (manual alignment)
    console.log(
      chalk.gray(
        `${"SLUG".padEnd(24)} ${"NOME".padEnd(24)} ${"VERSÃO".padEnd(10)} ${"AUTOR"}`,
      ),
    );
    console.log(chalk.gray("-".repeat(75)));

    modules.forEach((mod) => {
      console.log(
        `${chalk.cyan(mod.slug.padEnd(24))} ${chalk.white(mod.name.padEnd(24))} ${chalk.green(
          mod.latestVersion.padEnd(10),
        )} ${chalk.gray(mod.author)}`,
      );
      console.log(chalk.italic.gray(`   > ${mod.description}\n`));
    });

    console.log(chalk.gray(`Total: ${modules.length} módulos encontrados.\n`));
    console.log(chalk.gray("Use 'kaven marketplace install <slug>' para instalar um módulo."));

    telemetry.capture("cli.marketplace.list.success", { count: modules.length }, Date.now() - startTime);
    await telemetry.flush();
  } catch (error) {
    telemetry.capture("cli.marketplace.list.error", { error: (error as Error).message }, Date.now() - startTime);
    await telemetry.flush();

    spinner.fail(chalk.red("Erro ao buscar módulos no Marketplace."));
    console.error(error);
    process.exit(1);
  }
}
