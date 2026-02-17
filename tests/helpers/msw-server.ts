import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { createTestJwt } from './jwt.js';

export const mockServer = setupServer(
  http.post('https://api.kaven.sh/auth/device-code', () =>
    HttpResponse.json({
      device_code: 'test-device-code',
      user_code: 'TEST-1234',
      verification_uri: 'https://auth.kaven.sh/activate',
      expires_in: 300,
      interval: 5,
    })
  ),

  http.post('https://api.kaven.sh/auth/token', () =>
    HttpResponse.json({
      access_token: createTestJwt({ email: 'test@kaven.sh', tier: 'COMPLETE' }),
      refresh_token: 'test-refresh-token',
      user: { email: 'test@kaven.sh', githubId: 'testuser', tier: 'COMPLETE' },
    })
  ),

  http.post('https://api.kaven.sh/auth/refresh', () =>
    HttpResponse.json({
      access_token: createTestJwt({ email: 'test@kaven.sh', tier: 'COMPLETE' }),
      refresh_token: 'new-refresh-token',
    })
  ),

  http.get('https://api.kaven.sh/modules', () =>
    HttpResponse.json({
      data: [
        { id: '1', slug: 'payments', name: 'Payments', version: '1.2.0', tier: 'COMPLETE', installCount: 2300, category: 'billing' },
        { id: '2', slug: 'notifications', name: 'Notifications', version: '1.1.0', tier: 'STARTER', installCount: 1800, category: 'communication' },
      ],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    })
  ),

  http.get('https://api.kaven.sh/modules/:slug', ({ params }) =>
    HttpResponse.json({
      id: '1', slug: params.slug, name: 'Test Module', version: '1.0.0', tier: 'STARTER', category: 'devtools',
    })
  ),

  http.post('https://api.kaven.sh/download-tokens', () =>
    HttpResponse.json({
      token: 'dl-test-token',
      artifactUrl: 'https://artifacts.kaven.sh/test.tar.gz',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    })
  ),

  http.post('https://api.kaven.sh/licenses/validate', () =>
    HttpResponse.json({ valid: true, tier: 'COMPLETE', expiresAt: null })
  ),

  http.get('https://api.kaven.sh/licenses/status', () =>
    HttpResponse.json({
      key: 'KAVEN-COMPLETE-ABCD1234-XY',
      tier: 'COMPLETE',
      expiresAt: null,
      daysUntilExpiry: null,
    })
  ),
);
