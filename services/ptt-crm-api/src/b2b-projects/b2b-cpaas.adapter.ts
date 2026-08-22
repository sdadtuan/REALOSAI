import { B2bCpaasDownError } from './b2b-calls.types';
import { StringeeB2bCpaasAdapter } from './b2b-cpaas-stringee.adapter';
import type { AppConfigService } from '../config/app-config.service';

export interface CpaasStartCallInput {
  phone: string;
  sessionId: string;
  staffId: number;
  leadId: number;
}

export interface CpaasStartCallResult {
  providerCallId: string;
}

export interface B2bCpaasAdapter {
  startCall(input: CpaasStartCallInput): Promise<CpaasStartCallResult>;
}

export class MockB2bCpaasAdapter implements B2bCpaasAdapter {
  async startCall(input: CpaasStartCallInput): Promise<CpaasStartCallResult> {
    return { providerCallId: `mock-${input.sessionId}` };
  }
}

export class DownB2bCpaasAdapter implements B2bCpaasAdapter {
  async startCall(): Promise<CpaasStartCallResult> {
    throw new B2bCpaasDownError();
  }
}

export function createB2bCpaasAdapter(config: AppConfigService): B2bCpaasAdapter {
  const m = (config.b2bCpaas || 'mock').trim().toLowerCase();
  if (m === 'down' || m === 'off') return new DownB2bCpaasAdapter();
  if (m === 'stringee') {
    return new StringeeB2bCpaasAdapter({
      apiKeySid: config.stringeeApiKeySid ?? '',
      apiKeySecret: config.stringeeApiKeySecret ?? '',
      fromNumber: config.stringeeFromNumber ?? '',
    });
  }
  return new MockB2bCpaasAdapter();
}
