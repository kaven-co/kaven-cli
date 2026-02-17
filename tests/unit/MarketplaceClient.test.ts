import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MarketplaceClient } from "../../src/infrastructure/MarketplaceClient";
import {
  AuthenticationError,
  LicenseRequiredError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ServerError,
} from "../../src/infrastructure/errors";

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

/** Build a minimal Response-like object that fetch resolves to. */
function makeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const defaultHeaders: Record<string, string> = {
    "content-type": "application/json",
    ...headers,
  };
  return new Response(bodyStr, {
    status,
    headers: defaultHeaders,
  });
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe("MarketplaceClient", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let client: MarketplaceClient;

  beforeEach(() => {
    // Ensure we use the default base URL (no env override in tests)
    delete process.env.KAVEN_API_URL;
    fetchSpy = vi.spyOn(global, "fetch");
    // Default: client without AuthService (unauthenticated)
    client = new MarketplaceClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ────────────────────────────────────────────────────────────
  // requestDeviceCode
  // ────────────────────────────────────────────────────────────
  describe("requestDeviceCode", () => {
    it("should return device code response on success", async () => {
      const mockPayload = {
        device_code: "dev-abc",
        user_code: "KAVEN-1234",
        verification_uri: "https://kaven.sh/activate",
        expires_in: 600,
        interval: 5,
      };
      fetchSpy.mockResolvedValueOnce(makeResponse(200, mockPayload));

      const result = await client.requestDeviceCode();

      expect(result.device_code).toBe("dev-abc");
      expect(result.user_code).toBe("KAVEN-1234");
      expect(result.verification_uri).toBe("https://kaven.sh/activate");
      expect(result.expires_in).toBe(600);
    });

    it("should throw ServerError on 5xx", async () => {
      // Exhaust all retries with 500s — mock setTimeout to skip backoff delays
      const originalSetTimeout = global.setTimeout;
      vi.spyOn(global, "setTimeout").mockImplementation((fn: () => void) => {
        fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      });
      fetchSpy.mockResolvedValue(makeResponse(500, { message: "Internal Server Error" }));

      await expect(client.requestDeviceCode()).rejects.toBeInstanceOf(ServerError);
      vi.spyOn(global, "setTimeout").mockRestore();
      // Ensure original is restored
      global.setTimeout = originalSetTimeout;
    }, 10_000);

    it("should throw NetworkError on fetch failure (TypeError)", async () => {
      const originalSetTimeout = global.setTimeout;
      vi.spyOn(global, "setTimeout").mockImplementation((fn: () => void) => {
        fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      });
      fetchSpy.mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(client.requestDeviceCode()).rejects.toBeInstanceOf(NetworkError);
      vi.spyOn(global, "setTimeout").mockRestore();
      global.setTimeout = originalSetTimeout;
    }, 10_000);
  });

  // ────────────────────────────────────────────────────────────
  // pollDeviceToken
  // ────────────────────────────────────────────────────────────
  describe("pollDeviceToken", () => {
    it("should return success with tokens on 200", async () => {
      const tokens = {
        access_token: "at.xxx",
        refresh_token: "rt.yyy",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
        user: { email: "dev@kaven.sh", githubId: "octocat", tier: "complete" },
      };
      fetchSpy.mockResolvedValueOnce(makeResponse(200, tokens));

      const result = await client.pollDeviceToken("dev-abc");

      expect(result.status).toBe("success");
      expect(result.tokens?.access_token).toBe("at.xxx");
    });

    it("should return authorization_pending status", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(400, { error: "authorization_pending" })
      );
      const result = await client.pollDeviceToken("dev-abc");
      expect(result.status).toBe("authorization_pending");
    });

    it("should return slow_down status", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(400, { error: "slow_down" })
      );
      const result = await client.pollDeviceToken("dev-abc");
      expect(result.status).toBe("slow_down");
    });

    it("should return access_denied status", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(400, { error: "access_denied" })
      );
      const result = await client.pollDeviceToken("dev-abc");
      expect(result.status).toBe("access_denied");
    });

    it("should return expired_token status", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(400, { error: "expired_token" })
      );
      const result = await client.pollDeviceToken("dev-abc");
      expect(result.status).toBe("expired_token");
    });

    it("should throw NetworkError on ECONNREFUSED", async () => {
      const err = Object.assign(new Error("connect ECONNREFUSED"), {
        code: "ECONNREFUSED",
      });
      fetchSpy.mockRejectedValueOnce(err);

      await expect(client.pollDeviceToken("dev-abc")).rejects.toBeInstanceOf(
        NetworkError
      );
    });
  });

  // ────────────────────────────────────────────────────────────
  // refreshToken
  // ────────────────────────────────────────────────────────────
  describe("refreshToken", () => {
    it("should return new tokens on success", async () => {
      const refreshed = {
        access_token: "at.new",
        refresh_token: "rt.new",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      };
      fetchSpy.mockResolvedValueOnce(makeResponse(200, refreshed));

      const result = await client.refreshToken("rt.old");
      expect(result.access_token).toBe("at.new");
      expect(result.refresh_token).toBe("rt.new");
    });

    it("should throw AuthenticationError on 401", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(401, { message: "Invalid refresh token" })
      );

      await expect(client.refreshToken("bad-token")).rejects.toBeInstanceOf(
        AuthenticationError
      );
    });
  });

  // ────────────────────────────────────────────────────────────
  // HTTP error mapping
  // ────────────────────────────────────────────────────────────
  describe("error mapping", () => {
    it("should throw AuthenticationError on 401", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(401, { message: "Unauthorized" }));
      // Use refreshToken (unauthenticated endpoint) so we don't need AuthService
      await expect(client.refreshToken("token")).rejects.toBeInstanceOf(
        AuthenticationError
      );
    });

    it("should throw LicenseRequiredError on 403", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(403, { message: "License required", requiredTier: "complete" })
      );
      await expect(client.refreshToken("token")).rejects.toBeInstanceOf(
        LicenseRequiredError
      );
    });

    it("should attach requiredTier from 403 body", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(403, { message: "Upgrade needed", requiredTier: "pro" })
      );

      try {
        await client.refreshToken("token");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(LicenseRequiredError);
        expect((err as LicenseRequiredError).requiredTier).toBe("pro");
      }
    });

    it("should throw NotFoundError on 404", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(404, { message: "Not found" })
      );
      await expect(client.refreshToken("token")).rejects.toBeInstanceOf(
        NotFoundError
      );
    });

    it("should throw RateLimitError on 429 with retry-after header", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(429, { message: "Too many requests" }, { "retry-after": "30" })
      );

      try {
        await client.refreshToken("token");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(RateLimitError);
        expect((err as RateLimitError).retryAfter).toBe(30);
      }
    });

    it("should throw ServerError on 500 after retries", async () => {
      // All retries also return 500 — mock setTimeout to skip backoff delays
      const originalSetTimeout = global.setTimeout;
      vi.spyOn(global, "setTimeout").mockImplementation((fn: () => void) => {
        fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      });
      fetchSpy.mockResolvedValue(makeResponse(500, { message: "Internal error" }));

      await expect(client.refreshToken("token")).rejects.toBeInstanceOf(ServerError);
      vi.spyOn(global, "setTimeout").mockRestore();
      global.setTimeout = originalSetTimeout;
    }, 10_000);
  });

  // ────────────────────────────────────────────────────────────
  // getModuleManifest (legacy backward-compat)
  // ────────────────────────────────────────────────────────────
  describe("getModuleManifest (legacy)", () => {
    it("should return null when module is not found (404)", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(404, { message: "Module not found" })
      );

      const result = await client.getModuleManifest("non-existent-module");
      expect(result).toBeNull();
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
      fetchSpy.mockResolvedValueOnce(makeResponse(200, manifest));

      const result = await client.getModuleManifest("auth-google");
      expect(result).not.toBeNull();
      expect(result?.name).toBe("auth-google");
      expect(result?.injections.length).toBeGreaterThan(0);
    });
  });

  // ────────────────────────────────────────────────────────────
  // Base URL resolution
  // ────────────────────────────────────────────────────────────
  describe("base URL resolution", () => {
    it("should use KAVEN_API_URL env var when set", async () => {
      process.env.KAVEN_API_URL = "https://custom.api.example.com";
      const customClient = new MarketplaceClient();

      fetchSpy.mockResolvedValueOnce(
        makeResponse(200, {
          device_code: "d",
          user_code: "U",
          verification_uri: "https://example.com",
          expires_in: 300,
          interval: 5,
        })
      );

      await customClient.requestDeviceCode();

      const calledUrl = (fetchSpy.mock.calls[0][0] as string);
      expect(calledUrl).toContain("custom.api.example.com");

      delete process.env.KAVEN_API_URL;
    });
  });
});
