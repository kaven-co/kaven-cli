export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ModuleReleaseRef {
  id: string;
  version: string;
  changelog?: string;
  minKavenVersion?: string;
  fileSize?: number;
  createdAt: string;
}

export interface Module {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tier?: string;
  requiredTier?: string;
  latestVersion?: string;
  author?: string;
  installCount: number;
  releases?: ModuleReleaseRef[];
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
  checksum?: string;
  signature?: string;
  publicKey?: string;
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
  moduleSlug: string;
  version: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}
