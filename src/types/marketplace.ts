export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Module {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tier: "starter" | "complete" | "pro" | "enterprise";
  latestVersion: string;
  author: string;
  installCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleRelease {
  id: string;
  moduleId: string;
  version: string;
  changelog: string;
  installCount: number;
  createdAt: string;
}

export interface DownloadToken {
  token: string;
  expiresAt: string;
  downloadUrl: string;
}

export interface ModuleListFilters {
  category?: string;
  tier?: string;
  page?: number;
  pageSize?: number;
  q?: string;
}

export interface CreateDownloadTokenRequest {
  moduleId: string;
  releaseId: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}
