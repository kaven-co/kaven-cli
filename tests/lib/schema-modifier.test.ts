import { describe, it, expect } from "vitest";
import { activateModels, deactivateModels, isModuleActive } from "../../src/lib/schema-modifier";

const mockSchema = `
model User {
  id String @id
}

model Tenant {
  id String @id
}
`;

const mockCommentedSchema = `
model User {
  id String @id
}

// model Tenant {
//   id String @id
// }
`;

describe("Schema Modifier", () => {
  it("should detect active module", () => {
    expect(isModuleActive(mockSchema, ["User"])).toBe(true);
    expect(isModuleActive(mockCommentedSchema, ["Tenant"])).toBe(false);
  });

  it("should deactivate models", () => {
    const result = deactivateModels(mockSchema, ["Tenant"]);
    expect(result).toContain("// model Tenant {");
    expect(result).toContain("//   id String @id");
  });

  it("should activate models", () => {
    const result = activateModels(mockCommentedSchema, ["Tenant"]);
    expect(result).toContain("model Tenant {");
    expect(result).not.toContain("// model Tenant {");
  });
});
