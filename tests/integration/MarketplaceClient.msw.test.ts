import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mockServer } from '../helpers/msw-server.js';
import { MarketplaceClient } from '../../src/infrastructure/MarketplaceClient.js';
import { AuthenticationError, RateLimitError, NotFoundError } from '../../src/infrastructure/errors.js';

beforeAll(() => mockServer.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

describe('MarketplaceClient (HTTP via MSW)', () => {
  it('fetches modules list successfully', async () => {
    const client = new MarketplaceClient();
    const result = await client.listModules();
    expect(result.data).toHaveLength(2);
    expect(result.data[0].slug).toBe('payments');
  });

  it('throws AuthenticationError on 401', async () => {
    mockServer.use(
      http.get('https://api.kaven.sh/modules', () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
      )
    );
    const client = new MarketplaceClient();
    await expect(client.listModules()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws NotFoundError on 404', async () => {
    mockServer.use(
      http.get('https://api.kaven.sh/modules/:slug', () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 })
      )
    );
    const client = new MarketplaceClient();
    await expect(client.getModule('nonexistent')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws RateLimitError on 429', async () => {
    mockServer.use(
      http.get('https://api.kaven.sh/modules', () =>
        HttpResponse.json({ message: 'Too Many Requests', retryAfter: 60 }, { status: 429 })
      )
    );
    const client = new MarketplaceClient();
    await expect(client.listModules()).rejects.toBeInstanceOf(RateLimitError);
  });

  it('retries on 500 and succeeds', async () => {
    let callCount = 0;
    mockServer.use(
      http.get('https://api.kaven.sh/modules', () => {
        callCount++;
        if (callCount < 3) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json({
          data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });
      })
    );
    const client = new MarketplaceClient();
    const result = await client.listModules();
    expect(result.data).toHaveLength(0);
    expect(callCount).toBeGreaterThanOrEqual(2);
  }, 30000);

  it('validates license via API', async () => {
    const client = new MarketplaceClient();
    const result = await client.validateLicense('KAVEN-COMPLETE-ABCD1234-XY', 'COMPLETE');
    expect(result.valid).toBe(true);
    expect(result.tier).toBe('COMPLETE');
  });
});
