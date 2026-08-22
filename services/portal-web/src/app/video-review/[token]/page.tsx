'use client';

import { useEffect, useState } from 'react';
import {
  approvePublicVideoReview,
  fetchPublicVideoReview,
  postPublicVideoReviewComment,
  requestPublicVideoReviewChanges,
  type PublicVideoReview,
} from '@/lib/api';

export default function VideoReviewPage({ params }: { params: { token: string } }) {
  const token = params.token ?? '';
  const [data, setData] = useState<PublicVideoReview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Link không hợp lệ.');
      setLoading(false);
      return;
    }
    void fetchPublicVideoReview(token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tải được review'))
      .finally(() => setLoading(false));
  }, [token]);

  async function reload() {
    const row = await fetchPublicVideoReview(token);
    setData(row);
  }

  async function submitComment() {
    if (!comment.trim()) return;
    setActing(true);
    setMessage('');
    try {
      await postPublicVideoReviewComment(token, { body: comment.trim() });
      setComment('');
      await reload();
      setMessage('Comment đã gửi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi comment thất bại');
    } finally {
      setActing(false);
    }
  }

  async function approve() {
    setActing(true);
    setMessage('');
    try {
      await approvePublicVideoReview(token);
      setMessage('Đã approve — cảm ơn!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve thất bại');
    } finally {
      setActing(false);
    }
  }

  async function requestChanges() {
    setActing(true);
    setMessage('');
    try {
      await requestPublicVideoReviewChanges(token, { reason: 'Client request changes via portal' });
      setMessage('Đã gửi yêu cầu chỉnh sửa.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request changes thất bại');
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <main className="deal-teaser-page">
        <p className="muted">Đang tải video review…</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="deal-teaser-page">
        <div className="deal-teaser-card deal-teaser-card--error">
          <h1>Không thể mở video review</h1>
          <p>{error || 'Link không hợp lệ hoặc đã hết hạn (review_expired).'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="deal-teaser-page">
      <article className="deal-teaser-card stack-gap">
        <header>
          <p className="deal-teaser-eyebrow">PTT Agency · Video review (SC-14)</p>
          <h1 className="deal-teaser-title">Project #{data.project_id}</h1>
          <p className="deal-teaser-meta muted">
            Gate {data.gate_no} · hết hạn {new Date(data.expires_at).toLocaleString()}
          </p>
        </header>

        <div style={{ position: 'relative', maxWidth: 720 }}>
          {data.video_url ? (
            <video
              controls
              playsInline
              style={{ width: '100%', borderRadius: 8, background: '#000' }}
              src={data.video_url}
            />
          ) : (
            <p className="muted">Video preview stub — asset chưa có URL public.</p>
          )}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              display: 'grid',
              placeItems: 'center',
              color: 'rgba(255,255,255,0.35)',
              fontSize: '0.85rem',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}
          >
            {data.watermark_text}
          </div>
        </div>

        {message ? <p className="muted">{message}</p> : null}

        <section>
          <h2>Comments</h2>
          {data.comments.length === 0 ? <p className="muted">Chưa có comment.</p> : null}
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {data.comments.map((row) => (
              <li key={row.id}>
                {row.body}
                {row.timecode_ms != null ? ` @ ${row.timecode_ms}ms` : ''}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comment hoặc timecode…"
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-secondary" disabled={acting} onClick={() => void submitComment()}>
              Gửi
            </button>
          </div>
        </section>

        <section style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" disabled={acting} onClick={() => void approve()}>
            Approve
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={acting}
            onClick={() => void requestChanges()}
          >
            Request changes
          </button>
        </section>
      </article>
    </main>
  );
}
