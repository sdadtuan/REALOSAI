import { buildNavPreview, capsToStrings, diffCapStrings } from './staff-nav-preview.util';

describe('staff-nav-preview.util', () => {
  it('builds menu preview from caps', () => {
    const menu = buildNavPreview([{ section: 'crm_leads', action: 'view' }]);
    const leads = menu.find((m) => m.href === '/crm/leads');
    expect(leads?.visible).toBe(true);
    const admin = menu.find((m) => m.href === '/admin/crm/permissions');
    expect(admin?.visible).toBe(false);
  });

  it('diffs cap strings', () => {
    const diff = diffCapStrings(['crm_leads.view'], ['crm_leads.view', 'crm_kpi_records.view']);
    expect(diff.added).toEqual(['crm_kpi_records.view']);
    expect(diff.removed).toEqual([]);
  });

  it('serializes caps', () => {
    expect(capsToStrings([{ section: 'crm_leads', action: 'view' }])).toEqual(['crm_leads.view']);
  });
});
