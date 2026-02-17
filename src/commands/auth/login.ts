import chalk from "chalk";
import ora, { Ora } from "ora";
import open from "open";
import { AuthService } from "../../core/AuthService";
import { MarketplaceClient } from "../../infrastructure/MarketplaceClient";
import { TelemetryBuffer } from "../../infrastructure/TelemetryBuffer";
import { AuthTokens } from "../../types/auth";

/**
 * Sleep helper for polling delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll for access token with exponential backoff
 */
async function pollForToken(
  client: MarketplaceClient,
  deviceCode: string,
  expiresIn: number,
  initialInterval: number,
  spinner: Ora
): Promise<AuthTokens> {
  const deadline = Date.now() + expiresIn * 1000;
  const backoffIntervals = [5, 10, 15, 20]; // seconds - exponential backoff
  let backoffIndex = 0;
  let interval = initialInterval;

  while (Date.now() < deadline) {
    // Update countdown spinner
    const remaining = Math.ceil((deadline - Date.now()) / 1000);
    const mm = Math.floor(remaining / 60);
    const ss = String(remaining % 60).padStart(2, '0');
    spinner.text = `Waiting for authorization... (expires in ${mm}:${ss})`;

    // Wait for next poll
    await sleep(interval * 1000);

    try {
      const result = await client.pollDeviceToken(deviceCode);

      // Success - return tokens
      if (result.status === 'success' && result.tokens) {
        return result.tokens;
      }

      // Handle different status codes
      switch (result.status) {
        case 'slow_down':
          // Increase interval by 5s as requested by server
          interval += 5;
          break;

        case 'access_denied':
          throw new Error('Authorization denied by user. Try again with \'kaven auth login\'.');

        case 'expired_token':
          throw new Error('Device code expired. Run \'kaven auth login\' again.');

        case 'authorization_pending':
          // Continue polling - apply exponential backoff
          if (backoffIndex < backoffIntervals.length - 1) {
            backoffIndex++;
            interval = backoffIntervals[backoffIndex];
          }
          break;
      }
    } catch (error) {
      // Re-throw our custom errors
      if ((error as Error).message.includes('denied') ||
          (error as Error).message.includes('expired')) {
        throw error;
      }

      // Network errors
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ECONNREFUSED' || nodeError.code === 'ENOTFOUND') {
        throw new Error('Network error. Check your connection and try again.');
      }

      // Unknown error
      throw error;
    }
  }

  // Timeout - device code expired
  throw new Error('Device code expired. Run \'kaven auth login\' again.');
}

/**
 * Main login command - OAuth 2.0 Device Authorization Grant (RFC 8628)
 */
export async function authLogin(): Promise<void> {
  const telemetry = TelemetryBuffer.getInstance();
  const startTime = Date.now();
  telemetry.capture("cli.auth.login.start");

  const client = new MarketplaceClient();
  const authService = new AuthService();

  console.log(chalk.blue("🔐 Starting authentication flow...\n"));

  const spinner = ora("Requesting device code from marketplace...").start();

  try {
    // Step 1: Request device code
    const { device_code, user_code, verification_uri, expires_in, interval } =
      await client.requestDeviceCode();

    spinner.stop();

    // Step 2: Display code and open browser
    console.log(chalk.yellow("To complete login, follow these steps:\n"));
    console.log(chalk.bold(`  Your verification code: ${chalk.cyan(user_code)}\n`));

    try {
      await open(verification_uri);
      console.log(chalk.dim("  ✓ Browser opened automatically"));
    } catch {
      console.log(chalk.yellow(`  Open this URL in your browser:`));
      console.log(chalk.underline(`  ${verification_uri}\n`));
    }

    // Step 3: Poll for token with exponential backoff
    const pollSpinner = ora('Waiting for authorization...').start();
    const tokens = await pollForToken(client, device_code, expires_in, interval, pollSpinner);

    // Step 4: Store tokens securely
    await authService.saveTokens(tokens);

    pollSpinner.succeed(chalk.green(`Logged in as ${chalk.bold(tokens.user.email)}`));
    console.log(chalk.dim(`  Tier: ${tokens.user.tier}`));
    console.log(chalk.gray("\n  Your credentials were saved securely in ~/.kaven/auth.json\n"));

    telemetry.capture("cli.auth.login.success", { tier: tokens.user.tier }, Date.now() - startTime);
    await telemetry.flush();
  } catch (error) {
    telemetry.capture("cli.auth.login.error", { error: (error as Error).message }, Date.now() - startTime);
    await telemetry.flush();

    spinner.fail(chalk.red("Authentication failed"));
    console.error(chalk.red(`\n  Error: ${(error as Error).message}\n`));
    process.exit(1);
  }
}
