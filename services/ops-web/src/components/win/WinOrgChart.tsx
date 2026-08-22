'use client';

import Link from 'next/link';
import type { StaffOrgChartNode } from '@/lib/api';

export type StaffOrgChartTreeNode = StaffOrgChartNode & {
  children: StaffOrgChartTreeNode[];
};

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

function OrgChartNode({ node, depth }: { node: StaffOrgChartTreeNode; depth: number }) {
  return (
    <li className="win-org-chart__node">
      <div className="win-org-chart__card" style={{ marginLeft: depth * 16 }}>
        <Link href={`/crm/staff/${node.id}`} className="win-org-chart__name nav-link">
          {node.name}
        </Link>
        {node.position_code ? (
          <span className="win-badge-rbac win-org-chart__badge">{node.position_code}</span>
        ) : null}
        <span className="muted win-org-chart__meta">
          {[node.job_title, node.department].filter(Boolean).join(' · ') || '—'}
          {!node.active ? ' · inactive' : ''}
        </span>
      </div>
      {node.children.length > 0 ? (
        <ul className="win-org-chart__children">
          {node.children.map((child) => (
            <OrgChartNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WinOrgChart({
  nodes,
  loading,
  error,
}: {
  nodes: StaffOrgChartNode[];
  loading?: boolean;
  error?: string;
}) {
  const forest = buildOrgChartForest(nodes);

  if (loading) return <p className="muted">Đang tải sơ đồ…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!nodes.length) {
    return (
      <p className="muted">
        Chưa có dữ liệu nhân sự. Thêm NV trong roster hoặc onboard wizard.
      </p>
    );
  }
  if (!forest.length) return <p className="muted">Không dựng được cây tổ chức.</p>;

  return (
    <div className="win-org-chart" data-testid="win-org-chart">
      <ul className="win-org-chart__roots">
        {forest.map((root) => (
          <OrgChartNode key={root.id} node={root} depth={0} />
        ))}
      </ul>
    </div>
  );
}
