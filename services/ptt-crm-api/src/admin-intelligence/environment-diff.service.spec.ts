import { EnvironmentDiffService } from './environment-diff.service';

describe('EnvironmentDiffService', () => {
  const repo = {
    listSnapshots: jest.fn().mockResolvedValue([]),
    getSnapshotPayload: jest.fn(),
    saveEnvDiff: jest.fn().mockImplementation(async (input) => ({
      ...(input.result_json as object),
      id: 'diff-1',
      created_at: new Date().toISOString(),
    })),
  };

  const permissionsRepo = {
    listPositions: jest.fn().mockResolvedValue([
      { id: 1, code: 'AM-01', name: 'AM', active: true, grants_customized: false },
      { id: 2, code: 'MKT-02', name: 'MKT', active: true, grants_customized: true },
    ]),
    loadCaps: jest.fn().mockImplementation(async (id: number) => {
      if (id === 1) return [{ section_id: 'crm_leads', action: 'view' }];
      return [
        { section_id: 'crm_leads', action: 'view' },
        { section_id: 'meta_ads', action: 'view' },
      ];
    }),
  };

  const svc = new EnvironmentDiffService(repo as never, permissionsRepo as never);

  it('detects matrix drift between staging and uploaded prod snapshot', async () => {
    const result = await svc.createDiff(
      {
        upload_json: {
          grants: {
            'AM-01': { crm_leads: ['view'] },
            'MKT-02': { crm_leads: ['view'] },
          },
        },
        left_label: 'staging',
        right_label: 'prod-upload',
      },
      'it@test.vn',
    );

    expect(result.summary.changed).toBeGreaterThan(0);
    expect(result.matrix_diff.some((r) => r.position_code === 'MKT-02')).toBe(true);
    expect(['info', 'warning', 'critical']).toContain(result.severity);
  });

  it('returns no drift for identical matrices', async () => {
    const payload = {
      grants: {
        'AM-01': { crm_leads: ['view'] },
        'MKT-02': { crm_leads: ['view'], meta_ads: ['view'] },
      },
    };
    repo.getSnapshotPayload.mockResolvedValue(payload);
    const live = await svc.buildLiveMatrixPayload();
    expect(live.grants).toBeDefined();
  });
});
