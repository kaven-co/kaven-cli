import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "../../src/infrastructure/Container";

describe("Container", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  it("should register and resolve a service", () => {
    const service = { name: "test" };
    container.registerSingleton("test", service);

    expect(container.resolve("test")).toBe(service);
  });

  it("should throw if service not found", () => {
    expect(() => container.resolve("unknown")).toThrow("Service not found");
  });

  it("should cache factory results as singleton", () => {
    let callCount = 0;
    container.register("test", () => {
      callCount++;
      return { count: callCount };
    });

    const first = container.resolve("test");
    const second = container.resolve("test");

    expect(first).toBe(second);
    expect(callCount).toBe(1);
  });

  it("should clear all services", () => {
    container.registerSingleton("test", { name: "test" });
    container.clear();

    expect(() => container.resolve("test")).toThrow();
  });

  it("should prioritize singletons over factories", () => {
    const singleton = { type: "singleton" };
    const factory = () => ({ type: "factory" });

    container.register("test", factory);
    container.registerSingleton("test", singleton);

    expect(container.resolve("test")).toBe(singleton);
  });
});
