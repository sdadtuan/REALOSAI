import type { MktAiBrief, MktAiCampaignDraft, MktAiKpiTreeNode } from './marketing-ai-planner.types';

export function emptyKpiTree(): MktAiKpiTreeNode[] {
  return [
    {
      id: 'north_star',
      label: 'North Star KPI',
      target: '',
      unit: '',
      children: [],
    },
  ];
}

export function normalizeKpiTree(nodes: MktAiKpiTreeNode[] | null | undefined): MktAiKpiTreeNode[] {
  if (!Array.isArray(nodes) || nodes.length === 0) return emptyKpiTree();
  return nodes.map((n, i) => ({
    id: String(n.id ?? `kpi_${i}`),
    label: String(n.label ?? '').trim() || `KPI ${i + 1}`,
    target: n.target != null ? String(n.target) : '',
    unit: n.unit != null ? String(n.unit) : '',
    children: Array.isArray(n.children)
      ? n.children.map((c, j) => ({
          id: String(c.id ?? `kpi_${i}_${j}`),
          label: String(c.label ?? '').trim() || `Campaign KPI ${j + 1}`,
          target: c.target != null ? String(c.target) : '',
          unit: c.unit != null ? String(c.unit) : '',
        }))
      : [],
  }));
}

export function kpiTreeIsComplete(nodes: MktAiKpiTreeNode[] | null | undefined): boolean {
  const tree = normalizeKpiTree(nodes);
  const root = tree[0];
  if (!root?.label?.trim()) return false;
  if (!String(root.target ?? '').trim()) return false;
  const children = root.children ?? [];
  if (children.length === 0) return false;
  return children.every((c) => c.label?.trim() && String(c.target ?? '').trim());
}

/** Suggest KPI tree from brief + campaign drafts (non-destructive seed). */
export function suggestKpiTreeFromContext(
  brief: MktAiBrief | null,
  campaigns: MktAiCampaignDraft[],
): MktAiKpiTreeNode[] {
  const objective = String(brief?.objective ?? 'lead');
  const northLabel =
    objective === 'lead'
      ? 'Cost per Lead (CPL)'
      : objective === 'sales'
        ? 'ROAS / Doanh thu'
        : objective === 'awareness'
          ? 'Reach / Impressions'
          : 'Retention rate';

  const children: MktAiKpiTreeNode[] = campaigns.slice(0, 5).map((c, i) => ({
    id: `campaign_${i}`,
    label: c.name?.trim() || `Campaign ${i + 1}`,
    target: (c.kpis?.[0] ?? c.objective ?? '').trim(),
    unit: '',
  }));

  if (children.length === 0) {
    children.push({
      id: 'campaign_0',
      label: 'Campaign chính',
      target: '',
      unit: '',
    });
  }

  return [
    {
      id: 'north_star',
      label: northLabel,
      target: brief?.budget_monthly_vnd
        ? `Ngân sách ${Math.round(brief.budget_monthly_vnd / 1_000_000)}M/tháng`
        : '',
      unit: 'VND',
      children,
    },
  ];
}
