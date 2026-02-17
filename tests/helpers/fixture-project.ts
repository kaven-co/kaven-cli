import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function createFixtureProject(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaven-test-'));

  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'test-project', dependencies: {} }),
    '.env': 'DATABASE_URL=postgresql://localhost:5432/test\n',
    'prisma/schema.prisma': [
      'generator client { provider = "prisma-client-js" }',
      'datasource db { provider = "postgresql" url = env("DATABASE_URL") }',
      '// [KAVEN_MODULE_SCHEMA]',
    ].join('\n'),
    'src/api/routes/index.ts': [
      '// Routes',
      '// [KAVEN_MODULE:routes BEGIN]',
      '// [KAVEN_MODULE:routes END]',
    ].join('\n'),
  };

  for (const [file, content] of Object.entries(files)) {
    const filePath = path.join(dir, file);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }

  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
