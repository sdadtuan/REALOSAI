import { createHash } from 'crypto';

export type IngressChannel = 'facebook' | 'zalo' | 'webform' | 'api';

export interface IngressCatalog {
  forms: Array<{ formId: string; pageId: string; projectId: string; projectSlug: string; active: boolean }>;
  pages: Array<{ pageId: string; projectId: string; projectSlug: string; active: boolean }>;
  accounts?: Array<{
    channel: 'zalo' | 'webform' | 'api';
    externalKey: string;
    projectId: string;
    projectSlug: string;
    active: boolean;
  }>;
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(String(raw ?? '').trim()).digest('hex');
}

export function resolveIngressProject(
  input: {
    channel: IngressChannel;
    formId?: string;
    pageId?: string;
    oaId?: string;
    webformSlug?: string;
    apiKeyHash?: string;
    projectSlug: string;
  },
  catalog: IngressCatalog,
): { projectId: string } | { unmatched: true; reason: string } {
  const slug = String(input.projectSlug ?? '').trim().toLowerCase();
  if (input.channel === 'facebook') {
    const form = catalog.forms.find((f) => f.active && f.formId === String(input.formId ?? '').trim());
    if (!form) return { unmatched: true, reason: 'form_unmapped' };
    if (form.projectSlug !== slug) return { unmatched: true, reason: 'slug_mismatch' };
    return { projectId: form.projectId };
  }
  const key =
    input.channel === 'zalo'
      ? String(input.oaId ?? '').trim()
      : input.channel === 'webform'
        ? String(input.webformSlug ?? '').trim()
        : String(input.apiKeyHash ?? '').trim();
  const row = (catalog.accounts ?? []).find(
    (a) => a.active && a.channel === input.channel && a.externalKey === key,
  );
  if (!row) return { unmatched: true, reason: 'account_unmapped' };
  if (row.projectSlug !== slug) return { unmatched: true, reason: 'slug_mismatch' };
  return { projectId: row.projectId };
}

export function webhookChannelToIngress(channel: string): IngressChannel | null {
  const c = channel.trim().toLowerCase();
  if (c === 'meta' || c === 'facebook') return 'facebook';
  if (c === 'zalo') return 'zalo';
  if (c === 'webform' || c === 'website') return 'webform';
  if (c === 'api') return 'api';
  return null;
}

export function extractIngressKeysFromLead(
  channel: string,
  lead: {
    external_form_id?: string | null;
    fields?: Record<string, string>;
    raw?: Record<string, unknown>;
  },
): { formId?: string; pageId?: string; oaId?: string; webformSlug?: string } {
  const fields = lead.fields ?? {};
  const raw = lead.raw ?? {};
  const rawMeta =
    raw.meta && typeof raw.meta === 'object' ? (raw.meta as Record<string, unknown>) : {};
  const formId = String(
    lead.external_form_id ?? fields.form_id ?? rawMeta.form_id ?? raw.form_id ?? '',
  ).trim();
  const pageId = String(fields.page_id ?? rawMeta.page_id ?? raw.page_id ?? raw.oa_id ?? '').trim();
  const oaId = String(fields.oa_id ?? raw.oa_id ?? raw.app_id ?? rawMeta.oa_id ?? '').trim();
  const webformSlug = String(fields.webform_slug ?? fields.slug ?? raw.slug ?? '').trim();
  if (channel === 'meta' || channel === 'facebook') {
    return { formId: formId || undefined, pageId: pageId || undefined };
  }
  if (channel === 'zalo') return { oaId: oaId || undefined };
  return { webformSlug: webformSlug || undefined };
}
