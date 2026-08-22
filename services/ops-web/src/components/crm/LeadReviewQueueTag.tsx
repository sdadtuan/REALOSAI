import type { LeadRow } from '@/lib/api';

interface Props {
  lead: Pick<LeadRow, 'review_queue'>;
  compact?: boolean;
}

export function LeadReviewQueueTag({ lead, compact = false }: Props) {
  if (!lead.review_queue?.active) {
    return null;
  }

  const hours =
    lead.review_queue.hours_waiting != null ? ` · ${lead.review_queue.hours_waiting}h` : '';

  return (
    <span
      className="lead-kind-tag lead-kind-tag--review"
      title={lead.review_queue.message || 'Quá hạn B2 — chờ GDKD tra soát'}
    >
      {compact ? 'Tra soát' : `Phải tra soát${hours}`}
    </span>
  );
}
