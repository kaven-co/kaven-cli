export interface JwtPayload {
  sub?: string;
  email?: string;
  githubId?: string;
  tier?: string;
  iat?: number;
  exp?: number;
}

export function createTestJwt(payload: Partial<JwtPayload> = {}): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    sub: payload.sub ?? 'user_test',
    email: payload.email ?? 'test@kaven.sh',
    githubId: payload.githubId ?? 'testuser',
    tier: payload.tier ?? 'STARTER',
    iat: Math.floor(Date.now() / 1000),
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + 86400,
  })).toString('base64url');
  const sig = Buffer.from('test-sig').toString('base64url');
  return `${header}.${body}.${sig}`;
}

export function createExpiredJwt(): string {
  return createTestJwt({ exp: Math.floor(Date.now() / 1000) - 3600 });
}

export function createExpiringJwt(): string {
  return createTestJwt({ exp: Math.floor(Date.now() / 1000) + 120 }); // 2 min
}
