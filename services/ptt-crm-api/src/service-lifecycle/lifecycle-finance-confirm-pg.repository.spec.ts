import { mapLifecycleFinanceConfirmRow } from './lifecycle-finance-confirm-pg.repository';

describe('lifecycle finance confirm pg mapper', () => {
  it('maps pg row', () => {
    const row = mapLifecycleFinanceConfirmRow({
      id: '3',
      lifecycle_id: '9',
      staff_id: null,
      staff_email: 'a@b.c',
      outstanding_vnd: '1000',
      ar_pending_vnd: '0',
      ar_overdue_vnd: '0',
      strict_mode: true,
      note: null,
      created_at: '2026-08-23T00:00:00.000Z',
    });
    expect(row.id).toBe(3);
    expect(row.lifecycle_id).toBe(9);
    expect(row.staff_id).toBeNull();
    expect(row.strict_mode).toBe(true);
    expect(row.outstanding_vnd).toBe(1000);
  });
});
