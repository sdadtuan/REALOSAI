'use client';

import { winScopePilotEnabled } from '@/lib/win/flags';

type Props = {
  clientIds?: string[] | null;
  clientId?: string | null;
  clientLabels?: Record<string, string>;
  className?: string;
  maxItems?: number;
};

function shortId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.length <= 8) return trimmed;
  return `${trimmed.slice(0, 8)}…`;
}

function formatScopeLabel(
  ids: string[],
  labels: Record<string, string>,
  maxItems: number,
): string | null {
  if (!ids.length) return null;
  const names = ids.map((id) => labels[id]?.trim() || shortId(id));
  if (names.length <= maxItems) return names.join(', ');
  return `${names.slice(0, maxItems).join(', ')} +${names.length - maxItems}`;
}

/** R3 pilot — client workspace scope indicator on lead/staff rows. */
export function WinScopeBadge({
  clientIds,
  clientId,
  clientLabels = {},
  className = '',
  maxItems = 2,
}: Props) {
  if (!winScopePilotEnabled()) return null;

  const ids =
    clientIds?.length ? [...clientIds] : clientId?.trim() ? [clientId.trim()] : [];
  const label = formatScopeLabel(ids, clientLabels, maxItems);
  if (!label) return null;

  const title =
    ids.length > maxItems
      ? ids.map((id) => clientLabels[id] ?? id).join(', ')
      : ids.map((id) => clientLabels[id] ?? id).join(', ');

  return (
    <span className={`win-badge-scope ${className}`.trim()} title={`Scope: ${title}`}>
      {ids.length > 1 ? `${ids.length} clients` : 'Client'} · {label}
    </span>
  );
}
