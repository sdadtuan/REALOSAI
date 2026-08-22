'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  COMPETITOR_FACT_KEYS,
  COMPETITOR_FACT_LABELS,
  createResearchCompetitor,
  createResearchCompetitorSnapshot,
  fetchResearchCompetitors,
  patchResearchCompetitor,
  ResearchApiError,
  type CompetitorFact,
  type CompetitorFactKey,
  type ResearchCompetitor,
  type ResearchSource,
} from '@/lib/market-research-api';

function emptyFact(): CompetitorFact {
  return {};
}

function KindChip({ kind }: { kind: 'fact' | 'hypothesis' }) {
  const hypothesis = kind === 'hypothesis';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '0.75rem',
        fontWeight: 600,
        padding: '0.1rem 0.45rem',
        borderRadius: 999,
        border: hypothesis ? '1px dashed var(--border)' : '1px solid var(--primary)',
        background: hypothesis
          ? 'color-mix(in srgb, var(--text) 8%, var(--bg))'
          : 'color-mix(in srgb, var(--primary) 12%, white)',
        color: hypothesis ? 'var(--text)' : 'var(--primary)',
      }}
    >
      {hypothesis ? '◇ Giả thuyết' : '● Fact'}
    </span>
  );
}

export function CompetitorPane({
  projectId,
  sources,
  canEdit,
}: {
  projectId: number;
  sources: ResearchSource[];
  canEdit: boolean;
}) {
  const [competitors, setCompetitors] = useState<ResearchCompetitor[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [sourceId, setSourceId] = useState<string>('');
  const [observedAt, setObservedAt] = useState('');
  const [kind, setKind] = useState<'fact' | 'hypothesis'>('fact');
  const [fact, setFact] = useState<CompetitorFact>(emptyFact());
  const [limitationNote, setLimitationNote] = useState('');
  const [editName, setEditName] = useState('');
  const [editAliases, setEditAliases] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    const out = await fetchResearchCompetitors(token, projectId);
    setCompetitors(out.competitors);
  }, [projectId]);

  useEffect(() => {
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : 'Tải đối thủ thất bại');
    });
  }, [load]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await createResearchCompetitor(token, projectId, {
        name: name.trim(),
        aliases: aliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
      });
      setName('');
      setAliases('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm đối thủ thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onPatch(competitorId: number) {
    const token = getAccessToken();
    if (!token || !editName.trim()) return;
    setSaving(true);
    setError('');
    try {
      await patchResearchCompetitor(token, competitorId, {
        name: editName.trim(),
        aliases: editAliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sửa đối thủ thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onSnapshot(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || activeId == null) return;
    setSaving(true);
    setError('');
    try {
      await createResearchCompetitorSnapshot(token, activeId, {
        source_id: Number(sourceId),
        observed_at: observedAt,
        kind,
        fact,
        limitation_note: limitationNote.trim() || null,
      });
      setFact(emptyFact());
      setLimitationNote('');
      await load();
    } catch (err) {
      const api = err instanceof ResearchApiError ? err : null;
      if (api?.code === 'reliability_capped') {
        setError('Similarweb/Semrush không được gắn reliability High — chỉ low/medium.');
      } else if (api?.code === 'limitation_required') {
        setError('Similarweb/Semrush bắt buộc ghi limitation_note.');
      } else {
        setError(err instanceof Error ? err.message : 'Thêm snapshot thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  function setFactKey(key: CompetitorFactKey, value: string) {
    setFact((prev) => {
      const next = { ...prev };
      if (!value.trim()) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function openEdit(row: ResearchCompetitor) {
    setActiveId(row.id);
    setEditName(row.name);
    setEditAliases(row.aliases.join(', '));
  }

  return (
    <section className="card" style={{ padding: '0.9rem' }}>
      <div className="stack-gap">
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Đối thủ</h2>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Snapshot fact cần <code>source_id</code> cùng project. Similarweb/Semrush không lên High.
        </p>
        {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
        {canEdit ? (
          <form onSubmit={(e) => void onAdd(e)} style={{ display: 'grid', gap: '0.5rem' }}>
            <label>
              Tên đối thủ *
              <input
                className="kpi-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <label>
              Alias (phẩy)
              <input
                className="kpi-input"
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <button type="submit" className="btn btn-sm" disabled={saving}>
              + Thêm đối thủ
            </button>
          </form>
        ) : null}
        {competitors.length === 0 ? (
          <p className="muted">Chưa có đối thủ.</p>
        ) : (
          competitors.map((row) => (
            <article key={row.id} className="card" style={{ padding: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <strong>{row.name}</strong>
                {row.aliases.length ? (
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    alias: {row.aliases.join(', ')}
                  </span>
                ) : null}
              </div>
              {canEdit && activeId === row.id ? (
                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                  <input
                    className="kpi-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    aria-label="Sửa tên"
                  />
                  <input
                    className="kpi-input"
                    value={editAliases}
                    onChange={(e) => setEditAliases(e.target.value)}
                    aria-label="Sửa alias"
                  />
                  <button type="button" className="btn btn-sm" disabled={saving} onClick={() => void onPatch(row.id)}>
                    Lưu tên / alias
                  </button>
                </div>
              ) : canEdit ? (
                <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => openEdit(row)}>
                  Sửa / thêm snapshot
                </button>
              ) : null}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0.6rem 0 0' }}>
                {row.snapshots.map((snap) => (
                  <li key={snap.id} style={{ marginBottom: '0.45rem' }}>
                    <KindChip kind={snap.kind} />{' '}
                    <span className="muted">{snap.observed_at}</span>
                    {' · '}
                    <span>source #{snap.source_id}</span>
                    <div style={{ fontSize: '0.85rem', marginTop: 2 }}>
                      {COMPETITOR_FACT_KEYS.filter((k) => snap.fact[k] != null && snap.fact[k] !== '').map((k) => (
                        <span key={k} style={{ marginRight: '0.6rem' }}>
                          {COMPETITOR_FACT_LABELS[k]}: {String(snap.fact[k])}
                        </span>
                      ))}
                    </div>
                    {snap.limitation_note ? (
                      <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.8rem' }}>
                        Limitation: {snap.limitation_note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {canEdit && activeId === row.id ? (
                <form onSubmit={(e) => void onSnapshot(e)} style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                  <label>
                    Nguồn *
                    <select
                      className="kpi-input"
                      value={sourceId}
                      onChange={(e) => setSourceId(e.target.value)}
                      required
                      style={{ display: 'block', width: '100%', marginTop: 4 }}
                    >
                      <option value="">Chọn source_id</option>
                      {sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          #{s.id} {s.title}
                          {s.publisher ? ` · ${s.publisher}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Ngày quan sát *
                    <input
                      className="kpi-input"
                      type="date"
                      value={observedAt}
                      onChange={(e) => setObservedAt(e.target.value)}
                      required
                      style={{ display: 'block', width: '100%', marginTop: 4 }}
                    />
                  </label>
                  <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem' }}>
                    <legend>Loại</legend>
                    <label style={{ marginRight: 12 }}>
                      <input
                        type="radio"
                        name={`kind-${row.id}`}
                        checked={kind === 'fact'}
                        onChange={() => setKind('fact')}
                      />{' '}
                      Fact
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`kind-${row.id}`}
                        checked={kind === 'hypothesis'}
                        onChange={() => setKind('hypothesis')}
                      />{' '}
                      Giả thuyết
                    </label>
                  </fieldset>
                  {COMPETITOR_FACT_KEYS.map((key) => (
                    <label key={key}>
                      {COMPETITOR_FACT_LABELS[key]}
                      <input
                        className="kpi-input"
                        value={fact[key] != null ? String(fact[key]) : ''}
                        onChange={(e) => setFactKey(key, e.target.value)}
                        style={{ display: 'block', width: '100%', marginTop: 4 }}
                      />
                    </label>
                  ))}
                  <label>
                    Limitation note
                    <input
                      className="kpi-input"
                      value={limitationNote}
                      onChange={(e) => setLimitationNote(e.target.value)}
                      style={{ display: 'block', width: '100%', marginTop: 4 }}
                    />
                  </label>
                  <button type="submit" className="btn btn-sm" disabled={saving}>
                    + Snapshot
                  </button>
                </form>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
