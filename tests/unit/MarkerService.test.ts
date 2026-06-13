import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MarkerService } from "../../src/core/MarkerService.js";

describe("MarkerService", () => {
  const service = new MarkerService();

  const sampleFile = `
import { app } from './app.js';
// [ANCHOR:ROUTES]

app.listen(3000);
`;

  it("should detect missing module", () => {
    assert.strictEqual(service.hasModule(sampleFile, "payments"), false);
  });

  it("should inject module at anchor", () => {
    const result = service.injectModule(
      sampleFile,
      "// [ANCHOR:ROUTES]",
      "payments",
      "app.use('/payments', paymentsRouter);",
    );

    assert.ok(result.includes("// [KAVEN_MODULE:payments BEGIN]"));
    assert.ok(result.includes("app.use('/payments', paymentsRouter);"));
    assert.ok(result.includes("// [KAVEN_MODULE:payments END]"));
  });

  it("should prevent double injection", () => {
    const injected = service.injectModule(
      sampleFile,
      "// [ANCHOR:ROUTES]",
      "payments",
      "app.use('/payments', paymentsRouter);",
    );

    assert.throws(() => {
      service.injectModule(
        injected,
        "// [ANCHOR:ROUTES]",
        "payments",
        "app.use('/payments', paymentsRouter);",
      );
    }, { message: "Module payments already injected" });
  });

  it("should remove module cleanly", () => {
    const injected = service.injectModule(
      sampleFile,
      "// [ANCHOR:ROUTES]",
      "payments",
      "app.use('/payments', paymentsRouter);",
    );

    const removed = service.removeModule(injected, "payments");

    assert.ok(!removed.includes("KAVEN_MODULE:payments"));
    assert.ok(!removed.includes("paymentsRouter"));
    assert.ok(removed.includes("// [ANCHOR:ROUTES]"));
  });

  it("should throw if anchor not found", () => {
    assert.throws(() => {
      service.injectModule(
        sampleFile,
        "// [ANCHOR:MISSING]",
        "payments",
        "code",
      );
    }, { message: /Anchor not found/i });
  });

  it("should detect marker positions", () => {
    const injected = service.injectModule(
      sampleFile,
      "// [ANCHOR:ROUTES]",
      "payments",
      "code here",
    );

    const result = service.detectMarkers(injected, "payments");

    assert.strictEqual(result.found, true);
    assert.ok(result.beginLine > 0);
    assert.ok(result.endLine > result.beginLine!);
    assert.strictEqual(result.content, "code here");
  });

  it("should handle multiple modules", () => {
    let result = sampleFile;

    result = service.injectModule(
      result,
      "// [ANCHOR:ROUTES]",
      "payments",
      "payments code",
    );
    result = service.injectModule(
      result,
      "// [ANCHOR:ROUTES]",
      "auth",
      "auth code",
    );

    assert.strictEqual(service.hasModule(result, "payments"), true);
    assert.strictEqual(service.hasModule(result, "auth"), true);

    result = service.removeModule(result, "payments");
    assert.strictEqual(service.hasModule(result, "payments"), false);
    assert.strictEqual(service.hasModule(result, "auth"), true);
  });
});
