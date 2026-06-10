import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MODULE_REGISTRY } from "../../src/lib/module-registry.js";

describe("C3.4 — module-registry", () => {

  // ── 1. getModule('billing') retorna definição correta ─────────────────────

  it("MODULE_REGISTRY contém billing com campos corretos", () => {
    const billing = MODULE_REGISTRY.find(m => m.id === "billing");
    assert.ok(billing !== undefined);
    assert.ok(billing!.name);
    assert.ok(billing!.models.includes("Invoice"));
    assert.ok(billing!.dependsOn.includes("core"));
  });

  // ── 2. resolveDependencies('billing') — dependências da billing ───────────

  it("billing depende de core e core existe no registry", () => {
    const billing = MODULE_REGISTRY.find(m => m.id === "billing")!;
    const deps = billing.dependsOn.map(depId => MODULE_REGISTRY.find(m => m.id === depId));
    assert.strictEqual(deps.every(d => d !== undefined), true);
  });

  // ── 3. Módulo inexistente retorna undefined ───────────────────────────────

  it("find por id inexistente retorna undefined", () => {
    const result = MODULE_REGISTRY.find(m => m.id === "nonexistent-module-xyz");
    assert.strictEqual(result, undefined);
  });

  // ── 4. Dependências circulares não causam loop infinito ──────────────────

  it("grafo de dependências não tem ciclos", () => {
    function hasCycle(moduleId: string, visited = new Set<string>(), path = new Set<string>()): boolean {
      if (path.has(moduleId)) return true;
      if (visited.has(moduleId)) return false;

      visited.add(moduleId);
      path.add(moduleId);

      const mod = MODULE_REGISTRY.find(m => m.id === moduleId);
      if (mod) {
        for (const depId of mod.dependsOn) {
          if (hasCycle(depId, visited, path)) return true;
        }
      }

      path.delete(moduleId);
      return false;
    }

    for (const mod of MODULE_REGISTRY) {
      assert.strictEqual(hasCycle(mod.id), false);
    }
  });

  // ── 5. Todos os módulos têm campos obrigatórios ───────────────────────────

  it("todos os módulos têm id, name, description, models e dependsOn válidos", () => {
    for (const mod of MODULE_REGISTRY) {
      assert.ok(mod.id);
      assert.ok(mod.name);
      assert.ok(mod.description);
      assert.strictEqual(Array.isArray(mod.models), true);
      assert.ok(mod.models.length > 0);
      assert.strictEqual(Array.isArray(mod.dependsOn), true);
    }
  });

  // ── 6. IDs de dependências são válidos (todos referenciáveis) ─────────────

  it("todos os ids em dependsOn referenciam módulos existentes", () => {
    const ids = new Set(MODULE_REGISTRY.map(m => m.id));
    for (const mod of MODULE_REGISTRY) {
      for (const depId of mod.dependsOn) {
        assert.strictEqual(ids.has(depId), true, `${mod.id} depende de ${depId} que não existe`);
      }
    }
  });

  // ── 7. core nunca tem dependências ───────────────────────────────────────

  it("core module não depende de nenhum outro módulo", () => {
    const core = MODULE_REGISTRY.find(m => m.id === "core")!;
    assert.ok(core !== undefined);
    assert.strictEqual(core.dependsOn.length, 0);
  });
});
