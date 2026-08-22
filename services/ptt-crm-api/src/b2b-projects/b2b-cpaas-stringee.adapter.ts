import { B2bCpaasDownError } from './b2b-calls.types';
import type { B2bCpaasAdapter, CpaasStartCallInput, CpaasStartCallResult } from './b2b-cpaas.adapter';
import { createStringeeRestToken } from './b2b-cpaas-stringee.util';

const STRINGEE_CALLOUT_URL = 'https://api.stringee.com/v1/call2/callout';
const STRINGEE_TIMEOUT_MS = 1500;

export interface StringeeAdapterConfig {
  apiKeySid: string;
  apiKeySecret: string;
  fromNumber: string;
}

export class StringeeB2bCpaasAdapter implements B2bCpaasAdapter {
  constructor(private readonly cfg: StringeeAdapterConfig) {}

  async startCall(input: CpaasStartCallInput): Promise<CpaasStartCallResult> {
    if (!this.cfg.apiKeySid || !this.cfg.apiKeySecret || !this.cfg.fromNumber) {
      throw new B2bCpaasDownError('stringee_not_configured');
    }

    const token = createStringeeRestToken({
      apiKeySid: this.cfg.apiKeySid,
      apiKeySecret: this.cfg.apiKeySecret,
      ttlSec: 300,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STRINGEE_TIMEOUT_MS);

    try {
      const res = await fetch(STRINGEE_CALLOUT_URL, {
        method: 'POST',
        headers: {
          'X-STRINGEE-AUTH': token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          from: {
            type: 'external',
            number: this.cfg.fromNumber,
            alias: this.cfg.fromNumber,
          },
          to: [
            {
              type: 'external',
              number: input.phone,
              alias: input.phone,
            },
          ],
          customData: {
            sessionId: input.sessionId,
            leadId: input.leadId,
            staffId: input.staffId,
          },
        }),
        signal: controller.signal,
      });

      const json = (await res.json().catch(() => ({}))) as { r?: number; message?: string };
      if (!res.ok || json.r !== 0) {
        throw new B2bCpaasDownError(json.message ?? `stringee_http_${res.status}`);
      }

      return { providerCallId: `stringee-pending-${input.sessionId}` };
    } catch (err) {
      if (err instanceof B2bCpaasDownError) throw err;
      throw new B2bCpaasDownError(err instanceof Error ? err.message : 'stringee_call_failed');
    } finally {
      clearTimeout(timer);
    }
  }
}
