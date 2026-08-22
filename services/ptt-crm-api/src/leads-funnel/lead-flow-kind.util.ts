import { parseLeadMeta } from './care-pipeline.util';
import type { LeadFunnelRow } from './leads-funnel.types';

export type LeadFlowKind = 'spa_operational' | 'b2b_prospect' | 're_buyer';

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

function isMetaIngest(channel: string, source: string, meta: Record<string, unknown>): boolean {
  if (META_INGEST.has(channel) || META_INGEST.has(source)) return true;
  return Boolean(meta.meta_lead_id || meta.external_lead_id || meta.form_id);
}

export function resolveLeadFlowKind(input: LeadFlowKindInput): LeadFlowKind {
  const meta =
    typeof input.metaJson === 'string' || input.metaJson == null
      ? parseLeadMeta(input.metaJson)
      : (input.metaJson as Record<string, unknown>);

  const explicit = norm(String(meta.lead_flow_kind ?? meta.lead_flow ?? ''));
  if (explicit === 're_buyer' || explicit === 're-buyer' || explicit === 'bds') {
    return 're_buyer';
  }
  if (meta.re_project_id != null && String(meta.re_project_id).trim() !== '') {
    return 're_buyer';
  }
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

export function leadFlowKindLabel(kind: LeadFlowKind): string {
  if (kind === 're_buyer') return 'Khách mua BĐS';
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

const RE_BUYER_STATUSES = [
  'moi',
  'da_lien_he',
  'hen_gap',
  'hold',
  'coc',
  'lost',
  'pending_cleanup',
] as const;

export function statusOptionsForFlowKind(kind: LeadFlowKind): readonly string[] {
  if (kind === 're_buyer') return RE_BUYER_STATUSES;
  return kind === 'spa_operational' ? SPA_OPERATIONAL_STATUSES : B2B_PROSPECT_STATUSES;
}

export function assertStatusAllowedForFlow(kind: LeadFlowKind, status: string): void {
  const next = norm(status);
  const allowed = statusOptionsForFlowKind(kind);
  if (!allowed.includes(next)) {
    const flowLabel = leadFlowKindLabel(kind);
    throw new Error(`Trạng thái «${status}» không thuộc luồng ${flowLabel}.`);
  }
}

export function showPresalesForFlow(kind: LeadFlowKind): boolean {
  return kind === 'b2b_prospect';
}

export function showContractForFlow(kind: LeadFlowKind): boolean {
  return kind === 'b2b_prospect';
}

function metaString(meta: Record<string, unknown>, key: string): string {
  const val = meta[key];
  if (val === undefined || val === null) return '';
  return String(val);
}

export function resolveLeadFlowKindFromFunnelRow(
  row: Pick<LeadFunnelRow, 'status' | 'meta_json' | 'source' | 'channel' | 'client_id'>,
  hasPresales = false,
): LeadFlowKind {
  const meta = parseLeadMeta(row.meta_json);
  const channel = String(
    row.channel?.trim() ||
      metaString(meta, 'channel') ||
      metaString(meta, 'ingest_channel') ||
      metaString(meta, 'utm_source') ||
      row.source ||
      '',
  );
  const source = String(row.source ?? '');
  const clientId =
    row.client_id ??
    (meta.agency_client_id != null ? String(meta.agency_client_id) : null);

  return resolveLeadFlowKind({
    clientId,
    channel,
    source,
    status: row.status,
    metaJson: meta,
    hasPresales,
  });
}
