import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import fs from "fs-extra";
import {
  configFeatures,
  generateSeedFile,
  ALL_CAPABILITIES,
  type FeatureTier,
} from "./features";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempOutput(base: string): string {
  return path.join(
    base,
    "packages",
    "database",
    "prisma",
    "seeds",
    "capabilities.seed.ts"
  );
}

describe("GAP-3: Config Features Command", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `kaven-features-test-${Date.now()}`);
    await fs.ensureDir(
      path.join(tempDir, "packages", "database", "prisma", "seeds")
    );
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  // -------------------------------------------------------------------------
  // Catalog validation (pure — no I/O needed)
  // -------------------------------------------------------------------------

  describe("ALL_CAPABILITIES catalog", () => {
    it("should contain 63 capabilities (14+15+12+10+12)", () => {
      expect(ALL_CAPABILITIES).toHaveLength(63);
    });

    it("should have unique codes", () => {
      const codes = ALL_CAPABILITIES.map((c) => c.code);
      const unique = new Set(codes);
      expect(unique.size).toBe(codes.length);
    });

    it("should have all required fields on every entry", () => {
      for (const cap of ALL_CAPABILITIES) {
        expect(cap.code).toBeTruthy();
        expect(cap.resource).toBeTruthy();
        expect(cap.action).toBeTruthy();
        expect(cap.description).toBeTruthy();
        expect(cap.category).toBeTruthy();
        expect(["NORMAL", "SENSITIVE", "HIGHLY_SENSITIVE", "CRITICAL"]).toContain(
          cap.sensitivity
        );
        expect(["GLOBAL", "TENANT", "SPACE", "ASSIGNED"]).toContain(cap.scope);
      }
    });

    it("should have capabilities in 5 expected categories", () => {
      const categories = new Set(ALL_CAPABILITIES.map((c) => c.category));
      expect(categories).toContain("Support");
      expect(categories).toContain("DevOps");
      expect(categories).toContain("Finance");
      expect(categories).toContain("Marketing");
      expect(categories).toContain("Management");
    });

    it("should have 14 Support capabilities", () => {
      const count = ALL_CAPABILITIES.filter((c) => c.category === "Support").length;
      expect(count).toBe(14);
    });

    it("should have 15 DevOps capabilities", () => {
      const count = ALL_CAPABILITIES.filter((c) => c.category === "DevOps").length;
      expect(count).toBe(15);
    });

    it("should have 12 Finance capabilities", () => {
      const count = ALL_CAPABILITIES.filter((c) => c.category === "Finance").length;
      expect(count).toBe(12);
    });

    it("should have 10 Marketing capabilities", () => {
      const count = ALL_CAPABILITIES.filter((c) => c.category === "Marketing").length;
      expect(count).toBe(10);
    });

    it("should have 12 Management capabilities", () => {
      const count = ALL_CAPABILITIES.filter(
        (c) => c.category === "Management"
      ).length;
      expect(count).toBe(12);
    });
  });

  // -------------------------------------------------------------------------
  // generateSeedFile (pure function — no I/O)
  // -------------------------------------------------------------------------

  describe("generateSeedFile", () => {
    it("should generate valid TypeScript with Prisma imports", () => {
      const content = generateSeedFile(["tickets.read", "users.read"]);
      expect(content).toContain("import { PrismaClient");
      expect(content).toContain("CapabilitySensitivity");
      expect(content).toContain("CapabilityScope");
      expect(content).toContain("export async function seedCapabilities");
      expect(content).toContain("prisma.capability.create");
    });

    it("should include only selected capabilities", () => {
      const content = generateSeedFile(["tickets.read"]);
      expect(content).toContain("'tickets.read'");
      expect(content).not.toContain("'users.read'");
    });

    it("should include Generated at timestamp", () => {
      const content = generateSeedFile(["tickets.read"]);
      expect(content).toContain("Generated at:");
    });

    it("should include requiresMFA for MFA-gated capabilities", () => {
      const mfaCaps = ALL_CAPABILITIES.filter((c) => c.requiresMFA).map(
        (c) => c.code
      );
      expect(mfaCaps.length).toBeGreaterThan(0);
      const content = generateSeedFile(mfaCaps);
      expect(content).toContain("requiresMFA: true,");
    });

    it("should include requiresApproval for approval-gated capabilities", () => {
      const approvalCaps = ALL_CAPABILITIES.filter(
        (c) => c.requiresApproval
      ).map((c) => c.code);
      expect(approvalCaps.length).toBeGreaterThan(0);
      const content = generateSeedFile(approvalCaps);
      expect(content).toContain("requiresApproval: true,");
    });

    it("should group by category with comments", () => {
      const codes = ALL_CAPABILITIES.filter(
        (c) => c.category === "Support" || c.category === "Management"
      ).map((c) => c.code);
      const content = generateSeedFile(codes);
      expect(content).toMatch(/\/\/ SUPPORT/i);
      expect(content).toMatch(/\/\/ MANAGEMENT/i);
    });

    it("should return empty capabilities array when no codes given", () => {
      const content = generateSeedFile([]);
      expect(content).toContain("const capabilities = [");
      expect(content).toContain("export async function seedCapabilities");
    });
  });

  // -------------------------------------------------------------------------
  // --list mode (no file writes)
  // -------------------------------------------------------------------------

  describe("--list flag", () => {
    it("should not write any file when --list is passed", async () => {
      const outputPath = makeTempOutput(tempDir);
      await configFeatures({ list: true, outputPath });
      const exists = await fs.pathExists(outputPath);
      expect(exists).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // --tier mode
  // -------------------------------------------------------------------------

  describe("--tier flag", () => {
    const tiers: FeatureTier[] = ["starter", "complete", "pro", "enterprise"];

    for (const tier of tiers) {
      it(`should generate a valid seed file for tier=${tier}`, async () => {
        const outputPath = makeTempOutput(tempDir);
        await configFeatures({ tier, outputPath });

        const exists = await fs.pathExists(outputPath);
        expect(exists).toBe(true);

        const content = await fs.readFile(outputPath, "utf-8");
        expect(content).toContain("import { PrismaClient");
        expect(content).toContain("CapabilitySensitivity");
        expect(content).toContain("CapabilityScope");
        expect(content).toContain("export async function seedCapabilities");
        expect(content).toContain("prisma.capability.create");
        expect(content).toContain("Generated at:");
      });
    }

    it("starter tier should include users.read but not audit.export", async () => {
      const outputPath = makeTempOutput(tempDir);
      await configFeatures({ tier: "starter", outputPath });

      const content = await fs.readFile(outputPath, "utf-8");
      expect(content).toContain("'users.read'");
      expect(content).not.toContain("'audit.export'");
    });

    it("enterprise tier should include all 60 capabilities", async () => {
      const outputPath = makeTempOutput(tempDir);
      await configFeatures({ tier: "enterprise", outputPath });

      const content = await fs.readFile(outputPath, "utf-8");
      for (const cap of ALL_CAPABILITIES) {
        expect(content).toContain(`'${cap.code}'`);
      }
    });

    it("should overwrite existing file on repeated runs", async () => {
      const outputPath = makeTempOutput(tempDir);

      await configFeatures({ tier: "starter", outputPath });
      const firstContent = await fs.readFile(outputPath, "utf-8");

      await configFeatures({ tier: "enterprise", outputPath });
      const secondContent = await fs.readFile(outputPath, "utf-8");

      expect(firstContent).not.toBe(secondContent);
      expect(secondContent).toContain("'impersonate.user'");
    });

    it("should exit with error for invalid tier", async () => {
      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => {
          throw new Error("process.exit called");
        });

      await expect(
        configFeatures({ tier: "invalid" as FeatureTier })
      ).rejects.toThrow("process.exit called");

      exitSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // Seed file content structure (via generateSeedFile — pure)
  // -------------------------------------------------------------------------

  describe("generated seed file structure", () => {
    it("should include requiresMFA: true for critical capabilities in enterprise", () => {
      const codes = ALL_CAPABILITIES.map((c) => c.code);
      const content = generateSeedFile(codes);
      expect(content).toContain("requiresMFA: true,");
    });

    it("should include requiresApproval: true for approval-gated capabilities", () => {
      const codes = ALL_CAPABILITIES.map((c) => c.code);
      const content = generateSeedFile(codes);
      expect(content).toContain("requiresApproval: true,");
    });

    it("should group capabilities by category with comments", () => {
      const codes = ALL_CAPABILITIES.map((c) => c.code);
      const content = generateSeedFile(codes);
      expect(content).toMatch(/\/\/ SUPPORT/i);
      expect(content).toMatch(/\/\/ MANAGEMENT/i);
    });
  });
});
