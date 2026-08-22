import { PolicyImpactService } from './policy-impact.service';

describe('PolicyImpactService', () => {
  const mockUsers = Array.from({ length: 10 }, (_, i) => ({
    id: `user-${i}`,
    email: `user${i}@test.vn`,
    display_name: `User ${i}`,
    job_functions: [] as string[],
  }));

  const repo = {
    getPositionCode: jest.fn().mockResolvedValue('KD-02'),
    listActiveUsersByPosition: jest.fn().mockResolvedValue(mockUsers),
  };

  const baseCaps = [
    { section: 'crm_leads', action: 'view' },
    { section: 'crm_leads', action: 'view_pii' },
  ];

  const staffAuth = {
    loadCaps: jest.fn().mockResolvedValue(baseCaps),
  };

  const jobFunctions = { loadCapsForFunctions: jest.fn().mockResolvedValue([]) };
  const permissionSets = { loadCapsForUser: jest.fn().mockResolvedValue([]) };
  const adminAudit = { logSyntheticEvent: jest.fn().mockResolvedValue(undefined) };

  const svc = new PolicyImpactService(
    repo as never,
    staffAuth as never,
    jobFunctions as never,
    permissionSets as never,
    adminAudit as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repo.listActiveUsersByPosition.mockResolvedValue(mockUsers);
    staffAuth.loadCaps.mockResolvedValue(baseCaps);
  });

  it('counts affected users when cap removed from matrix patch', async () => {
    const result = await svc.simulateImpact({
      position_id: 2,
      patch: { removed: [{ section: 'crm_leads', action: 'view_pii' }] },
      limit: 5,
    });

    expect(result.position_code).toBe('KD-02');
    expect(result.affected_user_count).toBe(10);
    expect(result.sample_users.length).toBe(5);
    expect(result.aggregate.caps_removed_unique).toContain('crm_leads.view_pii');
    expect(result.aggregate.users_with_pii_loss).toBe(10);
  });

  it('returns zero affected when patch is empty', async () => {
    const result = await svc.simulateImpact({
      position_id: 2,
      patch: {},
    });
    expect(result.affected_user_count).toBe(0);
  });
});
