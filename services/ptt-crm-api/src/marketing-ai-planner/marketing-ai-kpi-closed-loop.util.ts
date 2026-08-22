import { normalizeKpiTree } from './marketing-ai-kpi-tree.util';
import type {
  MktAiDashboardPayload,
  MktAiKpiClosedLoopMetricKind,
  MktAiKpiClosedLoopPayload,
  MktAiKpiClosedLoopRow,
  MktAiKpiTreeNode,
} from './marketing-ai-planner.types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtVnd(n: number): string {
  if (n >= 1_000_000) return `${round2(n / 1_000_000)}M ₫`;
  if (n >= 1_000) return `${Math.round(n / 1000)}k ₫`;
  return `${Math.round(n)} ₫`;
}

function parseNumericTarget(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  const roasMatch = s.match(/roas\s*[≥>=<≤]*\s*([\d.,]+)/i);
  if (roasMatch) {
    const n = Number(roasMatch[1].replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  const leadMatch = s.match(/([\d.,]+)\s*lead/i);
  if (leadMatch) {
    const n = Number(leadMatch[1].replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  const cplMatch = s.match(/cpl\s*[≤<>=]*\s*([\d.,]+)\s*([km])?/i);
  if (cplMatch) {
    let n = Number(cplMatch[1].replace(/,/g, ''));
    const unit = cplMatch[2]?.toLowerCase();
    if (unit === 'k') n *= 1_000;
    if (unit === 'm') n *= 1_000_000;
    return Number.isFinite(n) ? n : null;
  }

  const moneyMatch = s.match(/([\d.,]+)\s*([km])\b/i);
  if (moneyMatch) {
    let n = Number(moneyMatch[1].replace(/,/g, ''));
    const unit = moneyMatch[2].toLowerCase();
    if (unit === 'k') n *= 1_000;
    if (unit === 'm') n *= 1_000_000;
    return Number.isFinite(n) ? n : null;
  }

  const plain = Number(s.replace(/[^\d.,]/g, '').replace(/,/g, ''));
  return Number.isFinite(plain) && plain > 0 ? plain : null;
}

function inferMetricKind(label: string, target: string): {
  kind: MktAiKpiClosedLoopMetricKind;
  direction: MktAiKpiClosedLoopRow['direction'];
} {
  const text = `${label} ${target}`.toLowerCase();
  if (/cpl|cost per lead|chi phí lead/.test(text)) {
    return { kind: 'cpl', direction: 'lower_better' };
  }
  if (/lead|khách hàng tiềm năng/.test(text)) {
    return { kind: 'leads', direction: 'higher_better' };
  }
  if (/roas|doanh thu/.test(text)) {
    return { kind: 'roas', direction: 'higher_better' };
  }
  if (/ngân sách|budget|spend|vnd|₫/.test(text)) {
    return { kind: 'spend', direction: 'lower_better' };
  }
  return { kind: 'other', direction: 'higher_better' };
}

function resolveActualFromOps(
  kind: MktAiKpiClosedLoopMetricKind,
  opsMetrics: Record<string, { actual?: number | null }> | undefined,
): { value: number | null; display: string } | null {
  if (!opsMetrics) return null;
  const pick = (...keys: string[]): number | null => {
    for (const key of keys) {
      const val = opsMetrics[key]?.actual;
      if (val != null && Number.isFinite(Number(val))) return Number(val);
    }
    return null;
  };
  switch (kind) {
    case 'cpl': {
      const value = pick('cpl', 'cost_per_lead', 'cpl_vnd');
      return value != null ? { value, display: fmtVnd(value) } : null;
    }
    case 'leads': {
      const value = pick('leads', 'lead_count', 'qualified_leads');
      return value != null ? { value, display: String(value) } : null;
    }
    case 'roas': {
      const value = pick('roas', 'roas_mtd');
      return value != null ? { value, display: value.toFixed(2) } : null;
    }
    case 'spend': {
      const value = pick('spend', 'spend_vnd', 'ad_spend', 'budget_spent');
      return value != null ? { value, display: fmtVnd(value) } : null;
    }
    default:
      return null;
  }
}

function resolveActual(
  kind: MktAiKpiClosedLoopMetricKind,
  dashboard: MktAiDashboardPayload,
  opsMetrics?: Record<string, { actual?: number | null }>,
): { value: number | null; display: string; source: 'meta' | 'ops' | 'none' } {
  const dash = (() => {
    switch (kind) {
      case 'cpl':
        return {
          value: dashboard.tiles.cpl_mtd,
          display: dashboard.tiles.cpl_mtd != null ? fmtVnd(dashboard.tiles.cpl_mtd) : '—',
        };
      case 'leads':
        return {
          value: dashboard.tiles.leads_mtd,
          display: dashboard.tiles.leads_mtd ? String(dashboard.tiles.leads_mtd) : '—',
        };
      case 'roas':
        return {
          value: dashboard.tiles.roas_mtd,
          display:
            dashboard.tiles.roas_mtd != null
              ? `${dashboard.tiles.roas_mtd.toFixed(2)}${dashboard.tiles.roas_stub ? ' (ước tính)' : ''}`
              : '—',
        };
      case 'spend':
        return {
          value: dashboard.tiles.spend_mtd_vnd,
          display: dashboard.tiles.spend_mtd_vnd ? fmtVnd(dashboard.tiles.spend_mtd_vnd) : '—',
        };
      default:
        return { value: null, display: '—' };
    }
  })();

  if (dashboard.linked && dash.value != null) {
    return { ...dash, source: 'meta' };
  }

  const ops = resolveActualFromOps(kind, opsMetrics);
  if (ops) {
    return { ...ops, source: 'ops' };
  }

  if (dash.value != null) {
    return { ...dash, source: dashboard.linked ? 'meta' : 'none' };
  }

  return { value: null, display: '—', source: 'none' };
}

function computeDeltaPct(
  actual: number,
  target: number,
  direction: MktAiKpiClosedLoopRow['direction'],
): number {
  if (target <= 0) return 0;
  const raw = ((actual - target) / target) * 100;
  if (direction === 'lower_better') return round2(raw);
  return round2(raw);
}

function isAlert(deltaPct: number | null, direction: MktAiKpiClosedLoopRow['direction'], thresholdPct: number): boolean {
  if (deltaPct == null) return false;
  if (direction === 'lower_better') return deltaPct >= thresholdPct;
  return deltaPct <= -thresholdPct;
}

function flattenKpiNodes(tree: MktAiKpiTreeNode[]): Array<{ node: MktAiKpiTreeNode; depth: number }> {
  const out: Array<{ node: MktAiKpiTreeNode; depth: number }> = [];
  for (const root of tree) {
    out.push({ node: root, depth: 0 });
    for (const child of root.children ?? []) {
      out.push({ node: child, depth: 1 });
    }
  }
  return out;
}

export function buildKpiClosedLoopRows(input: {
  appliedTree: MktAiKpiTreeNode[] | null | undefined;
  dashboard: MktAiDashboardPayload;
  thresholdPct: number;
  opsMetrics?: Record<string, { actual?: number | null }>;
}): { rows: MktAiKpiClosedLoopRow[]; messages: string[] } {
  const tree = normalizeKpiTree(input.appliedTree);
  const hasApplied = Array.isArray(input.appliedTree) && input.appliedTree.length > 0;
  const messages: string[] = [];

  if (!hasApplied) {
    messages.push('Chưa có KPI tree đã Apply — Apply TMMT sau khi hoàn thiện KPI tree.');
    return { rows: [], messages };
  }

  if (!input.dashboard.linked && input.opsMetrics && Object.keys(input.opsMetrics).length > 0) {
    messages.push('Actual từ Ops KPI (Ops Hub) — so sánh với KPI tree đã Apply.');
  } else if (!input.dashboard.linked) {
    messages.push('HĐ chưa liên kết agency client — dùng Ops KPI nếu AM đã nhập actual.');
  }

  const rows: MktAiKpiClosedLoopRow[] = [];
  for (const { node } of flattenKpiNodes(tree)) {
    const targetDisplay = String(node.target ?? '').trim();
    if (!targetDisplay) continue;

    const { kind, direction } = inferMetricKind(node.label, targetDisplay);
    const targetValue = parseNumericTarget(targetDisplay);
    const actual = resolveActual(kind, input.dashboard, input.opsMetrics);
    let deltaPct: number | null = null;

    if (targetValue != null && actual.value != null) {
      deltaPct = computeDeltaPct(actual.value, targetValue, direction);
    }

    rows.push({
      id: node.id,
      label: node.label,
      metric_kind: kind,
      target_display: targetDisplay,
      target_value: targetValue,
      actual_value: actual.value,
      actual_display: actual.display,
      delta_pct: deltaPct,
      unit: node.unit ?? '',
      direction,
      alert: isAlert(deltaPct, direction, input.thresholdPct),
    });
  }

  if (rows.length === 0) {
    messages.push('KPI tree đã Apply nhưng chưa có target cụ thể trên node.');
  }

  return { rows, messages };
}

export function buildKpiClosedLoopPayload(input: {
  enabled: boolean;
  lifecycleId: number;
  appliedTree: MktAiKpiTreeNode[] | null | undefined;
  dashboard: MktAiDashboardPayload;
  thresholdPct: number;
  opsMetrics?: Record<string, { actual?: number | null }>;
}): MktAiKpiClosedLoopPayload {
  const hasApplied = Array.isArray(input.appliedTree) && input.appliedTree.length > 0;
  const { rows, messages } = buildKpiClosedLoopRows({
    appliedTree: input.appliedTree,
    dashboard: input.dashboard,
    thresholdPct: input.thresholdPct,
    opsMetrics: input.opsMetrics,
  });
  const alerts = rows.filter((r) => r.alert);

  if (input.enabled && alerts.length > 0) {
    messages.push(`${alerts.length} KPI lệch >${input.thresholdPct}% — xem Optimize copilot.`);
  }

  return {
    ok: true,
    enabled: input.enabled,
    lifecycle_id: input.lifecycleId,
    has_applied_kpi_tree: hasApplied,
    linked: input.dashboard.linked,
    threshold_pct: input.thresholdPct,
    period: input.dashboard.period,
    rows,
    alerts,
    messages,
  };
}

export function buildKpiClosedLoopDashboardLink(lifecycleId: number): string {
  return `/crm/service-delivery/${lifecycleId}?tab=ai-planner&step=dashboard&sub=dashboard`;
}

export function buildWeeklyMemoAlertKey(lifecycleId: number, weekStart: string): string {
  return `mkt_ai_weekly_memo:${lifecycleId}:${weekStart}`;
}
