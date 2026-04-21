import i18next from "i18next";

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
    }
  },
  doctor: {
    checking: "Running diagnostics...",
    allClear: "Your project is healthy!",
    issuesFound: "Found {{count}} issue(s).",
    fixSuggestion: "💡 Run 'kaven module doctor --fix' to resolve automatically.",
  }
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
    }
  },
  doctor: {
    checking: "Executando diagnósticos...",
    allClear: "Seu projeto está saudável!",
    issuesFound: "Encontrados {{count}} problema(s).",
    fixSuggestion: "💡 Execute 'kaven module doctor --fix' para resolver automaticamente.",
  }
};

export class I18nService {
  private static instance: I18nService;
  
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
    await i18next.init({
      lng: lang,
      fallbackLng: "en",
      resources: {
        en: { translation: en },
        "pt-BR": { translation: ptBR },
      },
    });
  }

  public t(key: string, params?: Record<string, unknown>): string {
    return i18next.t(key, params as Record<string, string>);
  }

  public async setLanguage(lang: Language) {
    await i18next.changeLanguage(lang);
  }
}

export const t = (key: string, params?: Record<string, unknown>) => i18next.t(key, params as Record<string, string>);
