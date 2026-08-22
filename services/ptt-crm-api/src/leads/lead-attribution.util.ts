import { LeadV1 } from './leads.types';

const ATTRIBUTION_PERIOD_DAYS = 30;

export function attributionPeriodDays(): number {
  return ATTRIBUTION_PERIOD_DAYS;
}

export function normalizeAdsChannel(channel: string | null | undefined): string {
  const ch = String(channel ?? '')
    .trim()
    .toLowerCase();
  if (ch === 'facebook') return 'meta';
  return ch;
}

export function resolveCampaignId(lead: LeadV1, meta: Record<string, unknown> = {}): string | null {
  const fromLead = lead.campaign_id?.trim();
  if (fromLead) return fromLead;

  const keys = [
    'campaign_id',
    'facebook_campaign_id',
    'zalo_campaign_id',
    'utm_campaign',
    'external_campaign_id',
  ];
  for (const key of keys) {
    const raw = meta[key];
    if (raw != null && String(raw).trim()) {
      return String(raw).trim();
    }
  }
  return null;
}

export function computeCpl(spend: number, leads: number): number | null {
  if (!Number.isFinite(spend) || spend <= 0 || !Number.isFinite(leads) || leads <= 0) {
    return null;
  }
  return Math.round((spend / leads) * 100) / 100;
}

export function buildHubHref(campaignId: string): string {
  return `/crm/hub?campaign_id=${encodeURIComponent(campaignId)}`;
}

export function buildAdsHubLink(
  channel: string | null,
  clientId: string | null,
  campaignId: string,
): { href: string | null; label: string | null } {
  const qs = new URLSearchParams();
  if (clientId) qs.set('client_id', clientId);
  qs.set('q', campaignId);
  qs.set('tab', 'campaigns');

  const ch = normalizeAdsChannel(channel);
  if (ch === 'meta') {
    return { href: `/meta/facebook-ads?${qs.toString()}`, label: 'Meta hub' };
  }
  if (ch === 'google') {
    return { href: `/google/google-ads?${qs.toString()}`, label: 'Google hub' };
  }
  if (ch === 'zalo') {
    return { href: `/zalo/zalo-ads?${qs.toString()}`, label: 'Zalo hub' };
  }
  if (campaignId) {
    return { href: `/meta/ads-combined?${qs.toString()}`, label: 'Ads CPL' };
  }
  return { href: null, label: null };
}
