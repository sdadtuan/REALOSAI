import { mapMessageRow, mapTicketRow } from './tickets-pg.mapper';

describe('tickets-pg.mapper', () => {
  it('exposes legacy ticket id from sqlite_ticket_id', () => {
    const row = mapTicketRow(
      {
        id: '100',
        sqlite_ticket_id: '42',
        legacy_customer_id: '7',
        customer_name: 'Nguyen A',
        ticket_type: 'phan_anh',
        status: 'moi',
        priority: 'binh_thuong',
        channel: 'khac',
        title: 'Test',
        description: '',
        resolution: '',
        assigned_staff_id: null,
        assigned_staff_name: '—',
        sentiment_label: '',
        sentiment_score: null,
        sentiment_confidence: null,
        sentiment_scored_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        resolved_at: null,
      },
      'client-uuid',
    );
    expect(row.id).toBe(42);
    expect(row.customer_id).toBe(7);
    expect(row.agency_client_id).toBe('client-uuid');
    expect(row.title).toBe('Test');
  });

  it('exposes legacy message id from sqlite_message_id', () => {
    const row = mapMessageRow(
      {
        id: '200',
        sqlite_message_id: '55',
        author_staff_id: null,
        author_staff_name: 'Hệ thống',
        body: 'Hello',
        is_internal: true,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      42,
    );
    expect(row.id).toBe(55);
    expect(row.ticket_id).toBe(42);
    expect(row.body).toBe('Hello');
    expect(row.is_internal).toBe(true);
  });
});
