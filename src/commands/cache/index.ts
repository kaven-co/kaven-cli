import chalk from "chalk";
import { getCacheManager } from "../../core/CacheManager";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export async function cacheStatus(): Promise<void> {
  const manager = getCacheManager();
  const stats = await manager.stats();

  console.log(chalk.bold("\nKaven CLI Cache Status\n"));
  console.log(`  Cache directory:  ${chalk.cyan(manager.cacheDir)}`);
  console.log(`  Total size:       ${chalk.cyan(formatBytes(stats.totalSize))}`);
  console.log(`  Cached entries:   ${chalk.cyan(stats.entries.toString())}`);

  if (stats.oldest) {
    console.log(`  Oldest entry:     ${chalk.gray(stats.oldest.toLocaleString())}`);
  }
  if (stats.newest) {
    console.log(`  Newest entry:     ${chalk.gray(stats.newest.toLocaleString())}`);
  }

  console.log();
  console.log(chalk.gray("Run 'kaven cache clear' to remove all cached data."));
}

export async function cacheClear(): Promise<void> {
  const manager = getCacheManager();
  const stats = await manager.stats();

  if (stats.entries === 0) {
    console.log(chalk.gray("Cache is already empty."));
    return;
  }

  await manager.clear();
  console.log(
    chalk.green(
      `Cache cleared: ${stats.entries} entries (${formatBytes(stats.totalSize)}) removed.`
    )
  );
}
