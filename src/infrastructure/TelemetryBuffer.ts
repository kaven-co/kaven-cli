import fs from "fs-extra";
import path from "path";
import os from "os";

export interface TelemetryEvent {
  event: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  duration?: number;
}

export class TelemetryBuffer {
  private static instance: TelemetryBuffer;
  private readonly logPath: string;
  private buffer: TelemetryEvent[] = [];

  private constructor() {
    this.logPath = path.join(os.homedir(), ".kaven", "telemetry.log");
  }

  public static getInstance(): TelemetryBuffer {
    if (!TelemetryBuffer.instance) {
      TelemetryBuffer.instance = new TelemetryBuffer();
    }
    return TelemetryBuffer.instance;
  }

  /**
   * Captura um evento de telemetria
   */
  public capture(event: string, metadata?: Record<string, unknown>, duration?: number): void {
    const telemetryEvent: TelemetryEvent = {
      event,
      timestamp: new Date().toISOString(),
      metadata,
      duration,
    };
    this.buffer.push(telemetryEvent);
  }

  /**
   * Persiste os eventos do buffer no arquivo local
   */
  public async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    try {
      const logDir = path.dirname(this.logPath);
      await fs.ensureDir(logDir);

      const lines = this.buffer.map((e) => JSON.stringify(e)).join("\n") + "\n";
      await fs.appendFile(this.logPath, lines, "utf8");
      
      this.buffer = [];
    } catch (error) {
      // Falha silenciosa na telemetria para não interromper fluxo principal
      console.debug("Erro ao gravar telemetria:", error);
    }
  }

  /**
   * Recupera os últimos eventos registrados
   */
  public async getRecentEvents(limit: number = 20): Promise<TelemetryEvent[]> {
    if (!(await fs.pathExists(this.logPath))) return [];

    try {
      const content = await fs.readFile(this.logPath, "utf8");
      return content
        .trim()
        .split("\n")
        .reverse()
        .slice(0, limit)
        .map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }
}
