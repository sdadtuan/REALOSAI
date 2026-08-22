import { LeadSlaCareService } from './lead-sla-care.service';

describe('LeadSlaCareService re_buyer', () => {
  const baseRow = {
    status: 'moi',
    full_name: 'A',
    phone: '84901234567',
    source: 'meta',
    channel: 'meta',
    client_id: '',
    meta_json: JSON.stringify({ lead_flow_kind: 're_buyer', re_project_id: 12 }),
    care_stages_done_json: '{}',
    received_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  function make(row = baseRow) {
    const config = { crmLeadsLegacyPg: false, sqlitePath: ':memory:', leadMeetingPrepEnabled: false };
    const legacy = { listActivities: jest.fn().mockResolvedValue([]) };
    const leadSqlite = {
      firstCallAtByLeadIds: jest.fn().mockReturnValue(new Map()),
    };
    const lmpRepo = { tableReady: jest.fn().mockResolvedValue(false) };
    const svc = new LeadSlaCareService(
      config as never,
      legacy as never,
      leadSqlite as never,
      lmpRepo as never,
    );
    Object.assign(svc, {
      fetchLeadRow: jest.fn().mockResolvedValue(row),
      hasPresales: jest.fn().mockResolvedValue(false),
    });
    return { svc, leadSqlite };
  }

  it('re_buyer applicable with first_call_15m tier', async () => {
    const { svc } = make();
    const ctx = await svc.getCareContext(1);
    expect(ctx.applicable).toBe(true);
    expect(ctx.lead_flow_kind).toBe('re_buyer');
    expect(ctx.sla_tiers.find((t) => t.tier === 'first_call_15m')).toBeDefined();
    expect(ctx.sla_tiers.find((t) => t.tier === 'b2_complete_4h')?.sla_state).toBe('na');
  });

  it('uses touched_at as first call for re_buyer', async () => {
    const { svc } = make({
      ...baseRow,
      meta_json: JSON.stringify({
        lead_flow_kind: 're_buyer',
        touched_at: new Date().toISOString(),
      }),
      received_at: new Date(Date.now() - 60_000).toISOString(),
      created_at: new Date(Date.now() - 60_000).toISOString(),
    });
    const ctx = await svc.getCareContext(1);
    expect(ctx.sla_tiers.find((t) => t.tier === 'first_call_15m')?.sla_state).toBe('ok');
  });
});
