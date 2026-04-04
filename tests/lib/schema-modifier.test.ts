import { describe, it, expect, vi, beforeEach } from "vitest";
import { activateModels, deactivateModels, isModuleActive } from "../../src/lib/schema-modifier";

describe("C3.3 — Schema Modifier Logic", () => {
  const mockSchema = `
model User {
  id String @id
}

model Invoice {
  id String @id
}
`;

  it("should comment out models during deactivation", () => {
    const result = deactivateModels(mockSchema, ["Invoice"]);
    expect(result).toContain("// model Invoice {");
    expect(result).not.toContain("\\nmodel Invoice {");
  });

  it("should preserve original schema in a round-trip", () => {
    const deactivated = deactivateModels(mockSchema, ["Invoice"]);
    const reactivated = activateModels(deactivated, ["Invoice"]);
    // Basic check for content
    expect(reactivated).toContain("model Invoice {");
    expect(reactivated).not.toContain("// model Invoice {");
  });

  it("should accurately detect active status", () => {
    expect(isModuleActive(mockSchema, ["User"])).toBe(true);
    const deactivated = deactivateModels(mockSchema, ["Invoice"]);
    expect(isModuleActive(deactivated, ["Invoice"])).toBe(false);
  });
});
