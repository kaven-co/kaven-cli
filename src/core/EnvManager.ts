import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import chalk from 'chalk';

export interface EnvVarDefinition {
  name: string;
  description: string;
  default?: string;
  sensitive?: boolean;
  required?: boolean;
}

export interface EnvManagerOptions {
  projectDir: string;
  envFile?: string;
  skipEnv?: boolean;
  skipConfirmation?: boolean;
}

export class EnvManager {
  async injectEnvVars(
    moduleSlug: string,
    envVars: EnvVarDefinition[],
    options: EnvManagerOptions
  ): Promise<{ added: number; skipped: number }> {
    if (options.skipEnv || !envVars || envVars.length === 0) {
      return { added: 0, skipped: 0 };
    }

    const envFilePath = path.join(options.projectDir, options.envFile ?? '.env');
    const existingContent = this.readEnvFile(envFilePath);
    const existingVars = this.parseEnvFile(existingContent);

    const newVars: Array<{ name: string; value: string }> = [];
    let skipped = 0;

    console.log(chalk.bold(`\n  Environment variables for '${moduleSlug}':\n`));

    for (const envDef of envVars) {
      if (existingVars.has(envDef.name)) {
        console.log(chalk.dim(`  ${envDef.name} — already set, skipping`));
        skipped++;
        continue;
      }

      let value: string;

      if (envDef.sensitive) {
        value = await this.promptPassword(
          `  ${envDef.name} (${envDef.description})${envDef.default ? ' [****]' : ''}: `
        );
        if (!value && envDef.default) value = envDef.default;
      } else {
        const defaultHint = envDef.default ? ` [${envDef.default}]` : '';
        value = await this.promptInput(
          `  ${envDef.name} (${envDef.description})${defaultHint}: `,
          envDef.default
        );
      }

      if (envDef.required && !value) {
        console.log(chalk.yellow(`  ${envDef.name} is required.`));
        value = envDef.sensitive
          ? await this.promptPassword(`  ${envDef.name}: `)
          : await this.promptInput(`  ${envDef.name}: `);

        if (!value) {
          console.log(chalk.yellow(`  Skipping ${envDef.name} — set it manually in .env`));
          skipped++;
          continue;
        }
      }

      newVars.push({ name: envDef.name, value });
    }

    if (newVars.length === 0) {
      console.log(chalk.dim('  No new environment variables to add.'));
      return { added: 0, skipped };
    }

    const markerBlock = this.buildMarkerBlock(moduleSlug, newVars);
    this.appendToEnvFile(envFilePath, existingContent, markerBlock);

    console.log(
      chalk.green(`\n  Added ${newVars.length} environment variable(s) to ${options.envFile ?? '.env'}`)
    );

    return { added: newVars.length, skipped };
  }

  removeEnvVars(moduleSlug: string, options: EnvManagerOptions): number {
    const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];
    if (options.envFile) envFiles.unshift(options.envFile);

    let totalRemoved = 0;

    for (const envFile of envFiles) {
      const envFilePath = path.join(options.projectDir, envFile);
      if (!fs.existsSync(envFilePath)) continue;

      const content = fs.readFileSync(envFilePath, 'utf-8');
      const beginMarker = `# [KAVEN_MODULE:${moduleSlug} BEGIN]`;
      const endMarker = `# [KAVEN_MODULE:${moduleSlug} END]`;

      const beginIdx = content.indexOf(beginMarker);
      const endIdx = content.indexOf(endMarker);
      if (beginIdx === -1 || endIdx === -1) continue;

      const block = content.substring(beginIdx, endIdx + endMarker.length);
      const varCount = block.split('\n').filter(l => /^[A-Z_]+=/.test(l)).length;

      const before = content.substring(0, beginIdx).replace(/\n+$/, '\n');
      const after = content.substring(endIdx + endMarker.length + 1);
      fs.writeFileSync(envFilePath, before + after);

      totalRemoved += varCount;
      if (varCount > 0) {
        console.log(chalk.dim(`  Removed ${varCount} env var(s) from ${envFile}`));
      }
    }

    return totalRemoved;
  }

  readEnvFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return '';
    }
  }

  parseEnvFile(content: string): Map<string, string> {
    const vars = new Map<string, string>();
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match) vars.set(match[1], match[2]);
    }
    return vars;
  }

  buildMarkerBlock(moduleSlug: string, vars: Array<{ name: string; value: string }>): string {
    return [
      `# [KAVEN_MODULE:${moduleSlug} BEGIN]`,
      ...vars.map(v => `${v.name}=${v.value}`),
      `# [KAVEN_MODULE:${moduleSlug} END]`,
    ].join('\n');
  }

  appendToEnvFile(filePath: string, existingContent: string, block: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const separator = existingContent.endsWith('\n') || existingContent === '' ? '\n' : '\n\n';
    fs.writeFileSync(filePath, existingContent + separator + block + '\n');
  }

  private promptInput(message: string, defaultValue?: string): Promise<string> {
    return new Promise(resolve => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(message, answer => {
        rl.close();
        resolve(answer || defaultValue || '');
      });
    });
  }

  private promptPassword(message: string): Promise<string> {
    return new Promise(resolve => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      // Hide input by listening to keypress but readline doesn't natively support this
      // For simplicity, use standard prompt (production would use a proper password lib)
      process.stdout.write(message);
      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      let password = '';
      const handler = (key: Buffer) => {
        const char = key.toString();
        if (char === '\r' || char === '\n') {
          process.stdin.setRawMode?.(false);
          process.stdin.pause();
          process.stdin.removeListener('data', handler);
          process.stdout.write('\n');
          rl.close();
          resolve(password);
        } else if (char === '\u0003') {
          process.exit();
        } else if (char === '\u007f') {
          password = password.slice(0, -1);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(message + '*'.repeat(password.length));
        } else {
          password += char;
          process.stdout.write('*');
        }
      };
      process.stdin.on('data', handler);
    });
  }
}
