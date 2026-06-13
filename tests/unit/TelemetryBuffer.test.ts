import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import fs from "fs-extra";
import path from "path";
import os from "os";
import { TelemetryBuffer } from "../../src/infrastructure/TelemetryBuffer.js";

describe("TelemetryBuffer", () => {
  const logPath = path.join(os.homedir(), ".kaven", "telemetry.log");

  beforeEach(async () => {
    // Limpar o log antes de cada teste
    if (await fs.pathExists(logPath)) {
      await fs.remove(logPath);
    }
    // @ts-ignore - reset singleton for testing
    TelemetryBuffer.instance = undefined;
  });

  afterEach(async () => {
    if (await fs.pathExists(logPath)) {
      await fs.remove(logPath);
    }
  });

  it("deve capturar um evento no buffer", () => {
    const telemetry = TelemetryBuffer.getInstance();
    telemetry.capture("test.event", { foo: "bar" });
    
    // @ts-ignore - access private buffer for assertion
    assert.strictEqual(telemetry.buffer.length, 1);
    // @ts-ignore
    assert.strictEqual(telemetry.buffer[0].event, "test.event");
  });

  it("deve persistir eventos ao chamar flush", async () => {
    const telemetry = TelemetryBuffer.getInstance();
    telemetry.capture("test.flush", { id: 1 });
    await telemetry.flush();

    const exists = await fs.pathExists(logPath);
    assert.strictEqual(exists, true);

    const content = await fs.readFile(logPath, "utf8");
    const event = JSON.parse(content.trim());
    assert.strictEqual(event.event, "test.flush");
  });

  it("deve recuperar eventos recentes do arquivo", async () => {
    const telemetry = TelemetryBuffer.getInstance();
    telemetry.capture("event.1");
    telemetry.capture("event.2");
    await telemetry.flush();

    const events = await telemetry.getRecentEvents();
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0].event, "event.2"); // Ordem reversa
    assert.strictEqual(events[1].event, "event.1");
  });
});
