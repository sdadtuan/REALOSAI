'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  createResearchConjoint,
  fetchResearchConjoint,
  fetchResearchConjointWhatIfRuns,
  simulateResearchConjointWhatIf,
  ResearchApiError,
  TRANSITION_REASON_VI,
  type CjWhatIfResult,
  type CjWhatIfRunRow,
  type ResearchCjSummaryRow,
} from '@/lib/market-research-api';
import {
  CJ_TAB_BANNER,
  CJ_WHATIF_BANNER,
  CJ_WHATIF_PERSIST_BANNER,
  defaultWhatIfScenario,
  formatScenarioSummary,
  formatSharePct,
  formatWhatIfResult,
} from '@/components/research/conjoint-pane.util';

export function ConjointPane({
  projectId,
  canEdit,
}: {
  projectId: number;
  canEdit: boolean;
}) {
  const [summary, setSummary] = useState<ResearchCjSummaryRow | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [scenario, setScenario] = useState<Record<string, string>>({});
  const [whatIf, setWhatIf] = useState<CjWhatIfResult | null>(null);
  const [whatIfBusy, setWhatIfBusy] = useState(false);
  const [persistWhatIf, setPersistWhatIf] = useState(false);
  const [history, setHistory] = useState<CjWhatIfRunRow[]>([]);

  const loadHistory = useCallback(async (token: string) => {
    const out = await fetchResearchConjointWhatIfRuns(token, projectId);
    setHistory(out.runs ?? []);
  }, [projectId]);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    const out = await fetchResearchConjoint(token, projectId);
    setSummary(out.summary);
    if (out.summary) {
      setScenario(defaultWhatIfScenario(out.summary.attributes, out.summary.recommendation));
    }
    await loadHistory(token);
  }, [loadHistory, projectId]);

  useEffect(() => {
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : 'Tải conjoint thất bại');
    });
  }, [load]);

  async function onCompute() {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await createResearchConjoint(token, projectId, {});
      await load();
    } catch (err) {
      const api = err instanceof ResearchApiError ? err : null;
      if (api?.code && TRANSITION_REASON_VI[api.code]) {
        setError(TRANSITION_REASON_VI[api.code]);
      } else {
        setError(err instanceof Error ? err.message : 'Tính conjoint lite thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onWhatIf() {
    const token = getAccessToken();
    if (!token) return;
    setWhatIfBusy(true);
    setError('');
    try {
      const out = await simulateResearchConjointWhatIf(token, projectId, {
        scenario,
        persist: persistWhatIf,
      });
      setWhatIf(out);
      if (persistWhatIf) {
        await loadHistory(token);
      }
    } catch (err) {
      const api = err instanceof ResearchApiError ? err : null;
      if (api?.code && TRANSITION_REASON_VI[api.code]) {
        setError(TRANSITION_REASON_VI[api.code]);
      } else {
        setError(err instanceof Error ? err.message : 'Đếm khớp mẫu thất bại');
      }
    } finally {
      setWhatIfBusy(false);
    }
  }

  return (
    <section className="card stack-gap" style={{ padding: '0.9rem' }}>
      <h2 style={{ margin: 0, fontSize: '1rem' }}>Conjoint lite</h2>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        {CJ_TAB_BANNER}
      </p>
      {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
      {canEdit ? (
        <button type="button" className="btn btn-sm" disabled={saving} onClick={() => void onCompute()}>
          Tính conjoint lite
        </button>
      ) : null}
      {!summary ? (
        <p className="muted">Chưa có bảng conjoint.</p>
      ) : (
        <>
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            n={summary.n} · {summary.n_choices} lựa chọn
          </p>
          {summary.attributes.map((attr) => (
            <div key={attr.name} style={{ overflowX: 'auto' }}>
              <h3 style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.9rem' }}>{attr.name}</h3>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.4rem' }}>Mức</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem' }}>Count</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem' }}>Share %</th>
                  </tr>
                </thead>
                <tbody>
                  {attr.levels.map((level) => (
                    <tr key={level.label}>
                      <td style={{ padding: '0.4rem' }}>{level.label}</td>
                      <td style={{ padding: '0.4rem' }}>{level.count}</td>
                      <td style={{ padding: '0.4rem' }}>{formatSharePct(level.share_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {summary.recommendation.levels.length ? (
            <div>
              <h3 style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.9rem' }}>Gợi ý gói</h3>
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                {summary.recommendation.levels.map((row) => (
                  <li key={row.attribute}>
                    {row.attribute}: {row.level} ({formatSharePct(row.share_pct)}%)
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {summary.limitation_note ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              {summary.limitation_note}
            </p>
          ) : null}
          {summary.attributes.length ? (
            <form
              data-testid="cj-whatif-form"
              style={{ display: 'grid', gap: '0.45rem' }}
              onSubmit={(e) => {
                e.preventDefault();
                void onWhatIf();
              }}
            >
              <h3 style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>What-if lite</h3>
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                {CJ_WHATIF_BANNER}
              </p>
              {summary.attributes.map((attr) => (
                <label key={attr.name} style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
                  {attr.name}
                  <select
                    value={scenario[attr.name] ?? ''}
                    onChange={(e) =>
                      setScenario((prev) => ({ ...prev, [attr.name]: e.target.value }))
                    }
                  >
                    {attr.levels.map((level) => (
                      <option key={level.label} value={level.label}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {canEdit ? (
                <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    data-testid="cj-whatif-persist"
                    checked={persistWhatIf}
                    onChange={(e) => setPersistWhatIf(e.target.checked)}
                  />
                  Lưu kết quả
                </label>
              ) : null}
              {canEdit && persistWhatIf ? (
                <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                  {CJ_WHATIF_PERSIST_BANNER}
                </p>
              ) : null}
              <button type="submit" className="btn btn-sm" disabled={whatIfBusy} data-testid="cj-whatif-run">
                Đếm khớp mẫu
              </button>
              {whatIf ? (
                <p className="muted" data-testid="cj-whatif-result" style={{ margin: 0, fontSize: '0.85rem' }}>
                  {formatWhatIfResult(whatIf.n_match, whatIf.n_choices, whatIf.match_pct)}
                </p>
              ) : null}
            </form>
          ) : null}
          {history.length ? (
            <div data-testid="cj-whatif-history">
              <h3 style={{ margin: '0.75rem 0 0.35rem', fontSize: '0.9rem' }}>Lịch sử what-if</h3>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.4rem' }}>Thời gian</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem' }}>Scenario</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem' }}>Khớp</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem' }}>Người lưu</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} data-testid={`cj-whatif-history-row-${row.id}`}>
                      <td style={{ padding: '0.4rem' }}>{row.created_at.slice(0, 16).replace('T', ' ')}</td>
                      <td style={{ padding: '0.4rem' }}>{formatScenarioSummary(row.scenario)}</td>
                      <td style={{ padding: '0.4rem' }}>
                        {formatWhatIfResult(row.n_match, row.n_choices, row.match_pct)}
                      </td>
                      <td style={{ padding: '0.4rem' }}>{row.created_by ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
