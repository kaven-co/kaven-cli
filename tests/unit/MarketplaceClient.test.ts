import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { MarketplaceClient } from "../../src/infrastructure/MarketplaceClient.js";
import {
  AuthenticationError,
  LicenseRequiredError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ServerError,
} from "../../src/infrastructure/errors.js";

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function makeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): any {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const defaultHeaders: Record<string, string> = {
    "content-type": "application/json",
    ...headers,
  };
  
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: {
      get: (name: string) => defaultHeaders[name.toLowerCase()] || null,
    },
    text: async () => bodyStr,
    json: async () => JSON.parse(bodyStr),
  };
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe("MarketplaceClient", () => {
  let client: MarketplaceClient;
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.KAVEN_API_URL;
    client = new MarketplaceClient();
    // Setup a mock fetch on global
    global.fetch = mock.fn(() => Promise.resolve(makeResponse(200, {}))) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mock.restoreAll();
  });

  describe("requestDeviceCode", () => {
    it("should return device code response on success", async () => {
      const mockPayload = {
        device_code: "dev-abc",
        user_code: "KAVEN-1234",
        verification_uri: "https://kaven.site/activate",
        expires_in: 600,
        interval: 5,
      };
      
      (global.fetch as any).mock.mockImplementation(async () => makeResponse(200, mockPayload));

      const result = await client.requestDeviceCode();

      assert.strictEqual(result.device_code, "dev-abc");
      assert.strictEqual(result.user_code, "KAVEN-1234");
      assert.strictEqual(result.expires_in, 600);
    });

    it("should throw ServerError on 5xx", async () => {
      // Mock global.setTimeout to speed up retries
      const setTimeoutMock = mock.method(global, 'setTimeout', (fn: any) => {
        fn();
        return 0 as any;
      });

      (global.fetch as any).mock.mockImplementation(async () => makeResponse(500, { message: "Internal Server Error" }));

      await assert.rejects(async () => {
        await client.requestDeviceCode();
      }, (err) => {
        return err instanceof ServerError;
      });

      setTimeoutMock.mock.restore();
    });

    it("should throw NetworkError on fetch failure (TypeError)", async () => {
      const setTimeoutMock = mock.method(global, 'setTimeout', (fn: any) => {
        fn();
        return 0 as any;
      });

      (global.fetch as any).mock.mockImplementation(async () => {
        throw new TypeError("Failed to fetch");
      });

      await assert.rejects(async () => {
        await client.requestDeviceCode();
      }, (err) => {
        return err instanceof NetworkError;
      });

      setTimeoutMock.mock.restore();
    });
  });

  describe("pollDeviceToken", () => {
    it("should return success with tokens on 200", async () => {
      const tokens = {
        access_token: "at.xxx",
        refresh_token: "rt.yyy",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
        user: { email: "dev@kaven.site", githubId: "octocat", tier: "complete" },
      };
      (global.fetch as any).mock.mockImplementation(async () => makeResponse(200, tokens));

      const result = await client.pollDeviceToken("dev-abc");

      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.tokens?.access_token, "at.xxx");
    });

    it("should return authorization_pending status", async () => {
      (global.fetch as any).mock.mockImplementation(async () => 
        makeResponse(400, { error: "authorization_pending" })
      );
      const result = await client.pollDeviceToken("dev-abc");
      assert.strictEqual(result.status, "authorization_pending");
    });

    it("should throw NetworkError on ECONNREFUSED", async () => {
      const err = Object.assign(new Error("connect ECONNREFUSED"), {
        code: "ECONNREFUSED",
      });
      (global.fetch as any).mock.mockImplementation(async () => {
        throw err;
      });

      await assert.rejects(async () => {
        await client.pollDeviceToken("dev-abc");
      }, (err) => {
        return err instanceof NetworkError;
      });
    });
  });

  describe("refreshToken", () => {
    it("should return new tokens on success", async () => {
      const refreshed = {
        access_token: "at.new",
        refresh_token: "rt.new",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      };
      (global.fetch as any).mock.mockImplementation(async () => makeResponse(200, refreshed));

      const result = await client.refreshToken("rt.old");
      assert.strictEqual(result.access_token, "at.new");
      assert.strictEqual(result.refresh_token, "rt.new");
    });

    it("should throw AuthenticationError on 401", async () => {
      (global.fetch as any).mock.mockImplementation(async () => 
        makeResponse(401, { message: "Invalid refresh token" })
      );

      await assert.rejects(async () => {
        await client.refreshToken("bad-token");
      }, (err) => {
        return err instanceof AuthenticationError;
      });
    });
  });

  describe("error mapping", () => {
    it("should throw AuthenticationError on 401", async () => {
      (global.fetch as any).mock.mockImplementation(async () => makeResponse(401, { message: "Unauthorized" }));
      await assert.rejects(async () => {
        await client.refreshToken("token");
      }, (err) => err instanceof AuthenticationError);
    });

    it("should throw LicenseRequiredError on 403", async () => {
      (global.fetch as any).mock.mockImplementation(async () => 
        makeResponse(403, { message: "License required", requiredTier: "complete" })
      );
      await assert.rejects(async () => {
        await client.refreshToken("token");
      }, (err) => err instanceof LicenseRequiredError);
    });

    it("should attach requiredTier from 403 body", async () => {
      (global.fetch as any).mock.mockImplementation(async () => 
        makeResponse(403, { message: "Upgrade needed", requiredTier: "pro" })
      );

      try {
        await client.refreshToken("token");
        assert.fail("Should have thrown");
      } catch (err) {
        assert.ok(err instanceof LicenseRequiredError);
        assert.strictEqual((err as LicenseRequiredError).requiredTier, "pro");
      }
    });

    it("should throw NotFoundError on 404", async () => {
      (global.fetch as any).mock.mockImplementation(async () => 
        makeResponse(404, { message: "Not found" })
      );
      await assert.rejects(async () => {
        await client.refreshToken("token");
      }, (err) => err instanceof NotFoundError);
    });

    it("should throw RateLimitError on 429 with retry-after header", async () => {
      (global.fetch as any).mock.mockImplementation(async () => 
        makeResponse(429, { message: "Too many requests" }, { "retry-after": "30" })
      );

      try {
        await client.refreshToken("token");
        assert.fail("Should have thrown");
      } catch (err) {
        assert.ok(err instanceof RateLimitError);
        assert.strictEqual((err as RateLimitError).retryAfter, 30);
      }
    });

    it("should throw ServerError on 500 after retries", async () => {
      const setTimeoutMock = mock.method(global, 'setTimeout', (fn: any) => {
        fn();
        return 0 as any;
      });

      (global.fetch as any).mock.mockImplementation(async () => makeResponse(500, { message: "Internal error" }));

      await assert.rejects(async () => {
        await client.refreshToken("token");
      }, (err) => err instanceof ServerError);

      setTimeoutMock.mock.restore();
    });
  });

  describe("getModuleManifest (legacy)", () => {
    it("should return null when module is not found (404)", async () => {
      (global.fetch as any).mock.mockImplementation(async () => 
        makeResponse(404, { message: "Module not found" })
      );

      const result = await client.getModuleManifest("non-existent-module");
      assert.strictEqual(result, null);
    });

    it("should return manifest data on success", async () => {
      const manifest = {
        name: "auth-google",
        version: "1.0.0",
        description: "Google Auth",
        author: "Kaven",
        license: "Proprietary",
        dependencies: { npm: [], peerModules: [], kavenVersion: ">=0.1.0" },
        files: { backend: [], frontend: [], database: [] },
        injections: [
          {
            file: "setup.ts",
            anchor: "// KAVEN_INIT",
            code: "console.log('auth-google initialized!');",
            moduleName: "auth-google",
          },
        ],
        scripts: { postInstall: null, preRemove: null },
        env: [],
      };
      (global.fetch as any).mock.mockImplementation(async () => makeResponse(200, manifest));

      const result = await client.getModuleManifest("auth-google");
      assert.ok(result !== null);
      assert.strictEqual(result?.name, "auth-google");
      assert.ok(result!.injections.length > 0);
    });
  });

  describe("base URL resolution", () => {
    it("should use KAVEN_API_URL env var when set", async () => {
      process.env.KAVEN_API_URL = "https://custom.api.example.com";
      const customClient = new MarketplaceClient();

      (global.fetch as any).mock.mockImplementation(async () => 
        makeResponse(200, {
          device_code: "d",
          user_code: "U",
          verification_uri: "https://example.com",
          expires_in: 300,
          interval: 5,
        })
      );

      await customClient.requestDeviceCode();

      const calledUrl = (global.fetch as any).mock.calls[0].arguments[0] as string;
      assert.ok(calledUrl.includes("custom.api.example.com"));

      delete process.env.KAVEN_API_URL;
    });
  });
});
