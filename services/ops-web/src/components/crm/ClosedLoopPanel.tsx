'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchLeadClosedLoopContext, type LeadClosedLoopContext } from '@/lib/api';

interface Props {
  token: string;
  leadId: number;
  status: string;
  /** When set, skips GET /closed-loop-context. */
  closedLoop?: LeadClosedLoopContext | null;
  copilotLoading?: boolean;
}

export function ClosedLoopPanel({ token, leadId, status, closedLoop, copilotLoading = false }: Props) {
  const [ctx, setCtx] = useState<LeadClosedLoopContext | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const out = await fetchLeadClosedLoopContext(token, leadId);
      setCtx(out);
    } catch {
      setCtx(null);
    } finally {
      setLoading(false);
    }
  }, [leadId, token]);

  useEffect(() => {
    if (closedLoop !== undefined) {
      setCtx(closedLoop);
      setLoading(copilotLoading);
      return;
    }
    void reload();
  }, [closedLoop, copilotLoading, reload, status]);

  if (loading) {
    return (
      <section className="closed-loop-panel closed-loop-panel--loading">
        <p className="muted">Đang tải closed-loop…</p>
      </section>
    );
  }

  if (!ctx?.applicable) return null;

  const isChot = status.trim().toLowerCase() === 'chot';
  if (!isChot && ctx.deal_value_vnd <= 0 && ctx.qa_flags.length === 0) return null;

  return (
    <section className="closed-loop-panel" aria-label="Closed-loop ROAS">
      <header className="closed-loop-panel__head">
        <div>
          <h2 className="closed-loop-panel__title">Closed-loop ROAS</h2>
          <p className="muted closed-loop-panel__sub">{ctx.roas_hint}</p>
        </div>
        {ctx.hub_mapped && ctx.hub_href ? (
          <a href={ctx.hub_href} className="btn btn-sm btn-secondary" target="_blank" rel="noreferrer">
            Mở hub
          </a>
        ) : null}
      </header>

      <dl className="closed-loop-panel__stats">
        <div>
          <dt>Giá trị chốt</dt>
          <dd>{ctx.deal_value_vnd > 0 ? `${ctx.deal_value_vnd.toLocaleString('vi-VN')} VND` : '—'}</dd>
        </div>
        <div>
          <dt>Gói dịch vụ</dt>
          <dd>{ctx.chot_package ?? '—'}</dd>
        </div>
        <div>
          <dt>Script nguồn</dt>
          <dd>
            {ctx.call_script_source === 'sci'
              ? 'SCI talk track'
              : ctx.call_script_source === 'ai_v1'
                ? 'AI v1'
                : ctx.call_script_source === 'sop'
                  ? 'SOP'
                  : 'Chưa gắn'}
          </dd>
        </div>
      </dl>

      {ctx.qa_flags.length > 0 ? (
        <div className="closed-loop-panel__qa">
          <h3>QA flags</h3>
          <ul>
            {ctx.qa_flags.map((flag) => (
              <li key={flag}>{ctx.qa_flag_labels[flag] ?? flag}</li>
            ))}
          </ul>
        </div>
      ) : isChot ? (
        <p className="closed-loop-panel__ok">✓ Bằng chứng chốt đủ — sẵn sàng closed-loop.</p>
      ) : null}

      {!isChot ? (
        <p className="muted closed-loop-panel__hint">
          Khi chốt, ghi audit note có giá VND và tên gói để hub ROAS cập nhật tự động.
        </p>
      ) : null}
    </section>
  );
}
