import { AppConfigService } from '../config/app-config.service';
import { CustomerTimelineRepository } from './customer-timeline.repository';

const dbUrl = process.env.DATABASE_URL ?? '';
const integration = dbUrl.includes('rnosaidb') ? describe : describe.skip;

integration('CustomerTimelineRepository (RNOS-16 PG integration)', () => {
  let repo: CustomerTimelineRepository;

  beforeAll(() => {
    repo = new CustomerTimelineRepository({ databaseUrl: dbUrl } as AppConfigService);
  });

  afterAll(async () => {
    await repo.onModuleDestroy();
  });

  it('inserts and lists timeline event', async () => {
    expect(await repo.tableReady()).toBe(true);
    const inserted = await repo.insertEvent({
      entityType: 'lead',
      entityId: 'rnos16-probe',
      eventType: 'lead.ingested',
      eventSource: 'system',
      title: 'RNOS-16 probe',
      externalRef: `rnos16-probe-${Date.now()}`,
    });
    expect(inserted.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    const listed = await repo.listEvents({
      entityType: 'lead',
      entityId: 'rnos16-probe',
      limit: 5,
    });
    expect(listed.total).toBeGreaterThanOrEqual(1);
    await repo.deleteById(inserted.id);
  });
});
