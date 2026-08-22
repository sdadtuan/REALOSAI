'use client';

import type { ContentOsContext, ContentOsItem, ContentOsPillar } from '@/lib/content-os-api';

interface Props {
  ctx: ContentOsContext;
  pillars: ContentOsPillar[];
  items: ContentOsItem[];
  canWrite: boolean;
  hasAppliedPlan: boolean;
  onOpenCreateItem: () => void;
  onImportPlanner: () => void;
  onOpenReview: () => void;
}

function countItemsForPillar(pillar: ContentOsPillar, items: ContentOsItem[]): number {
  return items.filter((item) => {
    const brief = item.brief_json ?? {};
    if (brief.pillar_id != null && Number(brief.pillar_id) === pillar.id) return true;
    if (brief.pillar_name && String(brief.pillar_name) === pillar.name) return true;
    return item.funnel_goal && item.funnel_goal === pillar.goal;
  }).length;
}

export function ContentOsOverview({
  ctx,
  pillars,
  items,
  canWrite,
  hasAppliedPlan,
  onOpenCreateItem,
  onImportPlanner,
  onOpenReview,
}: Props) {
  const slaBreach = ctx.counts.in_review_sla_breach ?? 0;

  const kpis = [
    { label: 'Due tuần này', value: ctx.counts.scheduled_this_week ?? 0, warn: false },
    { label: 'In review', value: ctx.counts.in_review ?? 0, warn: false },
    { label: 'Published MTD', value: ctx.counts.published_mtd ?? 0, warn: false },
    {
      label: 'SLA breach',
      value: slaBreach,
      warn: slaBreach > 0,
      onClick: slaBreach > 0 ? onOpenReview : undefined,
    },
  ];

  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '0.5rem',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '0.65rem',
          background: 'var(--surface)',
        }}
      >
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            className="btn btn-ghost"
            disabled={!kpi.onClick}
            onClick={kpi.onClick}
            style={{
              textAlign: 'left',
              padding: '0.35rem 0.5rem',
              borderRadius: 6,
              cursor: kpi.onClick ? 'pointer' : 'default',
            }}
          >
            <div className="muted" style={{ fontSize: '0.78rem' }}>
              {kpi.label}
            </div>
            <div
              style={{
                fontSize: '1.35rem',
                fontWeight: 700,
                color: kpi.warn ? 'var(--warning, #e6a700)' : 'var(--text)',
              }}
            >
              {kpi.value}
              {kpi.warn ? ' ⚠' : ''}
            </div>
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '0.65rem',
        }}
      >
        <span className="muted" style={{ fontSize: '0.85rem', alignSelf: 'center', marginRight: '0.25rem' }}>
          Quick actions
        </span>
        {canWrite ? (
          <button type="button" className="btn btn-sm" onClick={onOpenCreateItem}>
            + Item
          </button>
        ) : null}
        {canWrite && hasAppliedPlan ? (
          <button type="button" className="btn btn-sm btn-secondary" onClick={onImportPlanner}>
            Import Planner
          </button>
        ) : null}
        <button type="button" className="btn btn-sm btn-ghost" onClick={onOpenReview}>
          Mở Review queue
          {ctx.counts.in_review ? ` (${ctx.counts.in_review})` : ''}
        </button>
      </div>

      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '0.65rem',
          display: 'grid',
          gap: '0.45rem',
        }}
      >
        <strong style={{ fontSize: '0.9rem' }}>Pillars (mirror)</strong>
        {!pillars.length ? (
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Chưa có pillar — import Planner hoặc quản lý tab Pillars.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.35rem' }}>
            {pillars.map((p) => {
              const cnt = countItemsForPillar(p, items);
              return (
                <li key={p.id} style={{ fontSize: '0.88rem' }}>
                  • {p.name}{' '}
                  <span className="muted">
                    ({p.goal}) — {cnt} item{cnt !== 1 ? 's' : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
