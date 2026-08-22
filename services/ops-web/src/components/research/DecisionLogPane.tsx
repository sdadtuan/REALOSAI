'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  APPROVED_INTERNAL_PLUS,
  createResearchDecision,
  DECISION_STATUS_LABELS,
  DECISION_STATUSES,
  fetchResearchDecisions,
  patchResearchDecision,
  ResearchApiError,
  TRANSITION_REASON_VI,
  type DecisionStatus,
  type ResearchDecision,
  type ResearchInsight,
} from '@/lib/market-research-api';

const emptyForm = {
  insight_id: '',
  decision_text: '',
  owner_email: '',
  due_at: '',
};

export function DecisionLogPane({
  projectId,
  insights,
  canEdit,
}: {
  projectId: number;
  insights: ResearchInsight[];
  canEdit: boolean;
}) {
  const [decisions, setDecisions] = useState<ResearchDecision[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const approved = insights.filter((insight) => APPROVED_INTERNAL_PLUS.includes(insight.status));

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    const out = await fetchResearchDecisions(token, projectId);
    setDecisions(out.decisions);
  }, [projectId]);

  useEffect(() => {
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : 'Tải decision thất bại');
    });
  }, [load]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    const insightId = Number(form.insight_id);
    if (!token || !Number.isInteger(insightId) || insightId < 1) return;
    setSaving(true);
    setError('');
    try {
      await createResearchDecision(token, projectId, {
        insight_id: insightId,
        decision_text: form.decision_text,
        owner_email: form.owner_email.trim(),
        due_at: form.due_at || null,
      });
      setForm(emptyForm);
      await load();
    } catch (err) {
      const api = err instanceof ResearchApiError ? err : null;
      if (api?.code && TRANSITION_REASON_VI[api.code]) {
        setError(TRANSITION_REASON_VI[api.code]);
      } else {
        setError(err instanceof Error ? err.message : 'Ghi decision thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onStatus(decision: ResearchDecision, status: DecisionStatus) {
    const token = getAccessToken();
    if (!token || decision.status === status) return;
    setSaving(true);
    setError('');
    try {
      await patchResearchDecision(token, decision.id, { status });
      await load();
    } catch (err) {
      const api = err instanceof ResearchApiError ? err : null;
      if (api?.code && TRANSITION_REASON_VI[api.code]) {
        setError(TRANSITION_REASON_VI[api.code]);
      } else {
        setError(err instanceof Error ? err.message : 'Cập nhật decision thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card stack-gap" style={{ padding: '0.9rem' }}>
      <h2 style={{ margin: 0, fontSize: '1rem' }}>Quyết định</h2>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        «Ghi action sau readout — gắn insight đã duyệt.»
      </p>
      {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
      {canEdit ? (
        <form onSubmit={(e) => void onAdd(e)} style={{ display: 'grid', gap: '0.5rem' }}>
          <label>
            Insight đã duyệt *
            <select
              className="kpi-input"
              required
              value={form.insight_id}
              onChange={(e) => setForm((p) => ({ ...p, insight_id: e.target.value }))}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            >
              <option value="">Chọn insight</option>
              {approved.map((insight) => (
                <option key={insight.id} value={insight.id}>
                  #{insight.id} · {insight.statement}
                </option>
              ))}
            </select>
          </label>
          <label>
            Decision *
            <textarea
              className="kpi-input"
              required
              minLength={10}
              rows={3}
              value={form.decision_text}
              onChange={(e) => setForm((p) => ({ ...p, decision_text: e.target.value }))}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <label>
              Owner email *
              <input
                className="kpi-input"
                type="email"
                required
                value={form.owner_email}
                onChange={(e) => setForm((p) => ({ ...p, owner_email: e.target.value }))}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <label>
              Due
              <input
                className="kpi-input"
                type="date"
                value={form.due_at}
                onChange={(e) => setForm((p) => ({ ...p, due_at: e.target.value }))}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
          </div>
          <button type="submit" className="btn btn-sm" disabled={saving || !form.insight_id}>
            + Decision
          </button>
        </form>
      ) : null}
      {decisions.length === 0 ? (
        <p className="muted">Chưa có decision.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Decision</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Insight</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Owner</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Due</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: '0.4rem' }}>{row.decision_text}</td>
                  <td style={{ padding: '0.4rem' }}>#{row.insight_id}</td>
                  <td style={{ padding: '0.4rem' }}>{row.owner_email}</td>
                  <td style={{ padding: '0.4rem' }}>{row.due_at || '—'}</td>
                  <td style={{ padding: '0.4rem' }}>
                    {canEdit ? (
                      <select
                        className="kpi-input"
                        value={row.status}
                        disabled={saving}
                        onChange={(e) => void onStatus(row, e.target.value as DecisionStatus)}
                      >
                        {DECISION_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {DECISION_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      DECISION_STATUS_LABELS[row.status]
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
