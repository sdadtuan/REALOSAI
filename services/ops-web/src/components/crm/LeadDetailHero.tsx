'use client';

import Link from 'next/link';
import type { LeadRow } from '@/lib/api';
import type { LeadFlowKind } from '@/lib/crm/lead-flow-kind';
import { leadStatusLabel, leadStatusTone } from '@/lib/crm/lead-status';

function leadInitials(name: string | null | undefined): string {
  const parts = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function LeadDetailHero({
  lead,
  ownerLabel,
  flowKind,
  flowLabel,
}: {
  lead: LeadRow;
  ownerLabel?: string | null;
  flowKind?: LeadFlowKind;
  flowLabel?: string;
}) {
  const tone = leadStatusTone(lead.status);
  const created = lead.created_at?.slice(0, 10) ?? '—';

  return (
    <header className="lead-detail-hero" data-testid="lead-detail-hero">
      <div className="lead-detail-hero__top">
        <Link href="/crm/leads" className="lead-detail-hero__back">
          ← Danh sách leads
        </Link>
        <span className="lead-detail-hero__id">#{lead.id}</span>
      </div>

      <div className="lead-detail-hero__body">
        <div className="lead-detail-hero__avatar" aria-hidden>
          {leadInitials(lead.full_name)}
        </div>

        <div className="lead-detail-hero__info">
          <div className="lead-detail-hero__title-row">
            <h1 className="lead-detail-hero__name">{lead.full_name || '—'}</h1>
            {flowKind && flowLabel ? (
              <span
                className={`lead-kind-tag lead-kind-tag--${flowKind === 'spa_operational' ? 'spa' : 'b2b'}`}
                title={flowLabel}
              >
                {flowLabel}
              </span>
            ) : null}
            <span className={`lead-status-badge lead-status-badge--${tone}`}>
              {leadStatusLabel(lead.status)}
            </span>
          </div>

          <div className="lead-detail-hero__meta">
            {lead.phone ? (
              <span className="lead-detail-hero__meta-item">
                <span className="lead-detail-hero__meta-label">SĐT</span>
                {lead.phone}
              </span>
            ) : null}
            {lead.email ? (
              <span className="lead-detail-hero__meta-item">
                <span className="lead-detail-hero__meta-label">Email</span>
                {lead.email}
              </span>
            ) : null}
            <span className="lead-detail-hero__meta-item">
              <span className="lead-detail-hero__meta-label">Nguồn</span>
              {lead.source || '—'}
            </span>
            <span className="lead-detail-hero__meta-item">
              <span className="lead-detail-hero__meta-label">Owner</span>
              {ownerLabel || 'Chưa phân'}
            </span>
            <span className="lead-detail-hero__meta-item">
              <span className="lead-detail-hero__meta-label">Ngày tạo</span>
              {created}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
