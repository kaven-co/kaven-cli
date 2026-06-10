import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MarkerService } from "../../src/core/MarkerService.js";
import { sampleApp, paymentsModule } from "../fixtures/sample-app.js";

describe("MarkerService with real module", () => {
  const service = new MarkerService();

  it("should inject payments module in two locations", () => {
    let result = sampleApp;

    // Inject route
    result = service.injectModule(
      result,
      "// [ANCHOR:ROUTES]",
      "payments-routes",
      paymentsModule.route,
    );

    // Inject middleware
    result = service.injectModule(
      result,
      "// [ANCHOR:MIDDLEWARE]",
      "payments-middleware",
      paymentsModule.middleware,
    );

    assert.ok(result.includes("paymentsRouter"));
    assert.ok(result.includes("validatePayment"));
    assert.strictEqual(service.hasModule(result, "payments-routes"), true);
    assert.strictEqual(service.hasModule(result, "payments-middleware"), true);
  });

  it("should remove payments module cleanly", () => {
    let result = sampleApp;

    result = service.injectModule(
      result,
      "// [ANCHOR:ROUTES]",
      "payments-routes",
      paymentsModule.route,
    );

    result = service.removeModule(result, "payments-routes");

    assert.ok(!result.includes("paymentsRouter"));
    assert.ok(result.includes("// [ANCHOR:ROUTES]"));
  });

  it("should preserve formatting after inject/remove cycle", () => {
    let result = sampleApp;

    result = service.injectModule(result, "// [ANCHOR:ROUTES]", "test", "code");
    result = service.removeModule(result, "test");

    // Should be nearly identical (minus whitespace)
    assert.strictEqual(result.trim(), sampleApp.trim());
  });
});
