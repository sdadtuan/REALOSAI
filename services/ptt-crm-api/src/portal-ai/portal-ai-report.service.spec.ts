import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AiAuditService } from '../ai-intelligence/ai-audit.service';
import { PortalJwtPayload } from '../portal/portal-jwt.util';
import { PerformanceService } from '../performance/performance.service';
import { PortalAiReportService } from './portal-ai-report.service';

function mockPortalUser(overrides?: Partial<PortalJwtPayload>): PortalJwtPayload {
  return {
    sub: 'user-1',
    email: 'viewer@demo.local',
    client_id: '550e8400-e29b-41d4-a716-446655440000',
    role: 'viewer',
    iat: 1,
    exp: 9_999_999_999,
    ...overrides,
  };
}

describe('PortalAiReportService', () => {
  let service: PortalAiReportService;
  const performance = {
    listForClient: jest.fn(),
  };
  const audit = {
    newRequestId: jest.fn(() => 'req-1'),
    wrap: jest.fn(async (_meta, fn) => {
      const result = await fn({ runId: '', requestId: 'req-1' });
      return { data: result.data, runId: 'run-1', requestId: 'req-1', latencyMs: 1 };
    }),
  };

  beforeEach(async () => {
    delete process.env.PTT_PORTAL_AI_SUMMARY_ENABLED;
    performance.listForClient.mockReset();
    audit.newRequestId.mockReturnValue('req-1');
    audit.wrap.mockImplementation(async (_meta, fn) => {
      const result = await fn({ runId: '', requestId: 'req-1' });
      return { data: result.data, runId: 'run-1', requestId: 'req-1', latencyMs: 1 };
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalAiReportService,
        { provide: PerformanceService, useValue: performance },
        { provide: AiAuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(PortalAiReportService);
  });

  it('returns disabled payload when feature flag off', async () => {
    const out = await service.reportSummary(mockPortalUser());
    expect(out.enabled).toBe(false);
    expect(out.narrative).toBe('');
  });

  it('builds narrative when enabled and performance ready', async () => {
    process.env.PTT_PORTAL_AI_SUMMARY_ENABLED = '1';
    performance.listForClient.mockResolvedValue({
      summary: {
        total_spend: 50_000_000,
        total_leads_crm: 20,
        avg_cpl: 2_500_000,
        avg_roas: 1.8,
        campaigns_tracked: 4,
        over_target_rows: 1,
      },
      rows: [{ channel: 'meta', spend: 50_000_000, leads_crm: 20 }],
      unmapped_spend_pct: 5,
      data_freshness: { through_date: '2026-07-27', synced_at: '2026-07-27T00:00:00Z' },
    });

    const out = await service.reportSummary(mockPortalUser(), '7');

    expect(out.enabled).toBe(true);
    expect(out.narrative).toMatch(/50 triệu VND/i);
    expect(out.agent_run_id).toBe('run-1');
    expect(audit.wrap).toHaveBeenCalled();
  });

  it('returns graceful fallback when performance unavailable', async () => {
    process.env.PTT_PORTAL_AI_SUMMARY_ENABLED = '1';
    performance.listForClient.mockRejectedValue(
      new ServiceUnavailableException({ ok: false, error: 'performance_tables_not_ready' }),
    );

    const out = await service.reportSummary(mockPortalUser());

    expect(out.enabled).toBe(true);
    expect(out.error).toBe('performance_tables_not_ready');
    expect(out.narrative).toMatch(/chưa sẵn sàng/i);
  });

  it('rethrows not found for unknown client', async () => {
    process.env.PTT_PORTAL_AI_SUMMARY_ENABLED = '1';
    performance.listForClient.mockRejectedValue(new NotFoundException({ error: 'Not found' }));

    await expect(
      service.reportSummary(mockPortalUser({ client_id: 'missing-client' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
