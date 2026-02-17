import fs from "fs-extra";
import path from "path";
import os from "os";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  size: number;
  createdAt: number;
}

interface CacheIndex {
  [key: string]: {
    file: string;
    expiresAt: number;
    size: number;
    createdAt: number;
  };
}

export class CacheManager {
  readonly cacheDir: string;
  private readonly maxSizeBytes: number;
  private readonly indexPath: string;

  constructor(cacheDir?: string, maxSizeBytes?: number) {
    this.cacheDir = cacheDir ?? path.join(os.homedir(), ".kaven", "cache");
    this.maxSizeBytes = maxSizeBytes ?? 50 * 1024 * 1024; // 50MB
    this.indexPath = path.join(this.cacheDir, "_index.json");
  }

  private async ensureDir(): Promise<void> {
    await fs.ensureDir(this.cacheDir);
  }

  private keyToFileName(key: string): string {
    // Sanitize key to valid filename
    return key.replace(/[^a-zA-Z0-9-_:.]/g, "_") + ".json";
  }

  private async readIndex(): Promise<CacheIndex> {
    try {
      if (await fs.pathExists(this.indexPath)) {
        return (await fs.readJson(this.indexPath)) as CacheIndex;
      }
    } catch {
      // ignore
    }
    return {};
  }

  private async writeIndex(index: CacheIndex): Promise<void> {
    await this.ensureDir();
    await fs.writeJson(this.indexPath, index, { spaces: 2 });
  }

  /** Get fresh data or null if expired. */
  async get<T>(key: string): Promise<T | null> {
    const index = await this.readIndex();
    const entry = index[key];
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) return null;

    try {
      const filePath = path.join(this.cacheDir, entry.file);
      const data: CacheEntry<T> = await fs.readJson(filePath);
      return data.data;
    } catch {
      return null;
    }
  }

  /** Get stale data (ignore TTL expiry) — for offline fallback. */
  async getStale<T>(key: string): Promise<T | null> {
    const index = await this.readIndex();
    const entry = index[key];
    if (!entry) return null;

    try {
      const filePath = path.join(this.cacheDir, entry.file);
      const data: CacheEntry<T> = await fs.readJson(filePath);
      return data.data;
    } catch {
      return null;
    }
  }

  /** Set data with TTL. */
  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    await this.ensureDir();

    const serialized = JSON.stringify(data);
    const size = Buffer.byteLength(serialized, "utf8");
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const fileName = this.keyToFileName(key);
    const filePath = path.join(this.cacheDir, fileName);

    const entry: CacheEntry<T> = {
      data,
      expiresAt,
      size,
      createdAt: now,
    };

    await fs.writeJson(filePath, entry, { spaces: 2 });

    const index = await this.readIndex();
    index[key] = {
      file: fileName,
      expiresAt,
      size,
      createdAt: now,
    };
    await this.writeIndex(index);

    // Evict if over limit
    await this.evict();
  }

  /** Evict oldest entries if total size exceeds the limit. */
  async evict(): Promise<void> {
    const index = await this.readIndex();
    const entries = Object.entries(index);

    let totalSize = entries.reduce((sum, [, e]) => sum + e.size, 0);

    if (totalSize <= this.maxSizeBytes) return;

    // Sort by oldest first
    entries.sort(([, a], [, b]) => a.createdAt - b.createdAt);

    const updatedIndex: CacheIndex = { ...index };

    for (const [key, entry] of entries) {
      if (totalSize <= this.maxSizeBytes) break;

      try {
        const filePath = path.join(this.cacheDir, entry.file);
        await fs.remove(filePath);
        delete updatedIndex[key];
        totalSize -= entry.size;
      } catch {
        // ignore individual removal errors
      }
    }

    await this.writeIndex(updatedIndex);
  }

  /** Get cache statistics. */
  async stats(): Promise<{
    totalSize: number;
    entries: number;
    oldest?: Date;
    newest?: Date;
  }> {
    const index = await this.readIndex();
    const entries = Object.values(index);

    if (entries.length === 0) {
      return { totalSize: 0, entries: 0 };
    }

    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
    const timestamps = entries.map((e) => e.createdAt);
    const oldest = new Date(Math.min(...timestamps));
    const newest = new Date(Math.max(...timestamps));

    return { totalSize, entries: entries.length, oldest, newest };
  }

  /** Clear all cache entries. */
  async clear(): Promise<void> {
    if (await fs.pathExists(this.cacheDir)) {
      await fs.remove(this.cacheDir);
    }
  }
}

// Singleton instance
let _cacheManager: CacheManager | null = null;

export function getCacheManager(): CacheManager {
  if (!_cacheManager) {
    _cacheManager = new CacheManager();
  }
  return _cacheManager;
}
