import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { VdWebhookService } from './vd-webhook.service';

function extractLeonardoEventId(body: unknown): string {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return 'invalid';
  }
  const data = (body as { data?: { object?: { id?: unknown }; type?: unknown } }).data;
  const id = data?.object?.id;
  const type = data?.type;
  if (typeof id !== 'string' || !id.trim()) {
    return 'invalid';
  }
  return typeof type === 'string' && type.trim() ? `${type}:${id}` : id;
}

@Controller('api/v1/vd/webhooks')
export class VdWebhookController {
  constructor(private readonly webhooks: VdWebhookService) {}

  @Post('leonardo')
  @HttpCode(200)
  async leonardo(
    @Headers() headers: Record<string, string>,
    @Body() body: unknown,
  ): Promise<{ ok: true; duplicate: boolean }> {
    const secret = (process.env.PTT_VD_LEONARDO_WEBHOOK_KEY ?? '').trim();
    if (secret) {
      const auth = headers.authorization ?? headers.Authorization;
      if (auth !== `Bearer ${secret}`) {
        throw new UnauthorizedException({ error: 'webhook_auth' });
      }
    }

    const eventId = extractLeonardoEventId(body);
    if (eventId === 'invalid') {
      return { ok: true, duplicate: false };
    }

    const result = await this.webhooks.ingest('leonardo', eventId, headers, body, {
      skipAuth: true,
    });
    return { ok: true, duplicate: result.duplicate };
  }
}
