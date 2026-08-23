import { mapCustomerRow } from './customers-pg.mapper';

describe('customers-pg.mapper', () => {
  it('exposes legacy id from sqlite_customer_id', () => {
    const row = mapCustomerRow({
      id: '100',
      sqlite_customer_id: '42',
      name: 'A',
      phone: '09',
      email: '',
      address: '',
      company: '',
      lead_source: 'web',
      lead_source_note: '',
      date_of_birth: '',
      gender: '',
      id_number: '',
      occupation: '',
      interests: '',
      profile_notes: '',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    expect(row.id).toBe(42);
    expect(row.name).toBe('A');
  });
});
