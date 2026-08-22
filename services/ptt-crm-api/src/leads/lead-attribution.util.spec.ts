import {
  attributionPeriodDays,
  buildAdsHubLink,
  buildHubHref,
  computeCpl,
  normalizeAdsChannel,
  resolveCampaignId,
} from './lead-attribution.util';
import { LeadV1 } from './leads.types';

describe('lead-attribution.util', () => {
  it('resolveCampaignId prefers lead.campaign_id', () => {
    const lead: LeadV1 = {
      id: 1,
      full_name: 'A',
      phone: '',
      email: '',
      status: 'moi',
      source: 'meta',
      channel: 'meta',
      client_id: 'c1',
      campaign_id: 'camp-123',
      external_lead_id: null,
      owner_id: null,
      created_at: '',
      received_at: '',
      is_duplicate: false,
    };
    expect(resolveCampaignId(lead, {})).toBe('camp-123');
  });

  it('buildAdsHubLink routes meta channel to facebook-ads', () => {
    const out = buildAdsHubLink('meta', 'client-uuid', '120');
    expect(out.href).toContain('/meta/facebook-ads');
    expect(out.href).toContain('client_id=client-uuid');
    expect(out.label).toBe('Meta hub');
  });

  it('computeCpl returns null for zero leads', () => {
    expect(computeCpl(100_000, 0)).toBeNull();
    expect(computeCpl(100_000, 10)).toBe(10_000);
  });

  it('normalizeAdsChannel maps facebook to meta', () => {
    expect(normalizeAdsChannel('facebook')).toBe('meta');
  });

  it('buildHubHref encodes campaign id', () => {
    expect(buildHubHref('camp with space')).toBe('/crm/hub?campaign_id=camp%20with%20space');
  });

  it('attributionPeriodDays defaults to 30', () => {
    expect(attributionPeriodDays()).toBe(30);
  });
});
