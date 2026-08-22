'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchAgencyClients } from '@/lib/api';
import { canWriteContentOs, getAccessToken, hasCap, type StoredStaffUser } from '@/lib/auth';
import { isMarketResearchFeEnabled } from '@/lib/market-research-flags';
import {
  fetchApprovedInsightsForClient,
  insertContentInsights,
  INSIGHT_STATUS_LABELS,
  parsePlanInsightSnapshot,
  type PlanInsightSnapshot,
  type ResearchInsight,
} from '@/lib/market-research-api';

const fieldStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.55rem 0.75rem',
  color: 'var(--text)',
} as const;

export function InsertInsightContentPanel({
  itemId,
  lifecycleClientId,
  briefJson,
  user,
  onInserted,
}: {
  itemId: number;
  lifecycleClientId: string;
  briefJson: unknown;
  user: StoredStaffUser;
  onInserted: (snapshot: PlanInsightSnapshot) => void;
}) {
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState(lifecycleClientId);
  const [insights, setInsights] = useState<ResearchInsight[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const snapshot = useMemo(() => {
    const rec = briefJson && typeof briefJson === 'object' ? (briefJson as Record<string, unknown>) : null;
    return parsePlanInsightSnapshot(rec?.market_research ?? briefJson);
  }, [briefJson]);
  const canView = isMarketResearchFeEnabled() && hasCap(user, 'crm_research', 'view');
  const canInsert = canWriteContentOs(user) && hasCap(user, 'crm_research', 'edit');

  const projectByInsight = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of insights) map.set(row.id, row.project_id);
    return map;
  }, [insights]);

  useEffect(() => {
    if (lifecycleClientId) setClientId(lifecycleClientId);
  }, [lifecycleClientId]);

  useEffect(() => {
    if (!canView) return;
    const token = getAccessToken();
    if (!token) return;
    void (async () => {
      try {
        const agency = await fetchAgencyClients(token).catch(() => ({
          clients: [] as Array<{ id: string; name: string }>,
        }));
        setClients(agency.clients.map((c) => ({ id: c.id, name: c.name })));
        if (!clientId && snapshot?.client_id) setClientId(snapshot.client_id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải khách hàng thất bại');
      }
    })();
  }, [canView, clientId, snapshot?.client_id]);

  const loadInsights = useCallback(
    async (cid: string) => {
      const token = getAccessToken();
      if (!token || !cid) {
        setInsights([]);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const out = await fetchApprovedInsightsForClient(token, cid);
        setInsights(out.insights);
        if (snapshot?.client_id === cid) {
          setSelected(snapshot.insight_ids);
        } else {
          setSelected([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải insight thất bại');
        setInsights([]);
      } finally {
        setLoading(false);
      }
    },
    [snapshot?.client_id, snapshot?.insight_ids],
  );

  useEffect(() => {
    if (!canView || !clientId) return;
    void loadInsights(clientId);
  }, [canView, clientId, loadInsights]);

  async function onInsert() {
    const token = getAccessToken();
    if (!token || !clientId || selected.length === 0) return;
    setSaving(true);
    setError('');
    try {
      const out = await insertContentInsights(token, itemId, {
        client_id: clientId,
        insight_ids: selected,
      });
      onInserted(out.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chèn insight thất bại');
    } finally {
      setSaving(false);
    }
  }

  if (!canView) return null;

  const chips = snapshot?.insight_ids ?? [];

  return (
    <section className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
      <h3 style={{ margin: 0, fontSize: '1rem' }}>Chèn insight đã duyệt — không copy nội dung vào brief.</h3>
      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span className="muted">Khách hàng</span>
        <select
          className="kpi-input"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          style={fieldStyle}
        >
          <option value="">Chọn khách hàng</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {loading ? <p className="muted">Đang tải…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {clientId && !loading && insights.length === 0 ? (
        <p className="muted">Chưa có insight đã duyệt cho khách hàng này.</p>
      ) : null}
      {insights.length ? (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.5rem' }}>
          {insights.map((row) => (
            <li
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: '0.5rem',
                alignItems: 'start',
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(row.id)}
                disabled={!canInsert || saving}
                onChange={() => {
                  setSelected((prev) =>
                    prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id],
                  );
                }}
              />
              <div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <Link href={`/crm/research/${row.project_id}?tab=insights`} className="nav-link">
                    INS-{row.id}
                  </Link>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    {INSIGHT_STATUS_LABELS[row.status] ?? row.status}
                  </span>
                </div>
                <p style={{ margin: '0.2rem 0 0' }}>{row.statement}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {canInsert ? (
        <button
          type="button"
          className="btn btn-sm"
          disabled={saving || !clientId || selected.length === 0}
          onClick={() => void onInsert()}
        >
          Chèn insight
        </button>
      ) : null}
      {chips.length ? (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {chips.map((id) => {
            const projectId = projectByInsight.get(id);
            const label = `INS-${id}`;
            if (!projectId) {
              return (
                <span
                  key={id}
                  style={{
                    display: 'inline-flex',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  {label}
                </span>
              );
            }
            return (
              <Link
                key={id}
                href={`/crm/research/${projectId}?tab=insights`}
                className="nav-link"
                style={{
                  display: 'inline-flex',
                  padding: '0.15rem 0.5rem',
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
