import { createPublicKey, verify } from 'crypto';

export interface StaffKeycloakClaims {
  sub: string;
  email?: string;
  preferred_username?: string;
  groups?: string[];
  acr?: string;
  amr?: string[];
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

export interface StaffKeycloakConfig {
  issuer: string;
  /** Base URL for server-side JWKS fetch; defaults to issuer. */
  fetchIssuer?: string;
  audience: string;
}

type JwkKey = {
  kid: string;
  kty: string;
  n?: string;
  e?: string;
  x5c?: string[];
};

const jwksCacheByIssuer = new Map<string, { fetchedAt: number; keys: JwkKey[] }>();
const JWKS_TTL_MS = 5 * 60 * 1000;

function decodePart(part: string): Buffer {
  const padded = part.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64');
}

export function parseStaffKeycloakJwt(
  token: string,
): { header: Record<string, unknown>; payload: StaffKeycloakClaims; sig: Buffer } | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const header = JSON.parse(decodePart(parts[0]).toString('utf8')) as Record<string, unknown>;
    const payload = JSON.parse(decodePart(parts[1]).toString('utf8')) as StaffKeycloakClaims;
    const sig = decodePart(parts[2]);
    return { header, payload, sig };
  } catch {
    return null;
  }
}

async function fetchJwks(issuer: string): Promise<JwkKey[]> {
  const now = Date.now();
  const cached = jwksCacheByIssuer.get(issuer);
  if (cached && now - cached.fetchedAt < JWKS_TTL_MS) {
    return cached.keys;
  }
  const url = `${issuer.replace(/\/$/, '')}/protocol/openid-connect/certs`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`JWKS fetch failed: ${resp.status}`);
  }
  const data = (await resp.json()) as { keys?: JwkKey[] };
  const keys = data.keys ?? [];
  jwksCacheByIssuer.set(issuer, { fetchedAt: now, keys });
  return keys;
}

function publicKeyFromJwk(jwk: JwkKey): ReturnType<typeof createPublicKey> | null {
  if (jwk.x5c?.[0]) {
    const pem = `-----BEGIN CERTIFICATE-----\n${jwk.x5c[0]}\n-----END CERTIFICATE-----`;
    return createPublicKey(pem);
  }
  if (jwk.kty === 'RSA' && jwk.n && jwk.e) {
    return createPublicKey({ key: jwk as unknown as Record<string, string>, format: 'jwk' });
  }
  return null;
}

function issMatches(tokenIss: string | undefined, expected: string): boolean {
  if (!tokenIss) {
    return false;
  }
  if (tokenIss === expected) {
    return true;
  }
  try {
    const a = new URL(tokenIss);
    const b = new URL(expected);
    return a.host === b.host && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '');
  } catch {
    return false;
  }
}

function audMatches(
  aud: string | string[] | undefined,
  azp: string | undefined,
  expected: string,
): boolean {
  if (azp === expected) {
    return true;
  }
  if (!aud) {
    return false;
  }
  if (Array.isArray(aud)) {
    return aud.includes(expected);
  }
  return aud === expected;
}

export async function verifyStaffKeycloakAccessToken(
  token: string,
  config: StaffKeycloakConfig,
): Promise<StaffKeycloakClaims | null> {
  const parsed = parseStaffKeycloakJwt(token);
  if (!parsed) {
    return null;
  }
  const { header, payload, sig } = parsed;
  const azp = String((payload as unknown as { azp?: string }).azp ?? '');
  if (payload.iss && !issMatches(payload.iss, config.issuer)) {
    return null;
  }
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    return null;
  }
  if (!audMatches(payload.aud, azp, config.audience)) {
    return null;
  }

  const kid = String(header.kid ?? '');
  const keys = await fetchJwks(config.fetchIssuer ?? config.issuer);
  const jwk = keys.find((k) => k.kid === kid) ?? keys[0];
  if (!jwk) {
    return null;
  }
  const pub = publicKeyFromJwk(jwk);
  if (!pub) {
    return null;
  }

  const signingInput = token.split('.').slice(0, 2).join('.');
  const algo = String(header.alg ?? 'RS256');
  if (algo !== 'RS256') {
    return null;
  }
  const ok = verify('RSA-SHA256', Buffer.from(signingInput), pub, sig);
  return ok ? payload : null;
}

export function normalizeKeycloakGroups(groups: string[] | null | undefined): string[] {
  if (!groups?.length) return [];
  return [
    ...new Set(
      groups
        .map((g) => String(g).trim().replace(/^\//, ''))
        .filter(Boolean),
    ),
  ];
}

export function staffEmailFromClaims(claims: StaffKeycloakClaims): string {
  return (claims.email ?? claims.preferred_username ?? '').trim().toLowerCase();
}

export function staffMfaSatisfied(claims: StaffKeycloakClaims): boolean {
  const acr = String(claims.acr ?? '').trim().toLowerCase();
  if (acr === 'mfa' || acr.includes('mfa')) {
    return true;
  }
  const amr = claims.amr ?? [];
  return amr.some((entry) => /otp|mfa|hwk|swk|pwd/i.test(String(entry)));
}

export interface StaffOidcTokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
}

export async function exchangeStaffAuthorizationCode(params: {
  issuer: string;
  fetchIssuer?: string;
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<StaffOidcTokenResponse> {
  const fetchBase = (params.fetchIssuer ?? params.issuer).replace(/\/$/, '');
  const tokenUrl = `${fetchBase}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.clientId,
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });
  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`token_exchange_failed:${resp.status}:${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as StaffOidcTokenResponse;
}

export function positionRequiresMfa(
  positionCode: string | null | undefined,
  requiredCodes: readonly string[],
): boolean {
  if (!positionCode) return false;
  const normalized = String(positionCode).trim().toLowerCase();
  return requiredCodes.some((code) => {
    const c = String(code).trim().toLowerCase();
    return c === normalized || normalized.includes(c) || c.includes(normalized);
  });
}
