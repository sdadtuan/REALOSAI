import { createHmac } from 'crypto';
import type { B2bCallState } from './b2b-calls.types';

export function mapStringeeEvent(event: string): B2bCallState | null {
  const e = event.trim().toLowerCase();
  if (e === 'answered' || e === 'agent_answered') return 'answered';
  if (e === 'ringing') return 'ringing';
  if (e === 'ended' || e === 'hangup') return 'ended';
  if (e === 'noanswer' || e === 'no_answer') return 'no_answer';
  return null;
}

export function resolveSessionIdFromProviderRef(providerRef: string): string {
  if (providerRef.startsWith('mock-')) return providerRef.slice('mock-'.length);
  if (providerRef.startsWith('stringee-pending-')) return providerRef.slice('stringee-pending-'.length);
  return providerRef;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

export function signStringeeJwt(
  payload: Record<string, unknown>,
  apiKeySecret: string,
): string {
  const header = { typ: 'JWT', alg: 'HS256', cty: 'stringee-api;v=1' };
  const head = base64UrlEncode(JSON.stringify(header));
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', apiKeySecret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function createStringeeRestToken(input: {
  apiKeySid: string;
  apiKeySecret: string;
  ttlSec?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  return signStringeeJwt(
    {
      jti: `${input.apiKeySid}_${now}`,
      iss: input.apiKeySid,
      exp: now + (input.ttlSec ?? 3600),
      rest_api: true,
    },
    input.apiKeySecret,
  );
}

export function createStringeeUserToken(input: {
  apiKeySid: string;
  apiKeySecret: string;
  userId: string;
  ttlSec?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  return signStringeeJwt(
    {
      jti: `${input.apiKeySid}_${input.userId}_${now}`,
      iss: input.apiKeySid,
      exp: now + (input.ttlSec ?? 3600),
      userId: input.userId,
    },
    input.apiKeySecret,
  );
}
