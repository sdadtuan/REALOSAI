import { ProposalRow, ProposalStatus, QuoteLineItemRow } from './proposals.types';

function formatTs(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().replace('T', ' ').slice(0, 19);
  }
  const s = String(value ?? '');
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return s.replace('T', ' ').slice(0, 19);
  }
  return s;
}

export function mapProposalRow(
  row: Record<string, unknown>,
  parseAi: boolean,
  legacyCustomerId?: number,
): ProposalRow {
  let serviceSlugs: string[] = [];
  try {
    serviceSlugs = JSON.parse(String(row.service_slugs ?? '[]'));
  } catch {
    serviceSlugs = [];
  }
  let aiOutput: Record<string, unknown> = {};
  const rawAi = String(row.ai_output ?? '{}');
  if (parseAi) {
    try {
      aiOutput = JSON.parse(rawAi) as Record<string, unknown>;
    } catch {
      aiOutput = {};
    }
  } else {
    try {
      aiOutput = JSON.parse(rawAi) as Record<string, unknown>;
    } catch {
      aiOutput = {};
    }
  }
  const generated = Object.values(aiOutput).some((v) => Boolean(v));
  const status = String(row.status ?? 'draft') as ProposalStatus;
  return {
    id: Number(row.sqlite_proposal_id ?? row.id),
    customer_id: legacyCustomerId ?? Number(row.legacy_customer_id ?? row.customer_id),
    lead_id: row.lead_id != null ? Number(row.lead_id) : null,
    presales_id: row.presales_id != null ? Number(row.presales_id) : null,
    lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
    service_slugs: serviceSlugs,
    total_vnd: Number(row.total_vnd ?? 0),
    timeline_months: Number(row.timeline_months ?? 1),
    notes: String(row.notes ?? ''),
    ai_output: aiOutput,
    generated,
    status: ['draft', 'sent', 'accepted', 'rejected'].includes(status) ? status : 'draft',
    valid_until: row.valid_until != null ? String(row.valid_until).slice(0, 10) : null,
    price_adjustment_reason: String(row.price_adjustment_reason ?? ''),
    created_at: formatTs(row.created_at),
    updated_at: formatTs(row.updated_at),
  };
}

export function mapLineRow(
  row: Record<string, unknown>,
  legacyProposalId?: number,
): QuoteLineItemRow {
  return {
    id: Number(row.sqlite_line_id ?? row.id),
    proposal_id: legacyProposalId ?? Number(row.proposal_id),
    dv_code: String(row.dv_code ?? ''),
    sku_code: row.sku_code != null ? String(row.sku_code) : null,
    package_tier: String(row.package_tier ?? ''),
    service_slug: String(row.service_slug ?? ''),
    reference_price_min: Number(row.reference_price_min ?? 0),
    reference_price_max: Number(row.reference_price_max ?? 0),
    final_price_vnd: Number(row.final_price_vnd ?? 0),
    scope_notes: String(row.scope_notes ?? ''),
    lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
    sort_order: Number(row.sort_order ?? 0),
  };
}
