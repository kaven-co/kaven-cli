import fs from "fs-extra";
import path from "path";

// ============================================================
// Definição dos módulos conhecidos do kaven-framework
// ============================================================

export type ModuleId = "auth" | "billing" | "projects" | "notifications" | "marketing-tracking";

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
];

// ============================================================
// Marcadores de seção no schema
// ============================================================

const BEGIN_MARKER = (moduleId: string) =>
  `// [KAVEN_MODULE:${moduleId.toUpperCase()} BEGIN]`;
const END_MARKER = (moduleId: string) =>
  `// [KAVEN_MODULE:${moduleId.toUpperCase()} END]`;

/** Regex robusto para capturar comentário e conteúdo, tolerante a espaços variáveis */
const COMMENT_REGEX = /^(\s*)\/\/\s*(.*)$/;

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

  /** Valida se os marcadores do módulo estão pareados corretamente */
  private validateMarkers(content: string, moduleId: string): void {
    const begin = BEGIN_MARKER(moduleId);
    const end = END_MARKER(moduleId);

    const hasBegin = content.includes(begin);
    const hasEnd = content.includes(end);

    if (hasBegin && !hasEnd) {
      throw new Error(`Marcador órfão detectado: Faltando END para o módulo "${moduleId}".`);
    }
    if (!hasBegin && hasEnd) {
      throw new Error(`Marcador órfão detectado: Faltando BEGIN para o módulo "${moduleId}".`);
    }
    if (!hasBegin && !hasEnd) {
      throw new Error(`O módulo "${moduleId}" não possui uma seção marcada no schema.`);
    }

    // Verifica se BEGIN vem antes de END
    if (content.indexOf(begin) > content.indexOf(end)) {
      throw new Error(`Marcadores invertidos para o módulo "${moduleId}".`);
    }
  }

  /**
   * Detecta se um módulo está ativo no schema.
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

  async activateModule(def: KavenModuleDef): Promise<void> {
    const content = await this.readSchema();
    this.validateMarkers(content, def.id);

    const updated = this.uncommentBlock(content, def.id);
    await this.writeSchema(updated);
  }

  async deactivateModule(def: KavenModuleDef): Promise<void> {
    const content = await this.readSchema();
    this.validateMarkers(content, def.id);

    const updated = this.commentBlock(content, def.id);
    await this.writeSchema(updated);
  }

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
          result.push(line);
        } else {
          result.push(`// ${line}`);
        }
      } else {
        result.push(line);
      }
    }

    return result.join("\n");
  }

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
        const match = line.match(COMMENT_REGEX);
        if (match) {
          // match[1] é a indentação, match[2] é o conteúdo sem // e sem o primeiro espaço opcional
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
