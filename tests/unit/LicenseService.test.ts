import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { LicenseService } from '../../src/core/LicenseService.js';
import fs from 'node:fs/promises';

describe('LicenseService', () => {
  let service: LicenseService;

  beforeEach(() => {
    service = new LicenseService();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('isValidFormat', () => {
    it('accepts valid PRO key', () => {
      assert.strictEqual(service.isValidFormat('KAVEN-PRO-ABCDEFGH-XY'), true);
    });
    it('accepts valid STARTER key', () => {
      assert.strictEqual(service.isValidFormat('KAVEN-STARTER-12345678-AB'), true);
    });
    it('rejects wrong prefix', () => {
      assert.strictEqual(service.isValidFormat('INVALID-PRO-ABCDEFGH-XY'), false);
    });
    it('rejects wrong segment length', () => {
      assert.strictEqual(service.isValidFormat('KAVEN-PRO-ABC-XY'), false);
    });
  });

  describe('tierLevel', () => {
    it('returns correct order', () => {
      assert.ok(service.tierLevel('STARTER') < service.tierLevel('COMPLETE'));
      assert.ok(service.tierLevel('COMPLETE') < service.tierLevel('PRO'));
      assert.ok(service.tierLevel('PRO') < service.tierLevel('ENTERPRISE'));
    });
  });

  describe('userHasRequiredTier', () => {
    it('returns true when tier matches', () => {
      assert.strictEqual(service.userHasRequiredTier('PRO', 'PRO'), true);
    });
    it('returns true when user has higher tier', () => {
      assert.strictEqual(service.userHasRequiredTier('ENTERPRISE', 'PRO'), true);
    });
    it('returns false when tier insufficient', () => {
      assert.strictEqual(service.userHasRequiredTier('STARTER', 'PRO'), false);
    });
  });

  describe('getCached', () => {
    it('returns null when no cache file', async () => {
      mock.method(fs, 'readFile', () => Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })));
      const result = await service.getCached('KAVEN-PRO-ABCDEFGH-XY');
      assert.strictEqual(result, null);
    });

    it('returns null when cache entry expired', async () => {
      const expired = {
        'KAVEN-PRO-ABCDEFGH-XY': {
          key: 'KAVEN-PRO-ABCDEFGH-XY',
          tier: 'PRO',
          expiresAt: null,
          validatedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        },
      };
      mock.method(fs, 'readFile', () => Promise.resolve(JSON.stringify(expired)));
      const result = await service.getCached('KAVEN-PRO-ABCDEFGH-XY');
      assert.strictEqual(result, null);
    });

    it('returns entry when cache valid', async () => {
      const valid = {
        'KAVEN-PRO-ABCDEFGH-XY': {
          key: 'KAVEN-PRO-ABCDEFGH-XY',
          tier: 'PRO',
          expiresAt: null,
          validatedAt: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        },
      };
      mock.method(fs, 'readFile', () => Promise.resolve(JSON.stringify(valid)));
      const result = await service.getCached('KAVEN-PRO-ABCDEFGH-XY');
      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.tier, 'PRO');
    });
  });

  describe('validateLicense', () => {
    it('uses cache when available', async () => {
      const validCache = {
        'KAVEN-PRO-ABCDEFGH-XY': {
          key: 'KAVEN-PRO-ABCDEFGH-XY',
          tier: 'PRO',
          expiresAt: null,
          validatedAt: Date.now(),
        },
      };
      mock.method(fs, 'readFile', () => Promise.resolve(JSON.stringify(validCache)));

      const result = await service.validateLicense('KAVEN-PRO-ABCDEFGH-XY', 'PRO');
      assert.strictEqual(result.source, 'cache');
    });

    it('throws on invalid format when no cache', async () => {
      mock.method(fs, 'readFile', () => Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })));
      await assert.rejects(async () => { await service.validateLicense('INVALID-KEY', 'PRO'); }, { message: 'Invalid license key format' });
    });
  });
});
