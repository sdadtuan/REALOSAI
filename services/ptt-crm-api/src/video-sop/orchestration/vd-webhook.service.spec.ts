import { ProviderError } from '../adapters/provider-error';
import { VdWebhookEventRepository } from './vd-webhook-event.repository';
import { VdWebhookService } from './vd-webhook.service';

function makeRepo(): VdWebhookEventRepository {
  const repo = new VdWebhookEventRepository({
    databaseUrl: 'postgres://127.0.0.1:1/none',
    contentMarketingVideoCinematicEnabled: false,
  } as never);
  jest.spyOn(repo, 'ensurePgReady').mockResolvedValue(false);
  return repo;
}

describe('VdWebhookService (CT-05, CT-06)', () => {
  const envKey = 'PTT_VD_WEBHOOK_TEST_SECRET';
  let prevSecret: string | undefined;

  beforeEach(() => {
    prevSecret = process.env[envKey];
    process.env[envKey] = 'test';
  });

  afterEach(() => {
    if (prevSecret === undefined) {
      delete process.env[envKey];
    } else {
      process.env[envKey] = prevSecret;
    }
  });

  it('second event_id is duplicate', async () => {
    const mem = makeRepo();
    const svc = new VdWebhookService(mem);
    await svc.ingest('leonardo', 'evt-1', { authorization: 'Bearer test' }, {});
    const second = await svc.ingest('leonardo', 'evt-1', { authorization: 'Bearer test' }, {});
    expect(second.duplicate).toBe(true);
  });

  it('first ingest is not duplicate', async () => {
    const mem = makeRepo();
    const svc = new VdWebhookService(mem);
    const first = await svc.ingest('leonardo', 'evt-new', { authorization: 'Bearer test' }, {});
    expect(first.duplicate).toBe(false);
  });

  it('throws webhook_auth when Bearer wrong and secret set', async () => {
    const mem = makeRepo();
    const svc = new VdWebhookService(mem);
    await expect(
      svc.ingest('leonardo', 'evt-1', { authorization: 'Bearer wrong' }, {}),
    ).rejects.toEqual(new ProviderError('auth', 'webhook_auth'));
  });

  it('skips auth when secret unset', async () => {
    delete process.env[envKey];
    const mem = makeRepo();
    const svc = new VdWebhookService(mem);
    const result = await svc.ingest('leonardo', 'evt-open', {}, {});
    expect(result.duplicate).toBe(false);
  });
});
