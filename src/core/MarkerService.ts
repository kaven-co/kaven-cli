import {
  MarkerDetectionResult,
  createMarker,
} from "../types/markers";

export class MarkerService {
  hasModule(fileContent: string, moduleName: string): boolean {
    const marker = createMarker(moduleName);
    return (
      fileContent.includes(marker.beginMarker) &&
      fileContent.includes(marker.endMarker)
    );
  }

  detectMarkers(
    fileContent: string,
    moduleName: string,
  ): MarkerDetectionResult {
    const marker = createMarker(moduleName);
    const lines = fileContent.split("\n");

    let beginLine: number | undefined;
    let endLine: number | undefined;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(marker.beginMarker)) {
        beginLine = i;
      }
      if (lines[i].includes(marker.endMarker)) {
        endLine = i;
        break;
      }
    }

    if (beginLine !== undefined && endLine !== undefined) {
      const content = lines.slice(beginLine + 1, endLine).join("\n");
      return {
        found: true,
        beginLine,
        endLine,
        content,
      };
    }

    return { found: false };
  }

  injectModule(
    fileContent: string,
    anchor: string,
    moduleName: string,
    code: string,
  ): string {
    if (this.hasModule(fileContent, moduleName)) {
      throw new Error(`Module ${moduleName} already injected`);
    }

    if (!fileContent.includes(anchor)) {
      throw new Error(`Anchor not found: ${anchor}`);
    }

    const marker = createMarker(moduleName);
    const markedCode = `\n${marker.beginMarker}\n${code}\n${marker.endMarker}\n`;

    return fileContent.replace(anchor, `${anchor}${markedCode}`);
  }

  removeModule(fileContent: string, moduleName: string): string {
    const marker = createMarker(moduleName);
    const beginMarker = this.escapeRegex(marker.beginMarker);
    const endMarker = this.escapeRegex(marker.endMarker);

    const regex = new RegExp(
      `\\n?${beginMarker}[\\s\\S]*?${endMarker}\\n?`,
      "g",
    );

    const result = fileContent.replace(regex, "");

    if (result === fileContent) {
      throw new Error(`Module ${moduleName} not found in file`);
    }

    return result;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
