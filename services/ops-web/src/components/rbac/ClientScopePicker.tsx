'use client';

import { useEffect, useState } from 'react';
import { WinScopeBadge } from '@/components/rbac/WinScopeBadge';
import { fetchAgencyClients, type AgencyClient } from '@/lib/api';
import { winScopePilotEnabled } from '@/lib/win/flags';

type Props = {
  token: string;
  value: string[];
  disabled?: boolean;
  onChange: (clientIds: string[]) => void;
};

export function ClientScopePicker({ token, value, disabled, onChange }: Props) {
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!winScopePilotEnabled()) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    void fetchAgencyClients(token, { status: 'active' })
      .then(({ clients: rows }) => {
        if (!cancelled) setClients(rows ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không tải agency clients');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!winScopePilotEnabled()) return null;

  function toggle(clientId: string) {
    if (disabled) return;
    onChange(
      value.includes(clientId)
        ? value.filter((id) => id !== clientId)
        : [...value, clientId].sort(),
    );
  }

  const labelById = Object.fromEntries(clients.map((c) => [c.id, c.code || c.name]));

  return (
    <section>
      <p className="muted" style={{ margin: '0 0 0.35rem' }}>
        Client scope (R3 pilot)
      </p>
      <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.8rem' }}>
        Rỗng = toàn bộ client (nội bộ). Chọn client để giới hạn lead/workspace.
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Đang tải clients…</p> : null}
      {!loading && clients.length === 0 ? (
        <p className="muted">Chưa có agency client active</p>
      ) : null}
      {!loading && clients.length > 0 ? (
        <div className="win-filter-chips">
          {clients.map((client) => (
            <button
              key={client.id}
              type="button"
              className={`chip${value.includes(client.id) ? ' is-active' : ''}`}
              disabled={disabled}
              title={`${client.code} · ${client.name}`}
              onClick={() => toggle(client.id)}
            >
              {client.code || shortId(client.id)}
            </button>
          ))}
        </div>
      ) : null}
      {value.length ? (
        <div style={{ marginTop: '0.35rem' }}>
          <WinScopeBadge clientIds={value} clientLabels={labelById} />
          <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.75rem' }}>
            User cần đăng nhập lại sau khi lưu scope.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function shortId(id: string): string {
  return id.length <= 8 ? id : `${id.slice(0, 8)}…`;
}
