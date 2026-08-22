import { Injectable } from '@nestjs/common';
import { ProviderError } from '../adapters/provider-error';
import { VdWebhookEventRepository } from './vd-webhook-event.repository';

@Injectable()
export class VdWebhookService {
  constructor(private readonly events: VdWebhookEventRepository) {}

  async ingest(
    provider_code: string,
    event_id: string,
    headers: Record<string, string>,
    _body: unknown,
    options?: { skipAuth?: boolean },
  ): Promise<{ duplicate: boolean }> {
    if (!options?.skipAuth) {
      this.assertAuthorized(headers);
    }

    const result = await this.events.recordEvent(provider_code, event_id);
    return { duplicate: !result.inserted };
  }

  private assertAuthorized(headers: Record<string, string>): void {
    const secret = process.env.PTT_VD_WEBHOOK_TEST_SECRET;
    if (!secret) return;

    const auth = headers.authorization ?? headers.Authorization;
    if (auth !== `Bearer ${secret}`) {
      throw new ProviderError('auth', 'webhook_auth');
    }
  }
}
