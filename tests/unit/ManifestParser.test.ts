import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ManifestParser } from "../../src/core/ManifestParser";
import fs from "fs-extra";
import path from "path";
import os from "os";

describe("ManifestParser", () => {
  let testDir: string;
  let parser: ManifestParser;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `manifest-test-${Date.now()}`);
    await fs.ensureDir(testDir);
    parser = new ManifestParser();
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it("should parse valid manifest", async () => {
    const manifestPath = path.join(testDir, "module.json");
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        name: "payments",
        version: "1.0.0",
        description: "Payment processing",
        dependencies: {
          npm: ["stripe@^14.0.0"],
          peerModules: [],
          kavenVersion: ">=0.1.0",
        },
        files: {
          backend: [
            { source: "api/**/*", dest: "apps/api/src/modules/payments/" },
          ],
        },
        injections: [
          {
            file: "apps/api/src/index.ts",
            anchor: "// [ANCHOR:ROUTES]",
            code: "app.use('/payments', paymentsRouter);",
          },
        ],
        scripts: {
          postInstall: "pnpm db:migrate",
        },
        env: [
          { key: "STRIPE_SECRET_KEY", required: true, example: "sk_test_..." },
        ],
      }),
    );

    const manifest = await parser.parse(manifestPath);

    expect(manifest.name).toBe("payments");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.dependencies.npm).toContain("stripe@^14.0.0");
    expect(manifest.injections).toHaveLength(1);
  });

  it("should reject invalid version format", async () => {
    const manifestPath = path.join(testDir, "module.json");
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        name: "test",
        version: "invalid", // Wrong format
        dependencies: {},
        files: {},
        injections: [],
      }),
    );

    await expect(parser.parse(manifestPath)).rejects.toThrow(
      "Invalid manifest",
    );
  });

  it("should require name field", async () => {
    const manifestPath = path.join(testDir, "module.json");
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        version: "1.0.0", // Missing name
      }),
    );

    await expect(parser.parse(manifestPath)).rejects.toThrow();
  });

  it("should validate manifest and return errors", async () => {
    const manifestPath = path.join(testDir, "module.json");
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        name: "", // Empty name
        version: "bad",
      }),
    );

    const result = await parser.validate(manifestPath);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
