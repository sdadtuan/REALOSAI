import { UnauthorizedException } from '@nestjs/common';
import { VdWebhookEventRepository } from './vd-webhook-event.repository';
import { VdWebhookController } from './vd-webhook.controller';
import { VdWebhookService } from './vd-webhook.service';

function makeController(): VdWebhookController {
  const repo = new VdWebhookEventRepository({
    databaseUrl: 'postgres://127.0.0.1:1/none',
    contentMarketingVideoCinematicEnabled: false,
  } as never);
  jest.spyOn(repo, 'ensurePgReady').mockResolvedValue(false);
  return new VdWebhookController(new VdWebhookService(repo));
}

describe('VdWebhookController (Leonardo)', () => {
  const envKey = 'PTT_VD_LEONARDO_WEBHOOK_KEY';
  let prevKey: string | undefined;

  beforeEach(() => {
    prevKey = process.env[envKey];
    process.env[envKey] = 'leonardo-secret';
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env[envKey];
    else process.env[envKey] = prevKey;
  });

  it('returns 401 when Bearer wrong', async () => {
    const controller = makeController();
    await expect(
      controller.leonardo({ authorization: 'Bearer wrong' }, {
        data: { type: 'generation.complete', object: { id: 'gen-1' } },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts valid Bearer and dedupes event', async () => {
    const controller = makeController();
    const body = { data: { type: 'generation.complete', object: { id: 'gen-dup' } } };
    const headers = { authorization: 'Bearer leonardo-secret' };
    const first = await controller.leonardo(headers, body);
    const second = await controller.leonardo(headers, body);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
  });
});
