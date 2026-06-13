import fs from "fs-extra";
import path from "path";
import os from "os";
import * as tarModule from "tar";
import * as clackModule from "@clack/prompts";
import pc from "picocolors";
import { AuthService } from "../../core/AuthService.js";
import { MarketplaceClient } from "../../infrastructure/MarketplaceClient.js";
import { GitMergeService } from "../../core/GitMergeService.js";
import { TelemetryBuffer } from "../../infrastructure/TelemetryBuffer.js";
import { ensureError } from "../../infrastructure/errors.js";
import { verifyDownload } from "../../core/SignatureVerifier.js";
import {
  cacheBaseline,
  getInstalledVersion,
  getBaselineCachePath,
  removeBaselineCache,
} from "../../core/ModuleCache.js";

// Exported for testability (properties are mutable, unlike frozen module namespace)
export const tar = { x: tarModule.x };
export const ui = {
  intro: clackModule.intro,
  outro: clackModule.outro,
  spinner: clackModule.spinner,
  confirm: clackModule.confirm,
  select: clackModule.select,
  isCancel: clackModule.isCancel,
  log: clackModule.log,
};

function sanitizePaths(paths: string[]): string[] {
  return paths.filter((p) => {
    const normalized = path.normalize(p);
    return !normalized.startsWith("..") && !path.isAbsolute(normalized);
  });
}

interface ConflictsRecord {
  module: string;
  fromVersion: string;
  toVersion: string;
  timestamp: string;
  conflicts: string[];
}

async function makeTempDir(): Promise<string> {
  const tmp = path.join(os.tmpdir(), `kaven-update-${Date.now()}`);
  await fs.ensureDir(tmp);
  return tmp;
}

async function detectPendingConflicts(projectRoot: string, slug: string): Promise<ConflictsRecord | null> {
  const conflictsPath = path.join(projectRoot, ".kaven", "conflicts.json");
  if (!(await fs.pathExists(conflictsPath))) return null;
  try {
    const data: ConflictsRecord = await fs.readJson(conflictsPath);
    if (data.module === slug) return data;
  } catch {
    // ignore malformed file
  }
  return null;
}

export interface ModuleUpdateOptions {
  skipVerify?: boolean;
}

export async function moduleUpdate(slug: string | undefined, projectRoot?: string, options: ModuleUpdateOptions = {}): Promise<void> {
  const telemetry = TelemetryBuffer.getInstance();
  const startTime = Date.now();
  const root = projectRoot ?? process.cwd();

  ui.intro(pc.bold(pc.cyan("kaven module update")));

  // AC11: no slug → interactive selection
  if (!slug) {
    slug = await selectInstalledModule(root);
    if (!slug) {
      ui.outro(pc.yellow("Nenhum módulo selecionado."));
      return;
    }
  }

  telemetry.capture("cli.module.update.start", { slug });

  let tempDir: string | undefined;

  try {
    // AC9: detect pending conflict state
    const pending = await detectPendingConflicts(root, slug);
    if (pending) {
      const resume = await ui.confirm({
        message: pc.yellow(
          `Conflitos pendentes encontrados do update ${pending.fromVersion}→${pending.toVersion}. Deseja tentar novamente?`
        ),
      });
      if (ui.isCancel(resume) || !resume) {
        ui.outro(pc.yellow("Update cancelado. Resolva os conflitos manualmente e rode novamente."));
        return;
      }
      await fs.remove(path.join(root, ".kaven", "conflicts.json"));
    }

    // AC3: verify module is installed
    const installedVersion = await getInstalledVersion(slug, root);
    if (!installedVersion) {
      ui.outro(pc.red(`Módulo '${slug}' não está instalado. Use 'kaven marketplace install ${slug}' primeiro.`));
      process.exit(1);
    }

    const spinner = ui.spinner();

    // fetch latest version from marketplace
    spinner.start(`Verificando versão mais recente de '${slug}'...`);
    const authService = new AuthService();
    const client = new MarketplaceClient(authService);
    try {
      await authService.getValidToken();
    } catch {
      spinner.stop("Autenticação necessária.");
      ui.outro(pc.red("Execute: kaven auth login"));
      process.exit(1);
    }

    const moduleData = await client.getModule(slug);
    const latestVersion = moduleData.latestVersion ?? moduleData.releases?.[0]?.version;

    if (!latestVersion) {
      spinner.stop();
      ui.outro(pc.red(`Nenhuma versão publicada encontrada para '${slug}'.`));
      process.exit(1);
    }

    spinner.stop(`Versão instalada: ${pc.bold(installedVersion)} — Última versão: ${pc.bold(latestVersion)}`);

    // AC2: already up to date
    if (installedVersion === latestVersion) {
      ui.outro(pc.green(`✓ '${slug}' já está na versão mais recente (${latestVersion}).`));
      telemetry.capture("cli.module.update.already_latest", { slug, version: latestVersion }, Date.now() - startTime);
      await telemetry.flush();
      return;
    }

    // download new version
    spinner.start(`Baixando '${slug}@${latestVersion}'...`);
    const downloadToken = await client.createDownloadToken(slug, latestVersion);
    tempDir = await makeTempDir();
    const tarPath = path.join(tempDir, "module.tar.gz");
    const extractDir = path.join(tempDir, "extracted");
    await fs.ensureDir(extractDir);

    const absoluteUrl = await client.resolveUrl(downloadToken.downloadUrl);
    const response = await fetch(absoluteUrl);
    if (!response.ok || !response.body) {
      throw new Error(`Download falhou: ${response.status} ${response.statusText}`);
    }

    const fileStream = fs.createWriteStream(tarPath);
    const reader = response.body.getReader();
    await new Promise<void>((resolve, reject) => {
      const pump = async () => {
        try {
          let reading = true;
          while (reading) {
            const { done, value } = await reader.read();
            if (done) { fileStream.end(); reading = false; }
            else {
              if (!fileStream.write(value)) {
                await new Promise<void>((r) => fileStream.once("drain", r));
              }
            }
          }
          fileStream.once("finish", resolve);
          fileStream.once("error", reject);
        } catch (err) { reject(err); }
      };
      pump();
    });

    spinner.stop(`Download concluído: ${slug}@${latestVersion}`);

    // verify Ed25519 signature + checksum (same as install)
    if (!options.skipVerify) {
      spinner.start(`Verificando assinatura de ${slug}@${latestVersion}...`);
      const releaseInfo = await client.getReleaseInfo(slug, latestVersion);
      if (releaseInfo.checksum && releaseInfo.signature && releaseInfo.publicKey) {
        await verifyDownload({
          filePath: tarPath,
          expectedChecksum: releaseInfo.checksum,
          signature: releaseInfo.signature,
          publicKeyBase64: releaseInfo.publicKey,
        });
        spinner.stop(`Assinatura verificada: ${slug}@${latestVersion}`);
      } else {
        spinner.stop(`Sem dados de assinatura para ${slug}@${latestVersion} — verificação ignorada`);
      }
    }

    // extract
    spinner.start("Extraindo arquivos...");
    await tar.x({ file: tarPath, cwd: extractDir });
    spinner.stop("Extração completa.");

    // read module.json from new version
    const manifestPath = path.join(extractDir, "module.json");
    if (!(await fs.pathExists(manifestPath))) {
      throw new Error(`module.json não encontrado no pacote de '${slug}@${latestVersion}'`);
    }
    const manifest = await fs.readJson(manifestPath);
    const mergeable: string[] = sanitizePaths(manifest.mergeable ?? []);
    const copyOnly: string[] = sanitizePaths(manifest.copyOnly ?? []);

    // AC8: cache new version BEFORE merge
    spinner.start(`Cacheando baseline de ${slug}@${latestVersion}...`);
    await cacheBaseline(slug, latestVersion, extractDir, root);
    spinner.stop("Baseline cacheado.");

    const oldCachePath = getBaselineCachePath(slug, installedVersion, root);
    const mergeService = new GitMergeService();
    const conflictFiles: string[] = [];

    // AC4: 3-way merge on mergeable files
    for (const relFile of mergeable) {
      const targetFile = path.join(root, relFile);
      const baseFile = path.join(oldCachePath, relFile);
      const updateFile = path.join(extractDir, relFile);

      if (!(await fs.pathExists(updateFile))) continue;

      spinner.start(`Mergeando ${relFile}...`);
      const result = await mergeService.performMerge(targetFile, baseFile, updateFile);
      if (result.conflicts) {
        conflictFiles.push(relFile);
        spinner.stop(pc.yellow(`  Conflito em ${relFile}`));
      } else {
        spinner.stop(pc.green(`  ✓ ${relFile}`));
      }
    }

    // AC5: direct overwrite for copyOnly files
    for (const relFile of copyOnly) {
      const srcFile = path.join(extractDir, relFile);
      const destFile = path.join(root, relFile);
      if (!(await fs.pathExists(srcFile))) continue;
      spinner.start(`Copiando ${relFile}...`);
      await fs.ensureDir(path.dirname(destFile));
      await fs.copy(srcFile, destFile, { overwrite: true });
      spinner.stop(pc.green(`  ✓ ${relFile} (sobrescrito)`));
    }

    // AC6: conflicts → write conflicts.json, keep old registry version
    if (conflictFiles.length > 0) {
      const conflictsRecord: ConflictsRecord = {
        module: slug,
        fromVersion: installedVersion,
        toVersion: latestVersion,
        timestamp: new Date().toISOString(),
        conflicts: conflictFiles,
      };
      await fs.ensureDir(path.join(root, ".kaven"));
      await fs.writeJson(path.join(root, ".kaven", "conflicts.json"), conflictsRecord, { spaces: 2 });

      ui.outro(
        pc.red(
          `Update parcial — ${conflictFiles.length} conflito(s) detectado(s):\n` +
          conflictFiles.map((f) => `  • ${f}`).join("\n") +
          `\n\nResolva os conflitos (marcadores git <<<<<<< / ======= / >>>>>>>), depois rode 'kaven module update ${slug}' novamente.`
        )
      );

      telemetry.capture("cli.module.update.conflicts", { slug, fromVersion: installedVersion, toVersion: latestVersion, conflictCount: conflictFiles.length }, Date.now() - startTime);
      await telemetry.flush();
      return;
    }

    // AC7: clean update — update registry, remove old cache
    await updateRegistry(root, slug, latestVersion);
    await removeBaselineCache(slug, installedVersion, root);

    ui.outro(pc.green(`✓ '${slug}' atualizado de ${installedVersion} → ${latestVersion}`));

    telemetry.capture("cli.module.update.success", { slug, fromVersion: installedVersion, toVersion: latestVersion }, Date.now() - startTime);
    await telemetry.flush();
  } catch (err: unknown) {
    const error = ensureError(err);
    ui.outro(pc.red(`Falha ao atualizar '${slug}': ${error.message}`));
    telemetry.capture("cli.module.update.error", { slug, error: error.message }, Date.now() - startTime);
    await telemetry.flush();
    process.exit(1);
  } finally {
    if (tempDir) await fs.remove(tempDir).catch(() => undefined);
  }
}

async function updateRegistry(projectRoot: string, slug: string, newVersion: string): Promise<void> {
  const configPath = path.join(projectRoot, "kaven.json");
  let config: Record<string, unknown> = {};
  if (await fs.pathExists(configPath)) {
    config = await fs.readJson(configPath);
  }
  if (!config.modules || typeof config.modules !== "object" || Array.isArray(config.modules)) {
    config.modules = {};
  }
  (config.modules as Record<string, string>)[slug] = newVersion;
  await fs.writeJson(configPath, config, { spaces: 2 });
}

async function selectInstalledModule(projectRoot: string): Promise<string | undefined> {
  const cacheDir = path.join(projectRoot, ".kaven", "cache", "modules");
  if (!(await fs.pathExists(cacheDir))) {
    ui.log.warn("Nenhum módulo instalado encontrado.");
    return undefined;
  }

  const entries = await fs.readdir(cacheDir);
  if (entries.length === 0) {
    ui.log.warn("Nenhum módulo instalado encontrado.");
    return undefined;
  }

  const options = entries.map((e) => {
    const lastDash = e.lastIndexOf("-");
    const slug = e.slice(0, lastDash);
    const version = e.slice(lastDash + 1);
    return { value: slug, label: `${slug} (${version})` };
  });

  const selected = await ui.select({
    message: "Selecione o módulo para atualizar:",
    options,
  });

  if (ui.isCancel(selected)) return undefined;
  return selected as string;
}
