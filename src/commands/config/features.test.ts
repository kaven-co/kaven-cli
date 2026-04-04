import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { configFeatures } from "./features";
import { ALL_CAPABILITIES } from "../../lib/capabilities-catalog";
import * as fs from "fs-extra";
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
      expect(categories).toContain("Auth");
      expect(categories).toContain("Tenancy");
      expect(categories).toContain("Billing");
      expect(categories).toContain("API");
      expect(categories).toContain("Limits");
      expect(categories).toContain("Support");
    });

    it("should have unique keys", () => {
      const keys = ALL_CAPABILITIES.map((c) => c.key);
      const unique = new Set(keys);
      expect(unique.size).toBe(keys.length);
    });
  });

  describe("--tier flag", () => {
    it("should generate a valid seed file for tier=starter", async () => {
      const outputPath = path.join(tempDir, "capabilities.seed.ts");
      await configFeatures({ tier: "starter", outputPath });
      
      expect(fs.existsSync(outputPath)).toBe(true);
      const content = await fs.readFile(outputPath, "utf-8");
      expect(content).toContain("Tier: starter");
      expect(content).toContain("FEATURE_EMAIL_VERIFICATION");
      expect(content).toContain("MAX_TEAM_MEMBERS");
    });

    it("should generate a valid seed file for tier=enterprise", async () => {
      const outputPath = path.join(tempDir, "capabilities.seed.ts");
      await configFeatures({ tier: "enterprise", outputPath });
      
      const content = await fs.readFile(outputPath, "utf-8");
      expect(content).toContain("Tier: enterprise");
      expect(content).toContain("defaultValue: \"-1\"");
    });
  });

  describe("--list flag", () => {
    it("should print the catalog without writing files", async () => {
      const outputPath = path.join(tempDir, "should-not-exist.ts");
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      
      await configFeatures({ list: true, outputPath });
      
      expect(fs.existsSync(outputPath)).toBe(false);
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });
});
