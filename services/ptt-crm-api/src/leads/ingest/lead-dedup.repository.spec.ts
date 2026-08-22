import { LeadDedupRepository } from './lead-dedup.repository';

describe('LeadDedupRepository.findContactDuplicates SQL', () => {
  it('B2B-06 scopes dedup by b2b_project_id when provided', async () => {
    const query = jest.fn(async () => ({ rows: [] }));
    const repo = new LeadDedupRepository({ databaseUrl: 'postgres://x' } as never);
    Object.defineProperty(repo, 'db', { get: () => ({ query }) });

    await repo.findContactDuplicates({ phone: '0901234567', b2bProjectId: 'proj-a' });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('b2b_project_id IS NOT DISTINCT FROM'),
      expect.arrayContaining(['0901234567', 'proj-a']),
    );
  });
});
