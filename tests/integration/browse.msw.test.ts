import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mockServer } from '../helpers/msw-server.js';
import { MarketplaceClient } from '../../src/infrastructure/MarketplaceClient.js';

beforeAll(() => mockServer.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

describe('marketplace browse (MSW integration)', () => {
  it('fetches categories successfully', async () => {
    mockServer.use(
      http.get('https://api.kaven.sh/modules/categories', () =>
        HttpResponse.json({ categories: ['auth', 'billing', 'notifications', 'devtools'] })
      )
    );

    const client = new MarketplaceClient();
    const categories = await client.getCategories();

    expect(categories).toBeInstanceOf(Array);
    expect(categories).toContain('auth');
    expect(categories).toContain('billing');
  });

  it('returns empty categories gracefully', async () => {
    mockServer.use(
      http.get('https://api.kaven.sh/modules/categories', () =>
        HttpResponse.json({ categories: [] })
      )
    );

    const client = new MarketplaceClient();
    const categories = await client.getCategories();
    expect(categories).toHaveLength(0);
  });

  it('fetches module list for a category', async () => {
    const client = new MarketplaceClient();
    const result = await client.listModules({ category: 'billing' });

    expect(result.data).toBeInstanceOf(Array);
    expect(result.data.length).toBeGreaterThanOrEqual(0);
  });

  it('fetches paginated module listing', async () => {
    mockServer.use(
      http.get('https://api.kaven.sh/modules', () =>
        HttpResponse.json({
          data: [
            { id: '1', slug: 'auth', name: 'Auth', tier: 'STARTER', description: 'Auth module', category: 'auth', installCount: 500, latestVersion: '1.0.0', author: 'kaven', createdAt: '', updatedAt: '' },
            { id: '2', slug: 'payments', name: 'Payments', tier: 'COMPLETE', description: 'Payments', category: 'billing', installCount: 2300, latestVersion: '2.0.0', author: 'kaven', createdAt: '', updatedAt: '' },
          ],
          total: 2,
          page: 1,
          pageSize: 10,
        })
      )
    );

    const client = new MarketplaceClient();
    const result = await client.listModules({ page: 1, pageSize: 10 });

    expect(result.data).toHaveLength(2);
    expect(result.data[0].slug).toBe('auth');
    expect(result.data[1].slug).toBe('payments');
    expect(result.total).toBe(2);
  });

  it('getModule returns module details', async () => {
    const client = new MarketplaceClient();
    const module = await client.getModule('payments');

    expect(module).toBeDefined();
    expect(module.slug).toBe('payments');
  });

  it('throws error on categories auth failure (401)', async () => {
    mockServer.use(
      http.get('https://api.kaven.sh/modules/categories', () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
      )
    );

    const client = new MarketplaceClient();
    // 401 is not retried, throws immediately
    await expect(client.getCategories()).rejects.toThrow();
  });
});
