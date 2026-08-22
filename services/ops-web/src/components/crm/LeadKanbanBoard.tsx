'use client';

import Link from 'next/link';
import type { LeadRow } from '@/lib/api';
import { leadStatusLabel } from '@/lib/crm/lead-status';
import { statusOptionsForFlowKind, type LeadFlowKind } from '@/lib/crm/lead-flow-kind';

const STAGE_ACCENT: Record<string, string> = {
  moi: '#17692f',
  da_lien_he: '#2d8a44',
  dang_tu_van: '#3d9970',
  hen_gap: '#4a9e6a',
  bao_gia: '#c9a227',
  dam_phan: '#d97706',
  proposal: '#2563eb',
  won: '#16a34a',
  chot: '#16a34a',
  lost: '#9ca3af',
  pending_cleanup: '#6b7280',
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

export function LeadKanbanBoard({
  rows,
  flowKind = 'b2b_prospect',
}: {
  rows: LeadRow[];
  flowKind?: LeadFlowKind;
}) {
  const stages = statusOptionsForFlowKind(flowKind);
  const byStage: Record<string, LeadRow[]> = {};
  for (const st of stages) byStage[st] = [];
  for (const row of rows) {
    const st = String(row.status ?? 'moi');
    if (!byStage[st]) byStage[st] = [];
    byStage[st].push(row);
  }

  return (
    <div className="crm-kanban" data-testid="crm-leads-kanban">
      {stages.map((stage) => {
        const items = byStage[stage] ?? [];
        return (
          <div
            key={stage}
            className="crm-kanban-column"
            style={{ ['--kanban-accent' as string]: STAGE_ACCENT[stage] ?? '#17692f' }}
          >
            <div className="crm-kanban-column__head">
              <span className="crm-kanban-column__title">{leadStatusLabel(stage)}</span>
              <span className="crm-kanban-column__count">{items.length}</span>
            </div>
            <div className="crm-kanban-column__body">
              {items.length === 0 ? (
                <p className="crm-kanban-empty">Trống</p>
              ) : (
                items.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/crm/leads/${lead.id}`}
                    className="crm-kanban-card"
                    data-testid={`kanban-card-${lead.id}`}
                  >
                    <p className="crm-kanban-card__title">{lead.full_name || `Lead #${lead.id}`}</p>
                    <div className="crm-kanban-card__meta">
                      {lead.phone ? <span>{lead.phone}</span> : null}
                      {lead.project_code ? <span>· {lead.project_code}</span> : null}
                      {lead.ai_band ? (
                        <span className={`crm-kanban-card__chip crm-kanban-card__chip--${lead.ai_band}`}>
                          {lead.ai_band === 'hot' ? 'NÓNG' : lead.ai_band === 'warm' ? 'ẤM' : 'LẠNH'}
                        </span>
                      ) : null}
                    </div>
                    <div className="crm-kanban-card__footer">
                      <span>#{lead.id}</span>
                      <span>{formatWhen(lead.received_at || lead.created_at)}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
