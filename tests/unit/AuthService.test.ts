import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { AuthService } from "../../src/core/AuthService";
import { AuthTokens } from "../../src/types/auth";

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

const configPath = path.join(os.homedir(), ".kaven", "auth.json");

/** Build a valid base64url JWT for a given payload. */
function buildFakeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode(payload);
  const sig = "fakesig";
  return `${header}.${body}.${sig}`;
}

/** Build an AuthTokens object with the given expiry offset from now (ms). */
function buildAuthTokens(expiryOffsetMs: number): AuthTokens {
  const expiresAt = new Date(Date.now() + expiryOffsetMs).toISOString();
  const exp = Math.floor((Date.now() + expiryOffsetMs) / 1000);

  const jwtPayload = {
    sub: "user_123",
    email: "dev@example.com",
    githubId: "octocat",
    tier: "complete",
    iat: Math.floor(Date.now() / 1000),
    exp,
  };

  return {
    access_token: buildFakeJwt(jwtPayload),
    refresh_token: "refresh-token-abc",
    expires_at: expiresAt,
    user: {
      email: "dev@example.com",
      githubId: "octocat",
      tier: "complete",
    },
  };
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe("AuthService", () => {
  let authService: AuthService;

  beforeEach(async () => {
    authService = new AuthService();
    if (await fs.pathExists(configPath)) {
      await fs.remove(configPath);
    }
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (await fs.pathExists(configPath)) {
      await fs.remove(configPath);
    }
  });

  // ────────────────────────────────────────────────────────────
  // Legacy methods (backward-compat)
  // ────────────────────────────────────────────────────────────
  describe("legacy methods", () => {
    it("should save and retrieve a token (storeToken/getToken)", async () => {
      const token = "test-token-123";
      await authService.storeToken(token);

      const retrieved = await authService.getToken();
      expect(retrieved).toBe(token);
    });

    it("should clear the token on logout (clearToken)", async () => {
      await authService.storeToken("some-token");
      await authService.clearToken();

      const retrieved = await authService.getToken();
      expect(retrieved).toBeNull();
    });

    it("should return false if no token is stored", async () => {
      const isAuth = await authService.isAuthenticated();
      expect(isAuth).toBe(false);
    });

    it("should set 0600 permissions on auth.json (Unix only)", async () => {
      if (process.platform === "win32") return;

      await authService.storeToken("secure-token");
      const stats = await fs.stat(configPath);

      expect(stats.mode & 0o777).toBe(0o600);
    });
  });

  // ────────────────────────────────────────────────────────────
  // saveTokens / getAuth
  // ────────────────────────────────────────────────────────────
  describe("saveTokens / getAuth", () => {
    it("should save and retrieve AuthTokens", async () => {
      const tokens = buildAuthTokens(3_600_000);
      await authService.saveTokens(tokens);

      const retrieved = await authService.getAuth();
      expect(retrieved).not.toBeNull();
      expect(retrieved?.access_token).toBe(tokens.access_token);
      expect(retrieved?.user.email).toBe("dev@example.com");
    });

    it("should return null when no auth file exists", async () => {
      const result = await authService.getAuth();
      expect(result).toBeNull();
    });

    it("should set 0600 permissions on auth.json for saveTokens (Unix only)", async () => {
      if (process.platform === "win32") return;

      const tokens = buildAuthTokens(3_600_000);
      await authService.saveTokens(tokens);

      const stats = await fs.stat(configPath);
      expect(stats.mode & 0o777).toBe(0o600);
    });
  });

  // ────────────────────────────────────────────────────────────
  // isAuthenticated
  // ────────────────────────────────────────────────────────────
  describe("isAuthenticated", () => {
    it("should return true when tokens are stored", async () => {
      const tokens = buildAuthTokens(3_600_000);
      await authService.saveTokens(tokens);

      const result = await authService.isAuthenticated();
      expect(result).toBe(true);
    });

    it("should return false when no tokens are stored", async () => {
      const result = await authService.isAuthenticated();
      expect(result).toBe(false);
    });

    it("should never throw", async () => {
      // Even with a corrupted file it should return false, not throw
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeFile(configPath, "not-valid-json");

      const result = await authService.isAuthenticated();
      expect(result).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────
  // logout
  // ────────────────────────────────────────────────────────────
  describe("logout", () => {
    it("should remove auth.json on logout", async () => {
      const tokens = buildAuthTokens(3_600_000);
      await authService.saveTokens(tokens);

      await authService.logout();

      expect(await fs.pathExists(configPath)).toBe(false);
    });

    it("should not throw when already logged out", async () => {
      await expect(authService.logout()).resolves.not.toThrow();
    });
  });

  // ────────────────────────────────────────────────────────────
  // getUserInfo
  // ────────────────────────────────────────────────────────────
  describe("getUserInfo", () => {
    it("should decode user info from JWT payload", async () => {
      const tokens = buildAuthTokens(3_600_000);
      await authService.saveTokens(tokens);

      const info = await authService.getUserInfo();
      expect(info).not.toBeNull();
      expect(info?.email).toBe("dev@example.com");
      expect(info?.id).toBe("user_123"); // from JWT sub claim
    });

    it("should return null when not authenticated", async () => {
      const info = await authService.getUserInfo();
      expect(info).toBeNull();
    });

    it("should fall back to stored user data for non-JWT token", async () => {
      // Store with a non-decodeable access_token
      const tokens: AuthTokens = {
        access_token: "not-a-jwt",
        refresh_token: "rt",
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        user: {
          email: "fallback@example.com",
          githubId: "fallback-user",
          tier: "starter",
        },
      };
      await authService.saveTokens(tokens);

      const info = await authService.getUserInfo();
      expect(info?.email).toBe("fallback@example.com");
    });
  });

  // ────────────────────────────────────────────────────────────
  // getWhoamiInfo
  // ────────────────────────────────────────────────────────────
  describe("getWhoamiInfo", () => {
    it("should return formatted whoami info with capitalized tier", async () => {
      const tokens = buildAuthTokens(3_600_000);
      await authService.saveTokens(tokens);

      const info = await authService.getWhoamiInfo();
      expect(info).not.toBeNull();
      expect(info?.email).toBe("dev@example.com");
      expect(info?.githubId).toBe("octocat");
      expect(info?.tier).toBe("Complete"); // capitalized
      expect(info?.sessionExpiry).toContain("expires in");
    });

    it("should return null when not authenticated", async () => {
      const info = await authService.getWhoamiInfo();
      expect(info).toBeNull();
    });

    it("should show 'expired' for past expiry dates", async () => {
      const tokens = buildAuthTokens(-1000); // already expired
      await authService.saveTokens(tokens);

      const info = await authService.getWhoamiInfo();
      expect(info?.sessionExpiry).toBe("expired");
    });
  });

  // ────────────────────────────────────────────────────────────
  // getValidToken
  // ────────────────────────────────────────────────────────────
  describe("getValidToken", () => {
    it("should return access token when not expiring soon", async () => {
      const tokens = buildAuthTokens(60 * 60 * 1000); // 1 hour from now
      await authService.saveTokens(tokens);

      const token = await authService.getValidToken();
      expect(token).toBe(tokens.access_token);
    });

    it("should throw when not authenticated", async () => {
      await expect(authService.getValidToken()).rejects.toThrow(
        "Not authenticated"
      );
    });

    it("should throw 'Session expired' when token is expired and refresh fails", async () => {
      // Token expired 10 minutes ago
      const tokens = buildAuthTokens(-10 * 60 * 1000);
      await authService.saveTokens(tokens);

      // Mock the dynamic import to fail
      vi.mock("../../src/infrastructure/MarketplaceClient", () => ({
        MarketplaceClient: class {
          async refreshToken() {
            throw new Error("Refresh failed");
          }
        },
      }));

      await expect(authService.getValidToken()).rejects.toThrow(
        "Session expired"
      );
    });

    it("should warn and use existing token when expiring soon but refresh fails (token still valid)", async () => {
      // Token expiring in 3 minutes (< 5min threshold) but not yet expired
      const tokens = buildAuthTokens(3 * 60 * 1000);
      await authService.saveTokens(tokens);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Mock the dynamic import to fail
      vi.mock("../../src/infrastructure/MarketplaceClient", () => ({
        MarketplaceClient: class {
          async refreshToken() {
            throw new Error("Refresh failed");
          }
        },
      }));

      const token = await authService.getValidToken();
      // Should still return the token (token is still valid, just expiring soon)
      expect(token).toBe(tokens.access_token);

      warnSpy.mockRestore();
    });
  });

  // ────────────────────────────────────────────────────────────
  // JWT decoding
  // ────────────────────────────────────────────────────────────
  describe("getDecodedToken", () => {
    it("should decode JWT payload fields", async () => {
      const tokens = buildAuthTokens(3_600_000);
      await authService.saveTokens(tokens);

      const payload = await authService.getDecodedToken();
      expect(payload).not.toBeNull();
      expect(payload?.email).toBe("dev@example.com");
      expect(payload?.githubId).toBe("octocat");
      expect(payload?.tier).toBe("complete");
      expect(payload?.sub).toBe("user_123");
    });

    it("should return null for non-JWT tokens", async () => {
      const tokens: AuthTokens = {
        access_token: "not-a-jwt",
        refresh_token: "rt",
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        user: { email: "e@e.com", githubId: "gh", tier: "starter" },
      };
      await authService.saveTokens(tokens);

      const payload = await authService.getDecodedToken();
      expect(payload).toBeNull();
    });
  });
});
