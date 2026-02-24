import chalk from "chalk";
import { configManager, type KavenConfig } from "../../core/ConfigManager";

export interface ConfigOptions {
  json?: boolean;
}

/**
 * C2.4: Config set — Persist value to ~/.kaven/config.json
 */
export async function configSet(key: string, value: string): Promise<void> {
  if (!key || !value) {
    console.error(chalk.red("Error: Both key and value are required"));
    console.error(chalk.gray("Usage: kaven config set KEY VALUE"));
    process.exit(1);
  }

  await configManager.initialize();

  try {
    await configManager.set(key as keyof KavenConfig, value);
    console.log(chalk.green(`✅ Set ${chalk.bold(key)} = ${chalk.bold(value)}`));
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * C2.4: Config get — Read with defaults
 */
export async function configGet(key: string, options: ConfigOptions): Promise<void> {
  if (!key) {
    console.error(chalk.red("Error: Key is required"));
    console.error(chalk.gray("Usage: kaven config get KEY"));
    process.exit(1);
  }

  await configManager.initialize();

  try {
    const value = configManager.get(key as keyof KavenConfig);

    if (options.json) {
      console.log(JSON.stringify({ [key]: value }, null, 2));
    } else {
      console.log(value);
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * C2.4: Config view — Show all configuration
 */
export async function configView(options: ConfigOptions): Promise<void> {
  await configManager.initialize();

  const config = configManager.getAll();

  if (options.json) {
    console.log(JSON.stringify(config, null, 2));
  } else {
    console.log(chalk.bold("Kaven Configuration:"));
    console.log(chalk.gray(`Location: ${configManager.getConfigDir()}/config.json`));
    console.log();

    const entries = Object.entries(config);
    const maxKeyLen = Math.max(...entries.map(([k]) => k.length));

    for (const [key, value] of entries) {
      const padding = " ".repeat(maxKeyLen - key.length);
      const displayValue =
        typeof value === "object"
          ? JSON.stringify(value, null, 2).replace(/\n/g, "\n" + " ".repeat(maxKeyLen + 3))
          : value;
      console.log(`  ${key}${padding}  ${chalk.cyan(displayValue)}`);
    }
  }
}

/**
 * C2.4: Config reset — Reset to defaults
 */
export async function configReset(): Promise<void> {
  const { confirm } = await import("@inquirer/prompts");

  const confirmed = await confirm({
    message: "Are you sure you want to reset config to defaults?",
    default: false,
  });

  if (!confirmed) {
    console.log(chalk.yellow("Cancelled."));
    return;
  }

  await configManager.initialize();
  await configManager.reset();
  console.log(chalk.green("✅ Config reset to defaults"));
}
