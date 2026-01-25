import chalk from "chalk";
import ora from "ora";
import { MarketplaceClient } from "../../infrastructure/MarketplaceClient";

export async function marketplaceList(): Promise<void> {
  const client = new MarketplaceClient();
  const spinner = ora("Buscando módulos no Marketplace...").start();

  try {
    const modules = await client.listModules();
    spinner.stop();

    if (modules.length === 0) {
      console.log(chalk.yellow("Nenhum módulo encontrado no Marketplace no momento."));
      return;
    }

    console.log(chalk.blue.bold("\n📦 Módulos Disponíveis no Marketplace:\n"));

    // Header (manual alignment)
    console.log(
      chalk.gray(
        `${"ID".padEnd(20)} ${"NOME".padEnd(20)} ${"VERSÃO".padEnd(10)} ${"AUTOR"}`,
      ),
    );
    console.log(chalk.gray("-".repeat(70)));

    modules.forEach((mod) => {
      console.log(
        `${chalk.cyan(mod.id.padEnd(20))} ${chalk.white(mod.name.padEnd(20))} ${chalk.green(
          mod.version.padEnd(10),
        )} ${chalk.gray(mod.author)}`,
      );
      console.log(chalk.italic.gray(`   > ${mod.description}\n`));
    });

    console.log(chalk.gray(`Total: ${modules.length} módulos encontrados.\n`));
    console.log(chalk.gray("Use 'kaven marketplace install <id>' para instalar um módulo."));
  } catch (error) {
    spinner.fail(chalk.red("Erro ao buscar módulos no Marketplace."));
    console.error(error);
    process.exit(1);
  }
}
