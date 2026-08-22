import { MarketingAiPlannerController } from './marketing-ai-planner.controller';
import { MarketingAiPlannerService } from './marketing-ai-planner.service';

describe('MarketingAiPlannerController', () => {
  const planner = {
    getContext: jest.fn(),
    patchBrief: jest.fn(),
    patchDraft: jest.fn(),
    runStrategyJob: jest.fn(),
    runCampaignJob: jest.fn(),
    runContentJob: jest.fn(),
    runQualityJob: jest.fn(),
    retryJob: jest.fn(),
    applyToTmmt: jest.fn(),
    exportPlan: jest.fn(),
  };

  const controller = new MarketingAiPlannerController(planner as unknown as MarketingAiPlannerService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('context delegates to service', async () => {
    planner.getContext.mockResolvedValue({ lifecycle_id: 123 });
    await expect(controller.context(123)).resolves.toEqual({ lifecycle_id: 123 });
    expect(planner.getContext).toHaveBeenCalledWith(123);
  });

  it('patchBrief passes actor email from request', async () => {
    planner.patchBrief.mockResolvedValue({ brief: {}, brief_validation: { ok: true, missing: [], messages: [] } });
    const req = { staffAuthVia: 'internal' } as never;
    await controller.patchBrief(123, { brand_name: 'Acme' }, req);
    expect(planner.patchBrief).toHaveBeenCalledWith(123, { brand_name: 'Acme' }, 'internal');
  });

  it('retryJob maps type to service job type', async () => {
    planner.retryJob.mockResolvedValue({ job_id: 1, status: 'succeeded' });
    const req = { staffUser: { email: 'sp@test.vn' } } as never;
    await controller.retryJob(123, 'strategy', req);
    expect(planner.retryJob).toHaveBeenCalledWith(123, 'strategy_generate', 'sp@test.vn');
  });

  it('exportPlan defaults format to pdf', async () => {
    planner.exportPlan.mockResolvedValue({
      format: 'pdf',
      filename: 'a.pdf',
      content: '',
      mime_type: 'application/pdf',
      encoding: 'base64',
    });
    const req = { staffAuthVia: 'internal' } as never;
    await controller.exportPlan(123, {}, req);
    expect(planner.exportPlan).toHaveBeenCalledWith(123, 'pdf', 'internal');
  });
});
