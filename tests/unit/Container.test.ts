import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import { Container } from "../../src/infrastructure/Container.js";

describe("Container", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  it("should register and resolve a service", () => {
    const service = { name: "test" };
    container.registerSingleton("test", service);

    assert.strictEqual(container.resolve("test"), service);
  });

  it("should throw if service not found", () => {
    assert.throws(() => container.resolve("unknown"), "Service not found");
  });

  it("should cache factory results as singleton", () => {
    let callCount = 0;
    container.register("test", () => {
      callCount++;
      return { count: callCount };
    });

    const first = container.resolve("test");
    const second = container.resolve("test");

    assert.strictEqual(first, second);
    assert.strictEqual(callCount, 1);
  });

  it("should clear all services", () => {
    container.registerSingleton("test", { name: "test" });
    container.clear();

    assert.throws(() => container.resolve("test"), );
  });

  it("should prioritize singletons over factories", () => {
    const singleton = { type: "singleton" };
    const factory = () => ({ type: "factory" });

    container.register("test", factory);
    container.registerSingleton("test", singleton);

    assert.strictEqual(container.resolve("test"), singleton);
  });
});
