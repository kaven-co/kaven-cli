import { describe, it } from 'node:test';
import assert from 'node:assert';
import { moduleJsonSchema } from "./publish.js";

describe("C2.2: Module Publish", () => {
  it("C2.2.1: Should validate module.json schema", () => {
    const validModule = {
      name: "Test Module",
      slug: "test-module",
      version: "1.0.0",
      description: "A test module",
      tier: "free",
    };

    const result = moduleJsonSchema.safeParse(validModule);
    assert.strictEqual(result.success, true);
  });

  it("C2.2.2: Should reject invalid slug", () => {
    const invalidModule = {
      name: "Test Module",
      slug: "Test Module", // Invalid: contains spaces and uppercase
      version: "1.0.0",
      description: "A test module",
      tier: "free",
    };

    const result = moduleJsonSchema.safeParse(invalidModule);
    assert.strictEqual(result.success, false);
  });

  it("C2.2.3: Should reject invalid version", () => {
    const invalidModule = {
      name: "Test Module",
      slug: "test-module",
      version: "1.0", // Invalid: not semver
      description: "A test module",
      tier: "free",
    };

    const result = moduleJsonSchema.safeParse(invalidModule);
    assert.strictEqual(result.success, false);
  });

  it("C2.2.4: Should accept valid tiers", () => {
    const tiers = ["free", "starter", "complete", "pro"];

    for (const tier of tiers) {
      const module = {
        name: "Test",
        slug: "test",
        version: "1.0.0",
        description: "Test",
        tier,
      };

      const result = moduleJsonSchema.safeParse(module);
      assert.strictEqual(result.success, true);
    }
  });
});
