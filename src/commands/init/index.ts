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
import { InitStateManager, type InitStep } from "../../core/InitStateManager.js";

function handleCancel(value: unknown) {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }
}

/** Execute a single init step, recording state before and after. */
async function runStep(
  stateManager: InitStateManager,
  step: InitStep,
  label: string,
  fn: () => Promise<void>,
  options: { fatal?: boolean } = {}
): Promise<boolean> {
  const s = spinner();
  s.start(label);
  try {
    await fn();
    await stateManager.markStep(step, "done");
    s.stop(pc.green(`${label} ✓`));
    return true;
  } catch (error: unknown) {
    await stateManager.markStep(step, "failed");
    const msg = error instanceof Error ? error.message : String(error);
    s.stop(pc.red(`${label} ✗`));
    if (options.fatal) {
      cancel(msg);
      process.exit(1);
    }
    console.log(pc.dim(`  Error: ${msg}`));
    return false;
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

  console.log(getBrandingBanner());
  intro(pc.cyan(i18n.t("init.intro")));

  // 2. Resolve Project Name
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

  // 3. Detect incomplete previous init — offer to resume
  const existingState = await InitStateManager.findIncomplete(targetDir);
  if (existingState && !options.force) {
    const resumePoint = existingState.getResumePoint();

    // --resume flag skips the confirmation prompt
    const shouldResume = options.resume
      ? true
      : await confirm({
          message: pc.yellow(
            `⚠  Incomplete init detected (stopped at: ${pc.bold(resumePoint ?? "unknown")}). Resume from here?`
          ),
          initialValue: true,
        });

    if (!options.resume) handleCancel(shouldResume);

    if (shouldResume) {
      await resumeInit(targetDir, existingState, initializer);
      return;
    }
    // User chose not to resume — fall through to fresh init (--force equivalent)
    options.force = true;
  } else if ((await fs.pathExists(targetDir)) && !options.force) {
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

  // 5. Initialize state tracker
  const stateManager = new InitStateManager(targetDir);
  await stateManager.create(name, { ...answers, projectName: name }, {
    withSquad: options.withSquad,
    skipInstall: options.skipInstall,
    skipGit: options.skipGit,
    skipAiox: options.skipAiox,
    template: options.template,
  });

  await executeInitSteps(targetDir, name, answers, stateManager, initializer, options);
}

/** Run all steps from the beginning (fresh init). */
async function executeInitSteps(
  targetDir: string,
  name: string,
  answers: InitPromptAnswers,
  stateManager: InitStateManager,
  initializer: ProjectInitializer,
  options: InitOptions
): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Step: clone
  await runStep(stateManager, "clone", "Cloning kaven-template...", async () => {
    await initializer.cloneTemplate(targetDir, options.template);
  }, { fatal: true });

  // Step: configure
  await runStep(stateManager, "configure", "Configuring project...", async () => {
    await initializer.removeGitDir(targetDir);
    await initializer.replacePlaceholders(targetDir, { ...answers, projectName: name });

    const claudePath = path.join(targetDir, ".claude", "CLAUDE.md");
    await fs.ensureDir(path.dirname(claudePath));
    const templatePath = path.resolve(__dirname, "../../core/templates/CLAUDE.md.hbs");
    if (await fs.pathExists(templatePath)) {
      const content = await fs.readFile(templatePath, "utf-8");
      await fs.writeFile(
        claudePath,
        content.replace("${new Date().toLocaleDateString()}", new Date().toLocaleDateString()),
        "utf-8"
      );
    }
  }, { fatal: true });

  // Step: install
  if (!options.skipInstall) {
    await runStep(stateManager, "install", i18n_installing(), async () => {
      await initializer.runInstall(targetDir);
    });
  } else {
    await stateManager.markStep("install", "skipped");
  }

  // Step: git
  if (!options.skipGit) {
    await runStep(stateManager, "git", "Initializing git...", async () => {
      await initializer.initGit(targetDir);
    });
  } else {
    await stateManager.markStep("git", "skipped");
  }

  // Step: squad + aiox-core
  if (options.withSquad) {
    const squadOk = await runStep(stateManager, "squad", "Installing kaven-squad...", async () => {
      const result = await initializer.installSquad(targetDir);
      if (!result.installed) throw new Error(result.reason ?? "squad install failed");
    });

    if (squadOk) {
      await runStep(stateManager, "aiox-core", "Installing AIOX Core...", async () => {
        const result = await initializer.installAIOXCore(targetDir);
        if (!result.installed) throw new Error(result.reason ?? "aiox-core install failed");
      });
    } else {
      await stateManager.markStep("aiox-core", "skipped");
      console.log(pc.dim(`  To retry: cd ${name} && kaven init --resume`));
    }
  } else {
    await stateManager.markStep("squad", "skipped");
    await stateManager.markStep("aiox-core", "skipped");
  }

  // Step: env-bootstrap
  if (!options.skipAiox) {
    await runStep(stateManager, "env-bootstrap", "Bootstrapping AIOX environment...", async () => {
      await runEnvironmentBootstrap(targetDir, { skipAiox: false });
    });
  } else {
    await stateManager.markStep("env-bootstrap", "skipped");
  }

  await finishInit(name, stateManager);
}

/** Resume from the last failed/pending step using saved state. */
async function resumeInit(
  targetDir: string,
  stateManager: InitStateManager,
  initializer: ProjectInitializer
): Promise<void> {
  const state = stateManager.getState();
  const { answers, options, projectName: name } = state;

  console.log(pc.cyan(`\nResuming init for ${pc.bold(name)}...\n`));

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const shouldRun = (step: InitStep) => {
    const status = state.steps[step];
    return status === "pending" || status === "failed";
  };

  if (shouldRun("clone")) {
    await runStep(stateManager, "clone", "Cloning kaven-template...", async () => {
      await initializer.cloneTemplate(targetDir, options.template);
    }, { fatal: true });
  }

  if (shouldRun("configure")) {
    await runStep(stateManager, "configure", "Configuring project...", async () => {
      await initializer.removeGitDir(targetDir);
      await initializer.replacePlaceholders(targetDir, answers);
      const claudePath = path.join(targetDir, ".claude", "CLAUDE.md");
      await fs.ensureDir(path.dirname(claudePath));
      const templatePath = path.resolve(__dirname, "../../core/templates/CLAUDE.md.hbs");
      if (await fs.pathExists(templatePath)) {
        const content = await fs.readFile(templatePath, "utf-8");
        await fs.writeFile(
          claudePath,
          content.replace("${new Date().toLocaleDateString()}", new Date().toLocaleDateString()),
          "utf-8"
        );
      }
    }, { fatal: true });
  }

  if (shouldRun("install")) {
    await runStep(stateManager, "install", "Installing dependencies...", async () => {
      await initializer.runInstall(targetDir);
    });
  }

  if (shouldRun("git")) {
    await runStep(stateManager, "git", "Initializing git...", async () => {
      await initializer.initGit(targetDir);
    });
  }

  if (shouldRun("squad")) {
    const squadOk = await runStep(stateManager, "squad", "Installing kaven-squad...", async () => {
      const result = await initializer.installSquad(targetDir);
      if (!result.installed) throw new Error(result.reason ?? "squad install failed");
    });

    if (squadOk && shouldRun("aiox-core")) {
      await runStep(stateManager, "aiox-core", "Installing AIOX Core...", async () => {
        const result = await initializer.installAIOXCore(targetDir);
        if (!result.installed) throw new Error(result.reason ?? "aiox-core install failed");
      });
    }
  } else if (shouldRun("aiox-core")) {
    await runStep(stateManager, "aiox-core", "Installing AIOX Core...", async () => {
      const result = await initializer.installAIOXCore(targetDir);
      if (!result.installed) throw new Error(result.reason ?? "aiox-core install failed");
    });
  }

  if (shouldRun("env-bootstrap")) {
    await runStep(stateManager, "env-bootstrap", "Bootstrapping AIOX environment...", async () => {
      await runEnvironmentBootstrap(targetDir, { skipAiox: false });
    });
  }

  await finishInit(name, stateManager);
}

function i18n_installing(): string {
  return "Installing dependencies...";
}

async function finishInit(name: string, stateManager: InitStateManager): Promise<void> {
  if (stateManager.isComplete()) {
    await stateManager.cleanup();
  } else {
    const resumePoint = stateManager.getResumePoint();
    console.log(pc.yellow(`\n  ⚠  Setup incomplete (stopped at: ${pc.bold(resumePoint ?? "unknown")})`));
    console.log(pc.dim(`  Resume with: kaven init ${name} --resume\n`));
  }

  note(
    `cd ${pc.cyan(name)}\ncp .env.example .env\npnpm docker:up\npnpm db:migrate && pnpm db:seed\npnpm dev`,
    "Next Steps"
  );

  outro(pc.cyan("Project ready. Happy building 🚀"));

  try {
    await configManager.initialize();
    const s = stateManager.getState();
    await configManager.set("projectDefaults", {
      dbUrl: s.answers.dbUrl,
      emailProvider: s.answers.emailProvider as "postmark" | "resend" | "ses" | "smtp",
      locale: s.answers.locale,
      currency: s.answers.currency,
    }, "global");
  } catch {
    // non-fatal
  }
}
