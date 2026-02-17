import fs from "fs-extra";
import path from "path";
import os from "os";
import { ModuleManifest } from "../types/manifest";
import { DeviceCodeResponse, TokenPollResult, AuthTokens } from "../types/auth";
import {
  Module,
  PaginatedResponse,
  DownloadToken,
  ModuleListFilters,
  RefreshTokenResponse,
} from "../types/marketplace";
import {
  AuthenticationError,
  LicenseRequiredError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ServerError,
} from "./errors";
import type { AuthService } from "../core/AuthService";

const DEFAULT_BASE_URL = "https://api.kaven.sh";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;

function debug(message: string): void {
  if (process.env.KAVEN_DEBUG === "1") {
    console.debug(`[kaven:debug] ${message}`);
  }
}

/** Load the apiUrl from ~/.kaven/config.json if present. */
async function loadConfigApiUrl(): Promise<string | null> {
  try {
    const configPath = path.join(os.homedir(), ".kaven", "config.json");
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      if (typeof config.apiUrl === "string" && config.apiUrl) {
        return config.apiUrl;
      }
    }
  } catch {
    // Ignore config read errors
  }
  return null;
}

/** Resolve base URL from env → config file → default. */
async function resolveBaseUrl(): Promise<string> {
  if (process.env.KAVEN_API_URL) {
    return process.env.KAVEN_API_URL.replace(/\/$/, "");
  }
  const configUrl = await loadConfigApiUrl();
  if (configUrl) {
    return configUrl.replace(/\/$/, "");
  }
  return DEFAULT_BASE_URL;
}

/** Sleep helper for retry backoff. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Determine if the error code / HTTP status is retryable. */
function isRetryable(status: number): boolean {
  return status >= 500;
}

export class MarketplaceClient {
  private readonly baseURLPromise: Promise<string>;
  private readonly authService: AuthService | null;

  constructor(authService?: AuthService) {
    this.authService = authService ?? null;
    this.baseURLPromise = resolveBaseUrl();
  }

  // ──────────────────────────────────────────────────────────
  // Core HTTP helpers
  // ──────────────────────────────────────────────────────────

  /**
   * Make an HTTP request with retry logic and typed error mapping.
   * `authenticated` controls whether Authorization header is attached.
   */
  private async request<T>(
    method: string,
    endpoint: string,
    options: {
      body?: unknown;
      authenticated?: boolean;
    } = {}
  ): Promise<T> {
    const baseURL = await this.baseURLPromise;
    const url = `${baseURL}${endpoint}`;
    const { body, authenticated = false } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        debug(`Retry attempt ${attempt} for ${method} ${endpoint} (delay ${delay}ms)`);
        await sleep(delay);
      }

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/json",
        };

        if (authenticated && this.authService) {
          const token = await this.authService.getValidToken();
          headers["Authorization"] = `Bearer ${token}`;
        }

        debug(`${method} ${url}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          REQUEST_TIMEOUT_MS
        );

        let response: Response;
        try {
          response = await fetch(url, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        debug(`Response: ${response.status} ${response.statusText}`);

        // Map HTTP errors to typed exceptions
        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          let errorMessage = errorText;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorText;
          } catch {
            // keep raw text
          }

          switch (response.status) {
            case 401:
              throw new AuthenticationError(
                errorMessage || "Authentication required"
              );
            case 403: {
              let requiredTier = "pro";
              try {
                const parsed = JSON.parse(errorText);
                requiredTier = parsed.requiredTier || requiredTier;
              } catch {
                // ignore
              }
              throw new LicenseRequiredError(
                requiredTier,
                errorMessage || "License required"
              );
            }
            case 404:
              throw new NotFoundError(errorMessage || "Resource not found");
            case 429: {
              const retryAfter = parseInt(
                response.headers.get("retry-after") ?? "60",
                10
              );
              throw new RateLimitError(isNaN(retryAfter) ? 60 : retryAfter);
            }
            default:
              if (isRetryable(response.status)) {
                lastError = new ServerError(
                  errorMessage || `Server error: ${response.status}`
                );
                continue; // retry
              }
              throw new ServerError(
                errorMessage || `Server error: ${response.status}`
              );
          }
        }

        // Parse successful response
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          return (await response.json()) as T;
        }
        // Return empty object for no-body responses (204, etc.)
        return {} as T;
      } catch (error) {
        // Re-throw our typed errors without retrying on 4xx
        if (
          error instanceof AuthenticationError ||
          error instanceof LicenseRequiredError ||
          error instanceof NotFoundError ||
          error instanceof RateLimitError
        ) {
          throw error;
        }

        // Network / timeout errors
        if (
          error instanceof TypeError ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          const networkError = new NetworkError(
            error.name === "AbortError"
              ? "Request timed out after 30s"
              : `Network error: ${error.message}`
          );
          lastError = networkError;
          // Retry on network errors too
          if (attempt < MAX_RETRIES) continue;
          throw networkError;
        }

        // ServerError already stored in lastError, will retry
        if (error instanceof ServerError) {
          lastError = error;
          if (attempt < MAX_RETRIES) continue;
          throw error;
        }

        // Unknown error — don't retry
        throw error;
      }
    }

    // All retries exhausted
    throw lastError ?? new NetworkError("Request failed after retries");
  }

  // ──────────────────────────────────────────────────────────
  // Auth endpoints (unauthenticated)
  // ──────────────────────────────────────────────────────────

  /**
   * Step 1 of Device Code Flow: Request device code from marketplace.
   */
  async requestDeviceCode(): Promise<DeviceCodeResponse> {
    return this.request<DeviceCodeResponse>("POST", "/auth/device-code", {
      body: { client_id: "kaven-cli" },
      authenticated: false,
    });
  }

  /**
   * Step 2 of Device Code Flow: Poll for access token.
   */
  async pollDeviceToken(deviceCode: string): Promise<TokenPollResult> {
    try {
      const baseURL = await this.baseURLPromise;
      const url = `${baseURL}/auth/token`;

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
      );

      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_code: deviceCode,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        const tokens: AuthTokens = await response.json();
        return { status: "success", tokens };
      }

      const errorData = await response.json().catch(() => ({}));
      const errorCode = (errorData as { error?: string }).error ?? "unknown_error";

      switch (errorCode) {
        case "authorization_pending":
          return { status: "authorization_pending" };
        case "slow_down":
          return { status: "slow_down" };
        case "access_denied":
          return { status: "access_denied" };
        case "expired_token":
          return { status: "expired_token" };
        default:
          throw new Error(`Unexpected error: ${errorCode}`);
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (
        nodeError.code === "ECONNREFUSED" ||
        nodeError.code === "ENOTFOUND"
      ) {
        throw new NetworkError(
          "Network error. Check your connection and try again."
        );
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token.
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    return this.request<RefreshTokenResponse>("POST", "/auth/refresh", {
      body: { refresh_token: refreshToken },
      authenticated: false,
    });
  }

  // ──────────────────────────────────────────────────────────
  // Module endpoints (authenticated)
  // ──────────────────────────────────────────────────────────

  /**
   * List available modules with optional filters.
   */
  async listModules(
    filters?: ModuleListFilters
  ): Promise<PaginatedResponse<Module>> {
    const params = new URLSearchParams();
    if (filters?.category) params.set("category", filters.category);
    if (filters?.tier) params.set("tier", filters.tier);
    if (filters?.q) params.set("q", filters.q);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));

    const query = params.toString();
    const endpoint = `/modules${query ? `?${query}` : ""}`;

    return this.request<PaginatedResponse<Module>>("GET", endpoint, {
      authenticated: true,
    });
  }

  /**
   * Get a single module by slug.
   */
  async getModule(slug: string): Promise<Module> {
    return this.request<Module>("GET", `/modules/${slug}`, {
      authenticated: true,
    });
  }

  /**
   * Get a module's manifest for a specific version.
   */
  async getManifest(slug: string, version: string): Promise<ModuleManifest> {
    return this.request<ModuleManifest>(
      "GET",
      `/modules/${slug}/versions/${version}/manifest`,
      { authenticated: true }
    );
  }

  /**
   * Create a download token for a module release.
   */
  async createDownloadToken(
    moduleId: string,
    releaseId: string
  ): Promise<DownloadToken> {
    return this.request<DownloadToken>("POST", "/download-tokens", {
      body: { moduleId, releaseId },
      authenticated: true,
    });
  }

  // ──────────────────────────────────────────────────────────
  // Legacy / backward-compat methods
  // ──────────────────────────────────────────────────────────

  /**
   * @deprecated Use getManifest(slug, version) instead.
   */
  async getModuleManifest(moduleId: string): Promise<ModuleManifest | null> {
    try {
      // Try to get latest manifest — for backward-compat we use "latest"
      return await this.getManifest(moduleId, "latest");
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  }
}
