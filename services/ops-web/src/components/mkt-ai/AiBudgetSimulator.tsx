'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MetaBudgetRecommendCard } from '@/components/meta/MetaBudgetRecommendCard';
import styles from '@/components/mkt-ai/mkt-ai-planner.module.css';
import {
  applyMktAiBudgetScenario,
  postMktAiBudgetSimulateJob,
  type MktAiBudgetScenarioRow,
} from '@/lib/mkt-ai-planner-api';

function fmtVnd(n: number): string {
  if (!n) return '—';
  return `${n.toLocaleString('vi-VN')} ₫`;
}

function cplLabel(row: MktAiBudgetScenarioRow, objective: string): string {
  const cpl = row.cpl_estimates_json?.blended_cpl_vnd ?? 0;
  if (objective === 'awareness') return `${Math.round(cpl)} CPV`;
  if (cpl >= 1_000_000) return `${(cpl / 1_000_000).toFixed(1)}M`;
  return `${Math.round(cpl / 1000)}k`;
}

interface Props {
  token: string;
  lifecycleId: number;
  canEdit: boolean;
  paused?: boolean;
  budgetMonthlyVnd?: number;
  objective?: string;
  scenarios: MktAiBudgetScenarioRow[];
  hasCampaigns: boolean;
  clientId?: string;
  onScenariosChange: (rows: MktAiBudgetScenarioRow[]) => void;
  onRefresh?: () => Promise<void>;
  onError?: (message: string) => void;
  onMessage?: (message: string) => void;
}

export function AiBudgetSimulator({
  token,
  lifecycleId,
  canEdit,
  paused = false,
  budgetMonthlyVnd = 0,
  objective = 'lead',
  scenarios,
  hasCampaigns,
  clientId,
  onScenariosChange,
  onRefresh,
  onError,
  onMessage,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [scenarioCount, setScenarioCount] = useState(3);
  const [selectedId, setSelectedId] = useState<number | null>(
    scenarios.find((s) => s.is_selected)?.id ?? scenarios.find((s) => s.slug === 'balanced')?.id ?? null,
  );

  async function runSimulate() {
    if (!canEdit || paused) return;
    setBusy(true);
    onError?.('');
    try {
      const res = await postMktAiBudgetSimulateJob(token, lifecycleId, scenarioCount);
      const rows = res.output?.scenarios ?? [];
      if (rows.length) {
        onScenariosChange(rows);
        const balanced = rows.find((s) => s.slug === 'balanced');
        if (balanced) setSelectedId(balanced.id);
      }
      await onRefresh?.();
      onMessage?.(`Đã sinh ${rows.length || scenarioCount} budget scenarios`);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Sinh budget scenarios thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function applySelected() {
    if (!canEdit || paused || selectedId == null) return;
    if (!hasCampaigns) {
      onError?.('Cần có ít nhất 1 campaign trước khi áp dụng scenario.');
      return;
    }
    setBusy(true);
    onError?.('');
    try {
      await applyMktAiBudgetScenario(token, lifecycleId, selectedId);
      await onRefresh?.();
      onMessage?.('Đã áp dụng scenario vào campaigns');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Áp dụng scenario thất bại');
    } finally {
      setBusy(false);
    }
  }

  const mix = (row: MktAiBudgetScenarioRow) => row.channel_mix_json ?? {};

  return (
    <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.85rem' }}>
      <div>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Budget simulator</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Ngân sách gốc: <strong>{fmtVnd(budgetMonthlyVnd)}</strong>/tháng · MKTP-UC-012
        </p>
      </div>

      {canEdit ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem' }}>
            Số scenario{' '}
            <select
              value={scenarioCount}
              disabled={paused || busy}
              onChange={(e) => setScenarioCount(Number(e.target.value))}
            >
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-sm" disabled={paused || busy} onClick={() => void runSimulate()}>
            {busy ? 'Đang xử lý…' : 'Sinh budget scenarios'}
          </button>
        </div>
      ) : null}

      {scenarios.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Chưa có scenario — bấm Sinh budget scenarios sau khi brief có ngân sách.
        </p>
      ) : (
        <div className={styles.budgetTableWrap}>
          <table className={styles.budgetTable}>
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Meta</th>
                <th>Google</th>
                <th>Content</th>
                <th>Dự phòng</th>
                <th>CPL est.</th>
                <th>Lý do (VI)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {scenarios.map((row) => {
                const selected = row.id === selectedId || row.is_selected;
                const channelMix = mix(row);
                return (
                  <tr key={row.id} className={selected ? styles.budgetRowSelected : undefined}>
                    <td>
                      {row.name}
                      {row.slug === 'balanced' ? ' ★' : ''}
                    </td>
                    <td>{channelMix.meta_pct ?? '—'}%</td>
                    <td>{channelMix.google_pct ?? '—'}%</td>
                    <td>{channelMix.content_pct ?? '—'}%</td>
                    <td>{channelMix.reserve_pct ?? '—'}%</td>
                    <td>{cplLabel(row, objective)}</td>
                    <td style={{ maxWidth: '14rem', fontSize: '0.82rem' }}>
                      {row.rationale_vi?.trim() || '—'}
                    </td>
                    <td>
                      {canEdit ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          disabled={paused || busy}
                          onClick={() => setSelectedId(row.id)}
                        >
                          {selected ? '✓' : 'Chọn'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && scenarios.length > 0 ? (
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={paused || busy || selectedId == null || !hasCampaigns}
          onClick={() => void applySelected()}
        >
          Áp dụng scenario vào campaigns
        </button>
      ) : null}

      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <Link href="/meta/intelligence" className="muted" style={{ fontSize: '0.82rem' }}>
          Xem gợi ý Meta WIN-4-C →
        </Link>
        <MetaBudgetRecommendCard token={token} clientId={clientId} />
      </div>
    </div>
  );
}
