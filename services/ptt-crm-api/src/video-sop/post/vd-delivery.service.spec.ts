import { VdDeliveryService } from './vd-delivery.service';

describe('VdDeliveryService', () => {
  const config = { contentMarketingVideoCinematicEnabled: true } as never;

  it('rejects package when gate4 not approved and QC auto fail', async () => {
    const service = new VdDeliveryService(
      config,
      { getById: jest.fn().mockResolvedValue({ id: 1, stage: 'post_production' }) } as never,
      { getStatusMap: jest.fn().mockResolvedValue({ 4: 'pending' }) } as never,
      { listByProjectIdAndKind: jest.fn().mockResolvedValue([]) } as never,
      {
        getPipeline: jest.fn().mockResolvedValue({
          gate4_auto: { ok: false, blocked: true, reasons: ['missing_video'] },
        }),
      } as never,
      { insert: jest.fn(), getLatestByProjectId: jest.fn() } as never,
      { listByProjectId: jest.fn().mockResolvedValue([]) } as never,
    );

    await expect(service.createPackage(1)).rejects.toThrow('gate4_required');
  });

  it('allows package when QC auto pass', async () => {
    const insert = jest.fn().mockResolvedValue({
      id: 9,
      zip_storage_key: '/tmp/x.zip',
      file_names_json: ['a.zip'],
      meta_json: { contains_human: false, ai_disclosure: true },
      created_at: new Date().toISOString(),
    });
    const service = new VdDeliveryService(
      config,
      { getById: jest.fn().mockResolvedValue({ id: 1, stage: 'post_production' }) } as never,
      { getStatusMap: jest.fn().mockResolvedValue({ 4: 'pending' }) } as never,
      { listByProjectIdAndKind: jest.fn().mockResolvedValue([]) } as never,
      {
        getPipeline: jest.fn().mockResolvedValue({
          gate4_auto: { ok: true, blocked: false, reasons: [] },
        }),
      } as never,
      { insert, getLatestByProjectId: jest.fn() } as never,
      { listByProjectId: jest.fn().mockResolvedValue([]) } as never,
    );

    const pkg = await service.createPackage(1);
    expect(pkg).not.toBeNull();
    expect(pkg!.meta_json.contains_human).toBe(false);
    expect(pkg!.meta_json.ai_disclosure).toBe(true);
    expect(insert).toHaveBeenCalled();
  });
});
