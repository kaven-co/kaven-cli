import chalk from "chalk";
import ora from "ora";
import path from "path";
import fs from "fs-extra";
import { ModuleInstaller } from "../../core/ModuleInstaller";
import { TelemetryBuffer } from "../../infrastructure/TelemetryBuffer";
import { MarkerService } from "../../core/MarkerService";

export async function moduleRemove(moduleName: string, projectRoot?: string): Promise<void> {
  const telemetry = TelemetryBuffer.getInstance();
  const startTime = Date.now();
  telemetry.capture("cli.module.remove.start", { moduleName });

  const root = projectRoot || process.cwd();
  const spinner = ora(`Removendo módulo ${moduleName}...`).start();

  try {
    const markerService = new MarkerService();
    const installer = new ModuleInstaller(root, markerService);

    // 1. Verificar se o módulo está na config
    const configPath = path.join(root, "kaven.json");
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
      root,
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

    ora().succeed(chalk.green(`Módulo ${moduleName} removido com sucesso!`));

    telemetry.capture("cli.module.remove.success", { moduleName }, Date.now() - startTime);
    await telemetry.flush();
  } catch (error) {
    telemetry.capture("cli.module.remove.error", { error: (error as Error).message }, Date.now() - startTime);
    await telemetry.flush();

    ora().fail(chalk.red(`Falha ao remover módulo ${moduleName}:`));
    spinner.fail(
      chalk.red(
        `${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    process.exit(1);
  }
}
