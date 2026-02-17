import chalk from "chalk";
import { AuthService } from "../../core/AuthService";
import { TelemetryBuffer } from "../../infrastructure/TelemetryBuffer";

export async function authWhoami(): Promise<void> {
  const telemetry = TelemetryBuffer.getInstance();
  telemetry.capture("cli.auth.whoami.start");

  const authService = new AuthService();

  try {
    const info = await authService.getWhoamiInfo();

    if (!info) {
      console.log(chalk.yellow("You are not authenticated."));
      console.log(chalk.gray("Use 'kaven auth login' to sign in."));
      telemetry.capture("cli.auth.whoami.not_authenticated");
      await telemetry.flush();
      return;
    }

    telemetry.capture("cli.auth.whoami.authenticated");
    console.log();
    console.log(`  ${chalk.bold("Email:")}    ${info.email}`);
    console.log(`  ${chalk.bold("GitHub:")}   ${info.githubId}`);
    console.log(`  ${chalk.bold("Tier:")}     ${info.tier}`);
    console.log(`  ${chalk.bold("Session:")}  ${info.sessionExpiry}`);
    console.log();
  } catch {
    console.error(chalk.red("Error checking authentication status."));
    process.exit(1);
  }

  await telemetry.flush();
}
