import {
  capsToGrantMap,
  diffGrantMaps,
  grantsToMatrix,
  normalizeGrantPayload,
} from './staff-permissions.catalog';

describe('staff-permissions.catalog', () => {
  it('normalizeGrantPayload keeps valid section actions', () => {
    const grants = normalizeGrantPayload({
      crm_leads: ['view', 'edit', 'invalid'],
      crm_email_mkt: ['view', 'write', 'reports'],
      unknown_section: ['view'],
    });
    expect(grants.crm_leads).toEqual(['edit', 'view']);
    expect(grants.crm_email_mkt).toEqual(['reports', 'view', 'write']);
    expect(grants.unknown_section).toBeUndefined();
  });

  it('diffGrantMaps tracks added and removed caps', () => {
    const before = { crm_leads: ['view'] };
    const after = { crm_leads: ['view', 'edit'], crm_agency: ['view'] };
    const diff = diffGrantMaps(before, after);
    expect(diff.added).toEqual([
      { section_id: 'crm_leads', action: 'edit' },
      { section_id: 'crm_agency', action: 'view' },
    ]);
    expect(diff.removed).toEqual([]);
  });

  it('grantsToMatrix includes ui button rows', () => {
    const grants = capsToGrantMap([
      { section_id: 'crm_leads', action: 'view' },
      { section_id: 'crm_leads', action: 'create' },
    ]);
    const matrix = grantsToMatrix(grants);
    const leads = matrix.find((r) => r.section_id === 'crm_leads' && r.row_kind === 'section');
    const btn = matrix.find((r) => r.section_id === 'crm_leads__btn_create');
    expect(leads?.allowed).toContain('view');
    expect(btn?.row_kind).toBe('ui_button');
  });
});
