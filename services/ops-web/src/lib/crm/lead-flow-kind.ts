import type { LeadFunnelSnapshot, LeadRow } from '@/lib/api';

export type LeadFlowKind = 'spa_operational' | 'b2b_prospect';

export interface LeadFlowKindInput {
  clientId?: string | null;
  channel?: string | null;
  source?: string | null;
  status?: string | null;
  metaJson?: string | Record<string, unknown> | null;
  hasPresales?: boolean;
}

const META_INGEST = new Set(['meta', 'facebook']);

function norm(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function parseMeta(raw: string | Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null) return raw;
  if (!raw?.trim()) return {};
  try {
    const data = JSON.parse(raw) as unknown;
    return data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function isMetaIngest(channel: string, source: string, meta: Record<string, unknown>): boolean {
  if (META_INGEST.has(channel) || META_INGEST.has(source)) return true;
  return Boolean(meta.meta_lead_id || meta.external_lead_id || meta.form_id || meta.facebook_leadgen_id);
}

export function resolveLeadFlowKind(input: LeadFlowKindInput): LeadFlowKind {
  const meta = parseMeta(input.metaJson);

  const explicit = norm(String(meta.lead_flow_kind ?? meta.lead_flow ?? ''));
  if (explicit === 'spa_operational' || explicit === 'spa') return 'spa_operational';
  if (explicit === 'b2b_prospect' || explicit === 'b2b') return 'b2b_prospect';

  const status = norm(input.status);
  if (status === 'won' || status === 'proposal') return 'b2b_prospect';
  if (input.hasPresales) return 'b2b_prospect';

  const clientId = norm(input.clientId);
  const channel = norm(input.channel);
  const source = norm(input.source);
  const metaLead = isMetaIngest(channel, source, meta);

  if (clientId && metaLead) return 'spa_operational';
  if (clientId && !metaLead) return 'spa_operational';
  if (metaLead && !clientId) return 'b2b_prospect';

  return 'b2b_prospect';
}

export function resolveLeadFlowKindFromLead(
  lead: Pick<LeadRow, 'client_id' | 'channel' | 'source' | 'status'>,
  funnel?: Pick<LeadFunnelSnapshot, 'lead_flow_kind' | 'presales'> | null,
): LeadFlowKind {
  if (funnel?.lead_flow_kind) return funnel.lead_flow_kind;
  return resolveLeadFlowKind({
    clientId: lead.client_id,
    channel: lead.channel,
    source: lead.source,
    status: lead.status,
    hasPresales: Boolean(funnel?.presales),
  });
}

export function leadFlowKindLabel(kind: LeadFlowKind): string {
  return kind === 'spa_operational' ? 'CSKH vận hành' : 'B2B Sales';
}

export const SPA_OPERATIONAL_STATUSES = [
  'moi',
  'da_lien_he',
  'dang_tu_van',
  'hen_gap',
  'chot',
  'lost',
  'pending_cleanup',
] as const;

export const B2B_PROSPECT_STATUSES = [
  'moi',
  'da_lien_he',
  'dang_tu_van',
  'bao_gia',
  'dam_phan',
  'proposal',
  'won',
  'lost',
  'pending_cleanup',
] as const;

export function statusOptionsForFlowKind(kind: LeadFlowKind): readonly string[] {
  return kind === 'spa_operational' ? SPA_OPERATIONAL_STATUSES : B2B_PROSPECT_STATUSES;
}

export function showPresalesForFlow(kind: LeadFlowKind): boolean {
  return kind === 'b2b_prospect';
}

export function showContractForFlow(kind: LeadFlowKind): boolean {
  return kind === 'b2b_prospect';
}

export function showB2bSalesFlowBar(kind: LeadFlowKind): boolean {
  return kind === 'b2b_prospect';
}
