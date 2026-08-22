import { AppConfigService } from '../config/app-config.service';
import { AiScoresRepository } from './ai-scores.repository';

const dbUrl = process.env.DATABASE_URL ?? '';
const integration = dbUrl.includes('rnosaidb') ? describe : describe.skip;

integration('AiScoresRepository (RNOS-04 PG integration)', () => {
  let repo: AiScoresRepository;

  beforeAll(() => {
    repo = new AiScoresRepository({ databaseUrl: dbUrl } as AppConfigService);
  });

  afterAll(async () => {
    await repo.onModuleDestroy();
  });

  it('inserts and lists lead score', async () => {
    expect(await repo.tableReady()).toBe(true);
    const inserted = await repo.insertScore({
      entityType: 'lead',
      entityId: 'rnos04-probe',
      scoreType: 'lead',
      scoreValue: 55,
      confidence: 0.6,
      features: { probe: true },
      explainability: { factors: [], flags: [], score_band: 'warm' },
    });
    expect(inserted.score_value).toBe(55);

    const listed = await repo.listScores('lead', 'rnos04-probe', 5);
    expect(listed.length).toBeGreaterThanOrEqual(1);

    await repo.deleteById(inserted.id);
  });
});
