import { mapInvoiceRow } from './invoices-pg.mapper';

describe('invoices-pg.mapper', () => {
  it('exposes legacy id from sqlite_invoice_id', () => {
    const row = mapInvoiceRow({
      id: '100',
      sqlite_invoice_id: '55',
      invoice_number: 'INV-2026-00055',
      legacy_customer_id: '7',
      status: 'draft',
      issued_on: null,
      due_on: '2026-02-01',
      amount_vnd: '1000000',
      paid_vnd: '0',
      notes: '',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    expect(row.id).toBe(55);
    expect(row.customer_id).toBe(7);
  });
});
