import { Test, TestingModule } from '@nestjs/testing';
import { MetaAlertsRepository } from '../meta-alerts/meta-alerts.repository';
import { AiAuditService } from './ai-audit.service';
import { AnomalyDigestService } from './anomaly-digest.service';

describe('AnomalyDigestService', () => {
  let service: AnomalyDigestService;
  const metaAlerts = {
    pgMetaAlertsReady: jest.fn(),
    summarizeOpenAlerts: jest.fn(),
  };
  const audit = {
    newRequestId: jest.fn(() => 'req-anomaly'),
    wrap: jest.fn(async (_meta, fn) => {
      const result = await fn({ runId: '', requestId: 'req-anomaly' });
      return { data: result.data, runId: 'run-anomaly-1', requestId: 'req-anomaly', latencyMs: 1 };
    }),
  };

  beforeEach(async () => {
    delete process.env.PTT_AI_ANOMALY_DIGEST_ENABLED;
    metaAlerts.pgMetaAlertsReady.mockReset();
    metaAlerts.summarizeOpenAlerts.mockReset();
    audit.wrap.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnomalyDigestService,
        { provide: MetaAlertsRepository, useValue: metaAlerts },
        { provide: AiAuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(AnomalyDigestService);
  });

  it('returns disabled payload when feature flag off', async () => {
    process.env.PTT_AI_ANOMALY_DIGEST_ENABLED = '0';
    const out = await service.getDigest();
    expect(out.data.enabled).toBe(false);
    expect(out.data.digest).toBeNull();
  });

  it('builds digest when alerts ready', async () => {
    metaAlerts.pgMetaAlertsReady.mockResolvedValue(true);
    metaAlerts.summarizeOpenAlerts.mockResolvedValue({
      meta_open_alerts: 1,
      zalo_open_alerts: 0,
      cpl_spike_count: 1,
      zero_leads_24h_count: 0,
      roas_low_count: 0,
      spend_spike_count: 0,
      top_anomaly_message: 'CPL spike',
      top_anomaly_channel: 'meta',
      top_anomaly_campaign_id: 'camp_1',
      top_alerts: [
        {
          id: '1',
          client_id: 'c1',
          channel: 'meta',
          external_campaign_id: 'camp_1',
          alert_type: 'cpl_spike',
          severity: 'warning',
          metric_value: 1,
          threshold_value: 1,
          message: 'CPL spike',
          performance_date: '2026-07-27',
          dedupe_key: 'k',
          acknowledged_at: null,
          created_at: '2026-07-27T01:00:00.000Z',
        },
      ],
    });

    const out = await service.getDigest({ channel: 'meta', client_id: 'c1' });
    expect(out.data.enabled).toBe(true);
    expect(out.data.digest?.narrative).toMatch(/alert/i);
    expect(out.data.agent_run_id).toBe('run-anomaly-1');
  });
});
