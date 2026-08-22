'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AiApplyTmmtModal } from '@/components/mkt-ai/AiApplyTmmtModal';
import { AiPlanApprovalBar } from '@/components/mkt-ai/AiPlanApprovalBar';
import { AiVersionCompareDrawer } from '@/components/mkt-ai/AiVersionCompareDrawer';
import { AiQualityScoreCard, type QualityScoreView } from '@/components/mkt-ai/AiQualityScoreCard';
import { ExportPlanActions } from '@/components/mkt-ai/ExportPlanActions';
import { fetchServiceLifecycleMarketingPlan } from '@/lib/api';
import { buildTmmtApplyDiff, summarizeApplyDiff, truncatePreview } from '@/lib/mkt-ai-apply-diff';
import { getQualityTier } from '@/lib/mkt-ai-quality-labels';
import {
  downloadMktAiExportFile,
  postMktAiApply,
  postMktAiExport,
  postMktAiExportPptx,
  postMktAiQualityJob,
  type MktAiDraft,
  type MktAiApprovalContext,
  type MktAiCommentRow,
  type MktAiPlanVersionSummary,
  type MktAiPptxExportSection,
} from '@/lib/mkt-ai-planner-api';

interface Props {
  token: string;
  lifecycleId: number;
  draft: MktAiDraft;
  quality: QualityScoreView | null | undefined;
  canEdit: boolean;
  canExport: boolean;
  canApprove: boolean;
  exportPptxEnabled?: boolean;
  approval?: MktAiApprovalContext;
  comments?: MktAiCommentRow[];
  planVersions?: MktAiPlanVersionSummary[];
  approvalRequired?: boolean;
  paused?: boolean;
  onOpenTmmtTab?: () => void;
  onApplied?: () => void;
  onQualityUpdated: () => Promise<void>;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
}

export function AiApplyStepPanel({
  token,
  lifecycleId,
  draft,
  quality,
  canEdit,
  canExport,
  canApprove,
  exportPptxEnabled = false,
  approval,
  comments,
  planVersions = [],
  approvalRequired = false,
  paused = false,
  onOpenTmmtTab,
  onApplied,
  onQualityUpdated,
  onMessage,
  onError,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [appliedOnce, setAppliedOnce] = useState(false);
  const [officialSf, setOfficialSf] = useState<Record<string, string>>({});
  const [officialProf, setOfficialProf] = useState<Record<string, string>>({});
  const [planLoaded, setPlanLoaded] = useState(false);

  const loadOfficialPlan = useCallback(async () => {
    try {
      const out = await fetchServiceLifecycleMarketingPlan(token, lifecycleId);
      const plan = out.plan as {
        strategy_framework?: Record<string, string>;
        target_market_prof?: Record<string, string>;
      } | null;
      setOfficialSf(plan?.strategy_framework ?? {});
      setOfficialProf(plan?.target_market_prof ?? {});
      setPlanLoaded(true);
    } catch {
      setOfficialSf({});
      setOfficialProf({});
      setPlanLoaded(true);
    }
  }, [lifecycleId, token]);

  const runQuality = useCallback(async () => {
    if (!canEdit) return;
    setQualityLoading(true);
    setBusy(true);
    onError('');
    try {
      await postMktAiQualityJob(token, lifecycleId);
      await onQualityUpdated();
      onMessage('Đã cập nhật quality score');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Tính quality score thất bại');
    } finally {
      setQualityLoading(false);
      setBusy(false);
    }
  }, [canEdit, lifecycleId, onError, onMessage, onQualityUpdated, token]);

  useEffect(() => {
    void loadOfficialPlan();
  }, [loadOfficialPlan]);

  useEffect(() => {
    if (!canEdit || paused) return;
    let cancelled = false;
    (async () => {
      setQualityLoading(true);
      setBusy(true);
      onError('');
      try {
        await postMktAiQualityJob(token, lifecycleId);
        if (!cancelled) await onQualityUpdated();
      } catch (err) {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : 'Tính quality score thất bại');
        }
      } finally {
        if (!cancelled) {
          setQualityLoading(false);
          setBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Auto-run quality once when entering Apply step (UC-007)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const diffs = useMemo(
    () =>
      buildTmmtApplyDiff(
        officialSf,
        officialProf,
        draft.strategy_framework ?? {},
        draft.target_market_prof ?? {},
      ),
    [draft.strategy_framework, draft.target_market_prof, officialProf, officialSf],
  );

  const diffSummary = useMemo(() => summarizeApplyDiff(diffs), [diffs]);
  const tier = getQualityTier(quality?.score);
  const canApply = Boolean(canEdit && quality?.can_apply && tier !== 'blocked');
  const contentOsImportHref = `/crm/service-delivery/${lifecycleId}?tab=content-os&view=ideas&import=planner`;

  async function handleApplyConfirm() {
    setBusy(true);
    onError('');
    try {
      const out = await postMktAiApply(token, lifecycleId, {
        confirm_overwrite: true,
        strategy_framework: draft.strategy_framework,
        target_market_prof: draft.target_market_prof,
      });
      setModalOpen(false);
      await onQualityUpdated();
      await loadOfficialPlan();
      if (out.tmmt_validation.ok) {
        onMessage('Đã apply — Gate TMMT ✓ pass');
      } else {
        onMessage('Đã apply — Gate TMMT chưa pass, kiểm tra tab TMMT');
      }
      setAppliedOnce(true);
      onApplied?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Apply TMMT thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(format: 'pdf' | 'docx' | 'xlsx') {
    setBusy(true);
    onError('');
    try {
      const out = await postMktAiExport(token, lifecycleId, format);
      downloadMktAiExportFile(out);
      onMessage(`Đã tải ${out.filename}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Export thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleExportPptx(sections: MktAiPptxExportSection[]) {
    setBusy(true);
    onError('');
    try {
      const out = await postMktAiExportPptx(token, lifecycleId, sections);
      downloadMktAiExportFile(out);
      onMessage(`Đã tải ${out.filename}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Export PPTX thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      {approval ? (
        <AiPlanApprovalBar
          token={token}
          lifecycleId={lifecycleId}
          approval={approval}
          comments={comments}
          canEdit={canEdit}
          canApprove={canApprove}
          busy={busy || paused}
          onRefresh={onQualityUpdated}
          onMessage={onMessage}
          onError={onError}
        />
      ) : null}

      <AiQualityScoreCard
        quality={quality}
        loading={qualityLoading}
        busy={busy || paused}
        canEdit={canEdit}
        onRecalculate={() => void runQuality()}
      />

      <section
        className="card"
        style={{ padding: '1rem', border: '1px solid var(--border)', display: 'grid', gap: '0.5rem' }}
      >
        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Preview TMMT merge</h4>
        {!planLoaded ? (
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Đang tải TMMT official…
          </p>
        ) : diffSummary.previewLines.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Draft chưa có nội dung strategy/TMMT để merge.
          </p>
        ) : (
          <>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              {diffSummary.changedCount} trường thay đổi · {diffSummary.newFields} trường mới từ draft
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
              {diffSummary.previewLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {diffs
              .filter((d) => d.draft.trim())
              .slice(0, 3)
              .map((d) => (
                <div key={`preview-${d.key}`} style={{ fontSize: '0.8rem' }}>
                  <span className="muted">{d.label}: </span>
                  {truncatePreview(d.draft, 80)}
                </div>
              ))}
          </>
        )}
      </section>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={busy || paused}
          onClick={() => setVersionDrawerOpen(true)}
        >
          So sánh phiên bản
          {planVersions.length > 0 ? ` (${planVersions.length})` : ''}
        </button>
        {canEdit ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy || paused || !canApply}
            title={
              !quality?.can_apply
                ? 'Cần quality ≥60'
                : tier === 'blocked'
                  ? 'Quality quá thấp'
                  : undefined
            }
            onClick={() => setModalOpen(true)}
          >
            Apply vào TMMT chính thức
          </button>
        ) : null}
        {onOpenTmmtTab ? (
          <button type="button" className="btn btn-sm btn-secondary" onClick={onOpenTmmtTab}>
            Mở tab TMMT chỉnh tay →
          </button>
        ) : null}
      </div>

      {!canApply && quality ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          {tier === 'blocked'
            ? 'Cần quality ≥60 và đủ tiêu chí brief/ICP/campaign trước khi apply.'
            : 'Apply bị khóa — kiểm tra draft và quality score.'}
        </p>
      ) : null}

      {appliedOnce ? (
        <p style={{ margin: 0, fontSize: '0.85rem' }}>
          <Link href={contentOsImportHref} className="btn btn-sm btn-secondary">
            Mở Content OS — Import Planner →
          </Link>
        </p>
      ) : null}

      <ExportPlanActions
        quality={quality}
        canExport={canExport}
        exportPptxEnabled={exportPptxEnabled}
        approvalRequired={approvalRequired}
        approvalCanExport={approval?.can_export ?? true}
        busy={busy || paused}
        onExport={(format) => void handleExport(format)}
        onExportPptx={(sections) => void handleExportPptx(sections)}
      />

      <AiApplyTmmtModal
        open={modalOpen}
        busy={busy}
        score={quality?.score ?? 0}
        diffs={diffs}
        onClose={() => !busy && setModalOpen(false)}
        onConfirm={() => void handleApplyConfirm()}
      />

      <AiVersionCompareDrawer
        open={versionDrawerOpen}
        token={token}
        lifecycleId={lifecycleId}
        canEdit={canEdit}
        busy={busy || paused}
        summaries={planVersions}
        onClose={() => !busy && setVersionDrawerOpen(false)}
        onRestored={onQualityUpdated}
        onMessage={onMessage}
        onError={onError}
      />
    </div>
  );
}
