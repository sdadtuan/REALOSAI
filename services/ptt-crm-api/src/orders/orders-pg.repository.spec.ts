import { mapOrderRow } from './orders-pg.mapper';

describe('orders-pg.mapper', () => {
  it('exposes legacy id from sqlite_order_id', () => {
    const row = mapOrderRow({
      id: '100',
      sqlite_order_id: '42',
      reference_code: 'SO-2026-00001',
      legacy_customer_id: '7',
      status: 'draft',
      order_date: '2026-01-01',
      total_vnd: '0',
      billing_type: 'one_off',
      notes: '',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    expect(row.id).toBe(42);
    expect(row.customer_id).toBe(7);
  });
});
