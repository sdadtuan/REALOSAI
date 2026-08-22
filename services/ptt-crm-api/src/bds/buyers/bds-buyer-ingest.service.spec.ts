import { BdsBuyerIngestService } from './bds-buyer-ingest.service';

describe('BdsBuyerIngestService', () => {
  const prevBuyer = process.env.PTT_BDS_BUYER;

  afterEach(() => {
    if (prevBuyer === undefined) delete process.env.PTT_BDS_BUYER;
    else process.env.PTT_BDS_BUYER = prevBuyer;
  });

  it('isActive follows BUYER flag', () => {
    process.env.PTT_BDS_BUYER = '0';
    const svc = new BdsBuyerIngestService({ sqlitePath: ':memory:', databaseUrl: '' } as never);
    expect(svc.isActive()).toBe(false);
    process.env.PTT_BDS_BUYER = '1';
    expect(svc.isActive()).toBe(true);
  });

  it('BDS-18 prepares re_buyer with tenant', async () => {
    process.env.PTT_BDS_BUYER = '1';
    const svc = new BdsBuyerIngestService({ sqlitePath: ':memory:', databaseUrl: '' } as never);
    jest.spyOn(svc, 'resolveProjectBySlug').mockResolvedValue({
      projectId: 12,
      tenantId: 't-uuid',
    });
    const out = await svc.prepareWebhookLeads({
      channel: 'meta',
      projectSlug: 'sun-village',
      leads: [
        {
          client_id: '',
          channel: 'meta',
          external_lead_id: 'ext1',
          idempotency_key: 'idem1',
          occurred_at: new Date().toISOString(),
          contact: { full_name: 'A', phone: '84901112233' },
          fields: {},
          raw: {},
        },
      ],
    });
    expect(out.handled).toBe(true);
    expect(out.toEnqueue[0].lead_flow_kind).toBe('re_buyer');
    expect(out.toEnqueue[0].meta?.bds_tenant_id).toBe('t-uuid');
    expect(out.toEnqueue[0].meta?.re_project_id).toBe(12);
  });

  it('returns handled false when slug not RE project', async () => {
    process.env.PTT_BDS_BUYER = '1';
    const svc = new BdsBuyerIngestService({ sqlitePath: ':memory:', databaseUrl: '' } as never);
    jest.spyOn(svc, 'resolveProjectBySlug').mockResolvedValue(null);
    const out = await svc.prepareWebhookLeads({
      channel: 'meta',
      projectSlug: 'unknown',
      leads: [
        {
          client_id: '',
          channel: 'meta',
          external_lead_id: 'ext1',
          idempotency_key: 'idem1',
          occurred_at: new Date().toISOString(),
          contact: { full_name: 'A', phone: '84901112233' },
          fields: {},
          raw: {},
        },
      ],
    });
    expect(out.handled).toBe(false);
  });
});
