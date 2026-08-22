'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  createResearchWave,
  fetchResearchWaves,
  ResearchApiError,
  TRANSITION_REASON_VI,
  type ResearchWave,
  type WaveCompareRow,
} from '@/lib/market-research-api';

const emptyForm = {
  wave_no: '',
  label: '',
  field_start: '',
  field_end: '',
  metrics: [{ key: '', value: '' }],
};

export function WavesPane({
  projectId,
  canEdit,
}: {
  projectId: number;
  canEdit: boolean;
}) {
  const [waves, setWaves] = useState<ResearchWave[]>([]);
  const [compare, setCompare] = useState<WaveCompareRow[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    const out = await fetchResearchWaves(token, projectId);
    setWaves(out.waves);
    setCompare(out.compare);
  }, [projectId]);

  useEffect(() => {
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : 'Tải wave thất bại');
    });
  }, [load]);

  function setMetric(index: number, patch: { key?: string; value?: string }) {
    setForm((prev) => ({
      ...prev,
      metrics: prev.metrics.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    const waveNo = Number(form.wave_no);
    if (!token || !Number.isInteger(waveNo) || waveNo < 1) return;
    const metric_json = form.metrics
      .map((row) => ({
        key: row.key.trim(),
        value: row.value.trim() === '' ? null : Number(row.value),
      }))
      .filter((row) => row.key);
    setSaving(true);
    setError('');
    try {
      await createResearchWave(token, projectId, {
        wave_no: waveNo,
        label: form.label.trim() || null,
        field_start: form.field_start || null,
        field_end: form.field_end || null,
        metric_json,
      });
      setForm(emptyForm);
      await load();
    } catch (err) {
      const api = err instanceof ResearchApiError ? err : null;
      if (api?.code && TRANSITION_REASON_VI[api.code]) {
        setError(TRANSITION_REASON_VI[api.code]);
      } else {
        setError(err instanceof Error ? err.message : 'Thêm wave thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card stack-gap" style={{ padding: '0.9rem' }}>
      <h2 style={{ margin: 0, fontSize: '1rem' }}>Waves</h2>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        So sánh 2 wave gần nhất.
      </p>
      {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
      {canEdit ? (
        <form onSubmit={(e) => void onAdd(e)} style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
            <label>
              Wave no *
              <input
                className="kpi-input"
                type="number"
                min={1}
                required
                value={form.wave_no}
                onChange={(e) => setForm((p) => ({ ...p, wave_no: e.target.value }))}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <label>
              Nhãn
              <input
                className="kpi-input"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <label>
              Field start
              <input
                className="kpi-input"
                type="date"
                value={form.field_start}
                onChange={(e) => setForm((p) => ({ ...p, field_start: e.target.value }))}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <label>
              Field end
              <input
                className="kpi-input"
                type="date"
                value={form.field_end}
                onChange={(e) => setForm((p) => ({ ...p, field_end: e.target.value }))}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
          </div>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {form.metrics.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem' }}>
                <input
                  className="kpi-input"
                  placeholder="Metric key"
                  maxLength={40}
                  value={row.key}
                  onChange={(e) => setMetric(i, { key: e.target.value })}
                />
                <input
                  className="kpi-input"
                  type="number"
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) => setMetric(i, { value: e.target.value })}
                />
              </div>
            ))}
            {form.metrics.length < 20 ? (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() =>
                  setForm((p) => ({ ...p, metrics: [...p.metrics, { key: '', value: '' }] }))
                }
              >
                + Metric
              </button>
            ) : null}
          </div>
          <button type="submit" className="btn btn-sm" disabled={saving || !form.wave_no}>
            + Wave
          </button>
        </form>
      ) : null}
      {waves.length === 0 ? (
        <p className="muted">Chưa có wave.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Wave</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Nhãn</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Field</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Metrics</th>
              </tr>
            </thead>
            <tbody>
              {waves.map((wave) => (
                <tr key={wave.id}>
                  <td style={{ padding: '0.4rem' }}>{wave.wave_no}</td>
                  <td style={{ padding: '0.4rem' }}>{wave.label || '—'}</td>
                  <td style={{ padding: '0.4rem' }}>
                    {[wave.field_start, wave.field_end].filter(Boolean).join(' → ') || '—'}
                  </td>
                  <td style={{ padding: '0.4rem' }}>
                    {wave.metric_json.length
                      ? wave.metric_json.map((m) => `${m.key}: ${m.value ?? '—'}`).join(', ')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {compare.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Key</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Prev</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Curr</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Delta</th>
              </tr>
            </thead>
            <tbody>
              {compare.map((row) => (
                <tr key={row.key}>
                  <td style={{ padding: '0.4rem' }}>{row.key}</td>
                  <td style={{ padding: '0.4rem' }}>{row.prev ?? '—'}</td>
                  <td style={{ padding: '0.4rem' }}>{row.curr ?? '—'}</td>
                  <td style={{ padding: '0.4rem' }}>{row.delta ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
