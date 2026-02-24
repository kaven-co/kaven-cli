import path from "path";
import fs from "fs-extra";
import os from "os";
import { z } from "zod";

const CONFIG_DIR = path.join(os.homedir(), ".kaven");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

export const configSchema = z.object({
  registry: z.string().url().default("https://marketplace.kaven.sh"),
  telemetry: z.boolean().default(true),
  theme: z.enum(["light", "dark"]).default("dark"),
  locale: z.string().default("en-US"),
  // Custom registry support
  customRegistry: z.string().url().optional(),
  // For storing user preferences
  lastLogin: z.string().datetime().optional(),
  projectDefaults: z
    .object({
      dbUrl: z.string().optional(),
      emailProvider: z.enum(["postmark", "resend", "ses", "smtp"]).optional(),
      locale: z.string().optional(),
      currency: z.string().optional(),
    })
    .optional(),
});

export type KavenConfig = z.infer<typeof configSchema>;

export class ConfigManager {
  private config: KavenConfig;

  constructor() {
    this.config = {
      registry: "https://marketplace.kaven.sh",
      telemetry: true,
      theme: "dark",
      locale: "en-US",
    };
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(CONFIG_DIR);
    if (await fs.pathExists(CONFIG_PATH)) {
      try {
        const raw = await fs.readJson(CONFIG_PATH);
        const parsed = configSchema.safeParse(raw);
        if (parsed.success) {
          this.config = parsed.data;
        } else {
          // If validation fails, use defaults
          this.config = {
            registry: "https://marketplace.kaven.sh",
            telemetry: true,
            theme: "dark",
            locale: "en-US",
          };
        }
      } catch {
        // If file is corrupted, start fresh
        this.config = {
          registry: "https://marketplace.kaven.sh",
          telemetry: true,
          theme: "dark",
          locale: "en-US",
        };
      }
    } else {
      // Initialize with defaults
      this.config = {
        registry: "https://marketplace.kaven.sh",
        telemetry: true,
        theme: "dark",
        locale: "en-US",
      };
      await this.persist();
    }
  }

  /**
   * Get config value with env var override support
   * Priority: ENV VAR > config file > CLI arg > default
   */
  get(key: keyof KavenConfig, envVarName?: string): unknown {
    // Check environment variable override
    if (envVarName) {
      const envValue = process.env[envVarName];
      if (envValue !== undefined) {
        return envValue;
      }
    }

    // Check config file
    const value = this.config[key];
    if (value !== undefined) {
      return value;
    }

    // Return default from schema
    const defaults = configSchema.parse({});
    return defaults[key];
  }

  /**
   * Set config value and persist to disk
   */
  async set(key: keyof KavenConfig, value: unknown): Promise<void> {
    const updateObj = { [key]: value };
    const updated = configSchema.safeParse({ ...this.config, ...updateObj });

    if (!updated.success) {
      const errors = updated.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      throw new Error(`Invalid config: ${errors}`);
    }

    this.config = updated.data;
    await this.persist();
  }

  /**
   * Get all config
   */
  getAll(): KavenConfig {
    return { ...this.config };
  }

  /**
   * Reset config to defaults
   */
  async reset(): Promise<void> {
    this.config = {
      registry: "https://marketplace.kaven.sh",
      telemetry: true,
      theme: "dark",
      locale: "en-US",
    };
    await this.persist();
  }

  /**
   * Persist config to disk
   */
  private async persist(): Promise<void> {
    await fs.ensureDir(CONFIG_DIR);
    await fs.writeJson(CONFIG_PATH, this.config, { spaces: 2 });
  }

  /**
   * Get registry URL (custom or default)
   */
  getRegistry(): string {
    return (this.config.customRegistry || this.config.registry || "https://marketplace.kaven.sh") as string;
  }

  /**
   * Check if telemetry is enabled (can be overridden by env var)
   */
  isTelemetryEnabled(): boolean {
    if (process.env.KAVEN_TELEMETRY === "0") {
      return false;
    }
    return this.config.telemetry !== false;
  }

  /**
   * Get config directory path
   */
  getConfigDir(): string {
    return CONFIG_DIR;
  }
}

// Export singleton instance
export const configManager = new ConfigManager();
