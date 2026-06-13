import { createInstance } from "i18next";

export type Language = "en" | "pt-BR";

const en = {
  common: {
    welcome: "Welcome to Kaven CLI",
    success: "Success",
    error: "Error",
    warning: "Warning",
    suggestion: "Suggestion",
    proceed: "Do you want to proceed?",
    cancelled: "Operation cancelled",
    exit: "Exit",
    back: "Back",
    cancel: "Cancel",
  },
  init: {
    intro: "Bootstrapping a new Kaven project",
    outro: "Project created successfully! Ready to build.",
    projectName: "What is the name of your project?",
    template: "Select a template",
    withSquad: "Include AIOX Squad (AI Agents)?",
    installing: "Installing dependencies...",
  },
  module: {
    activate: {
      title: "Module Activation: {{name}}",
      models: "Models to be added: {{count}}",
      envVars: "Env vars to inject: {{count}}",
      alreadyActive: "Module '{{name}}' is already active.",
    },
    list: {
      header: "Kaven Schema Modules",
    },
  },
  doctor: {
    checking: "Running diagnostics...",
    allClear: "Your project is healthy!",
    issuesFound: "Found {{count}} issue(s).",
    fixSuggestion: "💡 Run 'kaven module doctor --fix' to resolve automatically.",
  },
  marketplace: {
    browse: {
      loadingCategories: "Loading categories...",
      categoryLoadFailed: "Could not load categories — showing all modules.",
      browseByCategory: "Browse by category:",
      allModules: "All modules",
      loadingModules: "Loading modules...",
      errorLoadingModules: "Error loading modules: {{error}}",
      noModulesFound: "No modules found.",
      nextPage: "→ Next page",
      prevPage: "← Previous page",
      backToCategories: "↑ Back to categories",
      whatToDo: "What would you like to do?",
      install: "Install {{name}}",
      backToList: "Back to module list",
      sessionEnded: "Browse session ended.",
    },
  },
  config: {
    features: {
      catalogHeader: "Kaven Framework — Capability Catalog",
      capabilitiesTotal: "{{count}} capabilities total",
      tierPresets: "Tier presets:",
      tuiHeader: "🛡️ Kaven Feature Flag Configuration",
      selectTier: "Select a base tier:",
      customize: "Customize individual capabilities?",
      confirmOverwrite: "Seed file already exists. Overwrite?",
      seedWritten: "Seed file written to: {{path}}",
      runSeed: "Run pnpm prisma db seed to apply capabilities to your database.",
      dryRunHeader: "--- DRY RUN: Generated Content ---",
    },
  },
};

const ptBR: typeof en = {
  common: {
    welcome: "Bem-vindo à Kaven CLI",
    success: "Sucesso",
    error: "Erro",
    warning: "Aviso",
    suggestion: "Sugestão",
    proceed: "Deseja continuar?",
    cancelled: "Operação cancelada",
    exit: "Sair",
    back: "Voltar",
    cancel: "Cancelar",
  },
  init: {
    intro: "Iniciando um novo projeto Kaven",
    outro: "Projeto criado com sucesso! Hora de construir.",
    projectName: "Qual o nome do seu projeto?",
    template: "Selecione um template",
    withSquad: "Incluir AIOX Squad (Agentes de IA)?",
    installing: "Instalando dependências...",
  },
  module: {
    activate: {
      title: "Ativação de Módulo: {{name}}",
      models: "Models a serem adicionados: {{count}}",
      envVars: "Variáveis de ambiente: {{count}}",
      alreadyActive: "O módulo '{{name}}' já está ativo.",
    },
    list: {
      header: "Módulos de Schema Kaven",
    },
  },
  doctor: {
    checking: "Executando diagnósticos...",
    allClear: "Seu projeto está saudável!",
    issuesFound: "Encontrados {{count}} problema(s).",
    fixSuggestion: "💡 Execute 'kaven module doctor --fix' para resolver automaticamente.",
  },
  marketplace: {
    browse: {
      loadingCategories: "Carregando categorias...",
      categoryLoadFailed: "Não foi possível carregar categorias — exibindo todos os módulos.",
      browseByCategory: "Navegar por categoria:",
      allModules: "Todos os módulos",
      loadingModules: "Carregando módulos...",
      errorLoadingModules: "Erro ao carregar módulos: {{error}}",
      noModulesFound: "Nenhum módulo encontrado.",
      nextPage: "→ Próxima página",
      prevPage: "← Página anterior",
      backToCategories: "↑ Voltar às categorias",
      whatToDo: "O que deseja fazer?",
      install: "Instalar {{name}}",
      backToList: "Voltar à lista",
      sessionEnded: "Sessão de navegação encerrada.",
    },
  },
  config: {
    features: {
      catalogHeader: "Kaven Framework — Catálogo de Capacidades",
      capabilitiesTotal: "{{count}} capacidades no total",
      tierPresets: "Presets de tier:",
      tuiHeader: "🛡️ Configuração de Feature Flags Kaven",
      selectTier: "Selecione um tier base:",
      customize: "Personalizar capacidades individualmente?",
      confirmOverwrite: "Arquivo de seed já existe. Sobrescrever?",
      seedWritten: "Seed escrito em: {{path}}",
      runSeed: "Execute pnpm prisma db seed para aplicar as capacidades ao banco.",
      dryRunHeader: "--- DRY RUN: Conteúdo Gerado ---",
    },
  },
};

export class I18nService {
  private static instance: I18nService;
  // P3: dedicated instance instead of global i18next — prevents cross-test language pollution
  private i18n = createInstance();

  private constructor() {}

  public static async getInstance(): Promise<I18nService> {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService();
      await I18nService.instance.init();
    }
    return I18nService.instance;
  }

  private async init() {
    const lang = process.env.KAVEN_LANG || "en";
    await this.i18n.init({
      lng: lang,
      fallbackLng: "en",
      resources: {
        en: { translation: en },
        "pt-BR": { translation: ptBR },
      },
    });
  }

  public t(key: string, params?: Record<string, unknown>): string {
    return this.i18n.t(key, params as Record<string, string>);
  }

  public async setLanguage(lang: Language) {
    await this.i18n.changeLanguage(lang);
  }

  public getI18n() {
    return this.i18n;
  }
}

/** Module-level shorthand — uses the singleton's dedicated instance, never the global i18next. */
export const t = (key: string, params?: Record<string, unknown>): string => {
  const svc = (I18nService as unknown as { instance?: I18nService }).instance;
  if (svc) return svc.getI18n().t(key, params as Record<string, string>);
  return key;
};
