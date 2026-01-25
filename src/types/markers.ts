export interface ModuleMarker {
  moduleName: string;
  beginMarker: string;
  endMarker: string;
}

export interface InjectionPoint {
  file: string;
  anchor: string;
  code: string;
}

export interface MarkerDetectionResult {
  found: boolean;
  beginLine?: number;
  endLine?: number;
  content?: string;
}

export function createMarker(moduleName: string): ModuleMarker {
  return {
    moduleName,
    beginMarker: `// [KAVEN_MODULE:${moduleName} BEGIN]`,
    endMarker: `// [KAVEN_MODULE:${moduleName} END]`,
  };
}
