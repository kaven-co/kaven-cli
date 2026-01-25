import { ModuleManifest } from "../types/manifest";

export interface MarketplaceModule {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
}

export class MarketplaceClient {
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
