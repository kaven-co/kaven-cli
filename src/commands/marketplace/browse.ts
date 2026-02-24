import chalk from "chalk";
import ora from "ora";
import { AuthService } from "../../core/AuthService";
import { MarketplaceClient } from "../../infrastructure/MarketplaceClient";
import { marketplaceInstall } from "./install";
import type { Module } from "../../types/marketplace";

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
    case "FREE":
      return chalk.gray("[FREE]");
    case "STARTER":
      return chalk.green("[STARTER]");
    case "COMPLETE":
      return chalk.yellow("[COMPLETE]");
    case "PRO":
      return chalk.magenta("[PRO]");
    case "ENTERPRISE":
      return chalk.cyan("[ENTERPRISE]");
    default:
      return chalk.gray(`[${tier}]`);
  }
}

export async function marketplaceBrowse(): Promise<void> {
  const authService = new AuthService();
  const client = new MarketplaceClient(authService);

  const state: BrowseState = {
    category: null,
    page: 1,
    selectedModule: null,
    screen: "categories",
  };

  const { select } = await import("@inquirer/prompts");

  while (state.screen !== "exit") {
    if (state.screen === "categories") {
      // Step 1: Category selection
      const spinner = ora("Loading categories...").start();
      let categories: string[] = [];
      try {
        categories = await client.getCategories();
        spinner.stop();
      } catch {
        spinner.stop();
        console.log(chalk.yellow("Could not load categories — showing all modules."));
      }

      const categoryChoices = [
        { name: "All modules", value: "__all__" },
        ...categories.map((c) => ({ name: c, value: c })),
        { name: chalk.red("Exit"), value: "__exit__" },
      ];

      const selected = await select({
        message: "Browse by category:",
        choices: categoryChoices,
      });

      if (selected === "__exit__") {
        state.screen = "exit";
        break;
      }

      state.category = selected === "__all__" ? null : selected;
      state.page = 1;
      state.screen = "list";
      continue;
    }

    if (state.screen === "list") {
      // Step 2: Module listing with pagination
      const spinner = ora("Loading modules...").start();
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
        spinner.stop();
      } catch (error) {
        spinner.stop();
        console.error(
          chalk.red(
            `Error loading modules: ${error instanceof Error ? error.message : String(error)}`
          )
        );
        state.screen = "categories";
        continue;
      }

      if (modules.length === 0) {
        console.log(
          chalk.yellow(
            `No modules found${state.category ? ` in category: ${state.category}` : ""}.`
          )
        );
        state.screen = "categories";
        continue;
      }

      const categoryLabel = state.category ? ` [${state.category}]` : "";
      const pageLabel = totalPages > 1 ? ` (page ${state.page}/${totalPages})` : "";

      const moduleChoices = [
        ...modules.map((m) => ({
          name: `${m.name} ${tierBadge(m.tier)} — ${m.description}`,
          value: m.slug,
        })),
      ];

      // Navigation options at bottom
      if (state.page < totalPages) {
        moduleChoices.push({ name: chalk.cyan("→ Next page"), value: "__next__" });
      }
      if (state.page > 1) {
        moduleChoices.push({ name: chalk.cyan("← Previous page"), value: "__prev__" });
      }
      moduleChoices.push({ name: chalk.dim("↑ Back to categories"), value: "__back__" });
      moduleChoices.push({ name: chalk.red("Exit"), value: "__exit__" });

      const selected = await select({
        message: `Modules${categoryLabel}${pageLabel}:`,
        choices: moduleChoices,
      });

      if (selected === "__exit__") {
        state.screen = "exit";
        break;
      }
      if (selected === "__back__") {
        state.screen = "categories";
        continue;
      }
      if (selected === "__next__") {
        state.page++;
        continue;
      }
      if (selected === "__prev__") {
        state.page = Math.max(1, state.page - 1);
        continue;
      }

      // Find selected module
      const module = modules.find((m) => m.slug === selected);
      if (module) {
        state.selectedModule = module;
        state.screen = "detail";
      }
      continue;
    }

    if (state.screen === "detail" && state.selectedModule) {
      const m = state.selectedModule;

      // Step 3: Module detail view
      console.log();
      console.log(chalk.bold(`${m.name}`), tierBadge(m.tier));
      console.log(chalk.gray(`Version: ${m.latestVersion || "latest"}`));
      if (m.installCount !== undefined) {
        console.log(chalk.gray(`Installs: ${m.installCount.toLocaleString()}`));
      }
      if (m.description) {
        console.log();
        console.log(m.description);
      }
      console.log();

      const action = await select({
        message: "What would you like to do?",
        choices: [
          { name: `Install ${m.name}`, value: "install" },
          { name: "Back to module list", value: "back" },
          { name: chalk.red("Exit"), value: "exit" },
        ],
      });

      if (action === "exit") {
        state.screen = "exit";
        break;
      }
      if (action === "back") {
        state.selectedModule = null;
        state.screen = "list";
        continue;
      }
      if (action === "install") {
        console.log();
        await marketplaceInstall(m.slug, {
          force: false,
          skipEnv: false,
        });
        state.screen = "exit";
        break;
      }
    }
  }

  if (state.screen === "exit") {
    console.log(chalk.gray("Browse session ended."));
  }
}
