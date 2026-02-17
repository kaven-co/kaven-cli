import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LicenseService } from '../../src/core/LicenseService.js';
import fs from 'fs/promises';

vi.mock('fs/promises');
vi.mock('../../src/infrastructure/MarketplaceClient.js', () => ({
  MarketplaceClient: vi.fn().mockImplementation(() => ({
    validateLicense: vi.fn().mockResolvedValue({ valid: true, tier: 'PRO', expiresAt: null }),
    getLicenseStatus: vi.fn().mockResolvedValue({ key: 'KAVEN-PRO-ABCDEFGH-XY', tier: 'PRO', expiresAt: null, daysUntilExpiry: null }),
  })),
}));

describe('LicenseService', () => {
  let service: LicenseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LicenseService();
  });

  describe('isValidFormat', () => {
    it('accepts valid PRO key', () => {
      expect(service.isValidFormat('KAVEN-PRO-ABCDEFGH-XY')).toBe(true);
    });
    it('accepts valid STARTER key', () => {
      expect(service.isValidFormat('KAVEN-STARTER-12345678-AB')).toBe(true);
    });
    it('rejects wrong prefix', () => {
      expect(service.isValidFormat('INVALID-PRO-ABCDEFGH-XY')).toBe(false);
    });
    it('rejects wrong segment length', () => {
      expect(service.isValidFormat('KAVEN-PRO-ABC-XY')).toBe(false);
    });
  });

  describe('tierLevel', () => {
    it('returns correct order', () => {
      expect(service.tierLevel('STARTER')).toBeLessThan(service.tierLevel('COMPLETE'));
      expect(service.tierLevel('COMPLETE')).toBeLessThan(service.tierLevel('PRO'));
      expect(service.tierLevel('PRO')).toBeLessThan(service.tierLevel('ENTERPRISE'));
    });
  });

  describe('userHasRequiredTier', () => {
    it('returns true when tier matches', () => {
      expect(service.userHasRequiredTier('PRO', 'PRO')).toBe(true);
    });
    it('returns true when user has higher tier', () => {
      expect(service.userHasRequiredTier('ENTERPRISE', 'PRO')).toBe(true);
    });
    it('returns false when tier insufficient', () => {
      expect(service.userHasRequiredTier('STARTER', 'PRO')).toBe(false);
    });
  });

  describe('getCached', () => {
    it('returns null when no cache file', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      const result = await service.getCached('KAVEN-PRO-ABCDEFGH-XY');
      expect(result).toBeNull();
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
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(expired) as any);
      const result = await service.getCached('KAVEN-PRO-ABCDEFGH-XY');
      expect(result).toBeNull();
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
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(valid) as any);
      const result = await service.getCached('KAVEN-PRO-ABCDEFGH-XY');
      expect(result).not.toBeNull();
      expect(result?.tier).toBe('PRO');
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
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validCache) as any);

      const result = await service.validateLicense('KAVEN-PRO-ABCDEFGH-XY', 'PRO');
      expect(result.source).toBe('cache');
    });

    it('throws on invalid format when no cache', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      await expect(service.validateLicense('INVALID-KEY', 'PRO')).rejects.toThrow('Invalid license key format');
    });
  });
});
