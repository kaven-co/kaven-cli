import { describe, it, expect } from "vitest";
import { MarkerService } from "../../src/core/MarkerService";
import { sampleApp, paymentsModule } from "../fixtures/sample-app";

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

    expect(result).toContain("paymentsRouter");
    expect(result).toContain("validatePayment");
    expect(service.hasModule(result, "payments-routes")).toBe(true);
    expect(service.hasModule(result, "payments-middleware")).toBe(true);
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

    expect(result).not.toContain("paymentsRouter");
    expect(result).toContain("// [ANCHOR:ROUTES]");
  });

  it("should preserve formatting after inject/remove cycle", () => {
    let result = sampleApp;

    result = service.injectModule(result, "// [ANCHOR:ROUTES]", "test", "code");
    result = service.removeModule(result, "test");

    // Should be nearly identical (minus whitespace)
    expect(result.trim()).toBe(sampleApp.trim());
  });
});
