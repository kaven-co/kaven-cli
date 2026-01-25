import { describe, it, expect } from "vitest";
import { MarkerService } from "../../src/core/MarkerService";

describe("MarkerService", () => {
  const service = new MarkerService();

  const sampleFile = `
import { app } from './app';
// [ANCHOR:ROUTES]

app.listen(3000);
`;

  it("should detect missing module", () => {
    expect(service.hasModule(sampleFile, "payments")).toBe(false);
  });

  it("should inject module at anchor", () => {
    const result = service.injectModule(
      sampleFile,
      "// [ANCHOR:ROUTES]",
      "payments",
      "app.use('/payments', paymentsRouter);",
    );

    expect(result).toContain("// [KAVEN_MODULE:payments BEGIN]");
    expect(result).toContain("app.use('/payments', paymentsRouter);");
    expect(result).toContain("// [KAVEN_MODULE:payments END]");
  });

  it("should prevent double injection", () => {
    const injected = service.injectModule(
      sampleFile,
      "// [ANCHOR:ROUTES]",
      "payments",
      "app.use('/payments', paymentsRouter);",
    );

    expect(() => {
      service.injectModule(
        injected,
        "// [ANCHOR:ROUTES]",
        "payments",
        "app.use('/payments', paymentsRouter);",
      );
    }).toThrow("Module payments already injected");
  });

  it("should remove module cleanly", () => {
    const injected = service.injectModule(
      sampleFile,
      "// [ANCHOR:ROUTES]",
      "payments",
      "app.use('/payments', paymentsRouter);",
    );

    const removed = service.removeModule(injected, "payments");

    expect(removed).not.toContain("KAVEN_MODULE:payments");
    expect(removed).not.toContain("paymentsRouter");
    expect(removed).toContain("// [ANCHOR:ROUTES]");
  });

  it("should throw if anchor not found", () => {
    expect(() => {
      service.injectModule(
        sampleFile,
        "// [ANCHOR:MISSING]",
        "payments",
        "code",
      );
    }).toThrow("Anchor not found");
  });

  it("should detect marker positions", () => {
    const injected = service.injectModule(
      sampleFile,
      "// [ANCHOR:ROUTES]",
      "payments",
      "code here",
    );

    const result = service.detectMarkers(injected, "payments");

    expect(result.found).toBe(true);
    expect(result.beginLine).toBeGreaterThan(0);
    expect(result.endLine).toBeGreaterThan(result.beginLine!);
    expect(result.content).toBe("code here");
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

    expect(service.hasModule(result, "payments")).toBe(true);
    expect(service.hasModule(result, "auth")).toBe(true);

    result = service.removeModule(result, "payments");
    expect(service.hasModule(result, "payments")).toBe(false);
    expect(service.hasModule(result, "auth")).toBe(true);
  });
});
