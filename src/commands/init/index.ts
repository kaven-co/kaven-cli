import chalk from "chalk";
import ora from "ora";
import path from "path";
import fs from "fs-extra";
import {
  ProjectInitializer,
  InitOptions,
  InitPromptAnswers,
} from "../../core/ProjectInitializer";

async function promptAnswers(): Promise<InitPromptAnswers> {
  // Dynamic import to keep startup fast and avoid issues if not installed
  const { input, select } = await import("@inquirer/prompts");

  const dbUrl = await input({
    message: "Database URL (PostgreSQL):",
    default: "postgresql://user:password@localhost:5432/myapp",
  });

  const emailProvider = await select<string>({
    message: "Email provider:",
    choices: [
      { name: "Postmark", value: "postmark" },
      { name: "Resend", value: "resend" },
      { name: "AWS SES", value: "ses" },
      { name: "SMTP", value: "smtp" },
    ],
  });

  const locale = await input({
    message: "Default locale:",
    default: "en-US",
  });

  const currency = await input({
    message: "Default currency:",
    default: "USD",
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
    answers = {
      dbUrl:
        options.dbUrl || "postgresql://user:password@localhost:5432/" + name,
      emailProvider: options.emailProvider || "postmark",
      locale: options.locale || "en-US",
      currency: options.currency || "USD",
    };
  } else {
    answers = await promptAnswers();
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
}
