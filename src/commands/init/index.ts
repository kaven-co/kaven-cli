import path from "node:path";
import fs from "fs-extra";
import { fileURLToPath } from "node:url";
import { intro, outro, text, select, confirm, spinner, note, isCancel, cancel } from "@clack/prompts";
import pc from "picocolors";
import {
  ProjectInitializer,
  InitOptions,
  InitPromptAnswers,
} from "../../core/ProjectInitializer.js";
import { configManager } from "../../core/ConfigManager.js";
import { I18nService, type Language } from "../../core/I18nService.js";
import { getBrandingBanner } from "../../core/Branding.js";
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
  
  // 1. Language First (P0) — Just like AIOX Wizard
  const selectedLang = await select({
    message: "🌐 Select Language / Selecione o Idioma:",
    options: [
      { label: "English", value: "en" },
      { label: "Português (Brasil)", value: "pt-BR" },
    ],
    initialValue: "en",
  }) as Language;
  handleCancel(selectedLang);
  
  await i18n.setLanguage(selectedLang);
  await configManager.initialize();
  await configManager.set("language", selectedLang, "global");

  // 2. Welcome Banner with chosen language
  console.log(getBrandingBanner());
  intro(pc.cyan(i18n.t("init.intro")));

  // 3. Resolve Project Name
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

  // 4. Prompt Answers
  let answers: InitPromptAnswers;
  if (options.defaults) {
    const configDefaults = configManager.getAll().projectDefaults || {};
    answers = {
      dbUrl: options.dbUrl || configDefaults.dbUrl || `postgresql://user:password@localhost:5432/${name}`,
      emailProvider: options.emailProvider || configDefaults.emailProvider || "postmark",
      locale: options.locale || configDefaults.locale || "en-US",
      currency: options.currency || configDefaults.currency || "USD",
    };
  } else {
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

  // 5. Execution
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

  // 5.1 Inject Kaven Authority Rules (CLAUDE.md)
  try {
    const claudePath = path.join(targetDir, ".claude", "CLAUDE.md");
    await fs.ensureDir(path.dirname(claudePath));
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const templatePath = path.resolve(__dirname, "../../core/templates/CLAUDE.md.hbs");

    if (await fs.pathExists(templatePath)) {
      const templateContent = await fs.readFile(templatePath, "utf-8");
      const finalContent = templateContent.replace(
        "${new Date().toLocaleDateString()}",
        new Date().toLocaleDateString()
      );
      await fs.writeFile(claudePath, finalContent, "utf-8");
    }
  } catch { /* ignore */ }

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

  // 6. AI Squad
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

  // 7. Environment
  await runEnvironmentBootstrap(targetDir, { skipAiox: options.skipAiox });

  // 8. Summary
  note(
    `cd ${pc.cyan(name)}\ncp .env.example .env\nnpx prisma migrate dev\npnpm dev`,
    "Next Steps"
  );

  outro(pc.cyan(i18n.t("init.outro")));

  // Save defaults to Global Config
  try {
    await configManager.set("projectDefaults", {
      dbUrl: answers.dbUrl,
      emailProvider: answers.emailProvider as unknown as "postmark" | "resend" | "ses" | "smtp",
      locale: answers.locale,
      currency: answers.currency,
    }, "global");
  } catch { /* ignore */ }
}
