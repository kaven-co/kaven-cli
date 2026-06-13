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

describe("cache commands", () => {
  let cacheDir: string;
  let manager: CacheManager;

  beforeEach(async () => {
    cacheDir = path.join(
      os.tmpdir(),
      `cache-cmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    manager = new CacheManager(cacheDir);
  });

  afterEach(async () => {
    await fs.remove(cacheDir);

  });

  // cache status
  describe("cache status", () => {
    it("shows zero stats for empty cache", async () => {
      const stats = await manager.stats();
      assert.strictEqual(stats.entries, 0);
      assert.strictEqual(stats.totalSize, 0);
    });

    it("reflects correct entry count after adding items", async () => {
      await manager.set("modules:list::newest:1", [{ id: "1" }], 86_400_000);
      await manager.set("licenses:status:KAVEN-PRO", { valid: true }, 3_600_000);

      const stats = await manager.stats();
      assert.strictEqual(stats.entries, 2);
      assert.ok(stats.totalSize > 0);
    });

    it("shows oldest and newest dates", async () => {
      await manager.set("first:entry", "data", 60_000);
      await new Promise((r) => setTimeout(r, 5));
      await manager.set("second:entry", "data", 60_000);

      const stats = await manager.stats();
      assert.ok(stats.oldest instanceof Date);
      assert.ok(stats.newest instanceof Date);
      assert.ok(stats.newest!.getTime() >= stats.oldest!.getTime());
    });
  });

  // cache clear
  describe("cache clear", () => {
    it("removes all cached entries", async () => {
      await manager.set("entry:1", "data1", 60_000);
      await manager.set("entry:2", "data2", 60_000);

      await manager.clear();

      const dirExists = await fs.pathExists(cacheDir);
      assert.strictEqual(dirExists, false);
    });

    it("handles clearing an already-empty cache gracefully", async () => {
      // Should not throw even if cache directory doesn't exist
      await assert.doesNotReject(async () => { await manager.clear(); });
    });
  });
});
