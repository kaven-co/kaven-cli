import fs from "fs-extra";
import path from "path";

// ============================================================
// Definição dos módulos conhecidos do kaven-framework
// ============================================================

export type ModuleId = "auth" | "billing" | "projects" | "notifications" | "marketing-tracking" | "service-tokens";

export interface KavenModuleDef {
  id: ModuleId;
  label: string;
  description: string;
  /** Models declarados por este módulo no schema */
  models: string[];
  /** Enums declarados por este módulo no schema */
  enums: string[];
  /** IDs dos módulos que devem estar ativos para este funcionar */
  dependsOn: ModuleId[];
}

export interface ModuleStatus {
  id: ModuleId;
  label: string;
  description: string;
  models: string[];
  dependsOn: ModuleId[];
  active: boolean;
  /** Indica se o bloco marcado está presente no schema (BEGIN/END markers) */
  hasMarkers: boolean;
}

export const KAVEN_MODULES: KavenModuleDef[] = [
  {
    id: "auth",
    label: "Auth & Identity",
    description: "Gestão de usuários, permissões e sessões",
    models: ["User", "Role", "Capability", "AuthSession", "AuditLog"],
    enums: ["UserRole"],
    dependsOn: [],
  },
  {
    id: "billing",
    label: "Billing",
    description: "Faturamento, assinaturas e pagamentos",
    models: ["Invoice", "Order", "Subscription", "Plan", "Payment", "Product"],
    enums: [],
    dependsOn: [],
  },
  {
    id: "projects",
    label: "Projects",
    description: "Gestão de projetos e tasks",
    models: ["Project", "Task"],
    enums: ["ProjectStatus", "TaskStatus", "TaskPriority"],
    dependsOn: [],
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Notificações e preferências de usuário",
    models: ["Notification", "UserPreference"],
    enums: [],
    dependsOn: [],
  },
  {
    id: "marketing-tracking",
    label: "Marketing Tracking",
    description: "Observabilidade de anúncios, GTM, GA4 e Meta CAPI",
    models: ["TrackingEvent"],
    enums: ["TrackingSource"],
    dependsOn: [],
  },
  {
    id: "service-tokens",
    label: "Service Tokens",
    description: "Agent authentication tokens for AIOX integration",
    models: ["ServiceToken"],
    enums: [],
    dependsOn: [],
  },
];

// ============================================================
// Marcadores de seção no schema
// ============================================================

const BEGIN_MARKER = (moduleId: string) =>
  `// [KAVEN_MODULE:${moduleId.toUpperCase()} BEGIN]`;
const END_MARKER = (moduleId: string) =>
  `// [KAVEN_MODULE:${moduleId.toUpperCase()} END]`;

// ============================================================
// SchemaActivator — lê/escreve schema.extended.prisma
// ============================================================

export class SchemaActivator {
  private readonly schemaPath: string;

  constructor(projectRoot: string) {
    this.schemaPath = path.join(
      projectRoot,
      "packages",
      "database",
      "prisma",
      "schema.extended.prisma",
    );
  }

  /** Verifica se o schema existe no projeto */
  async exists(): Promise<boolean> {
    return fs.pathExists(this.schemaPath);
  }

  /** Caminho absoluto do schema */
  get path(): string {
    return this.schemaPath;
  }

  /** Lê o conteúdo atual do schema */
  private async readSchema(): Promise<string> {
    return fs.readFile(this.schemaPath, "utf-8");
  }

  /** Persiste o conteúdo no schema */
  private async writeSchema(content: string): Promise<void> {
    await fs.writeFile(this.schemaPath, content, "utf-8");
  }

  /**
   * Detecta se um módulo está ativo no schema.
   *
   * Estratégia:
   * 1. Se existirem marcadores BEGIN/END: verifica se o conteúdo dentro
   *    dos marcadores NÃO está completamente comentado.
   * 2. Se não houver marcadores: verifica se algum dos models principais
   *    do módulo está presente e não comentado no arquivo.
   */
  async getModuleStatus(def: KavenModuleDef): Promise<ModuleStatus> {
    const content = await this.readSchema();
    const begin = BEGIN_MARKER(def.id);
    const end = END_MARKER(def.id);

    const hasMarkers = content.includes(begin) && content.includes(end);

    let active = false;

    if (hasMarkers) {
      const block = this.extractBlock(content, def.id);
      active = block !== null && this.isBlockActive(block);
    } else {
      // Sem marcadores: verifica presença de pelo menos um model descomentado
      active = def.models.some((modelName) =>
        this.isModelActive(content, modelName),
      );
    }

    return {
      id: def.id,
      label: def.label,
      description: def.description,
      models: def.models,
      dependsOn: def.dependsOn,
      active,
      hasMarkers,
    };
  }

  /** Ativa um módulo: se tem marcadores, descomenta o bloco; senão, injeta o bloco */
  async activateModule(def: KavenModuleDef): Promise<void> {
    const content = await this.readSchema();
    const begin = BEGIN_MARKER(def.id);
    const end = END_MARKER(def.id);

    if (content.includes(begin) && content.includes(end)) {
      const updated = this.uncommentBlock(content, def.id);
      await this.writeSchema(updated);
      return;
    }

    // Módulo não tem seção marcada — sem template para injetar
    throw new Error(
      `O módulo "${def.id}" não possui uma seção marcada (BEGIN/END) no schema.\n` +
        `Adicione o bloco do módulo manualmente com os marcadores:\n` +
        `  ${begin}\n` +
        `  ... models do módulo ...\n` +
        `  ${end}`,
    );
  }

  /** Desativa um módulo: comenta todos os models do bloco */
  async deactivateModule(def: KavenModuleDef): Promise<void> {
    const content = await this.readSchema();
    const begin = BEGIN_MARKER(def.id);
    const end = END_MARKER(def.id);

    if (!content.includes(begin) || !content.includes(end)) {
      throw new Error(
        `O módulo "${def.id}" não possui marcadores BEGIN/END no schema. ` +
          `Não é possível desativar automaticamente.`,
      );
    }

    const updated = this.commentBlock(content, def.id);
    await this.writeSchema(updated);
  }

  // ──────────────────────────────────────────────
  // Helpers de manipulação de blocos
  // ──────────────────────────────────────────────

  /**
   * Extrai o conteúdo entre os marcadores BEGIN e END (exclusive).
   * Retorna null se os marcadores não forem encontrados.
   */
  private extractBlock(content: string, moduleId: string): string | null {
    const begin = BEGIN_MARKER(moduleId);
    const end = END_MARKER(moduleId);
    const lines = content.split("\n");

    let beginIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(begin)) beginIdx = i;
      if (lines[i].includes(end) && beginIdx !== -1) {
        endIdx = i;
        break;
      }
    }

    if (beginIdx === -1 || endIdx === -1) return null;
    return lines.slice(beginIdx + 1, endIdx).join("\n");
  }

  /**
   * Verifica se um bloco tem ao menos uma linha não-comentada relevante
   * (ignora linhas vazias e comentários simples).
   */
  private isBlockActive(block: string): boolean {
    return block.split("\n").some((line) => {
      const trimmed = line.trim();
      return (
        trimmed.length > 0 &&
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("/*") &&
        !trimmed.startsWith("*")
      );
    });
  }

  /**
   * Verifica se um model específico está ativo (não comentado) no schema.
   * Procura pela linha `model ModelName {` sem `//` antes.
   */
  private isModelActive(content: string, modelName: string): boolean {
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith(`model ${modelName}`) &&
        !line.trimStart().startsWith("//")
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Comenta todas as linhas não-comentadas dentro do bloco BEGIN/END.
   */
  private commentBlock(content: string, moduleId: string): string {
    const begin = BEGIN_MARKER(moduleId);
    const end = END_MARKER(moduleId);
    const lines = content.split("\n");

    let inBlock = false;
    const result: string[] = [];

    for (const line of lines) {
      if (line.includes(begin)) {
        inBlock = true;
        result.push(line);
        continue;
      }
      if (line.includes(end)) {
        inBlock = false;
        result.push(line);
        continue;
      }

      if (inBlock) {
        const trimmed = line.trim();
        if (trimmed.length === 0) {
          result.push(line);
        } else if (trimmed.startsWith("//")) {
          result.push(line); // já comentado
        } else {
          result.push(`// ${line}`);
        }
      } else {
        result.push(line);
      }
    }

    return result.join("\n");
  }

  /**
   * Remove `// ` do início das linhas dentro do bloco BEGIN/END.
   */
  private uncommentBlock(content: string, moduleId: string): string {
    const begin = BEGIN_MARKER(moduleId);
    const end = END_MARKER(moduleId);
    const lines = content.split("\n");

    let inBlock = false;
    const result: string[] = [];

    for (const line of lines) {
      if (line.includes(begin)) {
        inBlock = true;
        result.push(line);
        continue;
      }
      if (line.includes(end)) {
        inBlock = false;
        result.push(line);
        continue;
      }

      if (inBlock) {
        // Remove exatamente um nível de comentário preservando identação
        const match = line.match(/^(\s*)\/\/\s?(.*)$/);
        if (match) {
          result.push(match[1] + match[2]);
        } else {
          result.push(line);
        }
      } else {
        result.push(line);
      }
    }

    return result.join("\n");
  }
}
