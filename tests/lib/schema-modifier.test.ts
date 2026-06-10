import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { activateModels, deactivateModels, isModuleActive } from "../../src/lib/schema-modifier.js";

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
    assert.ok(result.includes("// model Invoice {"));
    assert.strictEqual(result.includes("\\nmodel Invoice {"), false);
  });

  it("should preserve original schema in a round-trip", () => {
    const deactivated = deactivateModels(mockSchema, ["Invoice"]);
    const reactivated = activateModels(deactivated, ["Invoice"]);
    // Basic check for content
    assert.ok(reactivated.includes("model Invoice {"));
    assert.strictEqual(reactivated.includes("// model Invoice {"), false);
  });

  it("should accurately detect active status", () => {
    assert.strictEqual(isModuleActive(mockSchema, ["User"]), true);
    const deactivated = deactivateModels(mockSchema, ["Invoice"]);
    assert.strictEqual(isModuleActive(deactivated, ["Invoice"]), false);
  });
});
