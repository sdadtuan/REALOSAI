'use client';

import { useEffect, useState } from 'react';
import {
  fetchPortalMktAiLinkedLifecycle,
  fetchPortalMktAiPlanSummary,
  type MktAiPortalPlanSummary,
} from '@/lib/api';
import { isMktAiPortalSummaryFeEnabled } from '@/lib/mkt-ai-portal-flags';

export interface MktAiPlanSummaryCardProps {
  token: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function MktAiPlanSummaryCard({ token }: MktAiPlanSummaryCardProps) {
  const [summary, setSummary] = useState<MktAiPortalPlanSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isMktAiPortalSummaryFeEnabled()) {
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
        const out = await fetchPortalMktAiPlanSummary(token, linked.lifecycle_id);
        setSummary(out.enabled ? out : null);
      } catch {
        setSummary(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (!isMktAiPortalSummaryFeEnabled()) {
    return null;
  }

  if (loading) {
    return (
      <section className="card portal-mkt-ai-summary" aria-busy="true" data-testid="portal-mkt-ai-summary">
        <h2 className="portal-mkt-ai-summary__title">Kế hoạch marketing AI</h2>
        <p className="muted">Đang tải tóm tắt…</p>
      </section>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <section className="card portal-mkt-ai-summary" data-testid="portal-mkt-ai-summary">
      <div className="portal-mkt-ai-summary__head">
        <div>
          <h2 className="portal-mkt-ai-summary__title">Kế hoạch marketing AI</h2>
          <p className="muted portal-mkt-ai-summary__subtitle">
            {summary.brand_name ? summary.brand_name : summary.service_slug}
            {summary.playbook_label ? ` · ${summary.playbook_label}` : ''}
          </p>
        </div>
        {summary.quality_score != null ? (
          <span className="portal-mkt-ai-summary__score">Quality {summary.quality_score}</span>
        ) : null}
      </div>

      {summary.strategy_excerpt ? (
        <p className="portal-mkt-ai-summary__excerpt">{summary.strategy_excerpt}</p>
      ) : (
        <p className="muted">Team PTT đang xây dựng kế hoạch chiến lược — quay lại sau.</p>
      )}

      <div className="portal-mkt-ai-summary__meta">
        <span>{summary.campaign_count} chiến dịch trong draft</span>
        <span>Cập nhật {fmtDate(summary.last_updated_at)}</span>
      </div>

      <p className="muted portal-mkt-ai-summary__footer">
        Tóm tắt read-only — không chứa dữ liệu nội bộ đầy đủ. Liên hệ AM/SP để chỉnh kế hoạch chi tiết.
      </p>
    </section>
  );
}
