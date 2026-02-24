import fs from "fs-extra";
import path from "path";
import os from "os";
import { MarkerService } from "./MarkerService";
import { ManifestParser } from "./ManifestParser";

export interface DoctorCheckResult {
  type: "anchor" | "marker" | "dependency";
  severity: "error" | "warning" | "info";
  message: string;
  file?: string;
  line?: number;
  fixable: boolean;
}

interface KavenConfig {
  modules: Array<{
    name: string;
    version: string;
    installed: boolean;
  }>;
}

export class ModuleDoctor {
  constructor(
    private projectRoot: string,
    private markerService: MarkerService,
    private manifestParser: ManifestParser,
  ) {}

  async checkAll(): Promise<DoctorCheckResult[]> {
    const results: DoctorCheckResult[] = [];

    results.push(...(await this.checkAnchors()));
    results.push(...(await this.checkMarkers()));
    results.push(...(await this.checkDependencies()));
    results.push(...(await this.checkSchemaMerge()));
    results.push(...(await this.checkEnvCompleteness()));
    results.push(...(await this.checkLicense()));
    results.push(...(await this.checkFrameworkVersion()));
    results.push(...(await this.checkPrismaClientSync()));

    return results;
  }

  async checkAnchors(): Promise<DoctorCheckResult[]> {
    const results: DoctorCheckResult[] = [];

    const expectedAnchors = [
      { file: "apps/api/src/index.ts", anchor: "// [ANCHOR:ROUTES]" },
      { file: "apps/api/src/index.ts", anchor: "// [ANCHOR:MIDDLEWARE]" },
      { file: "apps/admin/app/layout.tsx", anchor: "// [ANCHOR:NAV_ITEMS]" },
    ];

    for (const { file, anchor } of expectedAnchors) {
      const filePath = path.join(this.projectRoot, file);

      if (!(await fs.pathExists(filePath))) {
        results.push({
          type: "anchor",
          severity: "warning",
          message: `File not found: ${file}`,
          file,
          fixable: false,
        });
        continue;
      }

      const content = await fs.readFile(filePath, "utf-8");

      if (!content.includes(anchor)) {
        results.push({
          type: "anchor",
          severity: "error",
          message: `Missing anchor: ${anchor}`,
          file,
          fixable: false,
        });
      }
    }

    return results;
  }

  async checkMarkers(): Promise<DoctorCheckResult[]> {
    const results: DoctorCheckResult[] = [];

    const config = await this.readKavenConfig();
    const installedModules = config.modules.filter((m) => m.installed);

    for (const module of installedModules) {
      const manifestPath = path.join(
        this.projectRoot,
        ".kaven/modules",
        module.name,
        "module.json",
      );

      if (!(await fs.pathExists(manifestPath))) {
        results.push({
          type: "marker",
          severity: "error",
          message: `Manifest not found for installed module: ${module.name}`,
          fixable: false,
        });
        continue;
      }

      try {
        const manifest = await this.manifestParser.parse(manifestPath);

        for (const injection of manifest.injections) {
          const filePath = path.join(this.projectRoot, injection.file);

          if (!(await fs.pathExists(filePath))) {
            results.push({
              type: "marker",
              severity: "error",
              message: `Injection target not found: ${injection.file}`,
              file: injection.file,
              fixable: false,
            });
            continue;
          }

          const content = await fs.readFile(filePath, "utf-8");
          const moduleName = injection.moduleName || module.name;

          const detection = this.markerService.detectMarkers(
            content,
            moduleName,
          );

          if (!detection.found) {
            results.push({
              type: "marker",
              severity: "error",
              message: `Module ${module.name} not injected in ${injection.file}`,
              file: injection.file,
              fixable: true,
            });
          }
        }
      } catch (error) {
        results.push({
          type: "marker",
          severity: "error",
          message: `Invalid manifest for module ${module.name}: ${error instanceof Error ? error.message : String(error)}`,
          fixable: false,
        });
      }
    }

    return results;
  }

  async checkDependencies(): Promise<DoctorCheckResult[]> {
    const results: DoctorCheckResult[] = [];

    const config = await this.readKavenConfig();
    const installedModules = config.modules.filter((m) => m.installed);

    const packageJsonPath = path.join(this.projectRoot, "package.json");
    if (!(await fs.pathExists(packageJsonPath))) {
      results.push({
        type: "dependency",
        severity: "error",
        message: "package.json not found",
        fixable: false,
      });
      return results;
    }

    const packageJson = await fs.readJSON(packageJsonPath);

    for (const module of installedModules) {
      const manifestPath = path.join(
        this.projectRoot,
        ".kaven/modules",
        module.name,
        "module.json",
      );

      if (!(await fs.pathExists(manifestPath))) continue;

      try {
        const manifest = await this.manifestParser.parse(manifestPath);

        for (const dep of manifest.dependencies.npm) {
          const [name] = dep.split("@");

          const hasInDeps = packageJson.dependencies?.[name];
          const hasInDevDeps = packageJson.devDependencies?.[name];

          if (!hasInDeps && !hasInDevDeps) {
            results.push({
              type: "dependency",
              severity: "warning",
              message: `Missing npm dependency: ${dep}`,
              fixable: true,
            });
          }
        }
      } catch {
        // Ignorar erros de manifest aqui, já tratados em checkMarkers
      }
    }

    return results;
  }

  // ──────────────────────────────────────────────────────────
  // C2.4: New enhanced checks
  // ──────────────────────────────────────────────────────────

  /** Check that the base Prisma schema exists and has no merge conflicts. */
  async checkSchemaMerge(): Promise<DoctorCheckResult[]> {
    const results: DoctorCheckResult[] = [];

    const baseSchemaPath = path.join(
      this.projectRoot,
      "packages/database/prisma/schema.base.prisma"
    );

    if (!(await fs.pathExists(baseSchemaPath))) {
      results.push({
        type: "dependency",
        severity: "warning",
        message: "Prisma base schema not found: packages/database/prisma/schema.base.prisma",
        file: "packages/database/prisma/schema.base.prisma",
        fixable: false,
      });
      return results;
    }

    // Check for git merge conflict markers
    const schemaDir = path.dirname(baseSchemaPath);
    try {
      const schemaFiles = await fs.readdir(schemaDir);
      for (const schemaFile of schemaFiles) {
        if (!schemaFile.endsWith(".prisma")) continue;
        const filePath = path.join(schemaDir, schemaFile);
        const content = await fs.readFile(filePath, "utf-8");
        if (content.includes("<<<<<<<")) {
          results.push({
            type: "marker",
            severity: "error",
            message: `Merge conflict detected in schema file: ${schemaFile}`,
            file: path.join("packages/database/prisma", schemaFile),
            fixable: false,
          });
        }
      }
    } catch {
      // Non-critical
    }

    if (results.length === 0) {
      results.push({
        type: "dependency",
        severity: "info",
        message: "Prisma schema integrity OK",
        fixable: false,
      });
    }

    return results;
  }

  /** Check that .env has all keys defined in .env.example (non-optional). */
  async checkEnvCompleteness(): Promise<DoctorCheckResult[]> {
    const results: DoctorCheckResult[] = [];

    const envExamplePath = path.join(this.projectRoot, ".env.example");
    const envPath = path.join(this.projectRoot, ".env");

    if (!(await fs.pathExists(envExamplePath))) {
      results.push({
        type: "dependency",
        severity: "info",
        message: ".env.example not found — skipping env completeness check",
        fixable: false,
      });
      return results;
    }

    if (!(await fs.pathExists(envPath))) {
      results.push({
        type: "dependency",
        severity: "warning",
        message: ".env file not found. Copy .env.example to .env and fill in values",
        file: ".env",
        fixable: false,
      });
      return results;
    }

    const exampleContent = await fs.readFile(envExamplePath, "utf-8");
    const envContent = await fs.readFile(envPath, "utf-8");

    // Parse keys: lines that are KEY=VALUE (not comments, not blank)
    const parseKeys = (content: string): Set<string> => {
      const keys = new Set<string>();
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const key = trimmed.split("=")[0].trim();
        if (key) keys.add(key);
      }
      return keys;
    };

    const exampleKeys = parseKeys(exampleContent);
    const envKeys = parseKeys(envContent);

    const missingKeys: string[] = [];
    for (const key of exampleKeys) {
      if (!envKeys.has(key)) {
        missingKeys.push(key);
      }
    }

    if (missingKeys.length > 0) {
      results.push({
        type: "dependency",
        severity: "warning",
        message: `Missing env vars in .env: ${missingKeys.join(", ")}`,
        file: ".env",
        fixable: true,
      });
    } else {
      results.push({
        type: "dependency",
        severity: "info",
        message: "Env vars completeness OK",
        fixable: false,
      });
    }

    return results;
  }

  /** Check if the stored license is present and not expired. */
  async checkLicense(): Promise<DoctorCheckResult[]> {
    const results: DoctorCheckResult[] = [];
    const licensePath = path.join(os.homedir(), ".kaven", "license.json");

    if (!(await fs.pathExists(licensePath))) {
      results.push({
        type: "dependency",
        severity: "warning",
        message: "No license found at ~/.kaven/license.json. Run 'kaven license status' to set up.",
        fixable: false,
      });
      return results;
    }

    try {
      const licenseData = await fs.readJson(licensePath);
      if (licenseData.expiresAt) {
        const expiresAt = new Date(licenseData.expiresAt).getTime();
        if (Date.now() > expiresAt) {
          results.push({
            type: "dependency",
            severity: "error",
            message: `License expired on ${licenseData.expiresAt}. Run 'kaven upgrade' to renew.`,
            fixable: false,
          });
          return results;
        }
      }

      results.push({
        type: "dependency",
        severity: "info",
        message: `License valid (tier: ${licenseData.tier || "unknown"})`,
        fixable: false,
      });
    } catch {
      results.push({
        type: "dependency",
        severity: "warning",
        message: "Could not read license file. Try 'kaven license status'.",
        fixable: false,
      });
    }

    return results;
  }

  /** Check if the framework version in package.json is compatible. */
  async checkFrameworkVersion(): Promise<DoctorCheckResult[]> {
    const results: DoctorCheckResult[] = [];

    const packageJsonPath = path.join(this.projectRoot, "package.json");
    if (!(await fs.pathExists(packageJsonPath))) {
      results.push({
        type: "dependency",
        severity: "info",
        message: "package.json not found — skipping framework version check",
        fixable: false,
      });
      return results;
    }

    try {
      const packageJson = await fs.readJSON(packageJsonPath);
      const kavenCoreVersion =
        packageJson.dependencies?.["@kaven/core"] ||
        packageJson.devDependencies?.["@kaven/core"];

      if (!kavenCoreVersion) {
        results.push({
          type: "dependency",
          severity: "info",
          message: "@kaven/core not found in dependencies — not a Kaven framework project",
          fixable: false,
        });
        return results;
      }

      // Minimum required semver range
      const MINIMUM_VERSION = "1.0.0";
      const versionStr = kavenCoreVersion.replace(/[\^~>=<]/, "").split(" ")[0];
      const parts = versionStr.split(".").map(Number);
      const minParts = MINIMUM_VERSION.split(".").map(Number);

      let compatible = true;
      for (let i = 0; i < 3; i++) {
        if ((parts[i] || 0) > (minParts[i] || 0)) break;
        if ((parts[i] || 0) < (minParts[i] || 0)) {
          compatible = false;
          break;
        }
      }

      if (!compatible) {
        results.push({
          type: "dependency",
          severity: "warning",
          message: `@kaven/core version ${kavenCoreVersion} may be outdated. Minimum: ^${MINIMUM_VERSION}`,
          fixable: false,
        });
      } else {
        results.push({
          type: "dependency",
          severity: "info",
          message: `Framework version OK (${kavenCoreVersion})`,
          fixable: false,
        });
      }
    } catch {
      results.push({
        type: "dependency",
        severity: "info",
        message: "Could not determine framework version",
        fixable: false,
      });
    }

    return results;
  }

  /** Check if Prisma client is generated and up-to-date. */
  async checkPrismaClientSync(): Promise<DoctorCheckResult[]> {
    const results: DoctorCheckResult[] = [];

    const prismaClientPath = path.join(
      this.projectRoot,
      "node_modules/@prisma/client"
    );
    const schemaPath = path.join(this.projectRoot, "prisma/schema.prisma");

    if (!(await fs.pathExists(prismaClientPath))) {
      results.push({
        type: "dependency",
        severity: "warning",
        message:
          "@prisma/client not found. Run 'npx prisma generate' to generate the client.",
        fixable: true,
      });
      return results;
    }

    if (!(await fs.pathExists(schemaPath))) {
      results.push({
        type: "dependency",
        severity: "info",
        message: "prisma/schema.prisma not found — skipping Prisma sync check",
        fixable: false,
      });
      return results;
    }

    try {
      const schemaStat = await fs.stat(schemaPath);
      const clientStat = await fs.stat(prismaClientPath);

      if (schemaStat.mtime > clientStat.mtime) {
        results.push({
          type: "dependency",
          severity: "warning",
          message:
            "Prisma schema was modified after client generation. Run 'npx prisma generate'.",
          fixable: true,
        });
      } else {
        results.push({
          type: "dependency",
          severity: "info",
          message: "Prisma client is up to date",
          fixable: false,
        });
      }
    } catch {
      results.push({
        type: "dependency",
        severity: "info",
        message: "Could not compare Prisma schema and client timestamps",
        fixable: false,
      });
    }

    return results;
  }

  private async readKavenConfig(): Promise<KavenConfig> {
    const configPath = path.join(this.projectRoot, "kaven.config.json");

    if (!(await fs.pathExists(configPath))) {
      return { modules: [] };
    }

    try {
      return await fs.readJSON(configPath);
    } catch {
      return { modules: [] };
    }
  }
}
