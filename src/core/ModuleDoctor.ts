import fs from "fs-extra";
import path from "path";
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
