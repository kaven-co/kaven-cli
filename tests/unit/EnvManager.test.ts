import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { EnvManager } from '../../src/core/EnvManager.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('EnvManager', () => {
  let manager: EnvManager;
  let tempDir: string;

  beforeEach(() => {
    manager = new EnvManager();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaven-env-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('parseEnvFile', () => {
    it('parses KEY=VALUE pairs', () => {
      const result = manager.parseEnvFile('DATABASE_URL=postgres://localhost\nSECRET=abc123\n');
      assert.strictEqual(result.get('DATABASE_URL'), 'postgres://localhost');
      assert.strictEqual(result.get('SECRET'), 'abc123');
    });

    it('ignores comment lines', () => {
      const result = manager.parseEnvFile('# This is a comment\nKEY=value\n');
      assert.strictEqual(result.has('# This is a comment'), false);
      assert.strictEqual(result.get('KEY'), 'value');
    });

    it('returns empty map for empty content', () => {
      assert.strictEqual(manager.parseEnvFile('').size, 0);
    });
  });

  describe('buildMarkerBlock', () => {
    it('wraps vars with module markers', () => {
      const block = manager.buildMarkerBlock('payments', [
        { name: 'STRIPE_KEY', value: 'sk_test_xxx' },
        { name: 'STRIPE_SECRET', value: 'whsec_yyy' },
      ]);
      assert.ok(block.includes('# [KAVEN_MODULE:payments BEGIN]'));
      assert.ok(block.includes('STRIPE_KEY=sk_test_xxx'));
      assert.ok(block.includes('STRIPE_SECRET=whsec_yyy'));
      assert.ok(block.includes('# [KAVEN_MODULE:payments END]'));
    });
  });

  describe('appendToEnvFile', () => {
    it('creates file if not exists', () => {
      const filePath = path.join(tempDir, '.env');
      manager.appendToEnvFile(filePath, '', '# block');
      assert.strictEqual(fs.existsSync(filePath), true);
      assert.ok(fs.readFileSync(filePath, 'utf-8').includes('# block'));
    });

    it('appends with newline separator', () => {
      const filePath = path.join(tempDir, '.env');
      manager.appendToEnvFile(filePath, 'EXISTING=1\n', 'NEW=2');
      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('EXISTING=1'));
      assert.ok(content.includes('NEW=2'));
    });
  });

  describe('removeEnvVars', () => {
    it('removes marker block from .env', () => {
      const envPath = path.join(tempDir, '.env');
      fs.writeFileSync(envPath, [
        'DATABASE_URL=postgres://localhost',
        '',
        '# [KAVEN_MODULE:payments BEGIN]',
        'STRIPE_KEY=sk_test_xxx',
        '# [KAVEN_MODULE:payments END]',
        '',
      ].join('\n'));

      const removed = manager.removeEnvVars('payments', { projectDir: tempDir });
      assert.strictEqual(removed, 1);

      const after = fs.readFileSync(envPath, 'utf-8');
      assert.strictEqual(after.includes('KAVEN_MODULE:payments'), false);
      assert.strictEqual(after.includes('STRIPE_KEY'), false);
      assert.ok(after.includes('DATABASE_URL=postgres://localhost'));
    });

    it('handles missing module markers gracefully', () => {
      const envPath = path.join(tempDir, '.env');
      fs.writeFileSync(envPath, 'DATABASE_URL=postgres://localhost\n');
      const removed = manager.removeEnvVars('payments', { projectDir: tempDir });
      assert.strictEqual(removed, 0);
    });

    it('skips files that do not exist', () => {
      assert.doesNotThrow(() => manager.removeEnvVars('payments', { projectDir: tempDir }));
    });
  });

  describe('injectEnvVars - skipEnv option', () => {
    it('returns zero counts when skipEnv is true', async () => {
      const result = await manager.injectEnvVars('payments', [
        { name: 'STRIPE_KEY', description: 'Stripe key', required: true },
      ], { projectDir: tempDir, skipEnv: true });

      assert.strictEqual(result.added, 0);
      assert.strictEqual(result.skipped, 0);
    });

    it('returns zero counts when env array is empty', async () => {
      const result = await manager.injectEnvVars('payments', [], { projectDir: tempDir });
      assert.strictEqual(result.added, 0);
      assert.strictEqual(result.skipped, 0);
    });
  });

  describe('injectEnvVars - existing vars', () => {
    it('skips var that already exists in .env', async () => {
      const envPath = path.join(tempDir, '.env');
      fs.writeFileSync(envPath, 'STRIPE_KEY=existing_value\n');

      // Mock readline to avoid waiting for input
      mock.method(manager as any, 'promptInput', () => Promise.resolve('new_value'));
      mock.method(manager as any, 'promptPassword', () => Promise.resolve('secret'));

      const result = await manager.injectEnvVars('payments', [
        { name: 'STRIPE_KEY', description: 'Stripe key' },
      ], { projectDir: tempDir });

      assert.strictEqual(result.skipped, 1);
      assert.strictEqual(result.added, 0);
    });
  });
});
