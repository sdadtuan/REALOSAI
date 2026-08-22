'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { WinDiffChip } from '@/components/win';
import styles from '@/components/mkt-ai/mkt-ai-planner.module.css';
import { buildTmmtApplyDiff, truncatePreview } from '@/lib/mkt-ai-apply-diff';
import {
  fetchMktAiPlanVersions,
  postMktAiRestorePlanVersion,
  type MktAiPlanVersionRow,
  type MktAiPlanVersionSummary,
} from '@/lib/mkt-ai-planner-api';

interface Props {
  open: boolean;
  token: string;
  lifecycleId: number;
  canEdit: boolean;
  busy?: boolean;
  summaries?: MktAiPlanVersionSummary[];
  onClose: () => void;
  onRestored: () => Promise<void>;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
}

const VERSION_STATUS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Chờ duyệt',
  approved: 'Đã duyệt',
  applied: 'Đã apply',
  archived: 'Lưu trữ',
};

export function AiVersionCompareDrawer({
  open,
  token,
  lifecycleId,
  canEdit,
  busy = false,
  summaries = [],
  onClose,
  onRestored,
  onMessage,
  onError,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [versions, setVersions] = useState<MktAiPlanVersionRow[]>([]);
  const [baseId, setBaseId] = useState<number | null>(null);
  const [compareId, setCompareId] = useState<number | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    onError('');
    try {
      const out = await fetchMktAiPlanVersions(token, lifecycleId);
      const rows = out.versions ?? [];
      setVersions(rows);
      if (rows.length >= 2) {
        setBaseId(rows[1].id);
        setCompareId(rows[0].id);
      } else if (rows.length === 1) {
        setBaseId(rows[0].id);
        setCompareId(rows[0].id);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Không tải được phiên bản');
    } finally {
      setLoading(false);
    }
  }, [lifecycleId, onError, token]);

  useEffect(() => {
    if (open) void loadVersions();
  }, [loadVersions, open]);

  const base = useMemo(
    () => versions.find((v) => v.id === baseId) ?? null,
    [baseId, versions],
  );
  const compare = useMemo(
    () => versions.find((v) => v.id === compareId) ?? null,
    [compareId, versions],
  );

  const diffs = useMemo(() => {
    if (!base || !compare) return [];
    return buildTmmtApplyDiff(
      base.strategy_framework_json,
      base.target_market_prof_json,
      compare.strategy_framework_json,
      compare.target_market_prof_json,
    );
  }, [base, compare]);

  const changedCount = diffs.filter((d) => d.changed).length;
  const working = busy || localBusy || loading;

  async function handleRestore(version: MktAiPlanVersionRow) {
    if (!canEdit) return;
    const ok = window.confirm(
      `Khôi phục draft từ ${version.label || `v${version.version_no}`}? Không tự động apply TMMT.`,
    );
    if (!ok) return;
    setLocalBusy(true);
    onError('');
    try {
      await postMktAiRestorePlanVersion(token, lifecycleId, version.id);
      await onRestored();
      onMessage(`Đã khôi phục draft từ ${version.label || `v${version.version_no}`}`);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Khôi phục draft thất bại');
    } finally {
      setLocalBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className={styles.versionDrawerBackdrop} onClick={() => !working && onClose()}>
      <aside
        className={styles.versionDrawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mkt-ai-version-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.versionDrawerHeader}>
          <div>
            <h3 id="mkt-ai-version-drawer-title" style={{ margin: 0, fontSize: '1rem' }}>
              So sánh phiên bản
            </h3>
            <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>
              Diff TMMT keys · Rollback chỉ ghi draft (không auto-apply)
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <WinDiffChip added={changedCount} removed={0} />
            <button type="button" className="btn btn-sm btn-ghost" disabled={working} onClick={onClose}>
              ✕
            </button>
          </div>
        </header>

        {loading ? (
          <p className="muted" style={{ padding: '1rem', margin: 0 }}>
            Đang tải phiên bản…
          </p>
        ) : versions.length === 0 ? (
          <p className="muted" style={{ padding: '1rem', margin: 0 }}>
            Chưa có snapshot — gửi duyệt trên Step Apply để tạo v1.
            {summaries.length > 0 ? ` (${summaries.length} bản ghi trong context)` : ''}
          </p>
        ) : (
          <>
            <div className={styles.versionPickerRow}>
              <label style={{ display: 'grid', gap: '0.25rem', flex: 1 }}>
                <span className="muted" style={{ fontSize: '0.75rem' }}>
                  Base
                </span>
                <select
                  className="input"
                  value={baseId ?? ''}
                  disabled={working}
                  onChange={(e) => setBaseId(Number(e.target.value))}
                >
                  {versions.map((v) => (
                    <option key={`base-${v.id}`} value={v.id}>
                      {v.label || `v${v.version_no}`} · {VERSION_STATUS[v.status] ?? v.status}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: '0.25rem', flex: 1 }}>
                <span className="muted" style={{ fontSize: '0.75rem' }}>
                  So với
                </span>
                <select
                  className="input"
                  value={compareId ?? ''}
                  disabled={working}
                  onChange={(e) => setCompareId(Number(e.target.value))}
                >
                  {versions.map((v) => (
                    <option key={`cmp-${v.id}`} value={v.id}>
                      {v.label || `v${v.version_no}`} · {VERSION_STATUS[v.status] ?? v.status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.versionDiffTableWrap}>
              <table className={styles.versionDiffTable}>
                <thead>
                  <tr>
                    <th>Trường TMMT</th>
                    <th>{base?.label || (base ? `v${base.version_no}` : 'Base')}</th>
                    <th>{compare?.label || (compare ? `v${compare.version_no}` : 'Compare')}</th>
                  </tr>
                </thead>
                <tbody>
                  {diffs
                    .filter((d) => d.official.trim() || d.draft.trim())
                    .map((d) => (
                      <tr key={`${d.section}-${d.key}`} className={d.changed ? styles.versionDiffChanged : undefined}>
                        <td>{d.label}</td>
                        <td>{truncatePreview(d.official, 120) || '—'}</td>
                        <td>{truncatePreview(d.draft, 120) || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {canEdit && compare ? (
              <div className={styles.versionDrawerActions}>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={working}
                  onClick={() => void handleRestore(compare)}
                >
                  Khôi phục draft từ {compare.label || `v${compare.version_no}`}
                </button>
              </div>
            ) : null}
          </>
        )}
      </aside>
    </div>
  );
}
