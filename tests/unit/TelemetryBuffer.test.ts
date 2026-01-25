import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { TelemetryBuffer } from "../../src/infrastructure/TelemetryBuffer";

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
    expect(telemetry.buffer.length).toBe(1);
    // @ts-ignore
    expect(telemetry.buffer[0].event).toBe("test.event");
  });

  it("deve persistir eventos ao chamar flush", async () => {
    const telemetry = TelemetryBuffer.getInstance();
    telemetry.capture("test.flush", { id: 1 });
    await telemetry.flush();

    const exists = await fs.pathExists(logPath);
    expect(exists).toBe(true);

    const content = await fs.readFile(logPath, "utf8");
    const event = JSON.parse(content.trim());
    expect(event.event).toBe("test.flush");
  });

  it("deve recuperar eventos recentes do arquivo", async () => {
    const telemetry = TelemetryBuffer.getInstance();
    telemetry.capture("event.1");
    telemetry.capture("event.2");
    await telemetry.flush();

    const events = await telemetry.getRecentEvents();
    expect(events.length).toBe(2);
    expect(events[0].event).toBe("event.2"); // Ordem reversa
    expect(events[1].event).toBe("event.1");
  });
});
