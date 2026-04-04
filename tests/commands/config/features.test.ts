import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { configFeatures } from "../../../src/commands/config/features";
import * as fs from "fs-extra";
import * as path from "node:path";
import * as os from "node:os";

describe("C3.2 — Feature Flag TUI", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), "kaven-qa-features-" + Date.now());
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it("should generate seed file for each tier correctly", async () => {
    const tiers = ["starter", "complete", "pro", "enterprise"] as const;
    for (const tier of tiers) {
      const outputPath = path.join(tempDir, `seed-${tier}.ts`);
      await configFeatures({ tier, outputPath });
      expect(fs.existsSync(outputPath)).toBe(true);
      const content = await fs.readFile(outputPath, "utf-8");
      expect(content).toContain(`Tier: ${tier}`);
    }
  });

  it("should support numeric capabilities with correct values", async () => {
    const outputPath = path.join(tempDir, "seed-numeric.ts");
    await configFeatures({ tier: "starter", outputPath });
    const content = await fs.readFile(outputPath, "utf-8");
    expect(content).toContain("MAX_TEAM_MEMBERS");
    expect(content).toContain("defaultValue: \"5\"");
  });

  it("should not write file in dry-run mode", async () => {
    const outputPath = path.join(tempDir, "dry-run.ts");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await configFeatures({ tier: "complete", dryRun: true, outputPath });
    expect(fs.existsSync(outputPath)).toBe(false);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("DRY RUN"));
    logSpy.mockRestore();
  });
});
