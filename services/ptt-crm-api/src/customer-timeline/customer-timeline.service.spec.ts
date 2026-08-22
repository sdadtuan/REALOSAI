import { CustomerTimelineService } from './customer-timeline.service';
import { TIMELINE_EVENT } from './customer-timeline.constants';

describe('CustomerTimelineService', () => {
  const repo = {
    tableReady: jest.fn().mockResolvedValue(true),
    findByExternalRef: jest.fn().mockResolvedValue(null),
    insertEvent: jest.fn().mockResolvedValue({
      id: 'evt-1',
      entity_type: 'lead',
      entity_id: '99',
      event_type: TIMELINE_EVENT.ACTIVITY,
      event_source: 'crm',
    }),
    listEvents: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
    getLeadClientId: jest.fn().mockResolvedValue('client-1'),
  };

  let service: CustomerTimelineService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CustomerTimelineService(repo as never);
  });

  it('mirrors legacy activity with idempotent external_ref', async () => {
    const row = await service.recordActivityFromLegacy(99, {
      id: 5,
      lead_id: 99,
      user_id: 1,
      user_name: 'A',
      activity_type: 'call',
      activity_type_label: 'Gọi điện',
      content: 'Discuss pricing',
      result: '',
      next_action: '',
      next_action_at: '',
      created_at: '2026-07-26T08:00:00Z',
      created_by: 'staff-1',
    });

    expect(row?.id).toBe('evt-1');
    expect(repo.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        externalRef: 'activity:99:5',
        eventSource: 'call',
        eventType: TIMELINE_EVENT.ACTIVITY,
      }),
    );
  });

  it('records lead ingested with meta event_source', async () => {
    await service.recordLeadIngested({
      leadId: 42,
      channel: 'meta',
      clientId: 'client-1',
      externalLeadId: 'fb-123',
      attribution: { form_id: 'f1' },
    });

    expect(repo.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventSource: 'meta',
        eventType: TIMELINE_EVENT.LEAD_INGESTED,
        externalRef: 'ingest:meta:fb-123',
      }),
    );
  });

  it('buildAiContext returns empty when table missing', async () => {
    repo.tableReady.mockResolvedValueOnce(false);
    await expect(service.buildAiContext('lead', '1')).resolves.toEqual([]);
  });

  it('getCustomerTimelineEnvelope returns empty when no linked leads', async () => {
    const out = await service.getCustomerTimelineEnvelope(42, [], { limit: 10 }, 'req-1');
    expect(out.data.customer_id).toBe(42);
    expect(out.data.events).toEqual([]);
    expect(out.data.timeline_ready).toBe(true);
  });
});
