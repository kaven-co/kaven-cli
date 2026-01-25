import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ModuleInstaller, ModuleManifest } from "../../src/core/ModuleInstaller";
import { MarkerService } from "../../src/core/MarkerService";
import fs from "fs-extra";
import path from "path";
import os from "os";

describe("ModuleInstaller Integration", () => {
  let testDir: string;
  let installer: ModuleInstaller;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `kaven-install-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.ensureDir(testDir);

    const appFile = path.join(testDir, "app.ts");
    await fs.writeFile(
      appFile,
      `
import { app } from './app';
// [ANCHOR:ROUTES]
app.listen(3000);
    `,
    );

    const markerService = new MarkerService();
    installer = new ModuleInstaller(testDir, markerService);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it("should install module successfully", async () => {
    const manifest: ModuleManifest = {
      name: "payments",
      version: "1.0.0",
      injections: [
        {
          file: "app.ts",
          anchor: "// [ANCHOR:ROUTES]",
          moduleName: "payments",
          code: "app.use('/payments', paymentsRouter);",
        },
      ],
    };

    await installer.install(manifest);

    const content = await fs.readFile(path.join(testDir, "app.ts"), "utf-8");
    expect(content).toContain("KAVEN_MODULE:payments");
    expect(content).toContain("paymentsRouter");
  });

  it("should rollback on injection failure", async () => {
    const filePath = path.join(testDir, "app.ts");
    const originalContent = await fs.readFile(filePath, "utf-8");

    const manifest: ModuleManifest = {
      name: "broken",
      version: "1.0.0",
      injections: [
        {
          file: "app.ts",
          anchor: "// [ANCHOR:MISSING]",
          moduleName: "broken",
          code: "some code",
        },
      ],
    };

    await expect(installer.install(manifest)).rejects.toThrow();

    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toBe(originalContent);
  });
});
