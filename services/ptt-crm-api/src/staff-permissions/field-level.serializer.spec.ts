import {
  assertLeadPatchFieldsAllowed,
  maskPartialPii,
  serializeLeadForCaps,
} from './field-level.serializer';
import { resetFieldRegistryCache } from './field-level.registry';

describe('field-level.serializer', () => {
  beforeEach(() => {
    resetFieldRegistryCache();
  });

  const kdCaps = [{ section: 'crm_leads', action: 'view' }];
  const gdkdCaps = [
    { section: 'crm_leads', action: 'view' },
    { section: 'crm_leads', action: 'view_financial' },
    { section: 'crm_leads', action: 'view_pii' },
  ];
  const hasCap = (caps: { section: string; action: string }[], section: string, action: string) =>
    caps.some((c) => c.section === section && c.action === action);

  it('masks financial fields without view_financial', () => {
    const lead = {
      id: 1,
      full_name: 'A',
      phone: '0901234567',
      email: 'a@b.com',
      status: 'new',
      source: 'web',
      channel: 'web',
      client_id: 'c1',
      campaign_id: null,
      external_lead_id: null,
      owner_id: null,
      created_at: '',
      received_at: '',
      is_duplicate: false,
      expected_value: 1000000,
      margin_pct: 12.5,
    };
    const masked = serializeLeadForCaps(lead, kdCaps, hasCap);
    expect(masked.expected_value).toBe('••••');
    expect(masked.margin_pct).toBe('••••');
  });

  it('shows financial fields with cap', () => {
    const lead = {
      id: 1,
      full_name: 'A',
      phone: '0901234567',
      email: 'a@b.com',
      status: 'new',
      source: 'web',
      channel: 'web',
      client_id: 'c1',
      campaign_id: null,
      external_lead_id: null,
      owner_id: null,
      created_at: '',
      received_at: '',
      is_duplicate: false,
      expected_value: 1000000,
      margin_pct: 12.5,
    };
    const out = serializeLeadForCaps(lead, gdkdCaps, hasCap);
    expect(out.expected_value).toBe(1000000);
    expect(out.margin_pct).toBe(12.5);
  });

  it('strips PII on export without view_pii', () => {
    const lead = {
      id: 1,
      full_name: 'A',
      phone: '0901234567',
      email: 'a@b.com',
      status: 'new',
      source: 'web',
      channel: 'web',
      client_id: 'c1',
      campaign_id: null,
      external_lead_id: null,
      owner_id: null,
      created_at: '',
      received_at: '',
      is_duplicate: false,
    };
    const out = serializeLeadForCaps(lead, kdCaps, hasCap, { exportMode: true });
    expect(out.phone).toBe('');
    expect(out.email).toBe('');
  });

  it('blocks patch on protected fields', () => {
    expect(() =>
      assertLeadPatchFieldsAllowed({ expected_value: 1 }, kdCaps, hasCap),
    ).toThrow();
    expect(() =>
      assertLeadPatchFieldsAllowed({ expected_value: 1 }, gdkdCaps, hasCap),
    ).not.toThrow();
  });

  it('partial masks phone and email', () => {
    expect(maskPartialPii('0901234567')).toContain('4567');
    expect(maskPartialPii('user@example.com')).toContain('@example.com');
  });
});
