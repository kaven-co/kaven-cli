import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mockServer } from '../helpers/msw-server.js';
import { MarketplaceClient } from '../../src/infrastructure/MarketplaceClient.js';

beforeAll(() => mockServer.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

describe('Auth Flow (MSW)', () => {
  it('requests device code successfully', async () => {
    const client = new MarketplaceClient();
    const result = await client.requestDeviceCode();
    expect(result.device_code).toBe('test-device-code');
    expect(result.user_code).toBe('TEST-1234');
    expect(result.interval).toBe(5);
  });

  it('polls for token and returns success status with tokens', async () => {
    const client = new MarketplaceClient();
    const result = await client.pollDeviceToken('test-device-code');
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.tokens).toBeDefined();
      expect(result.tokens.access_token).toBeDefined();
      expect(result.tokens.refresh_token).toBe('test-refresh-token');
    }
  });

  it('returns authorization_pending status during poll', async () => {
    mockServer.use(
      http.post('https://api.kaven.sh/auth/token', () =>
        HttpResponse.json({ error: 'authorization_pending' }, { status: 400 })
      )
    );
    const client = new MarketplaceClient();
    const result = await client.pollDeviceToken('test-device-code');
    expect(result.status).toBe('authorization_pending');
  });

  it('returns access_denied status when user denies', async () => {
    mockServer.use(
      http.post('https://api.kaven.sh/auth/token', () =>
        HttpResponse.json({ error: 'access_denied' }, { status: 400 })
      )
    );
    const client = new MarketplaceClient();
    const result = await client.pollDeviceToken('test-device-code');
    expect(result.status).toBe('access_denied');
  });

  it('returns expired_token status when token expires', async () => {
    mockServer.use(
      http.post('https://api.kaven.sh/auth/token', () =>
        HttpResponse.json({ error: 'expired_token' }, { status: 400 })
      )
    );
    const client = new MarketplaceClient();
    const result = await client.pollDeviceToken('test-device-code');
    expect(result.status).toBe('expired_token');
  });

  it('throws on unexpected error from server', async () => {
    mockServer.use(
      http.post('https://api.kaven.sh/auth/token', () =>
        HttpResponse.json({ error: 'server_exploded' }, { status: 400 })
      )
    );
    const client = new MarketplaceClient();
    await expect(client.pollDeviceToken('test-device-code')).rejects.toThrow('Unexpected error');
  });
});
