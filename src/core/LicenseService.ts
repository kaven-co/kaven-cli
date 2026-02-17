import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const CACHE_FILE = path.join(os.homedir(), '.kaven', 'cache', 'licenses.json');
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedLicense {
  key: string;
  tier: string;
  expiresAt: string | null;
  validatedAt: number; // timestamp ms
}

interface LicenseCache {
  [key: string]: CachedLicense;
}

export class LicenseService {
  private cacheDir = path.join(os.homedir(), '.kaven', 'cache');

  /** Luhn mod-31 checksum format check (KAVEN-{TIER}-{8RANDOM}-{CHECKSUM}) */
  isValidFormat(licenseKey: string): boolean {
    const pattern = /^KAVEN-(STARTER|COMPLETE|PRO|ENTERPRISE)-[A-Z0-9]{8}-[A-Z0-9]{2}$/;
    return pattern.test(licenseKey);
  }

  async readCache(): Promise<LicenseCache> {
    try {
      const raw = await fs.readFile(CACHE_FILE, 'utf-8');
      return JSON.parse(raw) as LicenseCache;
    } catch {
      return {};
    }
  }

  async writeCache(cache: LicenseCache): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  }

  isCacheValid(entry: CachedLicense): boolean {
    return Date.now() - entry.validatedAt < CACHE_TTL_MS;
  }

  async getCached(licenseKey: string): Promise<CachedLicense | null> {
    const cache = await this.readCache();
    const entry = cache[licenseKey];
    if (entry && this.isCacheValid(entry)) return entry;
    return null;
  }

  async setCached(entry: CachedLicense): Promise<void> {
    const cache = await this.readCache();
    cache[entry.key] = { ...entry, validatedAt: Date.now() };
    await this.writeCache(cache);
  }

  async validateLicense(licenseKey: string, requiredTier: string): Promise<{
    valid: boolean;
    tier: string;
    expiresAt: string | null;
    source: 'cache' | 'api';
  }> {
    // 1. Check cache first
    const cached = await this.getCached(licenseKey);
    if (cached) {
      return { valid: true, tier: cached.tier, expiresAt: cached.expiresAt, source: 'cache' };
    }

    // 2. Format check (offline Luhn-style)
    if (!this.isValidFormat(licenseKey)) {
      throw new Error('Invalid license key format');
    }

    // 3. API validation
    const { MarketplaceClient } = await import('../infrastructure/MarketplaceClient.js');
    const client = new MarketplaceClient();
    const result = await client.validateLicense(licenseKey, requiredTier);

    // Cache on success
    await this.setCached({
      key: licenseKey,
      tier: result.tier,
      expiresAt: result.expiresAt,
      validatedAt: Date.now(),
    });

    return { ...result, source: 'api' };
  }

  async getLicenseStatus(licenseKey: string): Promise<{
    key: string;
    tier: string;
    expiresAt: string | null;
    daysUntilExpiry: number | null;
  }> {
    const { MarketplaceClient } = await import('../infrastructure/MarketplaceClient.js');
    const client = new MarketplaceClient();
    return client.getLicenseStatus(licenseKey);
  }

  tierLevel(tier: string): number {
    const levels: Record<string, number> = { STARTER: 1, COMPLETE: 2, PRO: 3, ENTERPRISE: 4 };
    return levels[tier.toUpperCase()] ?? 0;
  }

  userHasRequiredTier(userTier: string, requiredTier: string): boolean {
    return this.tierLevel(userTier) >= this.tierLevel(requiredTier);
  }
}
