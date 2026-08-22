'use client';

import { useEffect, useState } from 'react';
import {
  fetchMktAiStrategyScenarioCompare,
  postMktAiSelectStrategyScenario,
  postMktAiStrategyScenariosJob,
  type MktAiStrategyScenarioComparePayload,
  type MktAiStrategyScenarioRow,
} from '@/lib/mkt-ai-planner-api';

interface Props {
  token: string;
  lifecycleId: number;
  canEdit: boolean;
  paused?: boolean;
  scenarios: MktAiStrategyScenarioRow[];
  onScenariosChange: (rows: MktAiStrategyScenarioRow[]) => void;
  onSelected?: () => void;
  onError?: (message: string) => void;
  onMessage?: (message: string) => void;
}

export function AiStrategyScenarioCompare({
  token,
  lifecycleId,
  canEdit,
  paused = false,
  scenarios,
  onScenariosChange,
  onSelected,
  onError,
  onMessage,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [compareA, setCompareA] = useState<number | null>(scenarios[0]?.id ?? null);
  const [compareB, setCompareB] = useState<number | null>(scenarios[1]?.id ?? null);
  const [diff, setDiff] = useState<MktAiStrategyScenarioComparePayload | null>(null);

  useEffect(() => {
    if (!compareA || !compareB || compareA === compareB) {
      setDiff(null);
      return;
    }
    void (async () => {
      try {
        const out = await fetchMktAiStrategyScenarioCompare(token, lifecycleId, compareA, compareB);
        setDiff(out);
      } catch {
        setDiff(null);
      }
    })();
  }, [compareA, compareB, lifecycleId, token]);

  async function generate() {
    if (!canEdit || paused) return;
    setBusy(true);
    onError?.('');
    try {
      const out = await postMktAiStrategyScenariosJob(token, lifecycleId, 3);
      onScenariosChange(out.scenarios);
      if (out.scenarios[0]) setCompareA(out.scenarios[0].id);
      if (out.scenarios[1]) setCompareB(out.scenarios[1].id);
      onMessage?.(`Đã sinh ${out.scenarios.length} strategy scenarios — draft chưa đổi`);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Sinh scenarios thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function selectScenario(id: number) {
    if (!canEdit || paused) return;
    setBusy(true);
    try {
      await postMktAiSelectStrategyScenario(token, lifecycleId, id);
      onScenariosChange(
        scenarios.map((s) => ({ ...s, is_selected: s.id === id })),
      );
      onMessage?.('Đã chọn scenario — draft strategy đã cập nhật');
      onSelected?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Chọn scenario thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.95rem' }}>So sánh scenarios chiến lược</h4>
          <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
            Sinh 2–3 phương án — so sánh SWOT/kênh/messaging trước khi chọn vào draft
          </p>
        </div>
        {canEdit ? (
          <button type="button" className="btn btn-sm" disabled={paused || busy} onClick={() => void generate()}>
            Sinh 2–3 scenarios
          </button>
        ) : null}
      </div>

      {scenarios.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Chưa có scenario — bấm Sinh để tạo variants (không ghi đè draft hiện tại).
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem' }}>
              A{' '}
              <select
                value={compareA ?? ''}
                onChange={(e) => setCompareA(Number(e.target.value) || null)}
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: '0.85rem' }}>
              B{' '}
              <select
                value={compareB ?? ''}
                onChange={(e) => setCompareB(Number(e.target.value) || null)}
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {diff ? (
            <div style={{ fontSize: '0.85rem', display: 'grid', gap: '0.5rem' }}>
              <p className="muted" style={{ margin: 0 }}>
                Khác biệt: {diff.fields_changed.length ? diff.fields_changed.join(', ') : 'Không có diff lớn'}
              </p>
              {diff.messaging_diff.market_message?.changed ? (
                <div>
                  <strong>Market message</strong>
                  <div>A: {diff.messaging_diff.market_message.a.slice(0, 120)}</div>
                  <div>B: {diff.messaging_diff.market_message.b.slice(0, 120)}</div>
                </div>
              ) : null}
              {diff.channel_diff.media_reach?.changed ? (
                <div>
                  <strong>Media reach</strong>
                  <div>A: {diff.channel_diff.media_reach.a}</div>
                  <div>B: {diff.channel_diff.media_reach.b}</div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                className={s.is_selected ? 'btn btn-sm' : 'btn btn-sm btn-secondary'}
                disabled={!canEdit || paused || busy}
                onClick={() => void selectScenario(s.id)}
              >
                {s.is_selected ? '✓ ' : ''}
                Chọn {s.variant_slug}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
