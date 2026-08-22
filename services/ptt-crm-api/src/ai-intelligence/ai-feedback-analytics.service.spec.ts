import { ServiceUnavailableException } from '@nestjs/common';
import { AiFeedbackAnalyticsService } from './ai-feedback-analytics.service';

describe('AiFeedbackAnalyticsService', () => {
  const audit = { newRequestId: jest.fn().mockReturnValue('req-analytics-1') };
  const recommendations = {
    tableReady: jest.fn().mockResolvedValue(true),
    getAcceptanceMetrics: jest.fn().mockResolvedValue({
      acceptance_rate_pct: 42.5,
      accepted: 17,
      dismissed: 23,
      pending: 5,
      total_resolved: 40,
      by_type: [{ recommendation_type: 'follow_up_draft', accepted: 17, dismissed: 23, pending: 5 }],
      top_dismiss_reasons: [{ reason: 'wrong_tone', count: 10 }],
    }),
    listRecent: jest.fn().mockResolvedValue({
      rows: [
        {
          id: 'rec-1',
          entity_type: 'lead',
          entity_id: '7',
          recommendation_type: 'follow_up_draft',
          recommendation_text: 'Draft text',
          status: 'dismissed',
          dismissed_reason: 'wrong_tone',
          accepted_by: null,
          accepted_at: null,
          confidence: 0.7,
          created_at: '2026-07-26T00:00:00Z',
          updated_at: '2026-07-26T00:00:00Z',
        },
      ],
      total: 1,
    }),
  };

  let service: AiFeedbackAnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiFeedbackAnalyticsService(audit as never, recommendations as never);
  });

  it('returns acceptance metrics with default 7-day window', async () => {
    const out = await service.getAcceptanceMetrics({});
    expect(out.data.acceptance_rate_pct).toBe(42.5);
    expect(out.data.accepted).toBe(17);
    expect(recommendations.getAcceptanceMetrics).toHaveBeenCalled();
  });

  it('returns inbox list', async () => {
    const out = await service.listInbox({ status: 'dismissed', limit: 20 });
    expect(out.data.total).toBe(1);
    expect(out.data.recommendations[0].dismissed_reason).toBe('wrong_tone');
  });

  it('throws when schema not ready', async () => {
    recommendations.tableReady.mockResolvedValueOnce(false);
    await expect(service.getAcceptanceMetrics({})).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
