import { Body, Controller, Post } from '@nestjs/common';
import { B2bCallsService } from './b2b-calls.service';
import type { B2bCallState } from './b2b-calls.types';
import { mapStringeeEvent } from './b2b-cpaas-stringee.util';

type WebhookCallState = Exclude<B2bCallState, 'queued'>;

@Controller('api/v1/b2b-calls')
export class B2bCallsController {
  constructor(private readonly calls: B2bCallsService) {}

  @Post('webhooks/stringee')
  async stringeeWebhook(@Body() body: Record<string, unknown>) {
    const eventRaw =
      body.call_status ?? body.callStatus ?? body.event ?? body.type ?? body.status;
    const state = mapStringeeEvent(String(eventRaw ?? '')) as WebhookCallState | null;
    if (!state) {
      return { ok: true, ignored: true };
    }

    const custom =
      typeof body.customData === 'object' && body.customData !== null
        ? (body.customData as Record<string, unknown>)
        : typeof body.custom_data === 'object' && body.custom_data !== null
          ? (body.custom_data as Record<string, unknown>)
          : {};

    const sessionId = String(custom.sessionId ?? custom.session_id ?? '').trim();
    const providerCallId = String(body.call_id ?? body.callId ?? body.id ?? '').trim();

    if (sessionId) {
      await this.calls.applyWebhookBySessionId({
        sessionId,
        state,
        providerCallId: providerCallId || undefined,
      });
    } else if (providerCallId) {
      await this.calls.applyWebhook({ providerCallId, state });
    }

    return { ok: true };
  }
}
