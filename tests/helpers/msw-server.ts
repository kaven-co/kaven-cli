import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { createTestJwt } from './jwt.js';

// Minimal valid tar.gz (empty archive) — avoids real file I/O in integration tests
const EMPTY_TARGZ = Buffer.from(
  '1f8b08000000000000030363606060606060000000000000ffff030000000000',
  'hex'
);

export const mockServer = setupServer(
  // ── Auth ────────────────────────────────────────────────────────────────
  http.post('https://marketplace.kaven.site/auth/device-code', () =>
    HttpResponse.json({
      device_code: 'test-device-code',
      user_code: 'TEST-1234',
      verification_uri: 'https://auth.kaven.sh/activate',
      expires_in: 300,
      interval: 5,
    })
  ),

  http.post('https://marketplace.kaven.site/auth/token', () =>
    HttpResponse.json({
      access_token: createTestJwt({ email: 'test@kaven.sh', tier: 'COMPLETE' }),
      refresh_token: 'test-refresh-token',
      user: { email: 'test@kaven.sh', githubId: 'testuser', tier: 'COMPLETE' },
    })
  ),

  http.post('https://marketplace.kaven.site/auth/refresh', () =>
    HttpResponse.json({
      access_token: createTestJwt({ email: 'test@kaven.sh', tier: 'COMPLETE' }),
      refresh_token: 'new-refresh-token',
    })
  ),

  // ── Module listing ───────────────────────────────────────────────────────
  http.get('https://marketplace.kaven.site/modules', () =>
    HttpResponse.json({
      data: [
        {
          id: '1', slug: 'payments', name: 'Payments', latestVersion: '1.0.2',
          tier: 'COMPLETE', installCount: 2300, category: 'billing',
          description: 'Stripe payment integration', author: 'kaven',
          createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          id: '2', slug: 'notifications', name: 'Notifications', latestVersion: '1.1.0',
          tier: 'STARTER', installCount: 1800, category: 'communication',
          description: 'Push + email notifications', author: 'kaven',
          createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
      total: 2, page: 1, pageSize: 20,
    })
  ),

  // ── Single module (with latestVersion for install + update) ─────────────
  http.get('https://marketplace.kaven.site/modules/:slug', ({ params }) =>
    HttpResponse.json({
      id: '1',
      slug: params.slug,
      name: 'Payments',
      description: 'Stripe payment integration',
      category: 'billing',
      tier: 'COMPLETE',
      requiredTier: 'COMPLETE',
      latestVersion: '1.0.2',
      author: 'kaven',
      installCount: 2300,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
  ),

  // ── Release info (used by verifyDownload in install + update) ───────────
  http.get('https://marketplace.kaven.site/modules/:slug/versions/:version', ({ params }) =>
    HttpResponse.json({
      id: 'rel-1',
      moduleId: 'mod-1',
      version: params.version,
      changelog: 'Local test release',
      installCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
      // no checksum/signature/publicKey → skipVerify branch (safe fallback)
    })
  ),

  // ── Download token ───────────────────────────────────────────────────────
  http.post('https://marketplace.kaven.site/download-tokens', ({ request: _req }) =>
    HttpResponse.json({
      token: 'dl-test-token',
      downloadUrl: '/modules/payments/1.0.2/download',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    })
  ),

  // ── Actual file download (resolveUrl expands to full URL) ────────────────
  http.get('https://marketplace.kaven.site/modules/:slug/:version/download', () =>
    new HttpResponse(EMPTY_TARGZ, {
      status: 200,
      headers: { 'content-type': 'application/gzip', 'content-length': String(EMPTY_TARGZ.length) },
    })
  ),

  // ── Categories ───────────────────────────────────────────────────────────
  http.get('https://marketplace.kaven.site/categories', () =>
    HttpResponse.json(['auth', 'billing', 'notifications', 'devtools'])
  ),

  // ── Licenses ─────────────────────────────────────────────────────────────
  http.post('https://marketplace.kaven.site/licenses/validate', () =>
    HttpResponse.json({ valid: true, tier: 'COMPLETE', expiresAt: null })
  ),

  http.get('https://marketplace.kaven.site/licenses/status', () =>
    HttpResponse.json({
      key: 'KAVEN-COMPLETE-ABCD1234-XY',
      tier: 'COMPLETE',
      expiresAt: null,
      daysUntilExpiry: null,
    })
  ),
);
