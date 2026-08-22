'use client';

import Link from 'next/link';
import type { LeadFunnelSnapshot } from '@/lib/api';

export interface LeadContractFlowSummary {
  hasContract: boolean;
  contractStatus: string | null;
  pendingApproval: boolean;
  lifecycleId: number | null;
}

interface Props {
  leadId: number;
  funnel: LeadFunnelSnapshot | null;
  contract?: LeadContractFlowSummary | null;
}

type StepState = 'done' | 'current' | 'pending' | 'blocked';

function presalesStageIndex(stage: string | undefined): number {
  const order = ['lead', 'consult', 'proposal'];
  const idx = order.indexOf(stage ?? '');
  return idx >= 0 ? idx : -1;
}

function resolveStepStates(
  funnel: LeadFunnelSnapshot | null,
  contract: LeadContractFlowSummary | null | undefined,
): Record<string, StepState> {
  const inReview = Boolean(funnel?.review_queue.active);
  const b2Done = Boolean(funnel?.care_pipeline.all_complete);
  const presales = funnel?.presales?.presales;
  const presalesStarted = Boolean(presales);
  const presalesStage = presales?.stage;
  const presalesIdx = presalesStageIndex(presalesStage);
  const contractActive = contract?.contractStatus === 'active';
  const hasLifecycle = Boolean(contract?.lifecycleId);

  if (inReview) {
    return {
      b2: 'blocked',
      presales: 'blocked',
      intake: 'blocked',
      contract: 'blocked',
      delivery: 'blocked',
      agency: 'blocked',
    };
  }

  return {
    b2: b2Done ? 'done' : 'current',
    presales: !b2Done
      ? 'pending'
      : !presalesStarted
        ? 'current'
        : presalesIdx >= 2
          ? 'done'
          : presalesIdx >= 0
            ? 'current'
            : 'pending',
    intake: !presalesStarted || presalesIdx < 0
      ? 'pending'
      : presalesIdx >= 1
        ? 'done'
        : 'current',
    contract: presalesIdx >= 2
      ? contractActive
        ? 'done'
        : contract?.hasContract || contract?.pendingApproval
          ? 'current'
          : 'current'
      : 'pending',
    delivery: contractActive
      ? hasLifecycle
        ? 'done'
        : 'current'
      : 'pending',
    agency: contractActive && hasLifecycle ? 'current' : 'pending',
  };
}

export function LeadB2bSalesFlowBar({ leadId, funnel, contract }: Props) {
  const states = resolveStepStates(funnel, contract);
  const serviceSlug = funnel?.presales?.presales.service_slug?.trim();
  const intakeHref = `/crm/intake?lead_id=${leadId}${
    serviceSlug ? `&service_slug=${encodeURIComponent(serviceSlug)}` : ''
  }`;
  const lifecycleId = contract?.lifecycleId ?? null;

  const steps: Array<{
    key: string;
    label: string;
    short: string;
    href?: string;
    anchor?: string;
  }> = [
    { key: 'b2', label: 'B2 Liên hệ', short: 'B2', anchor: '#funnel-b2' },
    { key: 'presales', label: 'Pre-sales', short: 'Pre', anchor: '#funnel-presales' },
    { key: 'intake', label: 'Intake BANT', short: 'Intake', href: intakeHref },
    { key: 'contract', label: 'HĐ dịch vụ', short: 'HĐ', anchor: '#lead-contract' },
    {
      key: 'delivery',
      label: 'Triển khai',
      short: 'TK',
      href: lifecycleId ? `/crm/service-delivery/${lifecycleId}` : '/crm/service-delivery',
    },
    { key: 'agency', label: 'Agency Client', short: 'Agency', href: '/agency/clients/new' },
  ];

  return (
    <nav aria-label="Luồng B2B sales" className="lead-b2b-flow">
      <div className="lead-b2b-flow__head">
        <h3 className="lead-b2b-flow__title">Luồng B2B</h3>
        <p className="lead-b2b-flow__desc">Chăm sóc → Pre-sales → Intake → HĐ → Triển khai → Agency</p>
      </div>

      <ol className="lead-b2b-flow__track">
        {steps.map((step, idx) => {
          const state = states[step.key] ?? 'pending';
          const stepClass = `lead-b2b-step lead-b2b-step--${state}`;
          const inner = (
            <>
              <span className="lead-b2b-step__marker" aria-hidden>
                {state === 'done' ? '✓' : state === 'blocked' ? '!' : idx + 1}
              </span>
              <span className="lead-b2b-step__label">{step.label}</span>
              <span className="lead-b2b-step__label-short">{step.short}</span>
            </>
          );

          return (
            <li key={step.key} className={stepClass}>
              {step.href ? (
                <Link href={step.href} className="lead-b2b-step__link">
                  {inner}
                </Link>
              ) : step.anchor ? (
                <a href={step.anchor} className="lead-b2b-step__link">
                  {inner}
                </a>
              ) : (
                <span className="lead-b2b-step__link">{inner}</span>
              )}
              {idx < steps.length - 1 ? (
                <span className="lead-b2b-step__connector" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>

      {funnel?.review_queue.active ? (
        <p className="lead-b2b-flow__alert">
          Lead đang <strong>Phải tra soát</strong>
          {funnel.review_queue.hours_waiting != null
            ? ` (${funnel.review_queue.hours_waiting}h)`
            : ''}
          . AM tạm khóa funnel — GDKD xử lý tại{' '}
          <Link href="/crm/leads/review-queue">inbox Phải tra soát</Link>.
        </p>
      ) : null}
    </nav>
  );
}
