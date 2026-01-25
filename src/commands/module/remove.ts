import chalk from "chalk";
import ora from "ora";
import path from "path";
import fs from "fs-extra";
import { ModuleInstaller } from "../../core/ModuleInstaller";
import { MarkerService } from "../../core/MarkerService";

export async function moduleRemove(
  moduleName: string,
  projectRoot: string = process.cwd(),
): Promise<void> {
  const spinner = ora(`Removendo módulo ${moduleName}...`).start();

  try {
    const markerService = new MarkerService();
    const installer = new ModuleInstaller(projectRoot, markerService);

    // 1. Verificar se o módulo está na config
    const configPath = path.join(projectRoot, "kaven.json");
    if (!(await fs.pathExists(configPath))) {
      throw new Error(
        "Arquivo kaven.json não encontrado. Este é um projeto Kaven?",
      );
    }

    const config = await fs.readJson(configPath);
    if (!config.modules || !config.modules[moduleName]) {
      throw new Error(`O módulo ${moduleName} não está instalado.`);
    }

    // 2. Carregar manifest do cache
    const manifestPath = path.join(
      projectRoot,
      ".kaven",
      "modules",
      moduleName,
      "module.json",
    );
    if (!(await fs.pathExists(manifestPath))) {
      throw new Error(
        `Cache do manifest para ${moduleName} não encontrado em ${manifestPath}. A remoção precisa do manifest original.`,
      );
    }

    const manifest = await fs.readJson(manifestPath);

    // 3. Desinstalar
    spinner.text = `Removendo injeções de ${moduleName}...`;
    await installer.uninstall(manifest);

    // 4. Atualizar config
    spinner.text = "Atualizando configuração do projeto...";
    delete config.modules[moduleName];
    await fs.writeJson(configPath, config, { spaces: 2 });

    // 5. Limpar cache do manifest
    await fs.remove(path.dirname(manifestPath));

    spinner.succeed(chalk.green(`Módulo ${moduleName} removido com sucesso!`));
  } catch (error) {
    spinner.fail(
      chalk.red(
        `Falha na remoção: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    process.exit(1);
  }
}
