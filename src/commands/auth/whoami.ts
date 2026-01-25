import chalk from "chalk";
import { AuthService } from "../../core/AuthService";
import { TelemetryBuffer } from "../../infrastructure/TelemetryBuffer";

export async function authWhoami(): Promise<void> {
  const telemetry = TelemetryBuffer.getInstance();
  telemetry.capture("cli.auth.whoami.start");

  const authService = new AuthService();

  try {
    const userInfo = await authService.getUserInfo();

    if (!userInfo) {
      console.log(chalk.yellow("Você não está autenticado."));
      console.log(chalk.gray("Use 'kaven auth login' para entrar."));
      telemetry.capture("cli.auth.whoami.not_authenticated");
      await telemetry.flush();
      return;
    }

    telemetry.capture("cli.auth.whoami.authenticated");
    console.log(chalk.blue("👤 Usuário logado:"));
    console.log(`${chalk.bold("ID:")}    ${userInfo.id}`);
    console.log(`${chalk.bold("E-mail:")} ${userInfo.email}`);
    if (userInfo.name) {
      console.log(`${chalk.bold("Nome:")}   ${userInfo.name}`);
    }
  } catch {
    console.error(chalk.red("Erro ao verificar status de autenticação."));
    process.exit(1);
  }
}
