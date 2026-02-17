import chalk from "chalk";
import ora from "ora";
import open from "open";
import path from "path";
import fs from "fs-extra";
import os from "os";
import { AuthService } from "../../core/AuthService";
import { MarketplaceClient } from "../../infrastructure/MarketplaceClient";

export interface UpgradeOptions {
  browser?: boolean;
}

const LICENSE_PATH = path.join(os.homedir(), ".kaven", "license.json");

const TIERS = ["starter", "complete", "pro", "enterprise"] as const;

const TIER_LABELS: Record<string, string> = {
  starter: "Starter",
  complete: "Complete",
  pro: "Pro",
  enterprise: "Enterprise",
};

const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 120; // 10 minutes

async function loadLicenseKey(): Promise<string | null> {
  if (!(await fs.pathExists(LICENSE_PATH))) return null;
  try {
    const data = await fs.readJson(LICENSE_PATH);
    return data.key || null;
  } catch {
    return null;
  }
}

async function saveLicenseTier(tier: string): Promise<void> {
  let existing: Record<string, unknown> = {};
  if (await fs.pathExists(LICENSE_PATH)) {
    try {
      existing = await fs.readJson(LICENSE_PATH);
    } catch {
      // ignore
    }
  }
  await fs.ensureDir(path.dirname(LICENSE_PATH));
  await fs.writeJson(LICENSE_PATH, { ...existing, tier }, { spaces: 2 });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function upgradeCommand(options: UpgradeOptions): Promise<void> {
  // 1. Require auth
  const authService = new AuthService();
  try {
    await authService.getValidToken();
  } catch {
    console.error(
      chalk.red(
        "Error: Not authenticated. Run 'kaven auth login' first."
      )
    );
    process.exit(1);
    return;
  }

  // 2. Load current license key
  const licenseKey = await loadLicenseKey();
  if (!licenseKey) {
    console.error(
      chalk.red(
        "Error: No license found. Add your license key first with 'kaven license status'."
      )
    );
    process.exit(1);
    return;
  }

  // 3. Get current tier
  const client = new MarketplaceClient(authService);

  const tierSpinner = ora("Loading your current license...").start();
  let currentTier: string;
  try {
    const licenseStatus = await client.getLicenseStatus(licenseKey);
    currentTier = licenseStatus.tier.toLowerCase();
    tierSpinner.succeed(`Current tier: ${chalk.bold(TIER_LABELS[currentTier] || currentTier)}`);
  } catch {
    tierSpinner.fail("Could not load license status");
    console.error(chalk.gray("Try: kaven license status"));
    process.exit(1);
    return;
  }

  // 4. Show tier comparison table (imported from license command)
  const { printTierComparisonTable } = await import("../license/tier-table");
  printTierComparisonTable(currentTier, "pro");
  console.log();

  // 5. Prompt target tier (exclude current tier)
  const { select } = await import("@inquirer/prompts");
  const availableTiers = TIERS.filter(
    (t) => t !== currentTier && t !== "enterprise"
  );

  if (availableTiers.length === 0) {
    console.log(
      chalk.yellow(
        `You're already on the highest available tier (${TIER_LABELS[currentTier] || currentTier}).`
      )
    );
    console.log(
      chalk.gray("For Enterprise plans, contact: enterprise@kaven.sh")
    );
    return;
  }

  const targetTier = await select({
    message: "Select target tier:",
    choices: availableTiers.map((t) => ({
      name: TIER_LABELS[t],
      value: t,
    })),
  });

  // 6. Guard: same tier
  if (targetTier === currentTier) {
    console.log(
      chalk.yellow(`Already on ${TIER_LABELS[currentTier] || currentTier}.`)
    );
    return;
  }

  // 7. Create checkout session
  const checkoutSpinner = ora("Creating checkout session...").start();
  let sessionUrl: string;
  let sessionId: string;
  try {
    const session = await client.createCheckoutSession(targetTier, licenseKey);
    sessionUrl = session.sessionUrl;
    sessionId = session.sessionId;
    checkoutSpinner.succeed("Checkout session created");
  } catch (error) {
    checkoutSpinner.fail("Failed to create checkout session");
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
    return;
  }

  // 8. Open browser
  if (options.browser !== false) {
    console.log(chalk.cyan(`Opening checkout in your browser...`));
    console.log(chalk.gray(`URL: ${sessionUrl}`));
    try {
      await open(sessionUrl);
    } catch {
      console.log(
        chalk.yellow("Could not open browser automatically. Open this URL manually:")
      );
      console.log(chalk.cyan(sessionUrl));
    }
  } else {
    console.log(chalk.cyan("Open this URL to complete checkout:"));
    console.log(chalk.bold(sessionUrl));
  }

  console.log();

  // 9. Poll for checkout status
  const pollSpinner = ora(
    `Waiting for payment confirmation (checking every 5s, max 10 min)...`
  ).start();

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);

    const remaining = MAX_POLLS - i - 1;
    pollSpinner.text = `Waiting for payment confirmation... (${remaining * 5}s remaining)`;

    try {
      const status = await client.getCheckoutStatus(sessionId);

      if (status.status === "confirmed") {
        pollSpinner.succeed("Payment confirmed!");
        const newTier = status.tier || targetTier;
        await saveLicenseTier(newTier);
        console.log();
        console.log(
          chalk.green(
            `✅ Successfully upgraded to ${TIER_LABELS[newTier] || newTier}!`
          )
        );
        console.log(
          chalk.gray("Your new features are now unlocked.")
        );
        return;
      }

      if (status.status === "cancelled") {
        pollSpinner.fail("Checkout was cancelled.");
        console.log(chalk.gray("No changes were made to your subscription."));
        return;
      }

      if (status.status === "failed") {
        pollSpinner.fail("Payment failed.");
        console.log(
          chalk.gray("Please try again or contact support@kaven.sh")
        );
        process.exit(1);
        return;
      }

      // status === "pending" — continue polling
    } catch {
      // Network hiccup — keep polling
    }
  }

  // Timeout
  pollSpinner.warn("Timed out waiting for payment confirmation.");
  console.log();
  console.log(
    chalk.yellow(
      "If you completed payment, your upgrade may take a few minutes to activate."
    )
  );
  console.log(
    chalk.gray(
      "Check your upgrade status at: https://dashboard.kaven.sh/billing"
    )
  );
}
