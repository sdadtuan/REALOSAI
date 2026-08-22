'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SeoPortalShell } from '@/components/seo/SeoPortalShell';
import { portalSeoContentDetail, portalSeoReviewContent } from '@/lib/api';
import { useToast } from '@/lib/toast';

function ApprovalTimeline({ approvals }: { approvals: Array<Record<string, unknown>> }) {
  if (!approvals.length) return null;
  return (
    <section className="portal-hub-section">
      <h3 className="portal-hub-section__title">Approval timeline</h3>
      <ul className="portal-list">
        {approvals.map((row) => (
          <li key={String(row.stage)}>
            <strong>{String(row.stage)}</strong>: {String(row.status ?? 'pending')}
            {row.actor_id ? <span className="muted"> — {String(row.actor_id)}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SeoContentDetailPage() {
  const params = useParams();
  const contentId = String(params.id || '');

  return (
    <SeoPortalShell
      title="Chi tiết nội dung"
      breadcrumb={[
        { label: 'Client Portal', href: '/dashboard' },
        { label: 'SEO / AEO', href: '/seo' },
        { label: 'Content review', href: '/seo/content' },
        { label: `#${contentId}` },
      ]}
    >
      {({ token, user, seoEnabled }) =>
        seoEnabled ? (
          <SeoContentDetail token={token} contentId={contentId} isApprover={user.role === 'approver'} />
        ) : null
      }
    </SeoPortalShell>
  );
}

function SeoContentDetail({
  token,
  contentId,
  isApprover,
}: {
  token: string;
  contentId: string;
  isApprover: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void portalSeoContentDetail(token, contentId)
      .then(setContent)
      .catch((err) => setError(err instanceof Error ? err.message : 'Lỗi tải content'));
  }, [token, contentId]);

  async function review(approved: boolean) {
    const notes = window.prompt('Ghi chú (optional):') || '';
    try {
      await portalSeoReviewContent(token, contentId, { approved, notes });
      push(approved ? 'Đã duyệt nội dung SEO' : 'Đã từ chối nội dung SEO', approved ? 'success' : 'info');
      router.push('/seo/content');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Duyệt thất bại', 'error');
    }
  }

  const brief = (content?.brief as Record<string, unknown>) ?? {};
  const approvals = (content?.approvals as Array<Record<string, unknown>>) ?? [];

  if (error) return <p className="error">{error}</p>;
  if (!content) return <p className="muted">Đang tải…</p>;

  return (
    <article className="portal-content-detail">
      <h2 className="portal-content-detail__title">{String(content.title)}</h2>
      <p className="muted">
        Status: {String(content.workflow_status)} · Type: {String(content.content_type)}
      </p>
      {(Boolean(brief.meta_title) || Boolean(brief.meta_description)) && (
        <div className="portal-content-detail__meta">
          {brief.meta_title ? (
            <p>
              <strong>Meta title:</strong> {String(brief.meta_title)}
            </p>
          ) : null}
          {brief.meta_description ? (
            <p>
              <strong>Meta description:</strong> {String(brief.meta_description)}
            </p>
          ) : null}
        </div>
      )}
      <div
        className="portal-content-detail__body"
        dangerouslySetInnerHTML={{ __html: String(content.body_html || '') }}
      />
      <ApprovalTimeline approvals={approvals} />
      {isApprover && content.workflow_status === 'client_review' ? (
        <div className="portal-approval-panel__actions">
          <button type="button" className="btn" data-testid="seo-approve-btn" onClick={() => void review(true)}>
            Duyệt
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="seo-reject-btn"
            onClick={() => void review(false)}
          >
            Từ chối
          </button>
        </div>
      ) : null}
    </article>
  );
}
