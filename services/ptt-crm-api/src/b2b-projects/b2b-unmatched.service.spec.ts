import { B2bUnmatchedService } from './b2b-unmatched.service';
import { B2bProjectsRepository } from './b2b-projects.repository';

describe('B2bUnmatchedService', () => {
  it('lists unmatched rows without payload', async () => {
    const repo = {
      listUnmatched: jest.fn().mockResolvedValue([
        {
          id: 'u1',
          channel: 'facebook',
          project_slug: 'demo',
          external_key: 'form-99',
          created_at: '2026-08-19T00:00:00Z',
        },
      ]),
    } as unknown as B2bProjectsRepository;
    const svc = new B2bUnmatchedService(repo);
    const out = await svc.list({ limit: 10 });
    expect(out.items).toHaveLength(1);
    expect(out.items[0]).toEqual({
      id: 'u1',
      channel: 'facebook',
      project_slug: 'demo',
      external_key: 'form-99',
      created_at: '2026-08-19T00:00:00Z',
    });
    expect(out.items[0]).not.toHaveProperty('payload_json');
  });
});
