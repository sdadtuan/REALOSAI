'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchContentOsItemComments,
  postContentOsItemComment,
  type ContentOsComment,
} from '@/lib/content-os-api';

interface Props {
  token: string;
  lifecycleId: number;
  itemId: number;
  canWrite: boolean;
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
}

export function ContentOsCommentsPanel({
  token,
  lifecycleId,
  itemId,
  canWrite,
  onError,
  onMessage,
}: Props) {
  const [comments, setComments] = useState<ContentOsComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    onError('');
    try {
      const res = await fetchContentOsItemComments(token, lifecycleId, itemId);
      setComments(res.comments);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Tải comments thất bại');
    } finally {
      setLoading(false);
    }
  }, [token, lifecycleId, itemId, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite || !body.trim()) return;
    setBusy(true);
    onError('');
    try {
      await postContentOsItemComment(token, lifecycleId, itemId, {
        body: body.trim(),
        visibility: 'internal',
      });
      setBody('');
      onMessage('Đã thêm comment');
      await reload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gửi comment thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Đang tải comments…</p>;

  return (
    <div style={{ display: 'grid', gap: '0.65rem', marginTop: '0.75rem' }}>
      <strong style={{ fontSize: '0.9rem' }}>QA thread</strong>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.45rem' }}>
        {comments.map((c) => (
          <li
            key={c.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.55rem',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <strong>{c.author_id}</strong>
              <span className="muted" style={{ fontSize: '0.75rem' }}>
                {new Date(c.created_at).toLocaleString('vi-VN')}
              </span>
            </div>
            <p style={{ margin: '0.35rem 0 0', whiteSpace: 'pre-wrap' }}>{c.body}</p>
          </li>
        ))}
        {!comments.length ? <li className="muted">Chưa có comment — reject review sẽ tạo comment tự động.</li> : null}
      </ul>
      {canWrite ? (
        <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'grid', gap: '0.35rem' }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Comment nội bộ…"
            disabled={busy}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.45rem',
              color: 'var(--text)',
              fontFamily: 'inherit',
            }}
          />
          <button type="submit" className="btn btn-sm" disabled={busy || !body.trim()}>
            Gửi comment
          </button>
        </form>
      ) : (
        <p className="muted" style={{ fontSize: '0.82rem' }}>Chỉ xem — cần quyền crm_content.write</p>
      )}
    </div>
  );
}
