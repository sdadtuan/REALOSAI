import { mapPlanRow } from './marketing-plans-pg.mapper';

describe('marketing-plans-pg.mapper', () => {
  it('exposes legacy id from sqlite_plan_id', () => {
    const row = mapPlanRow({
      id: '100',
      sqlite_plan_id: '42',
      code: 'MP-2026',
      name: 'Q1 Growth Plan',
      status: 'draft',
      priority: 'normal',
      fiscal_year: 2026,
      period_label: 'Q1',
      north_star: '',
      objectives: '',
      pillars_json: '[]',
      audiences: '',
      channels_focus_json: '[]',
      budget_planned_vnd: 0,
      budget_actual_vnd: 0,
      success_metrics_json: '[]',
      risks_notes: '',
      owner_staff_id: null,
      owner_name: '',
      start_date: '',
      end_date: '',
      notes: '',
      strategy_framework_json: '{}',
      target_market_prof_json: '{}',
      target_market_steps4_json: '{}',
      khtn_market_research_json: '{}',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    expect(row.id).toBe(42);
    expect(row.name).toBe('Q1 Growth Plan');
    expect(row.status_label).toBe('Nháp');
  });

  it('falls back to pg id when sqlite_plan_id is absent', () => {
    const row = mapPlanRow({
      id: '99',
      code: '',
      name: 'New Plan',
      status: 'active',
      priority: 'high',
      fiscal_year: 2026,
      period_label: '',
      north_star: '',
      objectives: '',
      pillars_json: '[]',
      audiences: '',
      channels_focus_json: '[]',
      budget_planned_vnd: 0,
      budget_actual_vnd: 0,
      success_metrics_json: '[]',
      risks_notes: '',
      owner_staff_id: null,
      owner_name: '',
      start_date: '',
      end_date: '',
      notes: '',
      strategy_framework_json: '{}',
      target_market_prof_json: '{}',
      target_market_steps4_json: '{}',
      khtn_market_research_json: '{}',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    expect(row.id).toBe(99);
    expect(row.priority_label).toBe('Cao');
  });
});
