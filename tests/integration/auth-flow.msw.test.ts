import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert';
import { http, HttpResponse } from 'msw';
import { mockServer } from '../helpers/msw-server.js';
import { MarketplaceClient } from '../../src/infrastructure/MarketplaceClient.js';

before(() => mockServer.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => mockServer.resetHandlers());
after(() => mockServer.close());

describe('Auth Flow (MSW)', () => {
  it('requests device code successfully', async () => {
    const client = new MarketplaceClient();
    const result = await client.requestDeviceCode();
    assert.strictEqual(result.device_code, 'test-device-code');
    assert.strictEqual(result.user_code, 'TEST-1234');
    assert.strictEqual(result.interval, 5);
  });

  it('polls for token and returns success status with tokens', async () => {
    const client = new MarketplaceClient();
    const result = await client.pollDeviceToken('test-device-code');
    assert.strictEqual(result.status, 'success');
    if (result.status === 'success') {
      assert.ok(result.tokens !== undefined);
      assert.ok(result.tokens.access_token !== undefined);
      assert.strictEqual(result.tokens.refresh_token, 'test-refresh-token');
    }
  });

  it('returns authorization_pending status during poll', async () => {
    mockServer.use(
      http.post('https://marketplace.kaven.site/auth/token', () =>
        HttpResponse.json({ error: 'authorization_pending' }, { status: 400 })
      )
    );
    const client = new MarketplaceClient();
    const result = await client.pollDeviceToken('test-device-code');
    assert.strictEqual(result.status, 'authorization_pending');
  });

  it('returns access_denied status when user denies', async () => {
    mockServer.use(
      http.post('https://marketplace.kaven.site/auth/token', () =>
        HttpResponse.json({ error: 'access_denied' }, { status: 400 })
      )
    );
    const client = new MarketplaceClient();
    const result = await client.pollDeviceToken('test-device-code');
    assert.strictEqual(result.status, 'access_denied');
  });

  it('returns expired_token status when token expires', async () => {
    mockServer.use(
      http.post('https://marketplace.kaven.site/auth/token', () =>
        HttpResponse.json({ error: 'expired_token' }, { status: 400 })
      )
    );
    const client = new MarketplaceClient();
    const result = await client.pollDeviceToken('test-device-code');
    assert.strictEqual(result.status, 'expired_token');
  });

  it('throws on unexpected error from server', async () => {
    mockServer.use(
      http.post('https://marketplace.kaven.site/auth/token', () =>
        HttpResponse.json({ error: 'server_exploded' }, { status: 400 })
      )
    );
    const client = new MarketplaceClient();
    await assert.rejects(async () => { await client.pollDeviceToken('test-device-code'); }, { message: /Unexpected error/i });
  });
});
