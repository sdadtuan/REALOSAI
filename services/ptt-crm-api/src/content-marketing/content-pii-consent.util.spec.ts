import type { CmktItemRow } from './content-marketing.types';
import {
  injectLifecyclePiiIntoBrandContext,
  resolvePiiConsent,
  sanitizeBrandContextForPrompt,
  sanitizeItemForPrompt,
} from './content-pii-consent.util';

const baseItem = {
  id: 1,
  lifecycle_id: 1,
  title: 'T',
  channel: 'facebook',
  format: 'social_post',
  funnel_goal: 'engagement',
  status: 'draft',
  brief_json: { hook: 'h', customer_name: 'Nguyen Van A', phone: '0901234567' },
  body_json: { markdown: 'x', variants: [] },
} as unknown as CmktItemRow;

describe('content-pii-consent.util', () => {
  it('resolvePiiConsent reads brand flag', () => {
    expect(resolvePiiConsent({ pii_consent: true }, null)).toBe(true);
    expect(resolvePiiConsent({}, null)).toBe(false);
  });

  it('strips PII from brief when consent false', () => {
    const out = sanitizeItemForPrompt(baseItem, false);
    expect(out.brief_json?.customer_name).toBeUndefined();
    expect(out.brief_json?.phone).toBeUndefined();
    expect(out.brief_json?.hook).toBe('h');
  });

  it('injects lead name only when consent true', () => {
    const withLead = injectLifecyclePiiIntoBrandContext(
      { brand_name: 'X' },
      { lead: { full_name: 'Lead Name' } },
      true,
    );
    expect(withLead.lead_name).toBe('Lead Name');

    const blocked = injectLifecyclePiiIntoBrandContext(
      { brand_name: 'X' },
      { lead: { full_name: 'Lead Name' } },
      false,
    );
    expect(blocked.lead_name).toBeUndefined();
  });

  it('sanitizes brand context email/phone', () => {
    const out = sanitizeBrandContextForPrompt(
      { brand_name: 'X', email: 'a@b.vn', phone: '1' },
      false,
    );
    expect(out.email).toBeUndefined();
    expect(out.brand_name).toBe('X');
  });
});
