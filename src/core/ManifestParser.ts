import fs from "fs-extra";
import { ModuleManifestSchema, ModuleManifest } from "../types/manifest";
import { ZodError } from "zod";

export class ManifestParser {
  async parse(manifestPath: string): Promise<ModuleManifest> {
    if (!(await fs.pathExists(manifestPath))) {
      throw new Error(`Manifest not found: ${manifestPath}`);
    }

    const content = await fs.readFile(manifestPath, "utf-8");
    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      throw new Error(`Failed to parse manifest JSON: ${manifestPath}`);
    }

    try {
      return ModuleManifestSchema.parse(json);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new Error(`Invalid manifest: \n${this.formatZodError(error)}`);
      }
      throw error;
    }
  }

  async validate(
    manifestPath: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    try {
      await this.parse(manifestPath);
      return { valid: true, errors: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        errors: [errorMessage],
      };
    }
  }

  private formatZodError(error: ZodError): string {
    return error.issues
      .map((err) => `  - ${err.path.map(String).join(".")}: ${err.message}`)
      .join("\n");
  }
}
