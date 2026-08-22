import { ContentMarketingRepository } from '../content-marketing.repository';

describe('countSocialJobsToday', () => {
  it('does not count social_transcode or social_qa toward the daily cap', async () => {
    const repo = new ContentMarketingRepository({ databaseUrl: 'postgresql://x' } as never);
    (repo as unknown as { pgReady: boolean }).pgReady = false;

    await repo.createContentJob({
      lifecycle_id: 1,
      item_id: 2,
      job_type: 'social_transcode',
      input_json: {},
      created_by: 'a@b.c',
    });
    await repo.createContentJob({
      lifecycle_id: 1,
      item_id: 2,
      job_type: 'social_qa',
      input_json: {},
      created_by: 'a@b.c',
    });
    await repo.createContentJob({
      lifecycle_id: 1,
      item_id: 2,
      job_type: 'social_storyboard',
      input_json: {},
      created_by: 'a@b.c',
    });

    expect(await repo.countSocialJobsToday(1)).toBe(1);
  });
});
