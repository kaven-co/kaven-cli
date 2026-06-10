import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert';
import { http, HttpResponse } from 'msw';
import { mockServer } from '../helpers/msw-server.js';
import { MarketplaceClient } from '../../src/infrastructure/MarketplaceClient.js';
import { AuthenticationError, RateLimitError, NotFoundError } from '../../src/infrastructure/errors.js';

before(() => mockServer.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => mockServer.resetHandlers());
after(() => mockServer.close());

describe('MarketplaceClient (HTTP via MSW)', () => {
  it('fetches modules list successfully', async () => {
    const client = new MarketplaceClient();
    const result = await client.listModules();
    assert.strictEqual(result.data.length, 2);
    assert.strictEqual(result.data[0].slug, 'payments');
  });

  it('throws AuthenticationError on 401', async () => {
    mockServer.use(
      http.get('https://marketplace.kaven.site/modules', () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
      )
    );
    const client = new MarketplaceClient();
    await assert.rejects(async () => { await client.listModules(); }, AuthenticationError);
  });

  it('throws NotFoundError on 404', async () => {
    mockServer.use(
      http.get('https://marketplace.kaven.site/modules/:slug', () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 })
      )
    );
    const client = new MarketplaceClient();
    await assert.rejects(async () => { await client.getModule('nonexistent'); }, NotFoundError);
  });

  it('throws RateLimitError on 429', async () => {
    mockServer.use(
      http.get('https://marketplace.kaven.site/modules', () =>
        HttpResponse.json({ message: 'Too Many Requests', retryAfter: 60 }, { status: 429 })
      )
    );
    const client = new MarketplaceClient();
    await assert.rejects(async () => { await client.listModules(); }, RateLimitError);
  });

  it('retries on 500 and succeeds', async () => {
    let callCount = 0;
    mockServer.use(
      http.get('https://marketplace.kaven.site/modules', () => {
        callCount++;
        if (callCount < 3) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json({
          data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });
      })
    );
    const client = new MarketplaceClient();
    const result = await client.listModules();
    assert.strictEqual(result.data.length, 0);
    assert.ok(callCount >= 2);
  }, 30000);

  it('validates license via API', async () => {
    const client = new MarketplaceClient();
    const result = await client.validateLicense('KAVEN-COMPLETE-ABCD1234-XY', 'COMPLETE');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.tier, 'COMPLETE');
  });
});
