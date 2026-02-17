import { spawn } from 'child_process';
import readline from 'readline';
import chalk from 'chalk';

export interface ScriptDefinition {
  command: string;
  args?: string[];
  cwd: string;
  timeout?: number; // ms, default 60000
}

export class ScriptRunner {
  private timeoutMs: number;

  constructor(timeoutMs = 60_000) {
    this.timeoutMs = timeoutMs;
  }

  async runScript(
    script: ScriptDefinition,
    label: string,
    skipConfirmation = false
  ): Promise<void> {
    if (!skipConfirmation) {
      const confirmed = await this.confirm(
        `Run ${label} script: ${script.command} ${(script.args ?? []).join(' ')}?`
      );
      if (!confirmed) {
        console.log(chalk.dim(`  Skipping ${label} script.`));
        return;
      }
    }

    return new Promise<void>((resolve, reject) => {
      const child = spawn(script.command, script.args ?? [], {
        cwd: script.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      const prefix = chalk.dim(`[${label}] `);

      child.stdout?.on('data', (data: Buffer) => {
        process.stdout.write(prefix + data.toString());
      });

      child.stderr?.on('data', (data: Buffer) => {
        process.stderr.write(prefix + chalk.yellow(data.toString()));
      });

      const timer = setTimeout(() => {
        console.warn(chalk.yellow(`\n  ⚠ ${label} script timed out after ${this.timeoutMs / 1000}s, sending SIGTERM...`));
        child.kill('SIGTERM');
        setTimeout(() => {
          child.kill('SIGKILL');
        }, 5_000);
      }, this.timeoutMs);

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 || code === null) {
          resolve();
        } else {
          reject(new Error(`${label} script exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async runScripts(
    scripts: ScriptDefinition[],
    label: string,
    skipConfirmation = false
  ): Promise<void> {
    for (const script of scripts) {
      await this.runScript(script, label, skipConfirmation);
    }
  }

  private confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(`\n  ${message} [y/N] `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }
}
