import { ModuleManifest } from "../types/manifest";
import { DeviceCodeResponse, TokenPollResult, AuthTokens } from "../types/auth";

export interface MarketplaceModule {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
}

export class MarketplaceClient {
  private readonly baseURL: string;
  private readonly mockModules: MarketplaceModule[] = [
    {
      id: "auth-google",
      name: "Google Auth",
      description: "Integração completa com Google OAuth2 e suporte a multiplataforma.",
      version: "1.2.0",
      author: "Kaven Official",
    },
    {
      id: "db-postgresql",
      name: "PostgreSQL Adapter",
      description: "Conexão otimizada para PostgreSQL com suporte a pooling e migrações.",
      version: "2.0.1",
      author: "Kaven Official",
    },
    {
      id: "stripe-payments",
      name: "Stripe Checkout",
      description: "Lógica de pagamentos resiliente com suporte a webhooks e assinaturas.",
      version: "1.0.5",
      author: "Kaven Official",
    },
  ];

  constructor() {
    // Use environment variable or default to production
    this.baseURL = process.env.MARKETPLACE_API_URL || 'https://marketplace.kaven.sh';
  }

  /**
   * Step 1 of Device Code Flow: Request device code from marketplace
   */
  async requestDeviceCode(): Promise<DeviceCodeResponse> {
    const response = await fetch(`${this.baseURL}/auth/device-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: 'kaven-cli' }),
    });

    if (!response.ok) {
      throw new Error(`Failed to request device code: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Step 2 of Device Code Flow: Poll for access token
   */
  async pollDeviceToken(deviceCode: string): Promise<TokenPollResult> {
    try {
      const response = await fetch(`${this.baseURL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      // Success - got tokens
      if (response.ok) {
        const tokens: AuthTokens = await response.json();
        return { status: 'success', tokens };
      }

      // OAuth error response
      const errorData = await response.json();
      const errorCode = errorData.error || 'unknown_error';

      switch (errorCode) {
        case 'authorization_pending':
          return { status: 'authorization_pending' };
        case 'slow_down':
          return { status: 'slow_down' };
        case 'access_denied':
          return { status: 'access_denied' };
        case 'expired_token':
          return { status: 'expired_token' };
        default:
          throw new Error(`Unexpected error: ${errorCode}`);
      }
    } catch (error) {
      // Network errors
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ECONNREFUSED' || nodeError.code === 'ENOTFOUND') {
        throw new Error('Network error. Check your connection and try again.');
      }
      throw error;
    }
  }

  async listModules(): Promise<MarketplaceModule[]> {
    // Simular latência de rede
    await new Promise((resolve) => setTimeout(resolve, 800));
    return this.mockModules;
  }

  async getModuleManifest(moduleId: string): Promise<ModuleManifest | null> {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const module = this.mockModules.find((m) => m.id === moduleId);
    if (!module) return null;

    // Gerar manifest mockado baseado no ID
    return {
      name: module.id,
      version: module.version,
      description: module.description,
      author: module.author,
      license: "Proprietary",
      dependencies: {
        npm: [],
        peerModules: [],
        kavenVersion: ">=0.1.0",
      },
      files: {
        backend: [],
        frontend: [],
        database: [],
      },
      injections: [
        {
          file: "kaven-setup.ts",
          anchor: "// KAVEN_INIT",
          code: `console.log("Module ${module.name} initialized!");`,
          moduleName: module.id,
        },
      ],
      scripts: {
        postInstall: null,
        preRemove: null,
      },
      env: [],
    };
  }
}
