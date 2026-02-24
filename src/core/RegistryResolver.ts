import { configManager } from "./ConfigManager";
import { MarketplaceClient } from "../infrastructure/MarketplaceClient";
import { AuthService } from "./AuthService";

/**
 * C2.5: Registry resolver — handles both official and custom registries
 */
export class RegistryResolver {
  private authService: AuthService;

  constructor(authService?: AuthService) {
    this.authService = authService || new AuthService();
  }

  /**
   * Get the active registry URL (custom or default)
   */
  async getActiveRegistry(): Promise<string> {
    await configManager.initialize();
    return configManager.getRegistry();
  }

  /**
   * Get marketplace client for active registry
   */
  async getMarketplaceClient(): Promise<MarketplaceClient> {
    const registry = await this.getActiveRegistry();
    const client = new MarketplaceClient(this.authService);

    // Set custom registry if configured
    if (registry !== "https://marketplace.kaven.sh") {
      (client as unknown as Record<string, string>).baseUrl = registry;
    }

    return client;
  }

  /**
   * Validate registry URL is accessible
   */
  async validateRegistry(url: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch(`${url}/health`);

      if (!response.ok) {
        return {
          valid: false,
          error: `Registry returned ${response.status} ${response.statusText}`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Set custom registry
   */
  async setCustomRegistry(url: string): Promise<void> {
    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL format: ${url}`);
    }

    // Validate registry is accessible
    const validation = await this.validateRegistry(url);
    if (!validation.valid) {
      throw new Error(`Registry validation failed: ${validation.error}`);
    }

    // Save to config
    await configManager.initialize();
    await configManager.set("customRegistry", url);
  }

  /**
   * Reset to default registry
   */
  async resetToDefaultRegistry(): Promise<void> {
    await configManager.initialize();
    await configManager.set("customRegistry", undefined);
  }

  /**
   * List all available registries (default + custom)
   */
  async listRegistries(): Promise<{
    default: string;
    custom?: string;
    active: string;
  }> {
    await configManager.initialize();
    const config = configManager.getAll();

    return {
      default: config.registry || "https://marketplace.kaven.sh",
      custom: config.customRegistry,
      active: await this.getActiveRegistry(),
    };
  }
}
