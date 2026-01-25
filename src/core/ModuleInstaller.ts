import { TransactionalFileSystem } from "../infrastructure/TransactionalFileSystem";
import { MarkerService } from "./MarkerService";
import fs from "fs-extra";
import path from "path";

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

export class ModuleInstaller {
  constructor(
    private projectRoot: string,
    private markerService: MarkerService,
  ) {}

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
}
