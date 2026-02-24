import chalk from "chalk";
import ora from "ora";
import path from "path";
import fs from "fs-extra";
import {
  ProjectInitializer,
  InitOptions,
  InitPromptAnswers,
} from "../../core/ProjectInitializer";
import { configManager } from "../../core/ConfigManager";

async function promptAnswers(projectName: string): Promise<InitPromptAnswers> {
  // Dynamic import to keep startup fast and avoid issues if not installed
  const { input, select } = await import("@inquirer/prompts");

  // Load defaults from config if available
  await configManager.initialize();
  const existingDefaults = configManager.getAll().projectDefaults || {};

  const dbUrl = await input({
    message: "Database URL (PostgreSQL):",
    default:
      existingDefaults.dbUrl ||
      `postgresql://user:password@localhost:5432/${projectName}`,
  });

  const emailProvider = await select<string>({
    message: "Email provider:",
    choices: [
      { name: "Postmark", value: "postmark" },
      { name: "Resend", value: "resend" },
      { name: "AWS SES", value: "ses" },
      { name: "SMTP", value: "smtp" },
    ],
    default: existingDefaults.emailProvider || "postmark",
  });

  const locale = await input({
    message: "Default locale:",
    default: existingDefaults.locale || "en-US",
  });

  const currency = await input({
    message: "Default currency:",
    default: existingDefaults.currency || "USD",
  });

  return { dbUrl, emailProvider, locale, currency };
}

export async function initProject(
  projectName: string | undefined,
  options: InitOptions
): Promise<void> {
  const initializer = new ProjectInitializer();

  // Determine project name interactively if not provided
  let resolvedName: string = projectName ?? "";
  if (!resolvedName) {
    if (options.defaults) {
      resolvedName = "my-kaven-app";
    } else {
      const { input } = await import("@inquirer/prompts");
      resolvedName = await input({
        message: "Project name:",
        default: "my-kaven-app",
      });
    }
  }

  // Validate name
  const validation = initializer.validateName(resolvedName);
  if (!validation.valid) {
    console.error(chalk.red(`Error: ${validation.reason}`));
    console.error(
      chalk.gray("Try: kaven init my-project-name (use lowercase letters and hyphens)")
    );
    process.exit(1);
  }

  const name = resolvedName;
  const targetDir = path.resolve(process.cwd(), name);

  // Check if directory already exists
  if ((await fs.pathExists(targetDir)) && !options.force) {
    console.error(
      chalk.red(
        `Error: Directory "${name}" already exists. Use --force to overwrite.`
      )
    );
    process.exit(1);
  }

  // Get prompt answers or use defaults
  let answers: InitPromptAnswers;
  if (options.defaults) {
    // Try to load from config, then fallback to options
    await configManager.initialize();
    const configDefaults = configManager.getAll().projectDefaults || {};
    answers = {
      dbUrl:
        options.dbUrl ||
        configDefaults.dbUrl ||
        `postgresql://user:password@localhost:5432/${name}`,
      emailProvider: options.emailProvider || configDefaults.emailProvider || "postmark",
      locale: options.locale || configDefaults.locale || "en-US",
      currency: options.currency || configDefaults.currency || "USD",
    };
  } else {
    answers = await promptAnswers(name);
  }

  console.log();

  // Clone template
  const cloneSpinner = ora("Cloning kaven-template...").start();
  try {
    await initializer.cloneTemplate(targetDir);
    cloneSpinner.succeed("Template cloned successfully");
  } catch (error) {
    cloneSpinner.fail("Failed to clone template");
    console.error(
      chalk.red(
        error instanceof Error ? error.message : String(error)
      )
    );
    console.error(
      chalk.gray("Try: ensure git is installed and you have internet access")
    );
    process.exit(1);
  }

  // Remove .git directory
  const gitRemoveSpinner = ora("Removing .git directory...").start();
  await initializer.removeGitDir(targetDir);
  gitRemoveSpinner.succeed(".git directory removed");

  // Replace placeholders
  const placeholderSpinner = ora("Configuring project files...").start();
  await initializer.replacePlaceholders(targetDir, {
    ...answers,
    projectName: name,
  });
  placeholderSpinner.succeed("Project files configured");

  // Run pnpm install
  if (!options.skipInstall) {
    const installSpinner = ora("Installing dependencies (pnpm install)...").start();
    try {
      await initializer.runInstall(targetDir);
      installSpinner.succeed("Dependencies installed");
    } catch (error) {
      installSpinner.warn("Dependency installation failed — run pnpm install manually");
      console.error(
        chalk.gray(error instanceof Error ? error.message : String(error))
      );
    }
  }

  // Init git
  if (!options.skipGit) {
    const gitSpinner = ora("Initializing git repository...").start();
    try {
      await initializer.initGit(targetDir);
      gitSpinner.succeed("Git repository initialized");
    } catch (error) {
      gitSpinner.warn("Git init failed — initialize manually");
      console.error(
        chalk.gray(error instanceof Error ? error.message : String(error))
      );
    }
  }

  // Health check
  const healthCheckSpinner = ora("Running health check...").start();
  const health = await initializer.healthCheck(targetDir);
  if (health.healthy) {
    healthCheckSpinner.succeed("Health check passed");
  } else {
    healthCheckSpinner.warn("Health check found issues:");
    for (const issue of health.issues) {
      console.log(chalk.yellow(`  ⚠ ${issue}`));
    }
  }

  // Success message
  console.log();
  console.log(chalk.green("✅ Project created successfully!"));
  console.log();
  console.log(chalk.bold("Next steps:"));
  console.log(chalk.cyan(`  cd ${name}`));
  console.log(chalk.cyan("  cp .env.example .env"));
  console.log(chalk.cyan("  npx prisma migrate dev"));
  console.log(chalk.cyan("  pnpm dev"));
  console.log();
  console.log(
    chalk.gray(
      "For more help, visit: https://docs.kaven.sh/getting-started"
    )
  );

  // Save project defaults to config for future use
  await configManager.initialize();
  try {
    await configManager.set("projectDefaults", {
      dbUrl: answers.dbUrl,
      emailProvider: answers.emailProvider,
      locale: answers.locale,
      currency: answers.currency,
    });
  } catch {
    // Non-critical, continue if config save fails
  }
}
