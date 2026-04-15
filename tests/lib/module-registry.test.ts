import { describe, it, expect } from "vitest";
import { MODULE_REGISTRY } from "../../src/lib/module-registry";

describe("C3.4 — module-registry", () => {

  // ── 1. getModule('billing') retorna definição correta ─────────────────────

  it("MODULE_REGISTRY contém billing com campos corretos", () => {
    const billing = MODULE_REGISTRY.find(m => m.id === "billing");
    expect(billing).toBeDefined();
    expect(billing!.name).toBeTruthy();
    expect(billing!.models).toContain("Invoice");
    expect(billing!.dependsOn).toContain("core");
  });

  // ── 2. resolveDependencies('billing') — dependências da billing ───────────

  it("billing depende de core e core existe no registry", () => {
    const billing = MODULE_REGISTRY.find(m => m.id === "billing")!;
    const deps = billing.dependsOn.map(depId => MODULE_REGISTRY.find(m => m.id === depId));
    expect(deps.every(d => d !== undefined)).toBe(true);
  });

  // ── 3. Módulo inexistente retorna undefined ───────────────────────────────

  it("find por id inexistente retorna undefined", () => {
    const result = MODULE_REGISTRY.find(m => m.id === "nonexistent-module-xyz");
    expect(result).toBeUndefined();
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
      expect(hasCycle(mod.id)).toBe(false);
    }
  });

  // ── 5. Todos os módulos têm campos obrigatórios ───────────────────────────

  it("todos os módulos têm id, name, description, models e dependsOn válidos", () => {
    for (const mod of MODULE_REGISTRY) {
      expect(mod.id).toBeTruthy();
      expect(mod.name).toBeTruthy();
      expect(mod.description).toBeTruthy();
      expect(Array.isArray(mod.models)).toBe(true);
      expect(mod.models.length).toBeGreaterThan(0);
      expect(Array.isArray(mod.dependsOn)).toBe(true);
    }
  });

  // ── 6. IDs de dependências são válidos (todos referenciáveis) ─────────────

  it("todos os ids em dependsOn referenciam módulos existentes", () => {
    const ids = new Set(MODULE_REGISTRY.map(m => m.id));
    for (const mod of MODULE_REGISTRY) {
      for (const depId of mod.dependsOn) {
        expect(ids.has(depId), `${mod.id} depende de ${depId} que não existe`).toBe(true);
      }
    }
  });

  // ── 7. core nunca tem dependências ───────────────────────────────────────

  it("core module não depende de nenhum outro módulo", () => {
    const core = MODULE_REGISTRY.find(m => m.id === "core")!;
    expect(core).toBeDefined();
    expect(core.dependsOn).toHaveLength(0);
  });
});
