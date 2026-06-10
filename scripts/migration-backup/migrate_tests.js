import fs from 'node:fs';
import path from 'node:path';

const testFiles = [
  'src/commands/config/features.test.ts',
  'src/commands/config/config.test.ts',
  'src/commands/module/publish.test.ts',
  'src/commands/module/activate.test.ts',
  'src/commands/upgrade/upgrade.test.ts',
  'src/commands/init-ci/init-ci.test.ts',
  'src/commands/init/init.test.ts',
  'src/core/ErrorRecovery.test.ts',
  'src/core/SignatureVerifier.test.ts',
  'src/core/RegistryResolver.test.ts',
  'src/index.test.ts',
  'tests/commands/aiox/bootstrap.test.ts',
  'tests/commands/config/features.test.ts',
  'tests/commands/module/activate.test.ts',
  'tests/commands/init/arch-docs.test.ts',
  'tests/integration/browse.msw.test.ts',
  'tests/integration/module-installation.test.ts',
  'tests/integration/auth-flow.msw.test.ts',
  'tests/integration/module-add-remove.test.ts',
  'tests/integration/MarketplaceClient.msw.test.ts',
  'tests/integration/manifest-real-module.test.ts',
  'tests/integration/markers-real-module.test.ts',
  'tests/lib/module-registry.test.ts',
  'tests/lib/schema-modifier.test.ts',
  'tests/unit/AuthService.test.ts',
  'tests/unit/Container.test.ts',
  'tests/unit/commands/module-publish.test.ts',
  'tests/unit/commands/help-text.test.ts',
  'tests/unit/commands/features.test.ts',
  'tests/unit/commands/upgrade.test.ts',
  'tests/unit/commands/marketplace/install.test.ts',
  'tests/unit/commands/marketplace/list.test.ts',
  'tests/unit/commands/cache.test.ts',
  'tests/unit/core/ProjectInitializer.test.ts',
  'tests/unit/core/CacheManager.test.ts',
  'tests/unit/core/ModuleDoctor-enhanced.test.ts',
  'tests/unit/EnvManager.test.ts',
  'tests/unit/MarkerService.test.ts',
  'tests/unit/TelemetryBuffer.test.ts',
  'tests/unit/ModuleDoctor.test.ts',
  'tests/unit/LicenseService.test.ts',
  'tests/unit/ScriptRunner.test.ts',
  'tests/unit/TransactionalFileSystem.test.ts',
  'tests/unit/ManifestParser.test.ts',
  'tests/unit/MarketplaceClient.test.ts'
];

function migrate(filePath) {
  if (!fs.existsSync(filePath)) return;
  console.log(`Migrating ${filePath}...`);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 0. Preliminary cleanup of the mess I made
  content = content.replace(/await\s+assert\.rejects\(async\s+\(\)\s+=>\s+{\s+await\s+([\s\S]+?)\s+\)\.resolves\.toBeUndefined\(\);/g, 'await $1;');
  content = content.replace(/expect\(([\s\S]+?)\)\.resolves\.toBeUndefined\(\)/g, 'await $1');
  
  // 1. Remove vitest imports
  content = content.replace(/import\s+{[^}]+}\s+from\s+['"]vitest['"];?\n?/g, '');
  
  // 2. Identify all used node:test methods
  let methods = new Set(['describe', 'it']);
  if (content.includes('beforeEach')) methods.add('beforeEach');
  if (content.includes('afterEach')) methods.add('afterEach');
  if (content.includes('beforeAll') || content.includes('before(')) { methods.add('before'); content = content.replace(/beforeAll/g, 'before'); }
  if (content.includes('afterAll') || content.includes('after(')) { methods.add('after'); content = content.replace(/afterAll/g, 'after'); }
  if (content.includes('mock.') || content.includes('vi.')) methods.add('mock');
  
  // Remove existing node:test imports to recreate
  content = content.replace(/import\s+{[^}]+}\s+from\s+['"]node:test['"];?\n?/g, '');
  content = content.replace(/import\s+assert\s+from\s+['"]node:assert['"];?\n?/g, '');
  content.trimStart();

  // 3. Translations
  // Replace vi. with mock.
  content = content.replace(/vi\.fn\(\)/g, 'mock.fn()');
  content = content.replace(/vi\.spyOn/g, 'mock.method');
  content = content.replace(/vi\.mock\(.+?\);?\n?/g, '');

  // Assertion translations
  // Match till the LAST closing parenthesis for the argument to handle nested calls
  const translate = (regex, replacement) => {
    content = content.replace(regex, replacement);
  };

  translate(/expect\((.+?)\)\.toBe\((.+?)\)/g, 'assert.strictEqual($1, $2)');
  translate(/expect\((.+?)\)\.not\.toBe\((.+?)\)/g, 'assert.notStrictEqual($1, $2)');
  translate(/expect\((.+?)\)\.toEqual\((.+?)\)/g, 'assert.deepStrictEqual($1, $2)');
  translate(/expect\((.+?)\)\.toBeDefined\(\)/g, 'assert.ok($1 !== undefined)');
  translate(/expect\((.+?)\)\.toBeTruthy\(\)/g, 'assert.ok($1)');
  translate(/expect\((.+?)\)\.toBeFalsy\(\)/g, 'assert.ok(!$1)');
  translate(/expect\((.+?)\)\.toContain\((.+?)\)/g, 'assert.ok($1.includes($2))');
  translate(/expect\((.+?)\)\.toHaveLength\((.+?)\)/g, 'assert.strictEqual($1.length, $2)');
  translate(/expect\((.+?)\)\.toBeInstanceOf\((.+?)\)/g, 'assert.ok($1 instanceof $2)');
  translate(/expect\((.+?)\)\.toHaveProperty\((.+?)\)/g, 'assert.ok($2 in $1)');
  translate(/expect\((.+?)\)\.toBeNull\(\)/g, 'assert.strictEqual($1, null)');
  translate(/expect\((.+?)\)\.toBeUndefined\(\)/g, 'assert.strictEqual($1, undefined)');
  translate(/expect\((.+?)\)\.toBeGreaterThan\((.+?)\)/g, 'assert.ok($1 > $2)');
  translate(/expect\((.+?)\)\.toBeLessThanOrEqual\((.+?)\)/g, 'assert.ok($1 <= $2)');
  translate(/expect\((.+?)\)\.toBeLessThan\((.+?)\)/g, 'assert.ok($1 < $2)');
  translate(/expect\((.+?)\)\.toMatch\((.+?)\)/g, 'assert.match($1, $2)');

  // Throws / Rejects
  // expect(() => ...).toThrow()
  content = content.replace(/expect\((\(\)\s*=>\s*[\s\S]+?)\)\.toThrow\((.*?)\)/g, 'assert.throws($1, $2)');
  // await expect(...).rejects.toThrow(...)
  content = content.replace(/await\s+expect\(([\s\S]+?)\)\.rejects\.toThrow\((.*?)\)/g, 'await assert.rejects(async () => { await $1; }, $2)');

  // 4. Mocks: .mockResolvedValue and .mockImplementation
  content = content.replace(/\.mockResolvedValue\((.+?)\)/g, '.mock.mockImplementation(() => Promise.resolve($1))');
  content = content.replace(/\.mockImplementation\((.+?)\)/g, '.mock.mockImplementation($1)');

  // 5. Cleanup artifacts
  content = content.replace(/^\s*;\s*$/gm, ''); 
  content = content.replace(/assert\.throws\(\(\)\s*=>\s*\(\)\s*=>/g, 'assert.throws(() =>');
  
  // Fix broken await assert.rejects from previous run
  content = content.replace(/await\s+assert\.rejects\(async\s+\(\)\s+=>\s+{\s+await\s+([\s\S]+?)\s+;\s+}\s+;\s+}\s+,\s+{(.+?)}\);/g, 'await assert.rejects(async () => { await $1; }, {$2});');

  // 6. ESM Fixes
  if (content.includes('__dirname') && !content.includes('import.meta.url')) {
    const esmHelpers = `import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);\n\n`;
    content = esmHelpers + content;
  }

  // 7. Add imports
  const newImport = `import { ${Array.from(methods).sort().join(', ')} } from 'node:test';\nimport assert from 'node:assert';\n`;
  content = newImport + content.trimStart();

  fs.writeFileSync(filePath, content);
}

testFiles.forEach(migrate);
console.log('Migration complete!');
