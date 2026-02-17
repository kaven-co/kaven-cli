export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  user: {
    email: string;
    githubId: string;
    tier: string;
  };
}

export interface TokenPollResult {
  status: 'success' | 'authorization_pending' | 'slow_down' | 'access_denied' | 'expired_token';
  tokens?: AuthTokens;
}
