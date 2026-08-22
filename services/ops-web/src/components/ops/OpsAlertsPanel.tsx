'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  acknowledgeOpsAlert,
  type OpsAlertItem,
  type OpsHubPayload,
} from '@/lib/ops-dv-api';

type Props = {
  token: string;
  lifecycleId: number;
  alerts: OpsHubPayload['alerts'];
  canEdit: boolean;
  onRefresh: () => Promise<void>;
};

function severityClass(severity: OpsAlertItem['severity']): string {
  if (severity === 'critical') return 'error';
  if (severity === 'warning') return 'muted';
  return 'muted';
}

export function OpsAlertsPanel({ token, lifecycleId, alerts, canEdit, onRefresh }: Props) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function onAck(alertId: number) {
    if (!canEdit || busy != null) return;
    setBusy(alertId);
    setError('');
    try {
      await acknowledgeOpsAlert(token, alertId);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xác nhận cảnh báo thất bại');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <h4 style={{ margin: 0 }}>
          Cảnh báo{alerts.open_count > 0 ? ` (${alerts.open_count})` : ''}
        </h4>
        <Link href="/crm/ops/alerts" className="nav-link">
          Trung tâm cảnh báo
        </Link>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {alerts.items.length === 0 ? (
        <p className="muted" style={{ margin: '0.35rem 0 0' }}>
          Không có cảnh báo mở cho lifecycle #{lifecycleId}.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0', display: 'grid', gap: '0.5rem' }}>
          {alerts.items.map((alert) => (
            <li
              key={alert.id}
              style={{
                border: '1px solid var(--border, #ddd)',
                borderRadius: 8,
                padding: '0.65rem 0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <strong className={severityClass(alert.severity)}>{alert.title}</strong>
                  <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                    {alert.message}
                  </p>
                  <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                    {alert.alert_type} · {new Date(alert.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>
                {canEdit && alert.status === 'open' ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={busy === alert.id}
                    onClick={() => void onAck(alert.id)}
                  >
                    Đã xử lý
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
