
/**
 * Deactivates models by commenting them out in the Prisma schema
 */
export function deactivateModels(schemaContent: string, models: string[]): string {
  let updatedSchema = schemaContent;

  for (const modelName of models) {
    const modelRegex = new RegExp(`^model ${modelName} \\{[^}]*\\}`, "gm");
    updatedSchema = updatedSchema.replace(modelRegex, (match) => 
      match.split("\n").map(line => `// ${line}`).join("\n")
    );
  }

  return updatedSchema;
}

/**
 * Activates models by uncommenting them in the Prisma schema
 */
export function activateModels(schemaContent: string, models: string[]): string {
  let updatedSchema = schemaContent;

  for (const modelName of models) {
    // Regex matches multiple lines starting with // until the closing brace of the model
    const regex = new RegExp(`// model ${modelName} \\{[^}]*// \\}`, "gs");

    updatedSchema = updatedSchema.replace(regex, (match) => {
      return match.split("\n").map(line => line.replace(/^\/\/ /, "")).join("\n");
    });
  }

  return updatedSchema;
}

/**
 * Checks if a module is currently active in the schema
 */
export function isModuleActive(schemaContent: string, models: string[]): boolean {
  if (models.length === 0) return true;
  const firstModel = models[0];
  const activeRegex = new RegExp(`^model ${firstModel} \\{`, "m");
  return activeRegex.test(schemaContent);
}
