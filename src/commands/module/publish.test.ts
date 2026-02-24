import { describe, it, expect } from "vitest";
import { moduleJsonSchema } from "./publish";

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
    expect(result.success).toBe(true);
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
    expect(result.success).toBe(false);
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
    expect(result.success).toBe(false);
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
      expect(result.success).toBe(true);
    }
  });
});
