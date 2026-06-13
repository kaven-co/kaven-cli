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

describe("GAP-3: Config Features Command", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), "kaven-features-test-" + Date.now());
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it("--list flag should not write any file", async () => {
    const outputPath = path.join(tempDir, "seed.ts");
    const logSpy = mock.method(console, "log", () => {});
    
    await configFeatures({ list: true, outputPath });
    
    assert.strictEqual(fs.existsSync(outputPath), false);
    assert.ok(logSpy.mock.calls.length > 0);
    logSpy.mock.restore();
  });

  it("--tier flag should generate a valid seed file for tier=starter", async () => {
    const outputPath = path.join(tempDir, "packages/database/prisma/seeds/capabilities.seed.ts");
    
    await configFeatures({ tier: "starter", outputPath });
    
    assert.strictEqual(fs.existsSync(outputPath), true);
    const content = await fs.readFile(outputPath, "utf-8");
    assert.ok(content.includes("Tier: starter"));
    assert.ok(content.includes("MAX_TEAM_MEMBERS"));
  });

  it("--dry-run should print but not write", async () => {
    const outputPath = path.join(tempDir, "seed.ts");
    const logSpy = mock.method(console, "log", () => {});
    
    await configFeatures({ tier: "pro", dryRun: true, outputPath });
    
    assert.strictEqual(fs.existsSync(outputPath), false);
    assert.ok(logSpy.mock.calls.length > 0);
    logSpy.mock.restore();
  });
});
