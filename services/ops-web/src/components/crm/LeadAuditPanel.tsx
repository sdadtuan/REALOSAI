'use client';

import type { LeadAssignmentLogRow, LeadAuditBundle, LeadStatusLogRow } from '@/lib/api';

export function LeadAuditPanel({ audit }: { audit: LeadAuditBundle | null }) {
  if (!audit) {
    return (
      <div className="lead-panel lead-panel--audit">
        <div className="lead-panel__head">
          <h3 className="lead-panel__title">Audit</h3>
        </div>
        <p className="lead-empty-state">Đang tải audit…</p>
      </div>
    );
  }

  return (
    <div className="lead-panel lead-panel--audit">
      <div className="lead-panel__head">
        <h3 className="lead-panel__title">Audit</h3>
        <p className="lead-panel__subtitle">Lịch sử trạng thái và phân công</p>
      </div>

      <div className="lead-audit-grid">
        <section className="lead-audit-block">
          <h4 className="lead-audit-block__title">Trạng thái</h4>
          {audit.status_logs.length === 0 ? (
            <p className="lead-empty-state">Chưa có log.</p>
          ) : (
            <ul className="lead-audit-list">
              {audit.status_logs.map((l: LeadStatusLogRow) => (
                <li key={l.id} className="lead-audit-list__item">
                  <time className="lead-audit-list__time">{l.created_at?.slice(0, 16)}</time>
                  <span className="lead-audit-list__change">
                    {l.old_status} → {l.new_status}
                  </span>
                  {l.note ? <span className="lead-audit-list__note">{l.note}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lead-audit-block">
          <h4 className="lead-audit-block__title">Phân công</h4>
          {audit.assignment_logs.length === 0 ? (
            <p className="lead-empty-state">Chưa có log.</p>
          ) : (
            <ul className="lead-audit-list">
              {audit.assignment_logs.map((l: LeadAssignmentLogRow) => (
                <li key={l.id} className="lead-audit-list__item">
                  <time className="lead-audit-list__time">{l.created_at?.slice(0, 16)}</time>
                  <span className="lead-audit-list__change">
                    {l.from_name} → {l.to_name}
                  </span>
                  {l.reason ? <span className="lead-audit-list__note">{l.reason}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
