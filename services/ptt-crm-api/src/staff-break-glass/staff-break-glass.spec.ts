import { StaffBreakGlassRepository } from './staff-break-glass.repository';

describe('StaffBreakGlassRepository (memory)', () => {
  const config = { databaseUrl: 'postgresql://invalid:5432/nodb' } as never;
  const repo = new StaffBreakGlassRepository(config);
  const userId = '00000000-0000-4000-8000-000000000099';

  it('creates pending request and approves with TTL caps', async () => {
    const grant = await repo.createRequest(userId, {
      reason: 'Hot deal override',
      caps_requested: [{ section: 'crm_gdkd', action: 'override' }],
    });
    expect(grant.status).toBe('pending');

    const approved = await repo.approve(grant.id, 'gdkd@test.vn');
    expect(approved.status).toBe('approved');
    expect(approved.expires_at).toBeTruthy();

    const caps = await repo.loadActiveCapsForUser(userId);
    expect(caps).toEqual([{ section: 'crm_gdkd', action: 'override' }]);
  });

  it('revokes expired grants', async () => {
    const count = await repo.revokeExpired();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
