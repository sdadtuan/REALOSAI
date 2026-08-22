'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ContentOsDriftModal } from '@/components/content-os/ContentOsDriftModal';
import {
  fetchPlanSnapshot,
  postPlanSnapshotIngest,
  postPlanSnapshotSeal,
  type ContentOsContext,
  type ContentOsPlanSnapshot,
} from '@/lib/content-os-api';

interface Props {
  token: string;
  lifecycleId: number;
  ctx: ContentOsContext | null;
  canWrite: boolean;
  plannerImportRequested?: boolean;
  importRequestToken?: number;
  onPlannerImportHandled?: () => void;
  onChanged: () => Promise<void> | void;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
}

export function ContentOsSnapshotBanner({
  token,
  lifecycleId,
  ctx,
  canWrite,
  plannerImportRequested = false,
  importRequestToken = 0,
  onPlannerImportHandled,
  onChanged,
  onMessage,
  onError,
}: Props) {
  const [planSnap, setPlanSnap] = useState<ContentOsPlanSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [ingestMode, setIngestMode] = useState<'merge' | 'replace'>('merge');
  const [driftModalOpen, setDriftModalOpen] = useState(false);
  const autoImportStarted = useRef(false);
  const lastManualImportToken = useRef(0);

  const loadSnapshot = useCallback(async () => {
    try {
      const snap = await fetchPlanSnapshot(token, lifecycleId);
      setPlanSnap(snap);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Tải plan snapshot thất bại');
    }
  }, [token, lifecycleId, onError]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot, ctx?.snapshot?.id, ctx?.snapshot?.sealed]);

  const drift = Boolean(ctx?.snapshot?.planner_drift ?? planSnap?.planner.drift);
  const hasAppliedPlan = planSnap?.planner.has_applied_plan ?? false;
  const snap = ctx?.snapshot;
  const planId = snap?.marketing_plan_id ?? planSnap?.planner.marketing_plan_id;

  async function onImport() {
    if (!canWrite || !hasAppliedPlan) return;
    setBusy(true);
    onError('');
    try {
      const out = await postPlanSnapshotIngest(token, lifecycleId, {
        marketing_plan_id: planId ?? undefined,
        mode: ingestMode,
        import_calendar: true,
        import_pillars: true,
      });
      const warn =
        out.warnings?.length ? ` (${out.warnings.length} cảnh báo)` : '';
      onMessage(
        `Import OK — ${out.ideas_created} ideas, ${out.pillars_upserted} pillars${warn}`,
      );
      await loadSnapshot();
      await onChanged();
      onPlannerImportHandled?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Import Planner thất bại');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!plannerImportRequested || autoImportStarted.current) return;
    if (!canWrite || !hasAppliedPlan || busy) return;
    autoImportStarted.current = true;
    void onImport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plannerImportRequested, canWrite, hasAppliedPlan]);

  useEffect(() => {
    if (!importRequestToken || importRequestToken === lastManualImportToken.current) return;
    if (!canWrite || !hasAppliedPlan || busy) return;
    lastManualImportToken.current = importRequestToken;
    void onImport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importRequestToken, canWrite, hasAppliedPlan]);

  async function onSeal() {
    if (!canWrite || snap?.sealed) return;
    setBusy(true);
    onError('');
    try {
      await postPlanSnapshotSeal(token, lifecycleId);
      onMessage('Đã seal snapshot');
      await loadSnapshot();
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Seal snapshot thất bại');
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = !snap
    ? 'Chưa import Planner'
    : snap.sealed
      ? `sealed · TMMT #${planId ?? '—'}`
      : `draft · TMMT #${planId ?? '—'}`;

  return (
    <>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '0.65rem 0.75rem',
          background: drift ? 'rgba(255, 180, 0, 0.08)' : 'var(--surface)',
          display: 'grid',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>⚡ Kế hoạch Planner</span>
          <span className="muted" style={{ fontSize: '0.88rem' }}>
            {statusLabel}
            {snap ? ` · ${snap.pillars_count} pillars · ${ctx?.counts.ideas ?? 0} ideas` : ''}
          </span>
          {drift ? (
            <span style={{ color: 'var(--warning, #e6a700)', fontSize: '0.85rem' }}>⚠ Planner đã đổi</span>
          ) : (
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              Drift: —
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          {!hasAppliedPlan ? (
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              Chưa có TMMT — Apply AI Planner trước khi import.
            </span>
          ) : null}

          {canWrite && hasAppliedPlan ? (
            <>
              <select
                value={ingestMode}
                onChange={(e) => setIngestMode(e.target.value as 'merge' | 'replace')}
                disabled={busy}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.35rem 0.5rem',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="merge">Merge</option>
                <option value="replace">Replace (archive ideas import)</option>
              </select>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void onImport()}>
                Import từ Planner
              </button>
            </>
          ) : null}

          {drift ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={busy}
              onClick={() => setDriftModalOpen(true)}
            >
              Xem diff
            </button>
          ) : null}

          {canWrite && snap && !snap.sealed ? (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy}
              onClick={() => void onSeal()}
            >
              Seal snapshot
            </button>
          ) : null}
        </div>
      </div>

      <ContentOsDriftModal
        open={driftModalOpen}
        token={token}
        lifecycleId={lifecycleId}
        marketingPlanId={planId}
        canWrite={canWrite}
        busy={busy}
        onClose={() => setDriftModalOpen(false)}
        onReingested={async () => {
          await loadSnapshot();
          await onChanged();
        }}
        onMessage={onMessage}
        onError={onError}
      />
    </>
  );
}
