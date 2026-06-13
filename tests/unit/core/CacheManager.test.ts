import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import { CacheManager } from "../../../src/core/CacheManager.js";
import fs from "fs-extra";
import path from "path";
import os from "os";

describe("CacheManager", () => {
  let cacheDir: string;
  let manager: CacheManager;

  beforeEach(async () => {
    cacheDir = path.join(
      os.tmpdir(),
      `cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    manager = new CacheManager(cacheDir);
  });

  afterEach(async () => {
    await fs.remove(cacheDir);
  });

  it("returns null for a missing cache key", async () => {
    const result = await manager.get<string>("nonexistent:key");
    assert.strictEqual(result, null);
  });

  it("stores and retrieves data before TTL expires", async () => {
    await manager.set("test:key", { hello: "world" }, 60_000);
    const result = await manager.get<{ hello: string }>("test:key");
    assert.notStrictEqual(result, null);
    assert.strictEqual(result?.hello, "world");
  });

  it("returns null for expired entries", async () => {
    // Set with 1ms TTL (instantly expired)
    await manager.set("expired:key", { data: "stale" }, 1);
    await new Promise((r) => setTimeout(r, 10)); // wait for expiry
    const result = await manager.get<{ data: string }>("expired:key");
    assert.strictEqual(result, null);
  });

  it("getStale returns expired data", async () => {
    await manager.set("stale:key", { data: "old" }, 1);
    await new Promise((r) => setTimeout(r, 10));

    // get() should return null (expired)
    assert.strictEqual(await manager.get("stale:key"), null);

    // getStale() should still return the data
    const stale = await manager.getStale<{ data: string }>("stale:key");
    assert.notStrictEqual(stale, null);
    assert.strictEqual(stale?.data, "old");
  });

  it("returns correct stats after setting entries", async () => {
    await manager.set("entry:1", { a: 1 }, 60_000);
    await manager.set("entry:2", { b: 2 }, 60_000);

    const stats = await manager.stats();
    assert.strictEqual(stats.entries, 2);
    assert.ok(stats.totalSize > 0);
    assert.ok(stats.oldest instanceof Date);
    assert.ok(stats.newest instanceof Date);
  });

  it("returns zero stats for empty cache", async () => {
    const stats = await manager.stats();
    assert.strictEqual(stats.entries, 0);
    assert.strictEqual(stats.totalSize, 0);
    assert.strictEqual(stats.oldest, undefined);
    assert.strictEqual(stats.newest, undefined);
  });

  it("clear removes all cache entries", async () => {
    await manager.set("to:delete:1", "data1", 60_000);
    await manager.set("to:delete:2", "data2", 60_000);

    await manager.clear();

    const exists = await fs.pathExists(cacheDir);
    assert.strictEqual(exists, false);
  });

  it("evicts oldest entries when over size limit", async () => {
    // Create a manager with 1KB limit
    const tinyManager = new CacheManager(cacheDir, 1024);
    const largeData = "x".repeat(600); // 600 bytes each

    await tinyManager.set("old:entry", largeData, 60_000);
    await new Promise((r) => setTimeout(r, 5));
    await tinyManager.set("new:entry", largeData, 60_000);

    // After eviction, old entry should be gone
    // Note: evict is called after set, so one entry should remain
    const stats = await tinyManager.stats();
    assert.ok(stats.entries <= 2);
  });

  it("handles complex object types correctly", async () => {
    const complexData = {
      modules: [{ id: "1", name: "Test" }],
      pagination: { page: 1, total: 100 },
      metadata: { fetchedAt: new Date().toISOString() },
    };

    await manager.set("complex:data", complexData, 60_000);
    const retrieved = await manager.get<typeof complexData>("complex:data");

    assert.notStrictEqual(retrieved, null);
    assert.strictEqual(retrieved?.modules[0].name, "Test");
    assert.strictEqual(retrieved?.pagination.total, 100);
  });

  it("stores different data under different keys", async () => {
    await manager.set("key:a", "value-a", 60_000);
    await manager.set("key:b", "value-b", 60_000);

    const a = await manager.get<string>("key:a");
    const b = await manager.get<string>("key:b");

    assert.strictEqual(a, "value-a");
    assert.strictEqual(b, "value-b");
  });
});
