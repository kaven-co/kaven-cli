import chalk from "chalk";
import ora from "ora";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { MarketplaceClient } from "../../infrastructure/MarketplaceClient";
import { AuthService } from "../../core/AuthService";
import { moduleAdd } from "../module/add";
import { TelemetryBuffer } from "../../infrastructure/TelemetryBuffer";

export async function marketplaceInstall(moduleId: string): Promise<void> {
  const telemetry = TelemetryBuffer.getInstance();
  const startTime = Date.now();
  telemetry.capture("cli.marketplace.install.start", { moduleId });

  const authService = new AuthService();
  const client = new MarketplaceClient();

  // 1. Verificar Autenticação
  if (!(await authService.isAuthenticated())) {
    console.log(chalk.red("\n❌ Erro: Autenticação necessária."));
    console.log(chalk.yellow("O Marketplace da Kaven exige que você esteja logado para instalar módulos."));
    console.log(chalk.gray("\nExecute: kaven auth login\n"));
    process.exit(1);
  }

  const spinner = ora(`Preparando instalação de '${moduleId}'...`).start();

  try {
    // 2. Buscar Manifest Remoto
    spinner.text = `Buscando manifest de '${moduleId}' no Marketplace...`;
    const manifest = await client.getModuleManifest(moduleId);

    if (!manifest) {
      spinner.fail(chalk.red(`Módulo '${moduleId}' não encontrado no Marketplace.`));
      process.exit(1);
    }

    spinner.succeed(chalk.green(`Módulo '${moduleId}' encontrado.`));

    // 3. Salvar manifest temporário para usar o moduleAdd existente
    // Em uma versão futura, o moduleAdd poderia aceitar um objeto de manifest diretamente
    const tempDir = path.join(os.tmpdir(), "kaven-mkt-install");
    await fs.ensureDir(tempDir);
    const tempManifestPath = path.join(tempDir, `${moduleId}-manifest.json`);
    await fs.writeJson(tempManifestPath, manifest);

    // 4. Executar instalação (reutilizando lógica transacional do moduleAdd)
    await moduleAdd(tempManifestPath);

    // 5. Cleanup
    await fs.remove(tempDir);

    telemetry.capture("cli.marketplace.install.success", { moduleId }, Date.now() - startTime);
    await telemetry.flush();
  } catch (error) {
    telemetry.capture("cli.marketplace.install.error", { moduleId, error: (error as Error).message }, Date.now() - startTime);
    await telemetry.flush();

    spinner.fail(chalk.red(`Falha na instalação do módulo '${moduleId}'.`));
    console.error(error);
    process.exit(1);
  }
}
