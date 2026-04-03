import chalk from "chalk";
import ora from "ora";
import path from "node:path";
import {
  SchemaActivator,
  KAVEN_MODULES,
  type KavenModuleDef,
  type ModuleStatus,
} from "../../core/SchemaActivator";
import { TelemetryBuffer } from "../../infrastructure/TelemetryBuffer";

// ============================================================
// Helpers
// ============================================================

function findModuleDef(moduleId: string): KavenModuleDef | undefined {
  return KAVEN_MODULES.find((m) => m.id === moduleId.toLowerCase());
}

function assertSchemaExists(exists: boolean, root: string): void {
  if (!exists) {
    const fullPath = path.join(
      root,
      "packages",
      "database",
      "prisma",
      "schema.extended.prisma",
    );
    console.error(
      chalk.red(
        `\nErro: Schema não encontrado em: ${fullPath}`,
      ),
    );
    console.error(
      chalk.gray(
        "Certifique-se de que o caminho fornecido é a raiz de um projeto Kaven válido.",
      ),
    );
    process.exit(1);
  }
}

// ============================================================
// kaven module activate <name>
// ============================================================

export async function moduleActivate(
  moduleName: string,
  projectRoot?: string,
): Promise<void> {
  const telemetry = TelemetryBuffer.getInstance();
  const startTime = Date.now();
  telemetry.capture("cli.module.activate.start", { moduleName });

  const root = projectRoot ?? process.cwd();
  const activator = new SchemaActivator(root);
  const spinner = ora(`Ativando módulo ${moduleName}...`).start();

  try {
    // 1. Validar que o schema existe
    const exists = await activator.exists();
    spinner.stop();
    assertSchemaExists(exists, root);

    // 2. Validar que o módulo é conhecido
    const def = findModuleDef(moduleName);
    if (!def) {
      console.error(
        chalk.red(`\nMódulo desconhecido: "${moduleName}".`),
      );
      console.error(
        chalk.gray(
          `Módulos disponíveis: ${KAVEN_MODULES.map((m) => m.id).join(", ")}`,
        ),
      );
      process.exit(1);
    }

    // 3. Verificar dependências
    if (def.dependsOn.length > 0) {
      spinner.start("Verificando dependências...");
      const depStatuses: ModuleStatus[] = [];

      for (const depId of def.dependsOn) {
        const depDef = findModuleDef(depId);
        if (!depDef) continue;
        const status = await activator.getModuleStatus(depDef);
        depStatuses.push(status);
      }

      const missing = depStatuses.filter((s) => !s.active);
      if (missing.length > 0) {
        spinner.stop();
        console.error(
          chalk.red(
            `\nDependências inativas para "${moduleName}": ${missing.map((m) => m.id).join(", ")}`,
          ),
        );
        console.error(
          chalk.gray(
            `Ative as dependências primeiro:\n${missing.map((m) => `  kaven module activate ${m.id}`).join("\n")}`,
          ),
        );
        process.exit(1);
      }
      spinner.stop();
    }

    // 4. Verificar se já está ativo
    const current = await activator.getModuleStatus(def);
    if (current.active) {
      console.log(
        chalk.yellow(`\nMódulo "${def.label}" já está ativo.`),
      );
      return;
    }

    // 5. Ativar
    spinner.start(`Descomentando modelos de ${def.label} no schema...`);
    await activator.activateModule(def);
    spinner.succeed(
      chalk.green(
        `\nMódulo ${def.label} ativado. ${def.models.length} models adicionados: ${def.models.join(", ")}`,
      ),
    );

    console.log(
      chalk.cyan(
        "\nSugestão: Execute `pnpm db:generate && pnpm db:migrate` para aplicar as mudanças.",
      ),
    );

    telemetry.capture(
      "cli.module.activate.success",
      { moduleName: def.id, models: def.models.length },
      Date.now() - startTime,
    );
    await telemetry.flush();
  } catch (error) {
    spinner.fail(
      chalk.red(
        `Falha ao ativar módulo: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    telemetry.capture(
      "cli.module.activate.error",
      { moduleName, error: (error as Error).message },
      Date.now() - startTime,
    );
    await telemetry.flush();
    process.exit(1);
  }
}

// ============================================================
// kaven module deactivate <name>
// ============================================================

export async function moduleDeactivate(
  moduleName: string,
  projectRoot?: string,
): Promise<void> {
  const telemetry = TelemetryBuffer.getInstance();
  const startTime = Date.now();
  telemetry.capture("cli.module.deactivate.start", { moduleName });

  const root = projectRoot ?? process.cwd();
  const activator = new SchemaActivator(root);
  const spinner = ora(`Desativando módulo ${moduleName}...`).start();

  try {
    // 1. Validar que o schema existe
    const exists = await activator.exists();
    spinner.stop();
    assertSchemaExists(exists, root);

    // 2. Validar módulo
    const def = findModuleDef(moduleName);
    if (!def) {
      console.error(
        chalk.red(`\nMódulo desconhecido: "${moduleName}".`),
      );
      console.error(
        chalk.gray(
          `Módulos disponíveis: ${KAVEN_MODULES.map((m) => m.id).join(", ")}`,
        ),
      );
      process.exit(1);
    }

    // 3. Verificar se outros módulos ativos dependem deste
    spinner.start("Verificando dependências reversas...");
    const dependents: string[] = [];

    for (const candidate of KAVEN_MODULES) {
      if (candidate.id === def.id) continue;
      if (!candidate.dependsOn.includes(def.id)) continue;

      const status = await activator.getModuleStatus(candidate);
      if (status.active) {
        dependents.push(candidate.id);
      }
    }

    if (dependents.length > 0) {
      spinner.stop();
      console.error(
        chalk.red(
          `\nNão é possível desativar "${moduleName}": os seguintes módulos dependem dele e estão ativos:`,
        ),
      );
      console.error(chalk.gray(`  ${dependents.join(", ")}`));
      console.error(
        chalk.gray(
          `Desative-os primeiro:\n${dependents.map((d) => `  kaven module deactivate ${d}`).join("\n")}`,
        ),
      );
      process.exit(1);
    }

    // 4. Verificar se já está inativo
    const current = await activator.getModuleStatus(def);
    if (!current.active) {
      spinner.stop();
      console.log(
        chalk.yellow(`\nMódulo "${def.label}" já está inativo.`),
      );
      return;
    }

    // 5. Desativar
    spinner.start(`Comentando modelos de ${def.label} no schema...`);
    await activator.deactivateModule(def);
    spinner.succeed(
      chalk.green(`\nMódulo ${def.label} desativado com sucesso.`),
    );

    console.log(
      chalk.cyan(
        "\nSugestão: Execute `pnpm db:generate && pnpm db:migrate` para aplicar as mudanças.",
      ),
    );

    telemetry.capture(
      "cli.module.deactivate.success",
      { moduleName: def.id },
      Date.now() - startTime,
    );
    await telemetry.flush();
  } catch (error) {
    spinner.fail(
      chalk.red(
        `Falha ao desativar módulo: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    telemetry.capture(
      "cli.module.deactivate.error",
      { moduleName, error: (error as Error).message },
      Date.now() - startTime,
    );
    await telemetry.flush();
    process.exit(1);
  }
}

// ============================================================
// kaven module list
// ============================================================

export async function moduleListActivation(
  projectRoot?: string,
): Promise<void> {
  const root = projectRoot ?? process.cwd();
  const activator = new SchemaActivator(root);

  const schemaExists = await activator.exists();

  // Cabeçalho da tabela
  const COL = {
    module: 14,
    status: 10,
    models: 44,
    deps: 20,
  };

  const header =
    chalk.bold("Module".padEnd(COL.module)) +
    chalk.bold("Status".padEnd(COL.status)) +
    chalk.bold("Models".padEnd(COL.models)) +
    chalk.bold("Depends on");

  const divider = "─".repeat(COL.module + COL.status + COL.models + COL.deps);

  console.log();
  console.log(chalk.blue("Módulos Kaven disponíveis\n"));
  console.log(header);
  console.log(chalk.gray(divider));

  if (!schemaExists) {
    for (const def of KAVEN_MODULES) {
      const modCol = def.id.padEnd(COL.module);
      const statusCol = chalk.gray("unknown".padEnd(COL.status));
      const modelsCol = def.models.join(", ").padEnd(COL.models);
      const depsCol =
        def.dependsOn.length > 0 ? def.dependsOn.join(", ") : "—";
      console.log(`${modCol}${statusCol}${modelsCol}${depsCol}`);
    }

    console.log();
    console.log(
      chalk.yellow(
        "Atenção: schema.extended.prisma não encontrado. Status não pode ser determinado.",
      ),
    );
    console.log(
      chalk.gray(
        "Execute este comando na raiz de um projeto Kaven para ver o status real.",
      ),
    );
    return;
  }

  for (const def of KAVEN_MODULES) {
    const status = await activator.getModuleStatus(def);

    const modCol = def.id.padEnd(COL.module);
    const statusText = status.active ? "active" : "inactive";
    const statusColored = status.active
      ? chalk.green(statusText.padEnd(COL.status))
      : chalk.gray(statusText.padEnd(COL.status));
    const modelsCol = def.models.join(", ").padEnd(COL.models);
    const depsCol =
      def.dependsOn.length > 0 ? def.dependsOn.join(", ") : "—";

    console.log(`${modCol}${statusColored}${modelsCol}${depsCol}`);
  }

  console.log();
  console.log(
    chalk.gray(
      "Core (sempre ativo): Tenant, User, Role, Capability, AuthSession, AuditLog",
    ),
  );
  console.log();
  console.log(
    chalk.gray(
      "Para ativar: kaven module activate <name>  |  Para desativar: kaven module deactivate <name>",
    ),
  );
}
