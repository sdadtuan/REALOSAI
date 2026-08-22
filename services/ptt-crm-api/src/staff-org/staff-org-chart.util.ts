import type { StaffOrgChartNode } from './staff-org.types';

export type StaffOrgChartTreeNode = StaffOrgChartNode & {
  children: StaffOrgChartTreeNode[];
};

/** Build forest from flat crm_staff rows (reports_to_id). */
export function buildOrgChartForest(nodes: StaffOrgChartNode[]): StaffOrgChartTreeNode[] {
  const byId = new Map<number, StaffOrgChartTreeNode>();
  for (const node of nodes) {
    byId.set(node.id, { ...node, children: [] });
  }
  const roots: StaffOrgChartTreeNode[] = [];
  for (const node of byId.values()) {
    const parentId = node.reports_to_id;
    if (parentId != null && byId.has(parentId) && parentId !== node.id) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortTree = (list: StaffOrgChartTreeNode[]): StaffOrgChartTreeNode[] =>
    list
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .map((n) => ({ ...n, children: sortTree(n.children) }));
  return sortTree(roots);
}
