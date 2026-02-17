import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { MarketplaceClient } from "../../infrastructure/MarketplaceClient";
import { AuthService } from "../../core/AuthService";
import { NetworkError } from "../../infrastructure/errors";
import { TelemetryBuffer } from "../../infrastructure/TelemetryBuffer";
import type { Module } from "../../types/marketplace";

export interface MarketplaceListOptions {
  category?: string;
  sort?: "newest" | "popular" | "name";
  page?: number;
  limit?: number;
  json?: boolean;
}

function colorTier(tier: Module["tier"]): string {
  switch (tier) {
    case "starter":
      return chalk.green(tier);
    case "complete":
      return chalk.yellow(tier);
    case "pro":
      return chalk.magenta(tier);
    case "enterprise":
      return chalk.blue(tier);
    default:
      return tier;
  }
}

export async function marketplaceList(
  options: MarketplaceListOptions = {}
): Promise<void> {
  const telemetry = TelemetryBuffer.getInstance();
  const startTime = Date.now();
  telemetry.capture("cli.marketplace.list.start");

  const authService = new AuthService();
  const client = new MarketplaceClient(authService);

  const page = options.page ?? 1;
  const pageSize = Math.min(options.limit ?? 20, 100);
  const sort = options.sort ?? "newest";

  // Check auth — warn but don't block
  const isAuth = await authService.isAuthenticated();
  if (!isAuth) {
    console.log(
      chalk.yellow(
        "Warning: Not authenticated. Only public modules will be shown. Run: kaven auth login"
      )
    );
  }

  const spinner = ora("Fetching modules from Marketplace...").start();

  try {
    const result = await client.listModules({
      category: options.category,
      page,
      pageSize,
      q: sort === "newest" ? undefined : undefined,
    });

    spinner.stop();

    const modules = result.data;
    const total = result.total;

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      telemetry.capture(
        "cli.marketplace.list.success",
        { count: modules.length, json: true },
        Date.now() - startTime
      );
      await telemetry.flush();
      return;
    }

    if (modules.length === 0) {
      console.log(chalk.yellow("No modules found matching your criteria."));
      telemetry.capture(
        "cli.marketplace.list.success",
        { count: 0 },
        Date.now() - startTime
      );
      await telemetry.flush();
      return;
    }

    const table = new Table({
      head: [
        chalk.white.bold("Slug"),
        chalk.white.bold("Name"),
        chalk.white.bold("Version"),
        chalk.white.bold("Tier"),
        chalk.white.bold("Installs"),
      ],
      style: {
        head: [],
        border: ["gray"],
      },
    });

    // Sort modules client-side based on sort option
    const sorted = [...modules];
    if (sort === "popular") {
      sorted.sort((a, b) => b.installCount - a.installCount);
    } else if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    // newest = default server-side order

    for (const mod of sorted) {
      table.push([
        chalk.cyan(mod.slug),
        chalk.white(mod.name),
        chalk.green(mod.latestVersion),
        colorTier(mod.tier),
        chalk.gray(String(mod.installCount)),
      ]);
    }

    console.log(chalk.blue.bold("\nAvailable Marketplace Modules:\n"));
    console.log(table.toString());

    // Pagination footer
    const totalPages = Math.ceil(total / pageSize);
    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, total);
    console.log(
      chalk.gray(
        `\nShowing ${startItem}-${endItem} of ${total} modules (page ${page}/${totalPages})`
      )
    );
    console.log(
      chalk.gray(
        "Use 'kaven marketplace install <slug>' to install a module."
      )
    );

    telemetry.capture(
      "cli.marketplace.list.success",
      { count: modules.length, total },
      Date.now() - startTime
    );
    await telemetry.flush();
  } catch (error) {
    spinner.stop();

    if (error instanceof NetworkError) {
      console.error(
        chalk.red("Could not reach marketplace. Check your connection.")
      );
      telemetry.capture(
        "cli.marketplace.list.error",
        { error: "network_error" },
        Date.now() - startTime
      );
      await telemetry.flush();
      process.exit(1);
    }

    telemetry.capture(
      "cli.marketplace.list.error",
      { error: (error as Error).message },
      Date.now() - startTime
    );
    await telemetry.flush();

    console.error(chalk.red("Error fetching modules from Marketplace."));
    console.error(error);
    process.exit(1);
  }
}
