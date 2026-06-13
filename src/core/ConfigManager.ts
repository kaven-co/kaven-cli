import path from "node:path";
import fs from "fs-extra";
import os from "node:os";
import yaml from "js-yaml";
import { z } from "zod";

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".kaven");
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, "config.json");
const PROJECT_CONFIG_FILENAME = "kaven-config.yaml";

export const configSchema = z.object({
  registry: z.string().url().default("https://marketplace.kaven.site"),
  telemetry: z.boolean().default(true),
  theme: z.enum(["light", "dark"]).default("dark"),
  language: z.enum(["en", "pt-BR"]).default("en"),
  customRegistry: z.string().url().optional(),
  // Project-specific state (stored in kaven-config.yaml)
  projectId: z.string().uuid().optional(),
  activeModules: z.array(z.string()).default([]),
  capabilities: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).default({}),
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
  private globalConfig: Partial<KavenConfig> = {};
  private projectConfig: Partial<KavenConfig> = {};
  private currentConfig: KavenConfig;

  constructor() {
    this.currentConfig = configSchema.parse({});
  }

  async initialize(): Promise<void> {
    // 1. Load Global Config
    await fs.ensureDir(GLOBAL_CONFIG_DIR);
    if (await fs.pathExists(GLOBAL_CONFIG_PATH)) {
      try {
        this.globalConfig = await fs.readJson(GLOBAL_CONFIG_PATH);
      } catch {
        this.globalConfig = {};
      }
    }

    // 2. Load Project Config
    const projectRoot = this.findProjectRoot();
    if (projectRoot) {
      const projectPath = path.join(projectRoot, PROJECT_CONFIG_FILENAME);
      if (await fs.pathExists(projectPath)) {
        try {
          const content = await fs.readFile(projectPath, "utf-8");
          this.projectConfig = yaml.load(content) as Partial<KavenConfig>;
        } catch {
          this.projectConfig = {};
        }
      }
    }

    // 3. Resolve Final Config
    this.resolve();
  }

  private resolve() {
    this.currentConfig = configSchema.parse({
      ...this.globalConfig,
      ...this.projectConfig,
    });
  }

  private findProjectRoot(): string | null {
    let curr = process.cwd();
    while (curr !== path.parse(curr).root) {
      if (fs.existsSync(path.join(curr, "package.json"))) {
        return curr;
      }
      curr = path.dirname(curr);
    }
    return null;
  }

  /**
   * Get config value with layers support
   */
  get<K extends keyof KavenConfig>(key: K): KavenConfig[K] {
    const envVar = `KAVEN_${key.toUpperCase()}`;
    if (process.env[envVar] !== undefined) {
      const val = process.env[envVar];
      if (typeof this.currentConfig[key] === "boolean") return (val === "true") as unknown as KavenConfig[K];
      if (typeof this.currentConfig[key] === "number") return Number(val) as unknown as KavenConfig[K];
      return val as unknown as KavenConfig[K];
    }
    return this.currentConfig[key];
  }

  /**
   * Set config value. 
   * By default, it sets to Project Config if in a Kaven project, otherwise Global.
   */
  async set<K extends keyof KavenConfig>(key: K, value: KavenConfig[K], scope: "global" | "project" = "project"): Promise<void> {
    if (scope === "project") {
      this.projectConfig[key] = value;
      await this.persistProject();
    } else {
      this.globalConfig[key] = value;
      await this.persistGlobal();
    }
    this.resolve();
  }

  async persistGlobal(): Promise<void> {
    await fs.ensureDir(GLOBAL_CONFIG_DIR);
    await fs.writeJson(GLOBAL_CONFIG_PATH, this.globalConfig, { spaces: 2 });
  }

  async persistProject(): Promise<void> {
    const root = this.findProjectRoot();
    if (!root) return;
    const projectPath = path.join(root, PROJECT_CONFIG_FILENAME);
    const content = yaml.dump(this.projectConfig, { lineWidth: 120, noRefs: true });
    await fs.writeFile(projectPath, content, "utf-8");
  }

  async reset(): Promise<void> {
    this.globalConfig = {};
    this.projectConfig = {};
    await this.persistGlobal();
    await this.persistProject();
    this.resolve();
  }

  getRegistry(): string {
    return this.currentConfig.customRegistry || this.currentConfig.registry;
  }

  getAll(): KavenConfig {
    return { ...this.currentConfig };
  }

  getProjectRoot(): string | null {
    return this.findProjectRoot();
  }

  getConfigDir(): string {
    return GLOBAL_CONFIG_DIR;
  }
}

export const configManager = new ConfigManager();
