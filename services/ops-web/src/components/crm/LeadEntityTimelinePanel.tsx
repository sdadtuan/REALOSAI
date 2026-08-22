'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchEntityTimeline } from '@/lib/ai-api';

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

export function LeadEntityTimelinePanel({ token, leadId }: { token: string; leadId: number }) {
  const [events, setEvents] = useState<
    Array<{
      id: string;
      event_type: string;
      event_source: string;
      title: string;
      body: string | null;
      occurred_at: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchEntityTimeline(token, 'lead', leadId, {
        limit: 50,
        event_source: sourceFilter || undefined,
      });
      setEvents(out.data.events);
      const warn = out.errors?.[0] as { code?: string; message?: string } | undefined;
      if (warn?.message) {
        setError(warn.code === 'timeline_not_ready' ? warn.message : warn.message);
      } else {
        setError('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải timeline');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [leadId, sourceFilter, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const sources = useMemo(
    () => [...new Set(events.map((event) => event.event_source).filter(Boolean))],
    [events],
  );

  return (
    <section className="lead-panel lead-panel--timeline-unified" data-testid="lead-entity-timeline">
      <div className="lead-panel__head lead-panel__head--row">
        <div>
          <h3 className="lead-panel__title">Timeline thống nhất</h3>
          <p className="lead-panel__subtitle">RNOS-16 · đa kênh</p>
        </div>
        <select
          className="lead-select lead-select--compact"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          aria-label="Lọc nguồn timeline"
        >
          <option value="">Tất cả channel</option>
          {sources.map((source) => (
            <option key={source} value={source}>
              {SOURCE_LABELS[source] ?? source}
            </option>
          ))}
        </select>
      </div>

      {loading ? <p className="lead-empty-state">Đang tải timeline…</p> : null}

      {error ? (
        <div className="lead-alert lead-alert--error" role="alert">
          <strong>Timeline</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {!loading && !error && !events.length ? (
        <p className="lead-empty-state">
          Chưa có sự kiện — hoạt động CRM sẽ mirror tự động.
        </p>
      ) : null}

      {!loading && events.length > 0 ? (
        <ul className="lead-unified-timeline">
          {events.map((event) => (
            <li key={event.id} className="lead-unified-timeline__item" data-testid={`timeline-event-${event.id}`}>
              <div className="lead-unified-timeline__dot" aria-hidden />
              <div className="lead-unified-timeline__body">
                <div className="lead-unified-timeline__meta">
                  <span className="lead-unified-timeline__type">
                    {EVENT_TYPE_LABELS[event.event_type] ?? event.title}
                  </span>
                  <span className="lead-unified-timeline__source">
                    {SOURCE_LABELS[event.event_source] ?? event.event_source}
                  </span>
                  <time className="lead-unified-timeline__time">
                    {event.occurred_at.replace('T', ' ').slice(0, 16)}
                  </time>
                </div>
                {event.body ? <p className="lead-unified-timeline__text">{event.body}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
