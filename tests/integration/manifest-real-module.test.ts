import { fileURLToPath } from "node:url";
import path, { dirname } from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { describe, it } from 'node:test';
import assert from 'node:assert';


import { ManifestParser } from "../../src/core/ManifestParser.js";
import path from "path";

describe("ManifestParser with real module", () => {
  const parser = new ManifestParser();

  it("should parse payments module manifest", async () => {
    const manifestPath = path.join(
      __dirname,
      "../fixtures/payments-module.json",
    );

    const manifest = await parser.parse(manifestPath);

    assert.strictEqual(manifest.name, "payments");
    assert.strictEqual(manifest.version, "1.0.0");
    assert.strictEqual(manifest.dependencies.npm.length, 2);
    assert.strictEqual(manifest.injections.length, 2);
    assert.strictEqual(manifest.env.length, 2);
    assert.ok(manifest.scripts.postInstall.includes("db:migrate"));
  });

  it("should validate payments module", async () => {
    const manifestPath = path.join(
      __dirname,
      "../fixtures/payments-module.json",
    );

    const result = await parser.validate(manifestPath);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });
});
