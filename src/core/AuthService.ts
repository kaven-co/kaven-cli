import fs from "fs-extra";
import path from "path";
import os from "os";
import { AuthTokens } from "../types/auth";

export interface UserInfo {
  id: string;
  email: string;
  name?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  githubId: string;
  tier: "starter" | "complete" | "pro" | "enterprise";
  iat: number;
  exp: number;
}

export interface StoredAuth {
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO 8601
  user: {
    email: string;
    githubId: string;
    tier: "starter" | "complete" | "pro" | "enterprise";
  };
}

/** Decode a JWT payload without verifying the signature (server's responsibility). */
function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url → Base64 → JSON
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/** Format a future timestamp into a human-readable "expires in X" string. */
function formatExpiryRelative(expiresAt: string): string {
  const now = Date.now();
  const expMs = new Date(expiresAt).getTime();
  const diffSeconds = Math.max(0, Math.floor((expMs - now) / 1000));

  if (diffSeconds === 0) return "expired";

  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);

  if (hours > 0) {
    return `expires in ${hours}h ${minutes}m`;
  }
  return `expires in ${minutes}m`;
}

export class AuthService {
  private readonly configPath: string;

  constructor() {
    this.configPath = path.join(os.homedir(), ".kaven", "auth.json");
  }

  /**
   * Store complete auth tokens (new format for C1.1+)
   */
  async saveTokens(tokens: AuthTokens): Promise<void> {
    const configDir = path.dirname(this.configPath);
    await fs.ensureDir(configDir);

    await fs.writeJson(this.configPath, tokens, { spaces: 2 });

    // Set restrictive permissions (0600 - owner read/write only) on Unix-like systems
    if (process.platform !== "win32") {
      await fs.chmod(this.configPath, 0o600);
    }
  }

  /**
   * Legacy method - kept for backwards compatibility
   * @deprecated Use saveTokens() instead
   */
  async storeToken(token: string): Promise<void> {
    const configDir = path.dirname(this.configPath);
    await fs.ensureDir(configDir);

    await fs.writeJson(this.configPath, { token }, { spaces: 2 });

    if (process.platform !== "win32") {
      await fs.chmod(this.configPath, 0o600);
    }
  }

  /**
   * Get stored authentication data (new format)
   */
  async getAuth(): Promise<AuthTokens | null> {
    if (!(await fs.pathExists(this.configPath))) {
      return null;
    }

    try {
      const data = await fs.readJson(this.configPath);
      if (data.access_token) {
        return data as AuthTokens;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Legacy method - kept for backwards compatibility
   * @deprecated Use getAuth() instead
   */
  async getToken(): Promise<string | null> {
    if (!(await fs.pathExists(this.configPath))) {
      return null;
    }

    try {
      const data = await fs.readJson(this.configPath);
      if (data.access_token) {
        return data.access_token;
      }
      return data.token || null;
    } catch {
      return null;
    }
  }

  /**
   * Return a valid access token, auto-refreshing if it expires in <5 minutes.
   * Throws if the session is expired and refresh fails.
   */
  async getValidToken(): Promise<string> {
    const auth = await this.getAuth();
    if (!auth) {
      throw new Error(
        "Not authenticated. Run 'kaven auth login' to authenticate."
      );
    }

    const expiresAt = new Date(auth.expires_at).getTime();
    const now = Date.now();
    const fiveMinutesMs = 5 * 60 * 1000;
    const isExpiringSoon = expiresAt - now < fiveMinutesMs;
    const isExpired = now >= expiresAt;

    if (!isExpiringSoon) {
      // Token is still valid and not expiring soon — return as-is
      return auth.access_token;
    }

    // Attempt refresh
    try {
      // Lazy import to avoid circular dependency at module level
      const { MarketplaceClient } = await import(
        "../infrastructure/MarketplaceClient"
      );
      const client = new MarketplaceClient(this);
      const refreshed = await client.refreshToken(auth.refresh_token);

      // Update stored auth with new tokens
      const newAuth: AuthTokens = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: refreshed.expires_at,
        user: auth.user,
      };
      await this.saveTokens(newAuth);

      return refreshed.access_token;
    } catch {
      // Refresh failed — use existing token if still valid, else throw
      if (!isExpired) {
        console.warn(
          "[kaven] Warning: Failed to refresh token. Using existing token."
        );
        return auth.access_token;
      }

      throw new Error(
        "Session expired. Run 'kaven auth login' to re-authenticate."
      );
    }
  }

  /**
   * Check if the user is authenticated. Never throws.
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await this.getToken();
      return !!token;
    } catch {
      return false;
    }
  }

  /**
   * Remove auth.json (logout)
   */
  async logout(): Promise<void> {
    if (await fs.pathExists(this.configPath)) {
      await fs.remove(this.configPath);
    }
  }

  /**
   * Legacy alias for logout()
   * @deprecated Use logout() instead
   */
  async clearToken(): Promise<void> {
    return this.logout();
  }

  /**
   * Decode JWT and return user info from the access token payload.
   */
  async getUserInfo(): Promise<UserInfo | null> {
    const auth = await this.getAuth();
    if (!auth) return null;

    const payload = decodeJwtPayload(auth.access_token);
    if (payload) {
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.githubId,
      };
    }

    // Fallback to stored user data if JWT decode fails
    return {
      id: auth.user.githubId,
      email: auth.user.email,
      name: undefined,
    };
  }

  /**
   * Get decoded JWT payload from stored access token.
   */
  async getDecodedToken(): Promise<JwtPayload | null> {
    const auth = await this.getAuth();
    if (!auth) return null;
    return decodeJwtPayload(auth.access_token);
  }

  /**
   * Get the stored auth data along with human-readable expiry string.
   */
  async getWhoamiInfo(): Promise<{
    email: string;
    githubId: string;
    tier: string;
    sessionExpiry: string;
  } | null> {
    const auth = await this.getAuth();
    if (!auth) return null;

    return {
      email: auth.user.email,
      githubId: auth.user.githubId,
      tier:
        auth.user.tier.charAt(0).toUpperCase() + auth.user.tier.slice(1),
      sessionExpiry: formatExpiryRelative(auth.expires_at),
    };
  }
}
