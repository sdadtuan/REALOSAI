import { NL_QUERY_CATALOG } from './nl-query.catalog';
import {
  NlQueryCatalogEntry,
  NlQueryExecutionResult,
  NlQueryResultPayload,
} from './nl-query.types';

export function normalizeQueryText(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveIntent(input: {
  intent_id?: string;
  question?: string;
}): NlQueryCatalogEntry | null {
  const id = String(input.intent_id ?? '').trim();
  if (id) {
    return NL_QUERY_CATALOG.find((entry) => entry.id === id) ?? null;
  }

  const question = normalizeQueryText(input.question ?? '');
  if (!question) return null;

  for (const entry of NL_QUERY_CATALOG) {
    if (normalizeQueryText(entry.label) === question) return entry;
    for (const alias of entry.aliases) {
      if (normalizeQueryText(alias) === question) return entry;
    }
  }

  const partialMatches = NL_QUERY_CATALOG.filter((entry) => {
    if (normalizeQueryText(entry.label).includes(question)) return true;
    return entry.aliases.some((alias) => normalizeQueryText(alias).includes(question));
  });
  if (partialMatches.length === 1) return partialMatches[0]!;

  return null;
}

export function buildNarrative(
  intent: NlQueryCatalogEntry,
  execution: NlQueryExecutionResult,
): string {
  const rowCount = execution.rows.length;
  const first = execution.rows[0] ?? {};

  switch (intent.id) {
    case 'leads_new_7d':
    case 'leads_new_30d':
    case 'leads_won_30d':
    case 'duplicate_leads_30d':
    case 'qualified_leads_month':
      return `${intent.label}: ${Number(first.count ?? 0).toLocaleString('vi-VN')} bản ghi.`;
    case 'revenue_received_7d':
    case 'revenue_received_30d':
      return `${intent.label}: ${Number(first.amount_vnd ?? 0).toLocaleString('vi-VN')} ₫.`;
    case 'cpl_meta_t30_overview': {
      const cpl = first.cpl_vnd;
      const leads = Number(first.meta_leads ?? 0);
      if (cpl == null) {
        return `CPL Meta T-30: ${leads} lead Meta — chưa đủ chi phí MKT để tính CPL.`;
      }
      return `CPL Meta T-30 ước tính ${Number(cpl).toLocaleString('vi-VN')} ₫ / lead (${leads} lead Meta).`;
    }
    case 'sla_breach_summary':
      return `CSKH SLA: ${Number(first.breach ?? 0)} breach, ${Number(first.warning ?? 0)} warning, ${Number(first.ok ?? 0)} ok.`;
    case 'pipeline_at_risk_count':
      return `Pipeline at-risk: ${Number(first.total ?? 0)} deal cần theo dõi.`;
    case 'ai_acceptance_7d': {
      const rate = first.acceptance_rate_pct;
      return rate == null
        ? 'Chưa có dữ liệu AI acceptance 7 ngày.'
        : `AI acceptance 7 ngày: ${rate}% (${Number(first.accepted ?? 0)} chấp nhận / ${Number(first.dismissed ?? 0)} bỏ).`;
    }
    case 'forecast_month_summary':
      return String(
        first.summary_note ??
          `Forecast ${first.period_label ?? ''}: pipeline ${Number(first.pipeline_amount ?? 0).toLocaleString('vi-VN')} ₫.`,
      );
    case 'churn_health_top10':
      return rowCount
        ? `Top ${rowCount} client churn risk — xem bảng và drill /crm/health.`
        : 'Chưa có health score — chạy RNOS-19 churn scan.';
    case 'renewal_candidates_90d':
      return `${rowCount} hợp đồng sắp hết hạn trong 90 ngày.`;
    case 'revenue_trend_12w':
    case 'leads_trend_12w':
      return `${intent.label}: ${execution.chart?.labels.length ?? 0} tuần dữ liệu read-only.`;
    default:
      if (rowCount === 0) return `${intent.label}: chưa có dữ liệu trong phạm vi truy vấn.`;
      if (rowCount === 1 && first.count != null) {
        return `${intent.label}: ${Number(first.count).toLocaleString('vi-VN')}.`;
      }
      return `${intent.label}: ${rowCount} dòng kết quả (read-only).`;
  }
}

export function toResultPayload(
  intent: NlQueryCatalogEntry,
  execution: NlQueryExecutionResult,
): NlQueryResultPayload {
  return {
    intent_id: intent.id,
    label: intent.label,
    narrative: buildNarrative(intent, execution),
    result_kind: intent.result_kind,
    columns: execution.columns,
    rows: execution.rows,
    chart: execution.chart,
    read_only: true,
    drill_href: execution.drill_href,
  };
}
