'use client';

import Link from 'next/link';
import type { LeadRow } from '@/lib/api';

interface Props {
  lead: LeadRow;
  leadHref: string;
}

export function IntakeLeadContextCard({ lead, leadHref }: Props) {
  return (
    <section className="intake-context-card" aria-label="Ngữ cảnh lead">
      <div className="intake-context-card__head">
        <strong>A. Ngữ cảnh lead</strong>
        <Link href={leadHref} className="nav-link intake-context-card__link">
          Mở lead #{lead.id} →
        </Link>
      </div>
      <dl className="intake-context-card__grid">
        <div>
          <dt className="muted">Liên hệ</dt>
          <dd>{lead.full_name || '—'}</dd>
        </div>
        <div>
          <dt className="muted">SĐT</dt>
          <dd>{lead.phone || '—'}</dd>
        </div>
        <div>
          <dt className="muted">Email</dt>
          <dd>{lead.email || '—'}</dd>
        </div>
        <div>
          <dt className="muted">Trạng thái</dt>
          <dd>{lead.status || '—'}</dd>
        </div>
        <div>
          <dt className="muted">Nguồn &quot;Source&quot;</dt>
          <dd>{lead.source || '—'}</dd>
        </div>
        <div>
          <dt className="muted">Kênh &quot;Channel&quot;</dt>
          <dd>{lead.channel || '—'}</dd>
        </div>
        {lead.owner_id != null ? (
          <div>
            <dt className="muted">Owner</dt>
            <dd>#{lead.owner_id}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
