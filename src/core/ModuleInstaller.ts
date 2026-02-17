import { TransactionalFileSystem } from "../infrastructure/TransactionalFileSystem";
import { MarkerService } from "./MarkerService";
import { ScriptRunner } from "./ScriptRunner.js";
import fs from "fs-extra";
import path from "path";
import chalk from "chalk";

export interface Injection {
  file: string;
  anchor: string;
  moduleName?: string;
  code: string;
}

export interface ModuleManifest {
  name: string;
  version: string;
  injections: Injection[];
}

interface ModuleJson {
  scripts?: {
    postInstall?: Array<{ command: string; args?: string[] }>;
    preRemove?: Array<{ command: string; args?: string[] }>;
  };
  [key: string]: unknown;
}

export class ModuleInstaller {
  constructor(
    private projectRoot: string,
    private markerService: MarkerService,
  ) {}

  /**
   * Check whether the given module slug is already installed by scanning
   * project files for its begin/end markers.
   */
  async isModuleInstalled(moduleName: string): Promise<boolean> {
    try {
      const filesToCheck = await this.findProjectFiles();
      for (const filePath of filesToCheck) {
        try {
          const content = await fs.readFile(filePath, "utf-8");
          if (this.markerService.hasModule(content, moduleName)) {
            return true;
          }
        } catch {
          // Skip unreadable files
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /** Find text-based project source files to check for markers. */
  private async findProjectFiles(): Promise<string[]> {
    const { glob } = await import("glob");
    const patterns = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"];
    const ignore = ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/build/**"];

    const files: string[] = [];
    for (const pattern of patterns) {
      const found = await glob(pattern, {
        cwd: this.projectRoot,
        absolute: true,
        ignore,
      });
      files.push(...found);
    }
    return [...new Set(files)];
  }

  async install(manifest: ModuleManifest): Promise<void> {
    const tx = new TransactionalFileSystem(this.projectRoot);

    try {
      const filesToModify = Array.from(
        new Set(manifest.injections.map((inj) => inj.file)),
      );
      await tx.backup(filesToModify);

      for (const injection of manifest.injections) {
        await this.injectCode(injection);
      }

      await tx.commit();

      // Run postInstall lifecycle scripts if defined in module.json
      const moduleJson = await this.readManifest(this.projectRoot);
      if (moduleJson?.scripts?.postInstall?.length) {
        const runner = new ScriptRunner();
        try {
          await runner.runScripts(
            moduleJson.scripts.postInstall.map((s: { command: string; args?: string[] }) => ({ ...s, cwd: this.projectRoot })),
            'postInstall',
            false
          );
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.warn(chalk.yellow(`
  ⚠ PostInstall script failed: ${errMsg}`));
          console.warn(chalk.dim('  The module is installed. Run the script manually if needed.'));
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`❌ Installation failed: ${errorMessage}`);
      console.log(`🔄 Rolling back...`);
      await tx.rollback();
      throw error;
    }
  }

  async uninstall(manifest: ModuleManifest): Promise<void> {
    const tx = new TransactionalFileSystem(this.projectRoot);

    try {
      const filesToModify = Array.from(
        new Set(manifest.injections.map((inj) => inj.file)),
      );
      await tx.backup(filesToModify);

      // Run preRemove lifecycle scripts if defined in module.json
      const moduleJson = await this.readManifest(this.projectRoot);
      if (moduleJson?.scripts?.preRemove?.length) {
        const runner = new ScriptRunner();
        try {
          await runner.runScripts(
            moduleJson.scripts.preRemove.map((s: { command: string; args?: string[] }) => ({ ...s, cwd: this.projectRoot })),
            'preRemove',
            false
          );
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.warn(chalk.yellow(`
  ⚠ PreRemove script failed: ${errMsg}`));
        }
      }

      // Na desinstalação, removemos por arquivo para evitar múltiplas tentativas
      // de remover marcadores que o regex global já removeu.
      for (const fileName of filesToModify) {
        await this.removeCode(fileName, manifest.name);
      }

      await tx.commit();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`❌ Removal failed: ${errorMessage}`);
      console.log(`🔄 Rolling back...`);
      await tx.rollback();
      throw error;
    }
  }

  private async injectCode(injection: Injection): Promise<void> {
    const filePath = path.join(this.projectRoot, injection.file);
    const content = await fs.readFile(filePath, "utf-8");

    const updated = this.markerService.injectModule(
      content,
      injection.anchor,
      injection.moduleName || "unnamed",
      injection.code,
    );

    await fs.writeFile(filePath, updated);
  }

  private async removeCode(fileName: string, moduleName: string): Promise<void> {
    const filePath = path.join(this.projectRoot, fileName);
    const content = await fs.readFile(filePath, "utf-8");

    const updated = this.markerService.removeModule(content, moduleName);

    await fs.writeFile(filePath, updated);
  }

  private async readManifest(dir: string): Promise<ModuleJson | null> {
    try {
      const raw = await fs.readFile(path.join(dir, 'module.json'), 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
