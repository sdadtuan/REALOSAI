'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DealScoreMiniBar } from '@/components/ai/DealScoreMiniBar';
import { DismissReasonModal } from '@/components/ai/DismissReasonModal';
import { NbaCard } from '@/components/ai/NbaCard';
import { ScoreCard } from '@/components/ai/ScoreCard';
import { patchCase } from '@/lib/api';
import {
  fetchAiRecommendations,
  fetchAiScoresBatch,
  patchAiRecommendation,
  postAiNextBestAction,
  postAiScoreDeal,
  type AiScoreRecord,
  type NextBestActionResponse,
} from '@/lib/ai-api';

export interface PipelineCaseRow {
  id: number;
  title: string;
  pipeline_stage: string;
  pipeline_stage_label?: string;
  deal_value_vnd?: number;
  customer_name?: string;
  staff_name?: string;
}

interface Props {
  token: string;
  rows: PipelineCaseRow[];
  stageLabels: Record<string, string>;
  stages: string[];
  onRowUpdate?: (dealId: number, patch: Partial<PipelineCaseRow>) => void;
  canSortByScore?: boolean;
  initialDealId?: number | null;
}

type ScoreSummary = { score_value: number; score_band: string };

const BACKGROUND_SCORE_CONCURRENCY = 3;
const BACKGROUND_SCORE_LIMIT = 12;

async function scoreDealsInBackground(
  token: string,
  dealIds: number[],
  onScored: (dealId: number, summary: ScoreSummary) => void,
  signal: AbortSignal,
): Promise<void> {
  let cursor = 0;
  async function worker() {
    while (cursor < dealIds.length) {
      if (signal.aborted) return;
      const dealId = dealIds[cursor];
      cursor += 1;
      try {
        const scored = await postAiScoreDeal(token, dealId);
        if (signal.aborted) return;
        onScored(dealId, {
          score_value: scored.data.score,
          score_band: scored.data.explainability?.score_band ?? 'warm',
        });
      } catch {
        /* skip individual failures */
      }
    }
  }
  const workers = Math.min(BACKGROUND_SCORE_CONCURRENCY, dealIds.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
}

export function SalesPipelineFunnelPanel({
  token,
  rows,
  stageLabels,
  stages,
  onRowUpdate,
  canSortByScore = false,
  initialDealId = null,
}: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scoreMap, setScoreMap] = useState<Record<string, ScoreSummary>>({});
  const [dealScore, setDealScore] = useState<AiScoreRecord | null>(null);
  const [nba, setNba] = useState<NextBestActionResponse['data'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showDismiss, setShowDismiss] = useState(false);
  const [sortByScore, setSortByScore] = useState(false);
  const [pendingStage, setPendingStage] = useState('');
  const scoreAbortRef = useRef<AbortController | null>(null);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  useEffect(() => {
    if (selected) {
      setPendingStage(selected.pipeline_stage);
    }
  }, [selected]);

  const mergeScore = useCallback((dealId: number, summary: ScoreSummary) => {
    setScoreMap((prev) => ({ ...prev, [String(dealId)]: summary }));
  }, []);

  const loadScores = useCallback(async () => {
    if (!rows.length) {
      setScoreMap({});
      return;
    }

    scoreAbortRef.current?.abort();
    const controller = new AbortController();
    scoreAbortRef.current = controller;

    try {
      const batch = await fetchAiScoresBatch(
        token,
        'deal',
        rows.map((r) => r.id),
      );
      if (controller.signal.aborted) return;
      setScoreMap(batch);

      const unscored = rows
        .filter((row) => batch[String(row.id)] == null)
        .map((row) => row.id)
        .slice(0, BACKGROUND_SCORE_LIMIT);

      if (unscored.length) {
        await scoreDealsInBackground(token, unscored, mergeScore, controller.signal);
      }
    } catch {
      if (!controller.signal.aborted) {
        setScoreMap({});
      }
    }
  }, [mergeScore, rows, token]);

  useEffect(() => {
    void loadScores();
    return () => {
      scoreAbortRef.current?.abort();
    };
  }, [loadScores]);

  const openDeal = useCallback(
    async (dealId: number) => {
      setSelectedId(dealId);
      setMessage('');
      setNba(null);
      setDealScore(null);
      setBusy(true);
      try {
        const scored = await postAiScoreDeal(token, dealId);
        setDealScore({
          id: scored.data.agent_run_id,
          score_value: scored.data.score,
          confidence: scored.data.confidence,
          explainability_json: scored.data.explainability,
          model_name: 'deal-rules-v1',
          calculated_at: new Date().toISOString(),
        } as AiScoreRecord);
        mergeScore(dealId, {
          score_value: scored.data.score,
          score_band: scored.data.explainability?.score_band ?? 'warm',
        });
        const recs = await fetchAiRecommendations(token, 'deal', dealId, { status: 'pending' });
        const pendingNba = recs.data.recommendations.find((r) => r.recommendation_type === 'nba');
        if (pendingNba) {
          setNba({
            recommendation_id: String(pendingNba.id),
            entity_type: 'deal',
            entity_id: dealId,
            deal_id: dealId,
            action: String((pendingNba.action_json as Record<string, unknown>)?.action ?? 'call_back'),
            action_label: String(
              (pendingNba.action_json as Record<string, unknown>)?.action_label ?? 'Gọi lại',
            ),
            reason: String(
              (pendingNba.action_json as Record<string, unknown>)?.reason ?? pendingNba.recommendation_text,
            ),
            confidence: Number(pendingNba.confidence ?? 0.6),
            status: String(pendingNba.status ?? 'pending'),
            recommendation_text: String(pendingNba.recommendation_text ?? ''),
            agent_run_id: String(pendingNba.agent_run_id ?? ''),
            playbook_citation: null,
          });
        } else {
          try {
            const nbaOut = await postAiNextBestAction(token, { deal_id: dealId, entity_type: 'deal' });
            setNba(nbaOut.data);
          } catch {
            /* not stalled — no NBA */
          }
        }
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Không tải deal AI');
      } finally {
        setBusy(false);
      }
    },
    [mergeScore, token],
  );

  const initialDealOpenedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!initialDealId || !rows.length) return;
    if (initialDealOpenedRef.current === initialDealId) return;
    const exists = rows.some((row) => row.id === initialDealId);
    if (!exists) return;
    initialDealOpenedRef.current = initialDealId;
    void openDeal(initialDealId);
  }, [initialDealId, openDeal, rows]);

  const refreshDealScore = useCallback(
    async (dealId: number, force = false) => {
      const scored = await postAiScoreDeal(token, dealId, force);
      const nextScore = {
        id: scored.data.agent_run_id,
        score_value: scored.data.score,
        confidence: scored.data.confidence,
        explainability_json: scored.data.explainability,
        model_name: 'deal-rules-v1',
        calculated_at: new Date().toISOString(),
      } as AiScoreRecord;
      setDealScore(nextScore);
      mergeScore(dealId, {
        score_value: scored.data.score,
        score_band: scored.data.explainability?.score_band ?? 'warm',
      });
      return nextScore;
    },
    [mergeScore, token],
  );

  const changeStage = async () => {
    if (!selected || !pendingStage || pendingStage === selected.pipeline_stage) return;
    setBusy(true);
    setMessage('');
    try {
      await patchCase(token, selected.id, { pipeline_stage: pendingStage });
      onRowUpdate?.(selected.id, {
        pipeline_stage: pendingStage,
        pipeline_stage_label: stageLabels[pendingStage] ?? pendingStage,
      });
      await refreshDealScore(selected.id, true);
      setMessage('Đã cập nhật stage — điểm deal được làm mới.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Cập nhật stage thất bại');
    } finally {
      setBusy(false);
    }
  };

  const acceptNba = async () => {
    if (!nba) return;
    setBusy(true);
    try {
      await patchAiRecommendation(token, nba.recommendation_id, { status: 'accepted' });
      setMessage('Đã chấp nhận NBA — ghi case event.');
      setNba(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Chấp nhận NBA thất bại');
    } finally {
      setBusy(false);
    }
  };

  const dismissNba = async (reason: string) => {
    if (!nba) return;
    setBusy(true);
    try {
      await patchAiRecommendation(token, nba.recommendation_id, {
        status: 'dismissed',
        dismiss_reason: reason,
      });
      setShowDismiss(false);
      setNba(null);
      setMessage('Đã bỏ gợi ý NBA.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Bỏ NBA thất bại');
    } finally {
      setBusy(false);
    }
  };

  const columns = stages.filter((s) => s !== 'chot' && s !== 'mat');

  const cardsByStage = useMemo(() => {
    const grouped = new Map<string, PipelineCaseRow[]>();
    for (const stage of columns) {
      grouped.set(stage, []);
    }
    for (const row of rows) {
      const bucket = grouped.get(row.pipeline_stage);
      if (bucket) {
        bucket.push(row);
      }
    }
    if (sortByScore) {
      for (const [stage, cards] of grouped) {
        grouped.set(
          stage,
          [...cards].sort((a, b) => {
            const sa = scoreMap[String(a.id)]?.score_value ?? -1;
            const sb = scoreMap[String(b.id)]?.score_value ?? -1;
            return sb - sa;
          }),
        );
      }
    }
    return grouped;
  }, [columns, rows, scoreMap, sortByScore]);

  return (
    <div className="sales-pipeline-panel">
      <div className="sales-pipeline-panel__toolbar">
        <p className="muted">UI-R2-02 kanban · AI-UC-012 deal score · RNOS-10 NBA</p>
        {canSortByScore ? (
          <label className="sales-pipeline-panel__sort">
            <input
              type="checkbox"
              checked={sortByScore}
              onChange={(e) => setSortByScore(e.target.checked)}
              data-testid="pipeline-sort-by-score"
            />
            Sắp xếp theo điểm deal
          </label>
        ) : null}
      </div>
      {message ? <p className="sales-pipeline-panel__message">{message}</p> : null}
      <div className="sales-pipeline-kanban crm-kanban">
        {columns.map((stage) => {
          const cards = cardsByStage.get(stage) ?? [];
          return (
            <div key={stage} className="sales-pipeline-column crm-kanban-column">
              <div className="crm-kanban-column__head">
                <span className="crm-kanban-column__title">{stageLabels[stage] ?? stage}</span>
                <span className="crm-kanban-column__count">{cards.length}</span>
              </div>
              <div className="crm-kanban-column__body">
                <ul className="sales-pipeline-cards" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {cards.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className={`sales-pipeline-card crm-kanban-card${selectedId === row.id ? ' is-selected' : ''}`}
                        onClick={() => void openDeal(row.id)}
                      >
                        <strong className="crm-kanban-card__title">{row.title}</strong>
                        <span className="muted">{row.customer_name || `#${row.id}`}</span>
                        <DealScoreMiniBar summary={scoreMap[String(row.id)]} />
                        {nba && selectedId === row.id ? <span className="nba-card__badge">NBA</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
      {selected ? (
        <div className="sales-pipeline-drawer card">
          <h3>{selected.title}</h3>
          <p className="muted">
            {selected.pipeline_stage_label ?? selected.pipeline_stage} ·{' '}
            {Number(selected.deal_value_vnd ?? 0).toLocaleString('vi-VN')} VND
          </p>
          <div className="sales-pipeline-stage-form">
            <label htmlFor="pipeline-stage-select">Chuyển stage</label>
            <div className="sales-pipeline-stage-form__row">
              <select
                id="pipeline-stage-select"
                data-testid="pipeline-stage-select"
                value={pendingStage}
                disabled={busy}
                onChange={(e) => setPendingStage(e.target.value)}
              >
                {columns.map((stage) => (
                  <option key={stage} value={stage}>
                    {stageLabels[stage] ?? stage}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                data-testid="pipeline-stage-save"
                disabled={busy || pendingStage === selected.pipeline_stage}
                onClick={() => void changeStage()}
              >
                Lưu stage
              </button>
            </div>
          </div>
          {busy ? <p className="muted">Đang tải AI…</p> : null}
          <ScoreCard score={dealScore} title="Điểm deal" />
          {nba ? (
            <NbaCard
              actionLabel={nba.action_label}
              reason={nba.reason}
              confidence={nba.confidence}
              loading={busy}
              playbookCitation={nba.playbook_citation}
              onAccept={() => void acceptNba()}
              onDismiss={() => setShowDismiss(true)}
            />
          ) : null}
          <DismissReasonModal
            open={showDismiss}
            busy={busy}
            onCancel={() => setShowDismiss(false)}
            onConfirm={(reason) => void dismissNba(reason)}
          />
        </div>
      ) : null}
    </div>
  );
}
