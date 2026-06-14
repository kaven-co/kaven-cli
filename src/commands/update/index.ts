import path from "node:path";
import fs from "fs-extra";
import * as clackModule from "@clack/prompts";
import pc from "picocolors";
import { AuthService } from "../../core/AuthService.js";
import { MarketplaceClient } from "../../infrastructure/MarketplaceClient.js";
import { getInstalledVersion } from "../../core/ModuleCache.js";
import { moduleUpdate } from "../module/update.js";
import { ensureError } from "../../infrastructure/errors.js";

export const ui = {
  intro: clackModule.intro,
  outro: clackModule.outro,
  spinner: clackModule.spinner,
  log: {
    info: clackModule.log.info,
    warn: clackModule.log.warn,
    success: clackModule.log.success,
    error: clackModule.log.error,
    step: clackModule.log.step,
    message: clackModule.log.message,
  },
};

const CLI_NAME = "kaven-cli";

export interface UpdateOptions {
  core?: boolean;
  module?: string;
  all?: boolean;
  check?: boolean;
  skipVerify?: boolean;
}

interface UpdateSummary {
  cliCurrent: string;
  cliLatest: string | null;
  cliOutdated: boolean;
  modules: ModuleUpdateInfo[];
}

interface ModuleUpdateInfo {
  slug: string;
  installed: string;
  latest: string | null;
  outdated: boolean;
  error?: string;
}

function getCurrentCliVersion(projectRoot: string): string {
  const paths = [
    path.join(projectRoot, "package.json"),
    path.join(path.dirname(new URL(import.meta.url).pathname), "../../../package.json"),
    path.join(path.dirname(new URL(import.meta.url).pathname), "../../package.json"),
  ];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const pkg = JSON.parse(fs.readFileSync(p, "utf8")) as { version?: string };
        if (pkg.version) return pkg.version;
      }
    } catch { /* ignore */ }
  }
  return "0.4.2-alpha.0";
}

async function fetchCliLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${CLI_NAME}`);
    if (!res.ok) return null;
    const data = await res.json() as { "dist-tags"?: Record<string, string> };
    return data["dist-tags"]?.latest ?? null;
  } catch {
    return null;
  }
}

function compareSemver(a: string, b: string): number {
  const clean = (v: string) => v.replace(/^v/, "").split("-")[0].split(".").map(Number);
  const pa = clean(a);
  const pb = clean(b);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

async function getInstalledModuleSlugs(projectRoot: string): Promise<string[]> {
  const cacheDir = path.join(projectRoot, ".kaven", "cache", "modules");
  if (!(await fs.pathExists(cacheDir))) return [];
  const entries = await fs.readdir(cacheDir);
  const slugs = new Set<string>();
  for (const e of entries) {
    const lastDash = e.lastIndexOf("-");
    if (lastDash > 0) slugs.add(e.slice(0, lastDash));
  }
  return [...slugs];
}

async function buildSummary(projectRoot: string, checkCore: boolean): Promise<UpdateSummary> {
  const cliCurrent = getCurrentCliVersion(projectRoot);
  let cliLatest: string | null = null;
  let cliOutdated = false;

  if (checkCore) {
    cliLatest = await fetchCliLatestVersion();
    if (cliLatest && compareSemver(cliLatest, cliCurrent) > 0) cliOutdated = true;
  }

  const slugs = await getInstalledModuleSlugs(projectRoot);
  const modules: ModuleUpdateInfo[] = [];

  if (slugs.length > 0) {
    let client: MarketplaceClient | null = null;
    try {
      const authService = new AuthService();
      await authService.getValidToken();
      client = new MarketplaceClient(authService);
    } catch {
      // marketplace unreachable or not authenticated — still report installed modules
    }

    for (const slug of slugs) {
      const installed = await getInstalledVersion(slug, projectRoot);
      if (!installed) continue;

      let latest: string | null = null;
      let error: string | undefined;

      if (client) {
        try {
          const mod = await client.getModule(slug);
          latest = mod.latestVersion ?? null;
        } catch (err) {
          error = ensureError(err).message;
        }
      } else {
        error = "marketplace offline or not authenticated";
      }

      const outdated = !!(latest && compareSemver(latest, installed) > 0);
      modules.push({ slug, installed, latest, outdated, error });
    }
  }

  return { cliCurrent, cliLatest, cliOutdated, modules };
}

function printSummary(summary: UpdateSummary, checkCore: boolean): void {
  if (checkCore) {
    if (summary.cliLatest === null) {
      ui.log.warn(pc.yellow(`kaven-cli: ${pc.bold(summary.cliCurrent)} (could not reach npm)`));
    } else if (summary.cliOutdated) {
      ui.log.warn(
        pc.yellow(`kaven-cli: ${pc.bold(summary.cliCurrent)} → ${pc.bold(summary.cliLatest)} available`) +
        pc.dim("\n  npm install -g kaven-cli@latest")
      );
    } else {
      ui.log.success(pc.green(`kaven-cli: ${pc.bold(summary.cliCurrent)} ✓ up to date`));
    }
  }

  if (summary.modules.length === 0) {
    ui.log.info(pc.dim("No modules installed in this project."));
    return;
  }

  for (const m of summary.modules) {
    if (m.error) {
      ui.log.warn(pc.yellow(`${m.slug}: ${pc.bold(m.installed)} (${m.error})`));
    } else if (m.outdated) {
      ui.log.warn(pc.yellow(`${m.slug}: ${pc.bold(m.installed)} → ${pc.bold(m.latest!)} available`));
    } else {
      ui.log.success(pc.green(`${m.slug}: ${pc.bold(m.installed)} ✓`));
    }
  }
}

export async function updateCommand(options: UpdateOptions = {}, projectRoot?: string): Promise<void> {
  const root = projectRoot ?? process.cwd();
  const { core, module: moduleSlug, all, check: checkOnly, skipVerify } = options;

  // --module <slug>: delegate directly to module update
  if (moduleSlug) {
    await moduleUpdate(moduleSlug, root, { skipVerify });
    return;
  }

  const checkCore = !!(core || all || (!core && !moduleSlug));

  ui.intro(pc.bold(pc.cyan("kaven update")));

  const spinner = ui.spinner();
  spinner.start("Verificando atualizações disponíveis...");
  const summary = await buildSummary(root, checkCore);
  spinner.stop("Status de atualizações:");

  printSummary(summary, checkCore);

  const hasUpdates = summary.cliOutdated || summary.modules.some((m) => m.outdated);

  if (!hasUpdates) {
    ui.outro(pc.green("✓ Tudo atualizado."));
    return;
  }

  if (checkOnly) {
    ui.outro(pc.yellow("Atualizações disponíveis. Rode sem --check para aplicar."));
    return;
  }

  // Apply updates
  if (all || core) {
    if (summary.cliOutdated && summary.cliLatest) {
      ui.log.info(pc.cyan(`Atualizando kaven-cli ${summary.cliCurrent} → ${summary.cliLatest}...`));
      ui.log.info(pc.dim("  Execute: npm install -g kaven-cli@latest"));
    }
  }

  if (all) {
    const outdatedModules = summary.modules.filter((m) => m.outdated);
    for (const m of outdatedModules) {
      ui.log.info(pc.cyan(`\nAtualizando módulo ${m.slug} ${m.installed} → ${m.latest}...`));
      await moduleUpdate(m.slug, root, { skipVerify });
    }
    ui.outro(pc.green("✓ Todos os módulos atualizados."));
    return;
  }

  if (!core) {
    // Default (no flags): check only, show what's outdated
    const outdatedModules = summary.modules.filter((m) => m.outdated);
    if (outdatedModules.length > 0) {
      ui.log.info(pc.dim("\nPara atualizar módulos:"));
      for (const m of outdatedModules) {
        ui.log.info(pc.dim(`  kaven update --module ${m.slug}`));
      }
      ui.log.info(pc.dim("\nPara atualizar tudo: kaven update --all"));
    }
    ui.outro("");
  }
}
