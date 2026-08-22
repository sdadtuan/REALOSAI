'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchLeadPresalesConsultBrief } from '@/lib/api';
import { fetchLeadMeetingPrep } from '@/lib/lead-meeting-prep-api';
import { prepStageSubtitle } from '@/lib/lmp-stage-labels';
import { leadMeetingPrepEnabled } from '@/lib/crm/lmp-flags';
import { buildM2HandoffBrief } from '@/app/crm/leads/meeting-prep/m2-handoff.util';
import { BantQualifyChecklist } from '@/app/crm/leads/meeting-prep/BantQualifyChecklist';

type Props = {
  token: string;
  leadId: number;
};

export function IntakePrepSummaryCard({ token, leadId }: Props) {
  const [summary, setSummary] = useState('');
  const [painBasis, setPainBasis] = useState('');
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState('');
  const [bantTotal, setBantTotal] = useState<number | null>(null);

  useEffect(() => {
    if (!leadMeetingPrepEnabled() || !token || leadId <= 0) return;
    void (async () => {
      try {
        const [prep, briefOut] = await Promise.all([
          fetchLeadMeetingPrep(token, leadId),
          fetchLeadPresalesConsultBrief(token, leadId).catch(() => null),
        ]);
        setStatus(prep.status);
        setStage(prep.prep_stage);
        const text = prep.result?.company_profile?.summary?.trim();
        setSummary(text ?? '');
        if (prep.status === 'ready') {
          setPainBasis(buildM2HandoffBrief(prep).painBasis);
        }
        const readiness = (briefOut?.brief as { readiness?: { bant_total?: number } } | undefined)
          ?.readiness;
        setBantTotal(Number(readiness?.bant_total ?? 0) || null);
      } catch {
        setSummary('');
      }
    })();
  }, [token, leadId]);

  if (!leadMeetingPrepEnabled()) return null;

  return (
    <section className="intake-prep-card deal-room-panel">
      <header className="deal-room-panel__head">
        <h2 className="deal-room-panel__title">SCI · Qualify (M2)</h2>
        <Link href={`/crm/leads/${leadId}?prep=1`} className="btn btn-sm btn-secondary">
          Sales Cockpit
        </Link>
      </header>
      <BantQualifyChecklist leadId={leadId} compact />
      {status === 'ready' && (painBasis || summary) ? (
        <>
          <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
            {prepStageSubtitle(stage)}
            {bantTotal != null ? ` · BANT ${bantTotal}/30` : ''}
          </p>
          <p>{(painBasis || summary).slice(0, 320)}{(painBasis || summary).length > 320 ? '…' : ''}</p>
        </>
      ) : (
        <p className="muted">
          {status === 'running' || status === 'pending'
            ? 'Prep M2 đang chạy sau Intake — xem Sales Cockpit.'
            : 'Hoàn thành BANT Go để refresh SCI M2.'}
        </p>
      )}
    </section>
  );
}
