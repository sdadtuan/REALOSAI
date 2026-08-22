import type { CmktItemRow } from './content-marketing.types';

const PII_BRIEF_KEYS = [
  'customer_name',
  'contact_name',
  'lead_name',
  'client_name',
  'phone',
  'email',
  'address',
  'billing_contact',
  'tax_id',
] as const;

const PII_BRAND_KEYS = [
  'customer_name',
  'contact_name',
  'lead_name',
  'client_name',
  'phone',
  'email',
  'address',
  'billing_contact',
] as const;

export type LifecyclePiiContext = {
  lead?: { full_name?: string | null } | null;
  contract?: { title?: string | null } | null;
} | null;

export function resolvePiiConsent(
  brandContext: Record<string, unknown>,
  lifecycleCtx?: LifecyclePiiContext,
): boolean {
  if (brandContext.pii_consent === true || brandContext.customer_pii_consent === true) {
    return true;
  }
  const meta = brandContext.meta_json;
  if (meta && typeof meta === 'object') {
    const m = meta as Record<string, unknown>;
    if (m.pii_consent === true || m.customer_pii_consent === true) return true;
  }
  void lifecycleCtx;
  return false;
}

export function sanitizeBrandContextForPrompt(
  brandContext: Record<string, unknown>,
  piiConsent: boolean,
): Record<string, unknown> {
  if (piiConsent) return { ...brandContext };
  const out = { ...brandContext };
  for (const key of PII_BRAND_KEYS) delete out[key];
  delete out.lead_name;
  delete out.customer_contact;
  return out;
}

export function sanitizeItemForPrompt(item: CmktItemRow, piiConsent: boolean): CmktItemRow {
  if (piiConsent || !item.brief_json) return item;
  const brief = { ...item.brief_json };
  for (const key of PII_BRIEF_KEYS) delete brief[key];
  return { ...item, brief_json: brief };
}

export function injectLifecyclePiiIntoBrandContext(
  brandContext: Record<string, unknown>,
  lifecycleCtx: LifecyclePiiContext,
  piiConsent: boolean,
): Record<string, unknown> {
  if (!piiConsent || !lifecycleCtx) return brandContext;
  const leadName = String(lifecycleCtx.lead?.full_name ?? '').trim();
  if (!leadName) return brandContext;
  return { ...brandContext, lead_name: leadName };
}
