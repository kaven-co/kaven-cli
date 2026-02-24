import chalk from "chalk";
import ora from "ora";
import path from "path";
import fs from "fs-extra";
import crypto from "crypto";
import os from "os";
import { z } from "zod";
import { AuthService } from "../../core/AuthService";
import { MarketplaceClient } from "../../infrastructure/MarketplaceClient";

export interface PublishOptions {
  dryRun?: boolean;
  changelog?: string;
}

// Zod schema for module.json
export const moduleJsonSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().min(1),
  author: z.string().optional(),
  license: z.string().optional(),
  tier: z.enum(["free", "starter", "complete", "pro"]),
});

export type ModuleJson = z.infer<typeof moduleJsonSchema>;

const SIGNING_KEY_PATH = path.join(os.homedir(), ".kaven", "signing-key.json");

/** Load or generate Ed25519 signing key pair. */
async function getSigningKey(): Promise<{
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
}> {
  if (await fs.pathExists(SIGNING_KEY_PATH)) {
    try {
      const stored = await fs.readJson(SIGNING_KEY_PATH);
      const privateKey = crypto.createPrivateKey({
        key: Buffer.from(stored.privateKey, "base64"),
        type: "pkcs8",
        format: "der",
      });
      const publicKey = crypto.createPublicKey(privateKey);
      return { privateKey, publicKey };
    } catch {
      // Fall through to generate new key
    }
  }

  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const privateKeyDer = privateKey.export({ type: "pkcs8", format: "der" });
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" });

  await fs.ensureDir(path.dirname(SIGNING_KEY_PATH));
  await fs.writeJson(
    SIGNING_KEY_PATH,
    {
      privateKey: (privateKeyDer as Buffer).toString("base64"),
      publicKey: (publicKeyDer as Buffer).toString("base64"),
    },
    { spaces: 2 }
  );
  if (process.platform !== "win32") {
    await fs.chmod(SIGNING_KEY_PATH, 0o600);
  }

  return { privateKey, publicKey };
}

/** Generate SHA-256 checksum of a file. */
async function sha256File(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

/** Create tar.gz archive of current directory, excluding common noise. */
async function createTarball(sourceDir: string, outputPath: string): Promise<void> {
  const tar = await import("tar");
  await tar.create(
    {
      gzip: true,
      file: outputPath,
      cwd: sourceDir,
      filter: (filePath: string) => {
        const normalized = filePath.replace(/\\/g, "/");
        const excluded = [
          "node_modules",
          ".git",
          "dist",
          ".env",
        ];
        for (const exc of excluded) {
          if (
            normalized.startsWith(exc + "/") ||
            normalized === exc ||
            normalized.endsWith(".log")
          ) {
            return false;
          }
        }
        return true;
      },
    },
    ["."]
  );
}

export async function modulePublish(options: PublishOptions): Promise<void> {
  const cwd = process.cwd();

  // 1. Read and validate module.json
  const moduleJsonPath = path.join(cwd, "module.json");
  if (!(await fs.pathExists(moduleJsonPath))) {
    console.error(
      chalk.red(
        "Error: module.json not found in current directory."
      )
    );
    console.error(
      chalk.gray("Try: run this command from inside a module directory")
    );
    process.exit(1);
  }

  let moduleJson: ModuleJson;
  try {
    const raw = await fs.readJson(moduleJsonPath);
    const result = moduleJsonSchema.safeParse(raw);
    if (!result.success) {
      console.error(chalk.red("Error: Invalid module.json:"));
      for (const issue of result.error.issues) {
        console.error(chalk.red(`  - ${issue.path.join(".")}: ${issue.message}`));
      }
      process.exit(1);
    }
    moduleJson = result.data;
  } catch (error) {
    console.error(
      chalk.red(
        `Error: Failed to parse module.json: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }

  console.log();
  console.log(chalk.bold(`Publishing module: ${moduleJson.name} v${moduleJson.version}`));
  console.log(chalk.gray(`Slug: ${moduleJson.slug} | Tier: ${moduleJson.tier}`));
  console.log();

  // 2. Create tar.gz
  const tarballPath = path.join(
    os.tmpdir(),
    `kaven-${moduleJson.slug}-${moduleJson.version}.tar.gz`
  );

  const packageSpinner = ora("Creating module package...").start();
  try {
    await createTarball(cwd, tarballPath);
    const stats = await fs.stat(tarballPath);
    packageSpinner.succeed(
      `Package created (${(stats.size / 1024).toFixed(1)} KB)`
    );
  } catch (error) {
    packageSpinner.fail("Failed to create package");
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
    await fs.remove(tarballPath).catch(() => {});
    process.exit(1);
  }

  // 3. Generate checksum
  const checksumSpinner = ora("Computing SHA-256 checksum...").start();
  let checksum: string;
  try {
    checksum = await sha256File(tarballPath);
    checksumSpinner.succeed(`Checksum: ${checksum.substring(0, 16)}...`);
  } catch {
    checksumSpinner.fail("Failed to compute checksum");
    await fs.remove(tarballPath).catch(() => {});
    process.exit(1);
    return;
  }

  // 4. Sign the checksum
  const signSpinner = ora("Signing package...").start();
  let signatureHex: string;
  let publicKeyBase64: string;
  try {
    const { privateKey, publicKey } = await getSigningKey();
    const signature = crypto.sign(
      null, Buffer.from(checksum), privateKey
    );
    signatureHex = signature.toString("hex");
    const publicKeyDer = publicKey.export({
      type: "spki", format: "der",
    });
    publicKeyBase64 = (publicKeyDer as Buffer).toString("base64");
    signSpinner.succeed(
      `Package signed (${signatureHex.substring(0, 16)}...)`
    );
  } catch {
    signSpinner.fail("Failed to sign package");
    await fs.remove(tarballPath).catch(() => {});
    process.exit(1);
    return;
  }

  if (options.dryRun) {
    console.log();
    console.log(chalk.yellow("Dry-run mode: skipping upload and release creation."));
    console.log(chalk.green("✅ Package validated successfully."));
    await fs.remove(tarballPath).catch(() => {});
    return;
  }

  // 5. Get presigned upload URL
  const authService = new AuthService();
  try {
    await authService.getValidToken();
  } catch {
    console.error(
      chalk.red(
        "Error: Not authenticated. Run 'kaven auth login' first."
      )
    );
    await fs.remove(tarballPath).catch(() => {});
    process.exit(1);
    return;
  }

  const client = new MarketplaceClient(authService);
  const stats = await fs.stat(tarballPath);

  const urlSpinner = ora("Getting upload URL...").start();
  let uploadUrl: string;
  let s3Key: string;
  try {
    const uploadUrlResult = await client.getUploadUrl(
      moduleJson.slug,
      moduleJson.version,
      stats.size
    );
    uploadUrl = uploadUrlResult.uploadUrl;
    s3Key = uploadUrlResult.s3Key;
    urlSpinner.succeed("Upload URL received");
  } catch (error) {
    urlSpinner.fail("Failed to get upload URL");
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
    await fs.remove(tarballPath).catch(() => {});
    process.exit(1);
    return;
  }

  // 6. Upload tar.gz to presigned URL
  const uploadSpinner = ora(
    `Uploading package (${(stats.size / 1024).toFixed(1)} KB)...`
  ).start();
  try {
    const fileBuffer = await fs.readFile(tarballPath);
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/gzip",
        "Content-Length": String(stats.size),
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      throw new Error(
        `Upload failed: ${response.status} ${response.statusText}`
      );
    }
    uploadSpinner.succeed("Package uploaded successfully");
  } catch (error) {
    uploadSpinner.fail("Upload failed");
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
    await fs.remove(tarballPath).catch(() => {});
    process.exit(1);
    return;
  }

  // 7. Create release record
  const releaseSpinner = ora("Creating release record...").start();
  try {
    const release = await client.createRelease({
      moduleSlug: moduleJson.slug,
      version: moduleJson.version,
      s3Key,
      checksum,
      signature: signatureHex,
      publicKey: publicKeyBase64,
      changelog: options.changelog,
    });
    releaseSpinner.succeed(
      `Release created: ${moduleJson.slug}@${release.version} (ID: ${release.id})`
    );
  } catch (error) {
    releaseSpinner.fail("Failed to create release");
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
    await fs.remove(tarballPath).catch(() => {});
    process.exit(1);
    return;
  }

  // Cleanup temp file
  await fs.remove(tarballPath).catch(() => {});

  console.log();
  console.log(
    chalk.green(
      `✅ Published ${moduleJson.name} v${moduleJson.version} to the Kaven Marketplace!`
    )
  );
  console.log(
    chalk.gray(
      `View your module at: https://marketplace.kaven.sh/modules/${moduleJson.slug}`
    )
  );

  // Show next steps
  console.log();
  console.log(chalk.bold("Next steps:"));
  console.log(chalk.gray("  1. Share your module with the community"));
  console.log(chalk.gray("  2. Monitor installation metrics"));
  console.log(chalk.gray("  3. Update module with 'kaven module publish' when ready"));
}
