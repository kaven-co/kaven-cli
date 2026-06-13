import fs from "fs-extra";
import path from "path";

const MODULES_CACHE_DIR = ".kaven/cache/modules";

function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

export async function cacheBaseline(
  slug: string,
  version: string,
  extractedPath: string,
  projectRoot: string
): Promise<void> {
  const cachePath = path.join(projectRoot, MODULES_CACHE_DIR, `${slug}-${version}`);
  await fs.ensureDir(cachePath);
  await fs.copy(extractedPath, cachePath);
}

export async function getInstalledVersion(
  slug: string,
  projectRoot: string
): Promise<string | null> {
  const cacheDir = path.join(projectRoot, MODULES_CACHE_DIR);

  if (!(await fs.pathExists(cacheDir))) {
    return null;
  }

  const entries = await fs.readdir(cacheDir);

  // Extract slug via lastIndexOf('-') to avoid prefix collision (e.g. 'auth' vs 'auth-social')
  const matches = entries.filter((e) => {
    const lastDash = e.lastIndexOf("-");
    return lastDash > 0 && e.slice(0, lastDash) === slug;
  });

  if (matches.length === 0) return null;

  // If multiple cached versions (e.g. after conflict), pick lowest semver — that is the installed one
  matches.sort((a, b) => {
    const va = a.slice(a.lastIndexOf("-") + 1);
    const vb = b.slice(b.lastIndexOf("-") + 1);
    return compareSemver(va, vb);
  });

  const match = matches[0];
  return match.slice(match.lastIndexOf("-") + 1);
}

export function getBaselineCachePath(slug: string, version: string, projectRoot: string): string {
  return path.join(projectRoot, MODULES_CACHE_DIR, `${slug}-${version}`);
}

export async function removeBaselineCache(
  slug: string,
  version: string,
  projectRoot: string
): Promise<void> {
  const cachePath = getBaselineCachePath(slug, version, projectRoot);
  if (await fs.pathExists(cachePath)) {
    await fs.remove(cachePath);
  }
}
