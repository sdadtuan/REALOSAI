import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LeadRow } from '@/lib/api';
import type { LeadScoreSummary } from '@/lib/ai-api';
import { LeadScoreBadge } from '@/components/ai/LeadScoreBadge';
import { LeadReviewQueueTag } from '@/components/crm/LeadReviewQueueTag';
import { WinScopeBadge } from '@/components/rbac/WinScopeBadge';
import { WinEmptyState } from '@/components/win';

interface Props {
  rows: LeadRow[];
  loading: boolean;
  ownerNameById?: Record<number, string>;
  showScores?: boolean;
  scoreMap?: Record<string, LeadScoreSummary>;
  scoresPending?: boolean;
  showLeadKindTags?: boolean;
  detailHref?: (leadId: number) => string;
  emptyActions?: ReactNode;
}

function slaLabel(lead: LeadRow): string | null {
  if (!lead.review_queue?.active) return null;
  const hours = lead.review_queue.hours_waiting;
  if (hours != null && hours >= 0) {
    if (hours >= 24) return `SLA ${Math.floor(hours / 24)} ngày`;
    return `SLA ${Math.round(hours)}h`;
  }
  return 'Chờ tra soát';
}

function slaTone(lead: LeadRow): 'ok' | 'warn' | 'breach' {
  const hours = lead.review_queue?.hours_waiting;
  if (hours == null) return 'warn';
  if (hours >= 24) return 'breach';
  if (hours >= 8) return 'warn';
  return 'ok';
}

export function LeadsMobileCardList({
  rows,
  loading,
  ownerNameById = {},
  showScores = false,
  scoreMap = {},
  scoresPending = false,
  showLeadKindTags = true,
  detailHref = (id) => `/crm/leads/${id}`,
  emptyActions,
}: Props) {
  if (!loading && rows.length === 0) {
    return (
      <WinEmptyState
        icon="📋"
        title="Chưa có lead"
        subtitle="Thử đổi bộ lọc hoặc import Excel để thêm lead mới."
      >
        {emptyActions}
      </WinEmptyState>
    );
  }

  return (
    <ul className="win-leads-mobile-list lead-card-list" aria-label="Danh sách lead (mobile)">
      {rows.map((lead) => {
        const ownerLabel =
          lead.owner_id != null
            ? ownerNameById[lead.owner_id] ?? `NV #${lead.owner_id}`
            : 'Chưa phân';
        const sla = slaLabel(lead);
        const phoneDigits = lead.phone?.replace(/\D/g, '') ?? '';

        return (
          <li
            key={lead.id}
            className={`win-leads-mobile-card${lead.review_queue?.active ? ' win-leads-mobile-card--review' : ''}`}
          >
            <div className="win-leads-mobile-card__body">
              <div className="win-leads-mobile-card__head">
                <h3 className="win-leads-mobile-card__name">{lead.full_name || `Lead #${lead.id}`}</h3>
                <div className="win-leads-mobile-card__badges">
                  <WinScopeBadge clientId={lead.client_id} />
                  {showScores ? (
                    <LeadScoreBadge score={scoreMap[String(lead.id)]} pending={scoresPending} />
                  ) : null}
                  {showLeadKindTags && lead.review_queue?.active ? (
                    <LeadReviewQueueTag lead={lead} compact />
                  ) : null}
                </div>
              </div>
              <p className="win-leads-mobile-card__meta">
                {lead.phone ? <span>{lead.phone}</span> : null}
                {lead.source ? <span>{lead.source}</span> : null}
                {lead.status ? <span>{lead.status}</span> : null}
              </p>
              <p className="win-leads-mobile-card__owner">
                Owner: <strong>{ownerLabel}</strong>
                {sla ? (
                  <>
                    {' '}
                    ·{' '}
                    <span className={`win-sla-chip win-sla-chip--${slaTone(lead)}`}>{sla}</span>
                  </>
                ) : null}
              </p>
            </div>
            <div className="win-leads-mobile-card__actions">
              {phoneDigits ? (
                <a className="win-leads-mobile-card__action" href={`tel:${phoneDigits}`}>
                  Gọi
                </a>
              ) : (
                <span className="win-leads-mobile-card__action" aria-disabled="true" style={{ opacity: 0.45 }}>
                  Gọi
                </span>
              )}
              <Link
                href={detailHref(lead.id)}
                className="win-leads-mobile-card__action win-leads-mobile-card__action--primary"
              >
                Chi tiết →
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
