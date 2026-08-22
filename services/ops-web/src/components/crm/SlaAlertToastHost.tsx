'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createLeadSlaAutoTask,
  cskhSlaAlertsStreamUrl,
  fetchCskhSlaPredictions,
  type SlaPredictRow,
} from '@/lib/api';
import { getAccessToken, hasCap, type StoredStaffUser } from '@/lib/auth';

const POLL_MS = 60_000;
const MAX_TOASTS = 3;

function riskLabel(risk: SlaPredictRow['risk']): string {
  if (risk === 'imminent') return 'Sắp breach';
  if (risk === 'high') return 'Cảnh báo cao';
  return risk;
}

export function SlaAlertToastHost({ user }: { user: StoredStaffUser | null }) {
  const [toasts, setToasts] = useState<SlaPredictRow[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  const pushAlerts = useCallback((rows: SlaPredictRow[]) => {
    const alertRows = rows.filter((row) => row.risk === 'high' || row.risk === 'imminent');
    const fresh = alertRows.filter((row) => {
      const key = `${row.lead_id}:${row.tier}:${row.risk}`;
      if (seenRef.current.has(key)) return false;
      seenRef.current.add(key);
      return true;
    });
    if (!fresh.length) return;
    setToasts((prev) => [...fresh, ...prev].slice(0, MAX_TOASTS));
  }, []);

  useEffect(() => {
    if (!user || !hasCap(user, 'crm_leads', 'view')) return;

    let cancelled = false;
    let eventSource: EventSource | null = null;
    let pollTimer: number | undefined;

    async function poll() {
      const token = getAccessToken();
      if (!token || cancelled) return;
      try {
        const data = await fetchCskhSlaPredictions(token);
        if (!cancelled) pushAlerts(data.items);
      } catch {
        // ignore transient errors
      }
    }

    const token = getAccessToken();
    if (token && typeof EventSource !== 'undefined') {
      try {
        eventSource = new EventSource(cskhSlaAlertsStreamUrl(token));
        eventSource.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as {
              changed?: boolean;
              alerts?: SlaPredictRow[];
            };
            if (payload.changed && payload.alerts?.length) {
              pushAlerts(payload.alerts);
            }
          } catch {
            // ignore malformed SSE payload
          }
        };
        eventSource.onerror = () => {
          eventSource?.close();
          eventSource = null;
        };
      } catch {
        eventSource = null;
      }
    }

    void poll();
    pollTimer = window.setInterval(() => void poll(), POLL_MS);

    return () => {
      cancelled = true;
      eventSource?.close();
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, [user, pushAlerts]);

  if (!user || !hasCap(user, 'crm_leads', 'view') || toasts.length === 0) {
    return null;
  }

  function dismiss(index: number) {
    setToasts((prev) => prev.filter((_, i) => i !== index));
  }

  async function addReminder(row: SlaPredictRow) {
    const token = getAccessToken();
    if (!token) return;
    try {
      await createLeadSlaAutoTask(token, row.lead_id, {
        tier: row.tier,
        suggested_action: row.suggested_action,
        message: row.reason,
      });
      dismiss(toasts.findIndex((t) => t.lead_id === row.lead_id && t.tier === row.tier));
    } catch {
      // silent — user can open lead manually
    }
  }

  return (
    <div className="sla-alert-toast-host" data-testid="sla-alert-toast-host" aria-live="polite">
      {toasts.map((row, index) => (
        <div
          key={`${row.lead_id}-${row.tier}-${index}`}
          className={`sla-alert-toast sla-alert-toast--${row.risk}`}
        >
          <div className="sla-alert-toast__body">
            <strong>{riskLabel(row.risk)}</strong>
            <span>
              {row.lead_name} · còn {row.minutes_remaining}p · {row.reason}
            </span>
          </div>
          <div className="sla-alert-toast__actions">
            <Link href={`/crm/leads/${row.lead_id}`} className="btn btn-sm btn-ghost">
              Mở lead
            </Link>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => void addReminder(row)}>
              Tạo nhắc
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => dismiss(index)} aria-label="Đóng">
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
