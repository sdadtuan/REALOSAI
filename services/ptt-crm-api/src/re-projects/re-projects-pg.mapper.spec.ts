import { mapPgProjectRow } from './re-projects-pg.mapper';

describe('mapPgProjectRow', () => {
  it('maps PG row with defaults for missing plan fields', () => {
    const row = mapPgProjectRow({
      id: 9001,
      code: 'DA-DEMO-01',
      name: 'Demo Tower',
      status: 'selling',
      project_type: 'can_ho',
      district: 'Q1',
      city: 'TP.HCM',
      location_address: '123 Nguyen Hue',
      developer_name: 'CDT Demo',
      investor_name: 'Investor A',
      description: 'desc',
      notes: 'note',
      created_at: new Date('2026-01-15T10:00:00Z'),
      updated_at: '2026-01-16 12:00:00',
    });
    expect(row.id).toBe(9001);
    expect(row.project_type_label).toBe('Căn hộ chung cư');
    expect(row.status_label).toBe('Đang bán');
    expect(row.business_plan).toBeDefined();
    expect(row.created_at).toMatch(/^2026-01-15/);
  });
});
