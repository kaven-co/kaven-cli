import { describe, it, expect } from "vitest";
import { MarketplaceClient } from "../../src/infrastructure/MarketplaceClient";

describe("MarketplaceClient", () => {
  const client = new MarketplaceClient();

  it("deve retornar a lista de módulos disponíveis", async () => {
    const modules = await client.listModules();
    expect(modules).toBeInstanceOf(Array);
    expect(modules.length).toBeGreaterThan(0);
    expect(modules[0]).toHaveProperty("id");
    expect(modules[0]).toHaveProperty("name");
  });

  it("deve retornar o manifest de um módulo válido", async () => {
    const manifest = await client.getModuleManifest("auth-google");
    expect(manifest).not.toBeNull();
    expect(manifest?.name).toBe("auth-google");
    expect(manifest?.version).toBeDefined();
    expect(manifest?.injections.length).toBeGreaterThan(0);
  });

  it("deve retornar null para um ID de módulo inexistente", async () => {
    const manifest = await client.getModuleManifest("modulo-fantasma");
    expect(manifest).toBeNull();
  });
});
