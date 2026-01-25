import chalk from "chalk";
import ora from "ora";
import path from "path";
import fs from "fs-extra";
import { ModuleInstaller } from "../../core/ModuleInstaller";
import { MarkerService } from "../../core/MarkerService";
import { ManifestParser } from "../../core/ManifestParser";
import { TelemetryBuffer } from "../../infrastructure/TelemetryBuffer";

export async function moduleAdd(
  manifestPath: string,
  projectRoot?: string,
): Promise<void> {
  const telemetry = TelemetryBuffer.getInstance();
  const startTime = Date.now();
  telemetry.capture("cli.module.add.start", { manifestPath });

  const root = projectRoot || process.cwd();
  const spinner = ora("Preparando instalação do módulo...").start();

  try {
    const markerService = new MarkerService();
    const manifestParser = new ManifestParser();
    const installer = new ModuleInstaller(root, markerService);

    // 1. Resolver caminho do manifest
    const absolutePath = path.isAbsolute(manifestPath)
      ? manifestPath
      : path.join(root, manifestPath);

    if (!(await fs.pathExists(absolutePath))) {
      throw new Error(`Arquivo de manifest não encontrado: ${manifestPath}`);
    }

    // 2. Parse do manifest
    spinner.text = "Validando manifest...";
    const manifest = await manifestParser.parse(absolutePath);

    // 3. Instalar
    spinner.text = `Instalando ${manifest.name}@${manifest.version}...`;
    await installer.install(manifest);

    // 4. Atualizar kaven.json
    spinner.text = "Atualizando configuração do projeto...";
    await updateKavenConfig(root, manifest.name, manifest.version);

    // 5. Cache do manifest para desinstalação futura
    spinner.text = "Salvando cache do manifest...";
    const cacheDir = path.join(
      root,
      ".kaven",
      "modules",
      manifest.name,
    );
    await fs.ensureDir(cacheDir);
    await fs.writeJson(path.join(cacheDir, "module.json"), manifest, {
      spaces: 2,
    });

    spinner.succeed(
      chalk.green(`Módulo ${manifest.name} instalado com sucesso!`),
    );
    
    telemetry.capture("cli.module.add.success", { name: manifest.name }, Date.now() - startTime);
    await telemetry.flush();
  } catch (error) {
    telemetry.capture("cli.module.add.error", { error: (error as Error).message }, Date.now() - startTime);
    await telemetry.flush();
    
    spinner.fail(
      chalk.red(
        `Falha na instalação: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    process.exit(1);
  }
}

interface KavenConfig {
  modules?: Record<string, string>;
}

async function updateKavenConfig(
  projectRoot: string,
  name: string,
  version: string,
) {
  const configPath = path.join(projectRoot, "kaven.json");
  let config: KavenConfig = { modules: {} };

  if (await fs.pathExists(configPath)) {
    config = await fs.readJson(configPath);
  }

  if (!config.modules) config.modules = {};
  config.modules[name] = version;

  await fs.writeJson(configPath, config, { spaces: 2 });
}
