import fs from "fs-extra";
import path from "path";
import os from "os";
import { AuthTokens } from "../types/auth";

export interface UserInfo {
  id: string;
  email: string;
  name?: string;
}

export class AuthService {
  private readonly configPath: string;

  constructor() {
    this.configPath = path.join(os.homedir(), ".kaven", "auth.json");
  }

  /**
   * Store complete auth tokens (new format for C1.1)
   */
  async saveTokens(tokens: AuthTokens): Promise<void> {
    const configDir = path.dirname(this.configPath);
    await fs.ensureDir(configDir);

    // Save complete token object
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

    // Save token in legacy format
    await fs.writeJson(this.configPath, { token }, { spaces: 2 });

    // Set restrictive permissions
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

      // Check if it's the new format (has access_token)
      if (data.access_token) {
        return data as AuthTokens;
      }

      // Legacy format - return null (force re-auth)
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
      // Try new format first
      if (data.access_token) {
        return data.access_token;
      }
      // Fall back to legacy format
      return data.token || null;
    } catch {
      return null;
    }
  }

  async clearToken(): Promise<void> {
    if (await fs.pathExists(this.configPath)) {
      await fs.remove(this.configPath);
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  /**
   * Get user info from stored auth data
   */
  async getUserInfo(): Promise<UserInfo | null> {
    const auth = await this.getAuth();
    if (!auth) return null;

    return {
      id: auth.user.githubId, // Use githubId as unique identifier
      email: auth.user.email,
      name: undefined, // Name not included in marketplace auth response
    };
  }
}
