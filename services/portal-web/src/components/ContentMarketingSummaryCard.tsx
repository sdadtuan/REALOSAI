'use client';

import { useEffect, useState } from 'react';
import {
  fetchPortalCmktContentSummary,
  fetchPortalMktAiLinkedLifecycle,
  postPortalCmktClientApprove,
  type CmktPortalContentSummary,
} from '@/lib/api';
import { isCmktPortalSummaryFeEnabled } from '@/lib/cmkt-portal-flags';

export interface ContentMarketingSummaryCardProps {
  token: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function ContentMarketingSummaryCard({ token }: ContentMarketingSummaryCardProps) {
  const [summary, setSummary] = useState<CmktPortalContentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function reload(lifecycleId: number) {
    const out = await fetchPortalCmktContentSummary(token, lifecycleId);
    setSummary(out.enabled ? out : null);
  }

  useEffect(() => {
    if (!isCmktPortalSummaryFeEnabled()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const linked = await fetchPortalMktAiLinkedLifecycle(token);
        if (!linked.enabled || linked.lifecycle_id == null) {
          setSummary(null);
          return;
        }
        await reload(linked.lifecycle_id);
      } catch {
        setSummary(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (!isCmktPortalSummaryFeEnabled()) return null;

  if (loading) {
    return (
      <section className="card portal-mkt-ai-summary" aria-busy="true" data-testid="portal-cmkt-summary">
        <h2 className="portal-mkt-ai-summary__title">Content Marketing</h2>
        <p className="muted">Đang tải tóm tắt…</p>
      </section>
    );
  }

  if (!summary) return null;

  return (
    <section className="card portal-mkt-ai-summary" data-testid="portal-cmkt-summary">
      <div className="portal-mkt-ai-summary__head">
        <div>
          <h2 className="portal-mkt-ai-summary__title">Content Marketing</h2>
          <p className="muted portal-mkt-ai-summary__subtitle">
            {summary.service_slug} · Published MTD {summary.published_mtd}
          </p>
        </div>
        {summary.pending_client_count > 0 ? (
          <span className="portal-mkt-ai-summary__score">{summary.pending_client_count} chờ duyệt</span>
        ) : null}
      </div>

      {summary.pending_items.length ? (
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.1rem', fontSize: '0.9rem' }}>
          {summary.pending_items.map((item) => (
            <li key={item.id} style={{ marginBottom: '0.35rem' }}>
              <strong>{item.title}</strong>
              <span className="muted"> · {item.channel}/{item.format}</span>
              {item.status === 'pending_client' ? (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ marginLeft: '0.5rem' }}
                  disabled={busyId === item.id}
                  onClick={() => {
                    void (async () => {
                      setBusyId(item.id);
                      try {
                        await postPortalCmktClientApprove(token, summary.lifecycle_id, item.id);
                        await reload(summary.lifecycle_id);
                      } finally {
                        setBusyId(null);
                      }
                    })();
                  }}
                >
                  Duyệt
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Không có bài chờ duyệt — team PTT đang sản xuất nội dung.</p>
      )}

      <div className="portal-mkt-ai-summary__meta">
        <span>Draft {summary.items_by_status.draft ?? 0}</span>
        <span>In review {summary.items_by_status.in_review ?? 0}</span>
        <span>Cập nhật {fmtDate(summary.pending_items[0]?.updated_at ?? new Date().toISOString())}</span>
      </div>

      <p className="muted portal-mkt-ai-summary__footer">
        Tóm tắt read-only — liên hệ AM/SP để chỉnh chi tiết trên ops-web.
      </p>
    </section>
  );
}
