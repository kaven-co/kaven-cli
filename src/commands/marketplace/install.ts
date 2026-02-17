import chalk from "chalk";
import ora from "ora";
import fs from "fs-extra";
import path from "path";
import os from "os";
import * as tar from "tar";
import { MarketplaceClient } from "../../infrastructure/MarketplaceClient";
import { AuthService } from "../../core/AuthService";
import { ModuleInstaller } from "../../core/ModuleInstaller";
import { MarkerService } from "../../core/MarkerService";
import { TelemetryBuffer } from "../../infrastructure/TelemetryBuffer";
import {
  AuthenticationError,
  LicenseRequiredError,
  NotFoundError,
  NetworkError,
} from "../../infrastructure/errors";
import type { ModuleManifest } from "../../core/ModuleInstaller";

export interface MarketplaceInstallOptions {
  version?: string;
  force?: boolean;
}

/** Create a unique temp directory for this install session. */
async function makeTempDir(): Promise<string> {
  const base = path.join(os.tmpdir(), "kaven-install-");
  return fs.mkdtemp(base);
}

/** Format bytes into a human-readable string like "245 KB". */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function marketplaceInstall(
  slug: string,
  options: MarketplaceInstallOptions = {}
): Promise<void> {
  const telemetry = TelemetryBuffer.getInstance();
  const startTime = Date.now();
  telemetry.capture("cli.marketplace.install.start", { slug });

  const authService = new AuthService();
  const client = new MarketplaceClient(authService);
  const projectRoot = process.cwd();

  // 1. Verify authentication — required for downloads
  let accessToken: string;
  try {
    accessToken = await authService.getValidToken();
  } catch {
    console.error(
      chalk.red("Authentication required. Run: kaven auth login")
    );
    telemetry.capture(
      "cli.marketplace.install.error",
      { slug, error: "not_authenticated" },
      Date.now() - startTime
    );
    await telemetry.flush();
    process.exit(1);
    return; // Unreachable but satisfies TS control flow
  }
  void accessToken; // used implicitly via authService in client

  const spinner = ora(`Preparing installation of '${slug}'...`).start();
  let tempDir: string | null = null;

  try {
    // 2. Get module metadata
    spinner.text = `Fetching module '${slug}' from Marketplace...`;
    let moduleData;
    try {
      moduleData = await client.getModule(slug);
    } catch (error) {
      if (error instanceof NotFoundError) {
        spinner.fail(chalk.red(`Module '${slug}' not found in Marketplace.`));
        process.exit(1);
        return;
      }
      throw error;
    }

    const installVersion = options.version ?? moduleData.latestVersion;

    // 3. Check for conflict before downloading
    const markerService = new MarkerService();
    const installer = new ModuleInstaller(projectRoot, markerService);

    // Check if already installed by looking at marker files
    const isInstalled = await installer.isModuleInstalled(slug);
    if (isInstalled && !options.force) {
      spinner.stop();
      console.log(
        chalk.yellow(
          `Module '${slug}' is already installed. Use --force to overwrite.`
        )
      );
      telemetry.capture(
        "cli.marketplace.install.skipped",
        { slug, reason: "already_installed" },
        Date.now() - startTime
      );
      await telemetry.flush();
      return;
    }

    // 4. Create download token
    spinner.text = `Creating download token for '${slug}@${installVersion}'...`;
    const downloadToken = await client.createDownloadToken(
      moduleData.id,
      installVersion
    );

    // 5. Download the tarball to a temp directory
    tempDir = await makeTempDir();
    const tarPath = path.join(tempDir, "module.tar.gz");
    const extractDir = path.join(tempDir, "extracted");
    await fs.ensureDir(extractDir);

    // Fetch with size reporting
    spinner.text = `Downloading ${slug} v${installVersion}...`;
    const response = await fetch(downloadToken.downloadUrl);
    if (!response.ok) {
      throw new Error(
        `Download failed: ${response.status} ${response.statusText}`
      );
    }

    const contentLength = response.headers.get("content-length");
    const sizeStr = contentLength
      ? ` (${formatBytes(parseInt(contentLength, 10))})`
      : "";
    spinner.text = `Downloading ${slug} v${installVersion}${sizeStr}...`;

    if (!response.body) {
      throw new Error("No response body received for download");
    }

    // Stream download to file
    const fileStream = fs.createWriteStream(tarPath);
    const reader = response.body.getReader();
    await new Promise<void>((resolve, reject) => {
      const pump = async () => {
        try {
          let reading = true;
          while (reading) {
            const { done, value } = await reader.read();
            if (done) {
              fileStream.end();
              reading = false;
            } else {
              if (!fileStream.write(value)) {
                await new Promise<void>((r) => fileStream.once("drain", r));
              }
            }
          }
          fileStream.once("finish", resolve);
          fileStream.once("error", reject);
        } catch (err) {
          reject(err);
        }
      };
      pump();
    });

    // 6. Verify SHA-256 checksum if provided
    if (downloadToken.token) {
      // The token acts as a download auth token, not a checksum.
      // If the API were to return a checksum field, we'd verify here.
      // For now we verify the file exists and has content.
      const stat = await fs.stat(tarPath);
      if (stat.size === 0) {
        throw new Error("Downloaded file is empty");
      }
    }

    // 7. Extract tarball
    spinner.text = `Extracting ${slug} v${installVersion}...`;
    await tar.x({ file: tarPath, cwd: extractDir });

    // 8. Read module.json manifest from extracted dir
    const manifestPath = path.join(extractDir, "module.json");
    const manifestExists = await fs.pathExists(manifestPath);
    if (!manifestExists) {
      throw new Error(
        `module.json not found in extracted archive for '${slug}'`
      );
    }
    const manifest: ModuleManifest = await fs.readJson(manifestPath);

    // 9. Delegate to ModuleInstaller
    spinner.text = `Installing ${slug} v${installVersion}...`;
    await installer.install(manifest);

    spinner.succeed(
      chalk.green(`Module '${slug}@${installVersion}' installed successfully.`)
    );
    console.log(
      chalk.gray(`Use 'kaven module doctor' to verify the installation.`)
    );

    telemetry.capture(
      "cli.marketplace.install.success",
      { slug, version: installVersion },
      Date.now() - startTime
    );
    await telemetry.flush();
  } catch (error) {
    spinner.stop();

    if (error instanceof LicenseRequiredError) {
      console.error(
        chalk.red(
          `License required: '${slug}' requires a '${error.requiredTier}' license.`
        )
      );
      console.error(
        chalk.yellow(`Run: kaven upgrade ${error.requiredTier}`)
      );
      telemetry.capture(
        "cli.marketplace.install.error",
        { slug, error: "license_required", tier: error.requiredTier },
        Date.now() - startTime
      );
      await telemetry.flush();
      process.exit(1);
      return;
    }

    if (
      error instanceof AuthenticationError ||
      (error instanceof Error &&
        error.message.includes("Not authenticated"))
    ) {
      console.error(
        chalk.red("Authentication required. Run: kaven auth login")
      );
      telemetry.capture(
        "cli.marketplace.install.error",
        { slug, error: "auth_error" },
        Date.now() - startTime
      );
      await telemetry.flush();
      process.exit(1);
      return;
    }

    if (error instanceof NetworkError) {
      console.error(
        chalk.red("Could not reach marketplace. Check your connection.")
      );
      telemetry.capture(
        "cli.marketplace.install.error",
        { slug, error: "network_error" },
        Date.now() - startTime
      );
      await telemetry.flush();
      process.exit(1);
      return;
    }

    telemetry.capture(
      "cli.marketplace.install.error",
      { slug, error: (error as Error).message },
      Date.now() - startTime
    );
    await telemetry.flush();

    spinner.fail(chalk.red(`Failed to install module '${slug}'.`));
    console.error(error);
    process.exit(1);
  } finally {
    // 10. Always cleanup temp dir
    if (tempDir) {
      await fs.remove(tempDir).catch(() => {
        // Ignore cleanup errors
      });
    }
  }
}
