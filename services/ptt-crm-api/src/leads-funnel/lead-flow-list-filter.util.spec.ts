import {
  buildB2bListScopeClause,
  buildB2bProspectListFilter,
  buildLeadFlowKindListFilter,
  buildReBuyerListFilter,
  buildSpaOperationalListFilter,
} from './lead-flow-list-filter.util';

describe('lead-flow-list-filter.util', () => {
  it('builds spa filter with explicit meta and client guard', () => {
    const sql = buildSpaOperationalListFilter('postgres', 'l');
    expect(sql).toContain("l.meta_json->>'lead_flow_kind'");
    expect(sql).toContain('l.agency_client_id IS NOT NULL');
    expect(sql).toContain("'won', 'proposal'");
    expect(sql).toContain("'re_buyer', 're-buyer', 'bds'");
    expect(sql).toContain("l.meta_json->>'re_project_id'");
  });

  it('builds b2b filter with explicit meta and default-no-client guard', () => {
    const sql = buildB2bProspectListFilter('postgres', 'l');
    expect(sql).toContain("'b2b_prospect', 'b2b'");
    expect(sql).toContain("'won', 'proposal'");
    expect(sql).toContain('l.agency_client_id IS NOT NULL');
    expect(sql).toContain("'re_buyer', 're-buyer', 'bds'");
    expect(sql).toContain("l.meta_json->>'re_project_id'");
  });

  it('builds b2b list filter via kind selector', () => {
    const sql = buildLeadFlowKindListFilter('b2b_prospect', 'postgres', 'l');
    expect(sql).toContain(buildB2bProspectListFilter('postgres', 'l'));
  });

  it('builds re_buyer list filter matching resolve signals', () => {
    const sql = buildReBuyerListFilter('postgres', 'l');
    expect(sql).toContain("'re_buyer', 're-buyer', 'bds'");
    expect(sql).toContain("l.meta_json->>'re_project_id'");
    expect(sql).not.toContain("'b2b_prospect'");
    expect(sql).not.toContain("'won', 'proposal'");
  });

  it('does not fall back re_buyer kind selector to B2B filter', () => {
    const sql = buildLeadFlowKindListFilter('re_buyer', 'postgres', 'l');
    expect(sql).toBe(buildReBuyerListFilter('postgres', 'l'));
    expect(sql).not.toBe(buildB2bProspectListFilter('postgres', 'l'));
    expect(sql).not.toContain(buildB2bProspectListFilter('postgres', 'l'));
  });

  it('excludes re_buyer signals from spa and B2B filters', () => {
    const reBuyer = buildReBuyerListFilter('postgres', 'l');
    expect(buildSpaOperationalListFilter('postgres', 'l')).toContain(`NOT ${reBuyer}`);
    expect(buildB2bProspectListFilter('postgres', 'l')).toContain(`NOT ${reBuyer}`);
  });

  it('builds b2b list scope clause for restricted staff', () => {
    const sql = buildB2bListScopeClause(
      'postgres',
      'l',
      { staffId: 10, viewAll: false, isDirector: false },
      '$1',
    );
    expect(sql).toContain('crm_b2b_project_staff');
    expect(sql).toContain('l.owner_id = $1');
  });

  it('skips b2b scope clause for view-all', () => {
    const sql = buildB2bListScopeClause(
      'postgres',
      'l',
      { staffId: 10, viewAll: true, isDirector: false },
      '$1',
    );
    expect(sql).toBe('');
  });

  it('supports sqlite dialect for funnel sqlite reads', () => {
    const sql = buildLeadFlowKindListFilter('spa_operational', 'sqlite', 'l');
    expect(sql).toContain("json_extract(l.meta_json, '$.lead_flow_kind')");
    expect(sql).toContain("json_extract(l.meta_json, '$.agency_client_id')");
    expect(sql).toContain("json_extract(l.meta_json, '$.re_project_id')");
  });

  it('supports sqlite dialect for re_buyer filter', () => {
    const sql = buildLeadFlowKindListFilter('re_buyer', 'sqlite', 'l');
    expect(sql).toBe(buildReBuyerListFilter('sqlite', 'l'));
    expect(sql).toContain("json_extract(l.meta_json, '$.lead_flow_kind')");
    expect(sql).toContain("json_extract(l.meta_json, '$.re_project_id')");
    expect(sql).not.toContain("'b2b_prospect'");
  });
});
