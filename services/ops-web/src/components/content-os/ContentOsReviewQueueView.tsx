'use client';

import { ContentOsReviewSlaTile } from '@/components/content-os/ContentOsReviewSlaTile';
import { useCallback, useEffect, useState } from 'react';
import {
  channelFormatLabel,
  fetchContentOsReviewQueue,
  fetchContentOsReviewQueueSummary,
  fetchContentOsVisualReviewQueue,
  postContentOsApproveItem,
  postContentOsRejectItem,
  postContentOsVisualApprove,
  postContentOsVisualReject,
  visualStatusLabel,
  type ContentOsReviewQueueItem,
  type ContentOsVisualReviewItem,
} from '@/lib/content-os-api';

type QueueMode = 'copy' | 'visual';

interface Props {
  token: string;
  lifecycleId: number;
  canApprove: boolean;
  onOpenItem: (itemId: number) => void;
  onChanged: () => Promise<void> | void;
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
}

export function ContentOsReviewQueueView({
  token,
  lifecycleId,
  canApprove,
  onOpenItem,
  onChanged,
  onError,
  onMessage,
}: Props) {
  const [mode, setMode] = useState<QueueMode>('copy');
  const [items, setItems] = useState<ContentOsReviewQueueItem[]>([]);
  const [visualItems, setVisualItems] = useState<ContentOsVisualReviewItem[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    sla_breach: number;
    sla_target_hours: number;
    max_hours_in_review: number | null;
    avg_hours_in_review: number | null;
  } | null>(null);
  const [slaOnly, setSlaOnly] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      if (mode === 'visual') {
        const visual = await fetchContentOsVisualReviewQueue(token, lifecycleId);
        setVisualItems(visual.items);
        return;
      }
      const [queue, sum] = await Promise.all([
        fetchContentOsReviewQueue(token, lifecycleId, { sla_breach: slaOnly || undefined }),
        fetchContentOsReviewQueueSummary(token, lifecycleId),
      ]);
      setItems(queue.items);
      setSummary(sum);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Tải review queue thất bại');
    }
  }, [token, lifecycleId, slaOnly, mode, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onApprove(itemId: number) {
    if (!canApprove) return;
    setBusy(true);
    onError('');
    try {
      await postContentOsApproveItem(token, lifecycleId, itemId);
      onMessage(`Đã duyệt item #${itemId}`);
      await reload();
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Duyệt thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onVisualApprove(itemId: number) {
    if (!canApprove) return;
    setBusy(true);
    onError('');
    try {
      await postContentOsVisualApprove(token, lifecycleId, itemId, { override: true });
      onMessage(`Đã duyệt visual item #${itemId}`);
      await reload();
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Duyệt visual thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onRejectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canApprove || rejectId == null) return;
    setBusy(true);
    onError('');
    try {
      if (mode === 'visual') {
        await postContentOsVisualReject(token, lifecycleId, rejectId, rejectComment.trim());
      } else {
        await postContentOsRejectItem(token, lifecycleId, rejectId, rejectComment.trim());
      }
      onMessage(`Đã từ chối item #${rejectId}`);
      setRejectId(null);
      setRejectComment('');
      await reload();
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Từ chối thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={mode === 'copy' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
          onClick={() => setMode('copy')}
        >
          Copy review
        </button>
        <button
          type="button"
          className={mode === 'visual' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
          onClick={() => setMode('visual')}
        >
          Visual{visualItems.length ? ` (${visualItems.length})` : ''}
        </button>
      </div>

      {mode === 'copy' ? (
        <>
          <ContentOsReviewSlaTile
            total={summary?.total ?? items.length}
            slaBreach={summary?.sla_breach ?? 0}
            slaTargetHours={summary?.sla_target_hours ?? 48}
            maxHours={summary?.max_hours_in_review ?? null}
            avgHours={summary?.avg_hours_in_review ?? null}
            onFilterBreach={
              (summary?.sla_breach ?? 0) > 0 ? () => setSlaOnly(true) : undefined
            }
          />
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={slaOnly} onChange={(e) => setSlaOnly(e.target.checked)} />
            Chỉ SLA breach
          </label>
        </>
      ) : (
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Filter: visual_status=ai_ready · {visualItems.length} item(s)
        </p>
      )}

      {mode === 'copy' ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
          {items.map((item) => (
            <li
              key={item.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '0.65rem',
                background: item.sla_breach ? 'rgba(255, 80, 0, 0.06)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div>
                  <strong>{item.title}</strong>
                  <div className="muted" style={{ fontSize: '0.82rem' }}>
                    {channelFormatLabel(item.channel, item.format)}
                    {item.in_review_at
                      ? ` · since ${new Date(item.in_review_at).toLocaleString('vi-VN')}`
                      : ''}
                    {item.sla_breach ? ' · SLA ⚠' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => onOpenItem(item.id)}>
                    Mở
                  </button>
                  {canApprove ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busy}
                        onClick={() => void onApprove(item.id)}
                      >
                        Duyệt
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        disabled={busy}
                        onClick={() => {
                          setRejectId(item.id);
                          setRejectComment('');
                        }}
                      >
                        Từ chối
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
          {visualItems.map((item) => (
            <li
              key={item.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '0.65rem',
                background: 'rgba(100, 180, 255, 0.06)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div>
                  <strong>{item.title}</strong>
                  <span className="badge" style={{ marginLeft: 8 }}>
                    Visual
                  </span>
                  <div className="muted" style={{ fontSize: '0.82rem' }}>
                    {channelFormatLabel(item.channel, item.format)} · {visualStatusLabel(item.visual_status)}
                    {item.visual_qa_score != null ? ` · QA ${item.visual_qa_score}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => onOpenItem(item.id)}>
                    Mở Media AI
                  </button>
                  {canApprove ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busy}
                        onClick={() => void onVisualApprove(item.id)}
                      >
                        Duyệt visual
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        disabled={busy}
                        onClick={() => {
                          setRejectId(item.id);
                          setRejectComment('');
                        }}
                      >
                        Từ chối
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {mode === 'copy' && !items.length ? <p className="muted">Không có item đang duyệt.</p> : null}
      {mode === 'visual' && !visualItems.length ? (
        <p className="muted">Không có visual chờ duyệt (ai_ready).</p>
      ) : null}

      {rejectId != null ? (
        <form
          onSubmit={(e) => void onRejectSubmit(e)}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0.65rem',
            display: 'grid',
            gap: '0.5rem',
          }}
        >
          <strong>
            Từ chối {mode === 'visual' ? 'visual' : 'copy'} item #{rejectId}
          </strong>
          <textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={3}
            placeholder="Comment tối thiểu 10 ký tự…"
            required
            minLength={10}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.45rem',
              color: 'var(--text)',
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-sm" disabled={busy || rejectComment.trim().length < 10}>
              Xác nhận từ chối
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRejectId(null)}>
              Hủy
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
