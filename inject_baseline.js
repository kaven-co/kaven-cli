const fs = require('fs');
const path = require('path');
const installPath = path.join(__dirname, 'src/commands/marketplace/install.ts');
let content = fs.readFileSync(installPath, 'utf8');
const baselineFunc = `async function cacheBaseline(slug: string, version: string, extractedPath: string, projectRoot: string) {
  const KAVEN_CACHE_DIR = path.join(projectRoot, '.kaven', 'cache', 'modules');
  const cachePath = path.join(KAVEN_CACHE_DIR, \`${slug}-${version}\`);
  await fs.ensureDir(cachePath);
  await fs.copy(extractedPath, cachePath);
}
`;
content = content.replace('export async function marketplaceInstall', baselineFunc + '
export async function marketplaceInstall');
const callReplacement = `// 8.5 Save Baseline Cache
    spinner.text = \`Caching baseline for \${slug} v\${installVersion}...\`;
    await cacheBaseline(slug, installVersion, extractDir, projectRoot);

    // 9. Delegate to ModuleInstaller`;
content = content.replace('// 9. Delegate to ModuleInstaller', callReplacement);
fs.writeFileSync(installPath, content);
