import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
      expect(result.get('DATABASE_URL')).toBe('postgres://localhost');
      expect(result.get('SECRET')).toBe('abc123');
    });

    it('ignores comment lines', () => {
      const result = manager.parseEnvFile('# This is a comment\nKEY=value\n');
      expect(result.has('# This is a comment')).toBe(false);
      expect(result.get('KEY')).toBe('value');
    });

    it('returns empty map for empty content', () => {
      expect(manager.parseEnvFile('').size).toBe(0);
    });
  });

  describe('buildMarkerBlock', () => {
    it('wraps vars with module markers', () => {
      const block = manager.buildMarkerBlock('payments', [
        { name: 'STRIPE_KEY', value: 'sk_test_xxx' },
        { name: 'STRIPE_SECRET', value: 'whsec_yyy' },
      ]);
      expect(block).toContain('# [KAVEN_MODULE:payments BEGIN]');
      expect(block).toContain('STRIPE_KEY=sk_test_xxx');
      expect(block).toContain('STRIPE_SECRET=whsec_yyy');
      expect(block).toContain('# [KAVEN_MODULE:payments END]');
    });
  });

  describe('appendToEnvFile', () => {
    it('creates file if not exists', () => {
      const filePath = path.join(tempDir, '.env');
      manager.appendToEnvFile(filePath, '', '# block');
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toContain('# block');
    });

    it('appends with newline separator', () => {
      const filePath = path.join(tempDir, '.env');
      manager.appendToEnvFile(filePath, 'EXISTING=1\n', 'NEW=2');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('EXISTING=1');
      expect(content).toContain('NEW=2');
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
      expect(removed).toBe(1);

      const after = fs.readFileSync(envPath, 'utf-8');
      expect(after).not.toContain('KAVEN_MODULE:payments');
      expect(after).not.toContain('STRIPE_KEY');
      expect(after).toContain('DATABASE_URL=postgres://localhost');
    });

    it('handles missing module markers gracefully', () => {
      const envPath = path.join(tempDir, '.env');
      fs.writeFileSync(envPath, 'DATABASE_URL=postgres://localhost\n');
      const removed = manager.removeEnvVars('payments', { projectDir: tempDir });
      expect(removed).toBe(0);
    });

    it('skips files that do not exist', () => {
      expect(() => manager.removeEnvVars('payments', { projectDir: tempDir })).not.toThrow();
    });
  });

  describe('injectEnvVars - skipEnv option', () => {
    it('returns zero counts when skipEnv is true', async () => {
      const result = await manager.injectEnvVars('payments', [
        { name: 'STRIPE_KEY', description: 'Stripe key', required: true },
      ], { projectDir: tempDir, skipEnv: true });

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('returns zero counts when env array is empty', async () => {
      const result = await manager.injectEnvVars('payments', [], { projectDir: tempDir });
      expect(result.added).toBe(0);
      expect(result.skipped).toBe(0);
    });
  });

  describe('injectEnvVars - existing vars', () => {
    it('skips var that already exists in .env', async () => {
      const envPath = path.join(tempDir, '.env');
      fs.writeFileSync(envPath, 'STRIPE_KEY=existing_value\n');

      // Mock readline to avoid waiting for input
      vi.spyOn(manager as any, 'promptInput').mockResolvedValue('new_value');
      vi.spyOn(manager as any, 'promptPassword').mockResolvedValue('secret');

      const result = await manager.injectEnvVars('payments', [
        { name: 'STRIPE_KEY', description: 'Stripe key' },
      ], { projectDir: tempDir });

      expect(result.skipped).toBe(1);
      expect(result.added).toBe(0);
    });
  });
});
