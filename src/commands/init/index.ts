import path from "node:path";
import fs from "fs-extra";
import { intro, outro, text, select, confirm, spinner, note, isCancel, cancel } from "@clack/prompts";
import pc from "picocolors";
import {
  ProjectInitializer,
  InitOptions,
  InitPromptAnswers,
} from "../../core/ProjectInitializer.js";
import { configManager } from "../../core/ConfigManager.js";
import { I18nService } from "../../core/I18nService.js";
import { runEnvironmentBootstrap } from "./aiox-bootstrap.js";

function handleCancel(value: unknown) {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }
}

export async function initProject(
  projectName: string | undefined,
  options: InitOptions
): Promise<void> {
  const i18n = await I18nService.getInstance();
  const initializer = new ProjectInitializer();
  
  intro(pc.cyan(i18n.t("init.intro")));

  // 1. Resolve Project Name
  let name = projectName;
  if (!name) {
    if (options.defaults) {
      name = "my-kaven-app";
    } else {
      name = await text({
        message: i18n.t("init.projectName"),
        placeholder: "my-kaven-app",
        validate: (value) => {
          const v = initializer.validateName(value || "");
          return v.valid ? undefined : v.reason;
        },
      }) as string;
      handleCancel(name);
    }
  }

  const targetDir = path.resolve(process.cwd(), name);

  // Check if directory already exists
  if ((await fs.pathExists(targetDir)) && !options.force) {
    cancel(pc.red(`Error: Directory "${name}" already exists. Use --force to overwrite.`));
    process.exit(1);
  }

  // 2. Prompt Answers
  let answers: InitPromptAnswers;
  if (options.defaults) {
    await configManager.initialize();
    const configDefaults = configManager.getAll().projectDefaults || {};
    answers = {
      dbUrl: options.dbUrl || configDefaults.dbUrl || `postgresql://user:password@localhost:5432/${name}`,
      emailProvider: options.emailProvider || configDefaults.emailProvider || "postmark",
      locale: options.locale || configDefaults.locale || "en-US",
      currency: options.currency || configDefaults.currency || "USD",
    };
  } else {
    await configManager.initialize();
    const configDefaults = configManager.getAll().projectDefaults || {};

    const dbUrl = await text({
      message: "Database URL (PostgreSQL):",
      initialValue: configDefaults.dbUrl || `postgresql://user:password@localhost:5432/${name}`,
    });
    handleCancel(dbUrl);

    const emailProvider = await select({
      message: "Email provider:",
      options: [
        { label: "Postmark", value: "postmark" },
        { label: "Resend", value: "resend" },
        { label: "AWS SES", value: "ses" },
        { label: "SMTP", value: "smtp" },
      ],
      initialValue: configDefaults.emailProvider || "postmark",
    }) as string;
    handleCancel(emailProvider);

    const locale = await text({
      message: "Default locale:",
      initialValue: configDefaults.locale || "en-US",
    });
    handleCancel(locale);

    const currency = await text({
      message: "Default currency:",
      initialValue: configDefaults.currency || "USD",
    });
    handleCancel(currency);

    const withSquad = await confirm({
      message: i18n.t("init.withSquad"),
      initialValue: true,
    });
    handleCancel(withSquad);
    options.withSquad = withSquad as boolean;

    answers = { dbUrl: dbUrl as string, emailProvider, locale: locale as string, currency: currency as string };
  }

  const s = spinner();

  // 3. Execution
  s.start("Cloning kaven-template...");
  try {
    await initializer.cloneTemplate(targetDir, options.template);
    s.stop(pc.green("Template cloned"));
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    s.stop(pc.red("Clone failed"));
    cancel(err.message);
    process.exit(1);
  }

  s.start("Configuring project...");
  await initializer.removeGitDir(targetDir);
  await initializer.replacePlaceholders(targetDir, { ...answers, projectName: name });
  s.stop(pc.green("Project configured"));

  if (!options.skipInstall) {
    s.start(i18n.t("init.installing"));
    try {
      await initializer.runInstall(targetDir);
      s.stop(pc.green("Dependencies installed"));
    } catch {
      s.stop(pc.yellow("pnpm install failed (skip)"));
    }
  }

  if (!options.skipGit) {
    s.start("Initializing git...");
    try {
      await initializer.initGit(targetDir);
      s.stop(pc.green("Git initialized"));
    } catch {
      s.stop(pc.yellow("Git init failed (skip)"));
    }
  }

  // 4. AI Squad
  if (options.withSquad) {
    s.start("Infecting AIOX intelligence...");
    const squadResult = await initializer.installSquad(targetDir);
    if (squadResult.installed) {
      await initializer.installAIOXCore(targetDir);
      s.stop(pc.green("Kaven Squad online 🤖"));
    } else {
      s.stop(pc.yellow("AIOX bootstrap skipped or failed"));
    }
  }

  // 5. Environment
  await runEnvironmentBootstrap(targetDir, { skipAiox: options.skipAiox });

  // 6. Summary
  note(
    `cd ${pc.cyan(name)}\ncp .env.example .env\nnpx prisma migrate dev\npnpm dev`,
    "Next Steps"
  );

  outro(pc.cyan(i18n.t("init.outro")));

  // Save defaults
  try {
    await configManager.set("projectDefaults", {
      dbUrl: answers.dbUrl,
      emailProvider: answers.emailProvider as unknown as "postmark" | "resend" | "ses" | "smtp",
      locale: answers.locale,
      currency: answers.currency,
    });
  } catch { /* ignore */ }
}
