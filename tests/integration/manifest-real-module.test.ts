import { describe, it, expect } from "vitest";
import { ManifestParser } from "../../src/core/ManifestParser";
import path from "path";

describe("ManifestParser with real module", () => {
  const parser = new ManifestParser();

  it("should parse payments module manifest", async () => {
    const manifestPath = path.join(
      __dirname,
      "../fixtures/payments-module.json",
    );

    const manifest = await parser.parse(manifestPath);

    expect(manifest.name).toBe("payments");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.dependencies.npm).toHaveLength(2);
    expect(manifest.injections).toHaveLength(2);
    expect(manifest.env).toHaveLength(2);
    expect(manifest.scripts.postInstall).toContain("db:migrate");
  });

  it("should validate payments module", async () => {
    const manifestPath = path.join(
      __dirname,
      "../fixtures/payments-module.json",
    );

    const result = await parser.validate(manifestPath);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
