import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { configFeatures } from "../../../src/commands/config/features.js";
import fs from "fs-extra";
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
      assert.strictEqual(fs.existsSync(outputPath), true);
      const content = await fs.readFile(outputPath, "utf-8");
      assert.ok(content.includes(`Tier: ${tier}`));
    }
  });

  it("should support numeric capabilities with correct values", async () => {
    const outputPath = path.join(tempDir, "seed-numeric.ts");
    await configFeatures({ tier: "starter", outputPath });
    const content = await fs.readFile(outputPath, "utf-8");
    assert.ok(content.includes("MAX_TEAM_MEMBERS"));
    assert.ok(content.includes("defaultValue: \"5\""));
  });

  it("should not write file in dry-run mode", async () => {
    const outputPath = path.join(tempDir, "dry-run.ts");
    const logSpy = mock.method(console, "log", () => {});
    await configFeatures({ tier: "complete", dryRun: true, outputPath });
    assert.strictEqual(fs.existsSync(outputPath), false);
    assert.ok(logSpy.mock.calls.some((call: any) => typeof call.arguments[0] === 'string' && call.arguments[0].includes("DRY RUN")));
    logSpy.mock.restore();
  });
});
