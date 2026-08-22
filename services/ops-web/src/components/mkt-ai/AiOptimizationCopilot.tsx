'use client';

import { useCallback, useState } from 'react';
import styles from '@/components/mkt-ai/mkt-ai-planner.module.css';
import {
  postMktAiOptimizeJob,
  type MktAiOptimizeRecommendation,
  type MktAiOptimizeResult,
} from '@/lib/mkt-ai-planner-api';

interface Props {
  token: string;
  lifecycleId: number;
  canEdit?: boolean;
}

function priorityLabel(p: MktAiOptimizeRecommendation['priority']): string {
  if (p === 'high') return 'Cao';
  if (p === 'low') return 'Thấp';
  return 'Trung bình';
}

export function AiOptimizationCopilot({ token, lifecycleId, canEdit = true }: Props) {
  const [result, setResult] = useState<MktAiOptimizeResult | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const visibleRecs = (result?.recommendations ?? []).filter((r) => !dismissed.includes(r.id));

  const runPreview = useCallback(async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const out = await postMktAiOptimizeJob(token, lifecycleId, {
        channel: 'meta',
        confirm_create_tasks: false,
        dismissed_recommendation_ids: dismissed,
      });
      setResult(out);
      if (out.recommendations.length === 0) {
        setMessage('Không còn đề xuất sau khi loại bỏ — thử phân tích lại.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Phân tích optimize thất bại');
    } finally {
      setLoading(false);
    }
  }, [token, lifecycleId, dismissed]);

  const dismiss = (id: string) => {
    setDismissed((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const createTasks = useCallback(async () => {
    if (visibleRecs.length === 0) return;
    setCreating(true);
    setError('');
    setMessage('');
    try {
      const out = await postMktAiOptimizeJob(token, lifecycleId, {
        channel: 'meta',
        confirm_create_tasks: true,
        recommendation_ids: visibleRecs.map((r) => r.id),
        dismissed_recommendation_ids: dismissed,
      });
      setResult(out);
      const count = out.tasks_created?.length ?? 0;
      setMessage(count ? `Đã tạo ${count} task lifecycle — AM duyệt trước khi thực thi.` : 'Không tạo task.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo task thất bại');
    } finally {
      setCreating(false);
    }
  }, [token, lifecycleId, visibleRecs, dismissed]);

  return (
    <div className={`card stack-gap ${styles.copilotCard}`} style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <h4 style={{ margin: 0, flex: '1 1 auto' }}>Optimization Copilot</h4>
        {canEdit ? (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={loading || creating}
            onClick={() => void runPreview()}
          >
            {loading ? 'Đang phân tích…' : 'Phân tích optimize'}
          </button>
        ) : null}
      </div>

      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Đề xuất hành động từ KPI drift — không tự động thay đổi campaign Meta (BR-MKTP-01).
      </p>

      {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
      {message ? <p className="muted" style={{ margin: 0 }}>{message}</p> : null}

      {result?.kpi_context && (
        <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
          CPL vs target:{' '}
          {result.kpi_context.cpl_delta_pct != null
            ? `${result.kpi_context.cpl_delta_pct > 0 ? '+' : ''}${result.kpi_context.cpl_delta_pct}%`
            : '—'}
          {' · '}
          Spend MTD: {result.kpi_context.spend_mtd_vnd.toLocaleString('vi-VN')} ₫
        </p>
      )}

      {visibleRecs.length > 0 ? (
        <ul className={styles.copilotList}>
          {visibleRecs.map((rec) => (
            <li key={rec.id} className={styles.copilotItem}>
              <div className={styles.copilotItemHead}>
                <strong>{rec.title}</strong>
                <span className={styles.copilotPriority}>{priorityLabel(rec.priority)}</span>
              </div>
              <p className="muted" style={{ margin: '0.35rem 0', fontSize: '0.85rem' }}>
                {rec.rationale}
              </p>
              <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>
                Task ({rec.suggested_task.stage}): {rec.suggested_task.title}
              </p>
              {canEdit ? (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ marginTop: '0.5rem' }}
                  disabled={loading || creating}
                  onClick={() => dismiss(rec.id)}
                >
                  Bỏ qua
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : result && !loading ? (
        <p className="muted" style={{ margin: 0 }}>
          Chưa có đề xuất — bấm Phân tích optimize sau khi có KPI.
        </p>
      ) : null}

      {canEdit && visibleRecs.length > 0 ? (
        <button
          type="button"
          className="btn btn-sm"
          disabled={creating || loading}
          onClick={() => void createTasks()}
        >
          {creating ? 'Đang tạo task…' : 'Tạo task lifecycle'}
        </button>
      ) : null}

      {result?.tasks_created && result.tasks_created.length > 0 ? (
        <ul className="muted" style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
          {result.tasks_created.map((t) => (
            <li key={t.task_id}>
              #{t.task_id} — {t.title}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
