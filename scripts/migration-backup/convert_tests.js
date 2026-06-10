import fs from 'fs';
import path from 'path';

const files = [
"src/commands/config/features.test.ts",
"src/commands/config/config.test.ts",
"src/commands/module/publish.test.ts",
"src/commands/module/activate.test.ts",
"src/commands/upgrade/upgrade.test.ts",
"src/commands/init-ci/init-ci.test.ts",
"src/commands/init/init.test.ts",
"src/core/ErrorRecovery.test.ts",
"src/core/SignatureVerifier.test.ts",
"src/core/RegistryResolver.test.ts",
"src/index.test.ts",
"tests/commands/aiox/bootstrap.test.ts",
"tests/commands/config/features.test.ts",
"tests/commands/module/activate.test.ts",
"tests/commands/init/arch-docs.test.ts",
"tests/integration/browse.msw.test.ts",
"tests/integration/module-installation.test.ts",
"tests/integration/auth-flow.msw.test.ts",
"tests/integration/module-add-remove.test.ts",
"tests/integration/MarketplaceClient.msw.test.ts",
"tests/integration/manifest-real-module.test.ts",
"tests/integration/markers-real-module.test.ts",
"tests/lib/module-registry.test.ts",
"tests/lib/schema-modifier.test.ts",
"tests/unit/AuthService.test.ts",
"tests/unit/Container.test.ts",
"tests/unit/commands/module-publish.test.ts",
"tests/unit/commands/help-text.test.ts",
"tests/unit/commands/features.test.ts",
"tests/unit/commands/upgrade.test.ts",
"tests/unit/commands/marketplace/install.test.ts",
"tests/unit/commands/marketplace/list.test.ts",
"tests/unit/commands/cache.test.ts",
"tests/unit/core/ProjectInitializer.test.ts",
"tests/unit/core/CacheManager.test.ts",
"tests/unit/core/ModuleDoctor-enhanced.test.ts",
"tests/unit/EnvManager.test.ts",
"tests/unit/MarkerService.test.ts",
"tests/unit/TelemetryBuffer.test.ts",
"tests/unit/ModuleDoctor.test.ts",
"tests/unit/LicenseService.test.ts",
"tests/unit/ScriptRunner.test.ts",
"tests/unit/TransactionalFileSystem.test.ts",
"tests/unit/ManifestParser.test.ts",
"tests/unit/MarketplaceClient.test.ts"
];

function convert(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Helper to remove any existing node:test / node:assert if we are re-running
  content = content.replace(/import\s+\{\s*[^}]+\s*\}\s*from\s*['"]node:test['"];?\n?/g, '');
  content = content.replace(/import\s+assert\s+from\s*['"]node:assert['"];?\n?/g, '');

  // 1. Imports conversion
  const vitestImportRegex = /import\s+\{\s*([^}]+)\s*\}\s*from\s*['"]vitest['"]/g;
  if (vitestImportRegex.test(content)) {
    content = content.replace(vitestImportRegex, (match, p1) => {
      const parts = p1.split(',').map(s => s.trim());
      const usedInNodeTest = ['describe', 'it', 'beforeEach', 'afterEach', 'before', 'after', 'test'];
      const nodeTestImports = parts.filter(p => usedInNodeTest.includes(p));
      if (parts.includes('vi') || content.includes('vi.') || content.includes('mock.')) {
        if (!nodeTestImports.includes('mock')) nodeTestImports.push('mock');
      }
      if (content.includes('describe(') && !nodeTestImports.includes('describe')) nodeTestImports.push('describe');
      if (content.includes('it(') && !nodeTestImports.includes('it')) nodeTestImports.push('it');

      return `import { ${nodeTestImports.join(', ')} } from 'node:test';\nimport assert from 'node:assert';`;
    });
  } else {
    let imports = [];
    if (content.includes('describe(')) imports.push('describe');
    if (content.includes('it(')) imports.push('it');
    if (content.includes('beforeEach(')) imports.push('beforeEach');
    if (content.includes('afterEach(')) imports.push('afterEach');
    if (content.includes('mock.') || content.includes('vi.')) imports.push('mock');
    
    if (imports.length > 0) {
      content = `import { ${Array.from(new Set(imports)).join(', ')} } from 'node:test';\nimport assert from 'node:assert';\n` + content;
    }
  }

  // 2. Assertions (Greedy but constrained to parenthesized blocks)
  content = content.replace(/expect\(([\s\S]*?)\)\.toBe\(([\s\S]*?)\)/g, 'assert.strictEqual($1, $2)');
  content = content.replace(/expect\(([\s\S]*?)\)\.toEqual\(([\s\S]*?)\)/g, 'assert.deepStrictEqual($1, $2)');
  content = content.replace(/expect\(([\s\S]*?)\)\.toBeDefined\(\)/g, 'assert.ok($1 !== undefined)');
  content = content.replace(/expect\(([\s\S]*?)\)\.toBeUndefined\(\)/g, 'assert.strictEqual($1, undefined)');
  content = content.replace(/expect\(([\s\S]*?)\)\.toBeTruthy\(\)/g, 'assert.ok($1)');
  content = content.replace(/expect\(([\s\S]*?)\)\.toBeFalsy\(\)/g, 'assert.ok(!$1)');
  content = content.replace(/expect\(([\s\S]*?)\)\.toBeNull\(\)/g, 'assert.strictEqual($1, null)');
  content = content.replace(/expect\(([\s\S]*?)\)\.not\.toBeNull\(\)/g, 'assert.notStrictEqual($1, null)');
  content = content.replace(/expect\(([\s\S]*?)\)\.toContain\(([\s\S]*?)\)/g, 'assert.ok($1.includes($2))');
  content = content.replace(/expect\(([\s\S]*?)\)\.toHaveLength\(([\s\S]*?)\)/g, 'assert.strictEqual($1.length, $2)');
  content = content.replace(/expect\(([\s\S]*?)\)\.toBeInstanceOf\(([\s\S]*?)\)/g, 'assert.ok($1 instanceof $2)');

  content = content.replace(/await\s+expect\(([\s\S]*?)\)\.resolves\.not\.toThrow\(\)/g, 'await assert.doesNotReject(async () => { await $1; })');
  content = content.replace(/await\s+expect\(([\s\S]*?)\)\.rejects\.toThrow\(([\s\S]*?)\)/g, 'await assert.rejects(async () => { await $1; }, { message: $2 })');
  content = content.replace(/await\s+expect\(([\s\S]*?)\)\.resolves\.toBe\(([\s\S]*?)\)/g, 'assert.strictEqual(await $1, $2)');
  content = content.replace(/expect\(([\s\S]*?)\)\.toThrow\(([\s\S]*?)\)/g, 'assert.throws(() => $1, $2)');

  // 3. Mocks
  content = content.replace(/vi\.fn\(\)/g, 'mock.fn()');
  
  // Fix mock.method(...).mockImplementation
  content = content.replace(/mock\.method\((.*?),\s*(.*?)\)\.mockImplementation\(([\s\S]*?)\)/g, 'mock.method($1, $2, $3)');
  content = content.replace(/vi\.spyOn\((.*?),\s*(.*?)\)/g, 'mock.method($1, $2)');
  
  content = content.replace(/vi\.restoreAllMocks\(\)/g, '');
  content = content.replace(/\.mockRestore\(\)/g, '.mock.restore()');
  content = content.replace(/vi\.mocked\((.*?)\)/g, '$1');

  // NUCLEAR OPTION for vi.mock: comment it out completely until the end of the statement
  content = content.replace(/vi\.mock\([\s\S]*?\);\n?/g, (match) => `/* ${match.trim()} */\n`);
  // Also handle cases where it might be inside another block or not end with semicolon
  content = content.replace(/\/\/ mock\.module[\s\S]*?\}/g, (match) => `/* ${match} */`);

  // 4. Extensions
  content = content.replace(/from\s+['"](\.\.?\/[^'"]+?)(?<!\.js)['"]/g, "from '$1.js'");

  fs.writeFileSync(filePath, content);
  console.log(`Converted ${filePath}`);
}

files.forEach(file => {
  try {
    convert(file);
  } catch (err) {
    console.error(`Error converting ${file}:`, err.message);
  }
});
