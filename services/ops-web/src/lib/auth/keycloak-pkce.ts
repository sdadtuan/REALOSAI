const PKCE_VERIFIER_KEY = 'ptt_ops_pkce_verifier';
const PKCE_STATE_KEY = 'ptt_ops_oidc_state';

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generatePkceVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function pkceChallengeFromVerifier(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

export function storePkceSession(verifier: string, state: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(PKCE_STATE_KEY, state);
}

export function readPkceVerifier(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(PKCE_VERIFIER_KEY);
}

export function readPkceState(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(PKCE_STATE_KEY);
}

export function clearPkceSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_STATE_KEY);
}

export function randomOidcState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function buildStaffKeycloakAuthUrl(params: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  acrValues?: string;
  prompt?: string;
}): Promise<string> {
  const verifier = generatePkceVerifier();
  const challenge = await pkceChallengeFromVerifier(verifier);
  const state = randomOidcState();
  storePkceSession(verifier, state);

  const authBase = `${params.issuer.replace(/\/$/, '')}/protocol/openid-connect/auth`;
  const qs = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  if (params.acrValues) {
    qs.set('acr_values', params.acrValues);
  }
  if (params.prompt) {
    qs.set('prompt', params.prompt);
  }
  return `${authBase}?${qs.toString()}`;
}
