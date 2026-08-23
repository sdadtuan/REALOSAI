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
    expect(row.business_plan.approval_status).toBe('draft');
    expect(row.created_at).toMatch(/^2026-01-15/);
  });

  it('merges stored JSONB plans with defaults', () => {
    const row = mapPgProjectRow({
      id: 1,
      code: 'X',
      name: 'Proj',
      status: 'planning',
      project_type: 'can_ho',
      total_units: 100,
      sold_units: 25,
      revenue_target_vnd: 5000000000,
      business_plan_json: { vision: 'Luxury living', approval_status: 'approved' },
      marketing_plan_json: { budget_total_vnd: 1200000000, approval_status: 'draft' },
      sales_plan_json: { units_target: 80 },
    });
    expect(row.business_plan.vision).toBe('Luxury living');
    expect(row.business_plan.approval_status).toBe('approved');
    expect(row.marketing_plan.budget_total_vnd).toBe(1200000000);
    expect(row.sales_plan.units_target).toBe(80);
    expect(row.total_units).toBe(100);
    expect(row.sold_units).toBe(25);
    expect(row.sell_through_pct).toBe(25);
  });
});
