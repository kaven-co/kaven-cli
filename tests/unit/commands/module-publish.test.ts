import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import fs from "fs-extra";
import path from "path";
import os from "os";
import { moduleJsonSchema, ModuleJson } from "../../../src/commands/module/publish.js";

describe("module publish", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(
      os.tmpdir(),
      `publish-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);

  });

  // Zod schema validation tests
  describe("moduleJsonSchema", () => {
    it("accepts valid module.json", () => {
      const valid: ModuleJson = {
        name: "Payments",
        slug: "payments",
        version: "1.0.0",
        description: "Stripe payments integration",
        tier: "complete",
      };
      const result = moduleJsonSchema.safeParse(valid);
      assert.strictEqual(result.success, true);
    });

    it("rejects slug with uppercase letters", () => {
      const result = moduleJsonSchema.safeParse({
        name: "Payments",
        slug: "PAYMENTS",
        version: "1.0.0",
        description: "desc",
        tier: "complete",
      });
      assert.strictEqual(result.success, false);
    });

    it("rejects slug with spaces", () => {
      const result = moduleJsonSchema.safeParse({
        name: "Test",
        slug: "my module",
        version: "1.0.0",
        description: "desc",
        tier: "free",
      });
      assert.strictEqual(result.success, false);
    });

    it("rejects invalid semver version", () => {
      const result = moduleJsonSchema.safeParse({
        name: "Test",
        slug: "test",
        version: "v1.0",
        description: "desc",
        tier: "free",
      });
      assert.strictEqual(result.success, false);
    });

    it("rejects invalid tier value", () => {
      const result = moduleJsonSchema.safeParse({
        name: "Test",
        slug: "test",
        version: "1.0.0",
        description: "desc",
        tier: "enterprise-plus",
      });
      assert.strictEqual(result.success, false);
    });

    it("rejects empty name", () => {
      const result = moduleJsonSchema.safeParse({
        name: "",
        slug: "test",
        version: "1.0.0",
        description: "desc",
        tier: "free",
      });
      assert.strictEqual(result.success, false);
    });

    it("accepts all valid tier values", () => {
      const tiers = ["free", "starter", "complete", "pro"] as const;
      for (const tier of tiers) {
        const result = moduleJsonSchema.safeParse({
          name: "Test",
          slug: "test",
          version: "1.0.0",
          description: "desc",
          tier,
        });
        assert.strictEqual(result.success, true);
      }
    });

    it("allows optional author and license fields", () => {
      const result = moduleJsonSchema.safeParse({
        name: "Test",
        slug: "test",
        version: "2.0.0",
        description: "desc",
        tier: "pro",
        author: "Kaven",
        license: "Apache-2.0",
      });
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.author, "Kaven");
        assert.strictEqual(result.data.license, "Apache-2.0");
      }
    });

    it("rejects missing required description field", () => {
      const result = moduleJsonSchema.safeParse({
        name: "Test",
        slug: "test",
        version: "1.0.0",
        tier: "free",
      });
      assert.strictEqual(result.success, false);
    });
  });

  // dry-run behavior tests (smoke test via module.json reading)
  describe("module.json file reading", () => {
    it("successfully reads and validates a real module.json file", async () => {
      const moduleJsonPath = path.join(testDir, "module.json");
      const content: ModuleJson = {
        name: "Auth Module",
        slug: "auth",
        version: "1.5.0",
        description: "Authentication and authorization",
        tier: "starter",
      };
      await fs.writeJson(moduleJsonPath, content);

      const raw = await fs.readJson(moduleJsonPath);
      const result = moduleJsonSchema.safeParse(raw);
      assert.strictEqual(result.success, true);
    });
  });
});
