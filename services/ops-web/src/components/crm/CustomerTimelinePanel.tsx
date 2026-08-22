'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchCustomerTimeline,
  fetchTimelineCompleteness,
  type CustomerTimelineEventRow,
  type CustomerTimelineView,
  type TimelineCompletenessView,
} from '@/lib/api';

const EVENT_TYPE_LABELS: Record<string, string> = {
  'lead.ingested': 'Lead ingest',
  'lead.status_changed': 'Đổi trạng thái',
  'crm.activity': 'Hoạt động CRM',
  'lead.assigned': 'Phân lead',
  'ai.action': 'AI action',
};

const SOURCE_LABELS: Record<string, string> = {
  crm: 'CRM',
  meta: 'Meta',
  zalo: 'Zalo',
  email: 'Email',
  seo: 'SEO',
  call: 'Gọi',
  system: 'System',
  ai: 'AI',
};

interface Props {
  token: string;
  customerId: number;
  showCompleteness?: boolean;
}

function formatWhen(iso: string): string {
  if (!iso) return '—';
  return iso.replace('T', ' ').slice(0, 16);
}

function eventSummary(event: CustomerTimelineEventRow): string {
  if (event.body?.trim()) return event.body.trim();
  const payload = event.payload ?? {};
  if (payload.from_status && payload.to_status) {
    return `${String(payload.from_status)} → ${String(payload.to_status)}`;
  }
  if (payload.channel) {
    return `Kênh ${String(payload.channel)}`;
  }
  return event.title ?? event.event_type;
}

export function CustomerTimelinePanel({ token, customerId, showCompleteness = false }: Props) {
  const [timeline, setTimeline] = useState<CustomerTimelineView | null>(null);
  const [completeness, setCompleteness] = useState<TimelineCompletenessView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [view, gate] = await Promise.all([
        fetchCustomerTimeline(token, customerId, { limit: 50 }),
        showCompleteness ? fetchTimelineCompleteness(token, 500).catch(() => null) : Promise.resolve(null),
      ]);
      setTimeline(view);
      setCompleteness(gate);
    } catch (err) {
      setTimeline(null);
      setError(err instanceof Error ? err.message : 'Không tải timeline');
    } finally {
      setLoading(false);
    }
  }, [customerId, showCompleteness, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const linkedLeadIds = timeline?.linked_lead_ids ?? [];
  const events = timeline?.events ?? [];

  const completenessBadge = useMemo(() => {
    if (!completeness) return null;
    const pct = completeness.completeness_pct;
    const pass = completeness.gate_pass;
    return (
      <span
        className={`customer-timeline-gate${pass ? ' customer-timeline-gate--pass' : ' customer-timeline-gate--warn'}`}
        data-testid="timeline-completeness-badge"
      >
        Timeline completeness {pct}% ({completeness.leads_with_timeline}/{completeness.total_leads})
        {pass ? ' · Gate ≥70%' : ' · Cần ≥70%'}
      </span>
    );
  }, [completeness]);

  return (
    <div className="customer-timeline-panel" data-testid="customer-timeline-panel">
      <div className="customer-timeline-panel__header">
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Timeline thống nhất</h3>
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => void load()} disabled={loading}>
          {loading ? '…' : '↻'}
        </button>
      </div>
      <p className="muted customer-timeline-panel__meta">
        RNOS-16 · AI-UC-008
        {linkedLeadIds.length ? ` · ${linkedLeadIds.length} lead liên kết` : ' · chưa liên kết lead'}
      </p>
      {showCompleteness && completenessBadge}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Đang tải timeline…</p> : null}
      {!loading && timeline && !timeline.timeline_ready ? (
        <p className="muted">Bảng timeline chưa sẵn sàng — apply RNOS-01 DDL.</p>
      ) : null}
      {!loading && timeline?.timeline_ready && events.length === 0 ? (
        <p className="muted">Chưa có sự kiện timeline cho khách hàng này.</p>
      ) : null}
      {!loading && events.length > 0 ? (
        <ul className="customer-timeline-list">
          {events.map((event) => (
            <li key={event.id} className="customer-timeline-item" data-testid="customer-timeline-item">
              <div className="customer-timeline-item__meta">
                <time dateTime={event.occurred_at}>{formatWhen(event.occurred_at)}</time>
                <span className="customer-timeline-chip customer-timeline-chip--type">
                  {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
                </span>
                <span className={`customer-timeline-chip customer-timeline-chip--${event.event_source}`}>
                  {SOURCE_LABELS[event.event_source] ?? event.event_source}
                </span>
                {event.linked_lead_id ? (
                  <Link href={`/crm/leads/${event.linked_lead_id}`} className="nav-link">
                    Lead #{event.linked_lead_id}
                  </Link>
                ) : null}
              </div>
              <strong>{event.title ?? EVENT_TYPE_LABELS[event.event_type] ?? 'Sự kiện'}</strong>
              <p>{eventSummary(event)}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
