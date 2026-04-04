import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { configFeatures } from "../../../src/commands/config/features";
import * as fs from "fs-extra";
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
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    await configFeatures({ list: true, outputPath });
    
    expect(fs.existsSync(outputPath)).toBe(false);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Capability Catalog"));
    logSpy.mockRestore();
  });

  it("--tier flag should generate a valid seed file for tier=starter", async () => {
    const outputPath = path.join(tempDir, "packages/database/prisma/seeds/capabilities.seed.ts");
    
    await configFeatures({ tier: "starter", outputPath });
    
    expect(fs.existsSync(outputPath)).toBe(true);
    const content = await fs.readFile(outputPath, "utf-8");
    expect(content).toContain("Tier: starter");
    expect(content).toContain("MAX_TEAM_MEMBERS");
  });

  it("--dry-run should print but not write", async () => {
    const outputPath = path.join(tempDir, "seed.ts");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    await configFeatures({ tier: "pro", dryRun: true, outputPath });
    
    expect(fs.existsSync(outputPath)).toBe(false);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("DRY RUN"));
    logSpy.mockRestore();
  });
});
