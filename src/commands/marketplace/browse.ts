import { select, spinner, outro, isCancel, cancel } from "@clack/prompts";
import pc from "picocolors";
import { AuthService } from "../../core/AuthService.js";
import { MarketplaceClient } from "../../infrastructure/MarketplaceClient.js";
import { I18nService } from "../../core/I18nService.js";
import { marketplaceInstall } from "./install.js";
import type { Module } from "../../types/marketplace.js";

const PAGE_SIZE = 10;

type Screen = "categories" | "list" | "detail" | "exit";

interface BrowseState {
  category: string | null;
  page: number;
  selectedModule: Module | null;
  screen: Screen;
}

function tierBadge(tier: string): string {
  switch (tier.toUpperCase()) {
    case "FREE":       return pc.dim("[FREE]");
    case "STARTER":    return pc.green("[STARTER]");
    case "COMPLETE":   return pc.yellow("[COMPLETE]");
    case "PRO":        return pc.magenta("[PRO]");
    case "ENTERPRISE": return pc.cyan("[ENTERPRISE]");
    default:           return pc.dim(`[${tier}]`);
  }
}

function handleCancel(value: unknown) {
  if (isCancel(value)) {
    cancel("Cancelled.");
    process.exit(0);
  }
}

export async function marketplaceBrowse(): Promise<void> {
  const i18n = await I18nService.getInstance();
  const authService = new AuthService();
  const client = new MarketplaceClient(authService);
  const s = spinner();

  const state: BrowseState = {
    category: null,
    page: 1,
    selectedModule: null,
    screen: "categories",
  };

  while (state.screen !== "exit") {
    if (state.screen === "categories") {
      s.start(i18n.t("marketplace.browse.loadingCategories"));
      let categories: string[] = [];
      try {
        categories = await client.getCategories();
        s.stop();
      } catch {
        s.stop(pc.yellow(i18n.t("marketplace.browse.categoryLoadFailed")));
      }

      const categoryOptions = [
        { label: i18n.t("marketplace.browse.allModules"), value: "__all__" },
        ...categories.map((c) => ({ label: c, value: c })),
        { label: pc.dim(i18n.t("common.exit")), value: "__exit__" },
      ];

      const selected = await select({
        message: i18n.t("marketplace.browse.browseByCategory"),
        options: categoryOptions,
      });
      handleCancel(selected);

      if (selected === "__exit__") { state.screen = "exit"; break; }
      state.category = selected === "__all__" ? null : (selected as string);
      state.page = 1;
      state.screen = "list";
      continue;
    }

    if (state.screen === "list") {
      s.start(i18n.t("marketplace.browse.loadingModules"));
      let modules: Module[] = [];
      let totalPages = 1;

      try {
        const result = await client.listModules({
          category: state.category || undefined,
          page: state.page,
          pageSize: PAGE_SIZE,
        });
        modules = result.data;
        totalPages = Math.ceil(result.total / PAGE_SIZE) || 1;
        s.stop();
      } catch (error) {
        s.stop(pc.red(i18n.t("marketplace.browse.errorLoadingModules", { error: error instanceof Error ? error.message : String(error) })));
        state.screen = "categories";
        continue;
      }

      if (modules.length === 0) {
        console.log(pc.yellow(i18n.t("marketplace.browse.noModulesFound")));
        state.screen = "categories";
        continue;
      }

      const categoryLabel = state.category ? ` [${state.category}]` : "";
      const pageLabel = totalPages > 1 ? ` (${state.page}/${totalPages})` : "";

      const moduleOptions = [
        ...modules.map((m) => ({
          label: `${m.name} ${tierBadge(m.requiredTier ?? m.tier ?? "")}`,
          hint: m.description,
          value: m.slug,
        })),
        ...(state.page < totalPages ? [{ label: pc.cyan(i18n.t("marketplace.browse.nextPage")), value: "__next__" }] : []),
        ...(state.page > 1 ? [{ label: pc.cyan(i18n.t("marketplace.browse.prevPage")), value: "__prev__" }] : []),
        { label: pc.dim(i18n.t("marketplace.browse.backToCategories")), value: "__back__" },
        { label: pc.dim(i18n.t("common.exit")), value: "__exit__" },
      ];

      const selected = await select({
        message: `Modules${categoryLabel}${pageLabel}:`,
        options: moduleOptions,
      });
      handleCancel(selected);

      if (selected === "__exit__") { state.screen = "exit"; break; }
      if (selected === "__back__") { state.screen = "categories"; continue; }
      if (selected === "__next__") { state.page++; continue; }
      if (selected === "__prev__") { state.page = Math.max(1, state.page - 1); continue; }

      const module = modules.find((m) => m.slug === selected);
      if (module) { state.selectedModule = module; state.screen = "detail"; }
      continue;
    }

    if (state.screen === "detail" && state.selectedModule) {
      const m = state.selectedModule;

      console.log();
      console.log(pc.bold(m.name), tierBadge(m.requiredTier ?? m.tier ?? ""));
      console.log(pc.dim(`Version: ${m.latestVersion || "latest"}`));
      if (m.installCount !== undefined) {
        console.log(pc.dim(`Installs: ${m.installCount.toLocaleString()}`));
      }
      if (m.description) {
        console.log();
        console.log(m.description);
      }
      console.log();

      const action = await select({
        message: i18n.t("marketplace.browse.whatToDo"),
        options: [
          { label: i18n.t("marketplace.browse.install", { name: m.name }), value: "install" },
          { label: pc.dim(i18n.t("marketplace.browse.backToList")), value: "back" },
          { label: pc.dim(i18n.t("common.exit")), value: "exit" },
        ],
      });
      handleCancel(action);

      if (action === "exit") { state.screen = "exit"; break; }
      if (action === "back") { state.selectedModule = null; state.screen = "list"; continue; }
      if (action === "install") {
        console.log();
        await marketplaceInstall(m.slug, { force: false, skipEnv: false });
        state.screen = "exit";
        break;
      }
    }
  }

  outro(pc.dim(i18n.t("marketplace.browse.sessionEnded")));
}
