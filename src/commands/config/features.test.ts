import path from "node:path";
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { configFeatures } from "./features.js";
import { ALL_CAPABILITIES } from "../../lib/capabilities-catalog.js";
import fs from "fs-extra";
import * as path from "node:path";
import * as os from "node:os";

describe("GAP-3: Config Features Command (Refactored)", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), "kaven-features-final-test-" + Date.now());
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe("ALL_CAPABILITIES catalog", () => {
    it("should contain all mandatory categories from spec", () => {
      const categories = new Set(ALL_CAPABILITIES.map((c) => c.category));
      assert.ok(categories.has("Auth"));
      assert.ok(categories.has("Tenancy"));
      assert.ok(categories.has("Billing"));
      assert.ok(categories.has("API"));
      assert.ok(categories.has("Limits"));
      assert.ok(categories.has("Support"));
    });

    it("should have unique keys", () => {
      const keys = ALL_CAPABILITIES.map((c) => c.key);
      const unique = new Set(keys);
      assert.strictEqual(unique.size, keys.length);
    });
  });

  describe("--tier flag", () => {
    it("should generate a valid seed file for tier=starter", async () => {
      const outputPath = path.join(tempDir, "capabilities.seed.ts");
      await configFeatures({ tier: "starter", outputPath });
      
      assert.strictEqual(fs.existsSync(outputPath), true);
      const content = await fs.readFile(outputPath, "utf-8");
      assert.ok(content.includes("Tier: starter"));
      assert.ok(content.includes("FEATURE_EMAIL_VERIFICATION"));
      assert.ok(content.includes("MAX_TEAM_MEMBERS"));
    });

    it("should generate a valid seed file for tier=enterprise", async () => {
      const outputPath = path.join(tempDir, "capabilities.seed.ts");
      await configFeatures({ tier: "enterprise", outputPath });
      
      const content = await fs.readFile(outputPath, "utf-8");
      assert.ok(content.includes("Tier: enterprise"));
      assert.ok(content.includes("defaultValue: \"-1\""));
    });
  });

  describe("--list flag", () => {
    it("should print the catalog without writing files", async () => {
      const outputPath = path.join(tempDir, "should-not-exist.ts");
      const logSpy = mock.method(console, "log", () => {});
      
      await configFeatures({ list: true, outputPath });
      
      assert.strictEqual(fs.existsSync(outputPath), false);
      assert.ok(logSpy.mock.calls.length > 0);
      logSpy.mock.restore();
    });
  });
});
