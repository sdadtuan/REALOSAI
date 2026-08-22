'use client';

import { useCallback, useState } from 'react';
import styles from '@/components/mkt-ai/mkt-ai-planner.module.css';
import {
  postMktAiComment,
  postMktAiDecideApproval,
  postMktAiSubmitApproval,
  type MktAiApprovalContext,
  type MktAiCommentRow,
} from '@/lib/mkt-ai-planner-api';

interface Props {
  token: string;
  lifecycleId: number;
  approval: MktAiApprovalContext;
  comments?: MktAiCommentRow[];
  canEdit: boolean;
  canApprove: boolean;
  busy?: boolean;
  onRefresh: () => Promise<void>;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt MKT Lead',
  approved: 'Đã duyệt',
  changes_requested: 'Yêu cầu chỉnh sửa',
  rejected: 'Đã từ chối',
  cancelled: 'Đã hủy',
};

export function AiPlanApprovalBar({
  token,
  lifecycleId,
  approval,
  comments = [],
  canEdit,
  canApprove,
  busy = false,
  onRefresh,
  onMessage,
  onError,
}: Props) {
  const [localBusy, setLocalBusy] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [decisionNote, setDecisionNote] = useState('');

  const loading = busy || localBusy;
  const latest = approval.latest;
  const status = latest?.status ?? null;
  const versionLabel = latest?.plan_version?.label ?? (latest ? `v${latest.plan_version?.version_no ?? '?'}` : '—');
  const pending = status === 'pending';

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setLocalBusy(true);
      onError('');
      try {
        await fn();
        await onRefresh();
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Thao tác duyệt thất bại');
      } finally {
        setLocalBusy(false);
      }
    },
    [onError, onRefresh],
  );

  if (!approval.required) return null;

  async function handleSubmit() {
    await run(async () => {
      await postMktAiSubmitApproval(token, lifecycleId, {});
      onMessage('Đã gửi duyệt — chờ MKT Lead');
    });
  }

  async function handleDecide(decision: 'approve' | 'changes_requested' | 'reject') {
    if (!latest) return;
    await run(async () => {
      await postMktAiDecideApproval(token, lifecycleId, latest.id, {
        decision,
        note: decisionNote.trim() || undefined,
      });
      setDecisionNote('');
      if (decision === 'approve') onMessage('Đã duyệt — export được mở khóa');
      else if (decision === 'reject') onMessage('Đã từ chối kế hoạch');
      else onMessage('Đã yêu cầu chỉnh sửa');
    });
  }

  async function handleComment() {
    const text = commentText.trim();
    if (!text) return;
    await run(async () => {
      await postMktAiComment(token, lifecycleId, {
        body: text,
        approval_id: latest?.id,
      });
      setCommentText('');
      setCommentOpen(false);
      onMessage('Đã thêm comment');
    });
  }

  return (
    <div className={styles.approvalBar}>
      <div className={styles.approvalBarMain}>
        <div>
          <strong style={{ fontSize: '0.9rem' }}>Duyệt kế hoạch trước export</strong>
          <p className="muted" style={{ margin: '0.15rem 0 0', fontSize: '0.82rem' }}>
            Trạng thái: {status ? STATUS_LABEL[status] ?? status : 'Chưa gửi duyệt'}
            {' · '}
            Version: {versionLabel}
            {!approval.can_export && approval.required ? ' · Export bị khóa' : ''}
          </p>
        </div>
        <div className={styles.approvalBarActions}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={loading}
            onClick={() => setCommentOpen((v) => !v)}
          >
            Comment
          </button>
          {canEdit && approval.can_submit ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled={loading}
              onClick={() => void handleSubmit()}
            >
              Gửi duyệt
            </button>
          ) : null}
          {canApprove && pending && latest ? (
            <>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={loading}
                onClick={() => void handleDecide('changes_requested')}
              >
                Yêu cầu sửa
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={loading}
                onClick={() => void handleDecide('reject')}
              >
                Từ chối
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={loading}
                onClick={() => void handleDecide('approve')}
              >
                Duyệt ✓
              </button>
            </>
          ) : null}
        </div>
      </div>

      {commentOpen ? (
        <div className={styles.approvalCommentBox}>
          <textarea
            className="input"
            rows={2}
            placeholder="Ghi chú review cho SP…"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            disabled={loading}
          />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-sm"
              disabled={loading || !commentText.trim()}
              onClick={() => void handleComment()}
            >
              Gửi comment
            </button>
            {canApprove && pending ? (
              <input
                className="input"
                style={{ flex: '1 1 160px', fontSize: '0.85rem' }}
                placeholder="Ghi chú quyết định (tùy chọn)"
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                disabled={loading}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {comments.length > 0 ? (
        <ul className={styles.approvalCommentList}>
          {comments.slice(0, 5).map((c) => (
            <li key={c.id}>
              <span className="muted">{c.author_email}: </span>
              {c.body}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
