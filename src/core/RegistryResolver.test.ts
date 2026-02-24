import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import fs from "fs-extra";
import { RegistryResolver } from "./RegistryResolver";
import { configManager } from "./ConfigManager";

describe("C2.5: Remote Registry Support", () => {
  let tempDir: string;
  let originalHome: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `kaven-registry-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
    originalHome = process.env.HOME || "";
    process.env.HOME = tempDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await fs.remove(tempDir);
  });

  it("C2.5.1: Should get default registry", async () => {
    const resolver = new RegistryResolver();
    const registry = await resolver.getActiveRegistry();

    expect(registry).toBe("https://marketplace.kaven.sh");
  });

  it("C2.5.2: Should validate registry URL format", async () => {
    const resolver = new RegistryResolver();

    try {
      await resolver.setCustomRegistry("not-a-url");
      expect.fail("Should reject invalid URL");
    } catch (error) {
      expect((error as Error).message).toContain("Invalid URL");
    }
  });

  it("C2.5.3: Should list registries", async () => {
    const resolver = new RegistryResolver();
    const registries = await resolver.listRegistries();

    expect(registries).toHaveProperty("default");
    expect(registries).toHaveProperty("active");
    expect(registries.default).toBe("https://marketplace.kaven.sh");
  });

  it("C2.5.4: Should reset to default registry", async () => {
    await configManager.initialize();
    await configManager.set("customRegistry", "https://custom.example.com");

    const resolver = new RegistryResolver();
    await resolver.resetToDefaultRegistry();

    const registries = await resolver.listRegistries();
    expect(registries.custom).toBeUndefined();
    expect(registries.active).toBe("https://marketplace.kaven.sh");
  });
});
