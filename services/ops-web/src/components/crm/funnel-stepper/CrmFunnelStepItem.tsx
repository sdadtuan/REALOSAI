'use client';

import Link from 'next/link';
import type { FunnelStepViewModel, FunnelStepperContext } from '@/lib/crm/funnel-stepper.types';

interface Props {
  step: FunnelStepViewModel;
  index: number;
  isLast: boolean;
  context: FunnelStepperContext;
}

function stepMarker(state: FunnelStepViewModel['state'], index: number): string {
  if (state === 'done') return '✓';
  if (state === 'blocked') return '!';
  if (state === 'warn') return '△';
  if (state === 'current') return '●';
  return String(index + 1);
}

function stepLinkTarget(
  step: FunnelStepViewModel,
  context: FunnelStepperContext,
): { kind: 'href'; href: string } | { kind: 'anchor'; anchor: string } | { kind: 'static' } {
  if (context === 'intake' && step.key === 'intake_bant') {
    return { kind: 'static' };
  }
  if (step.href) return { kind: 'href', href: step.href };
  if (step.anchor && context === 'lead_detail') return { kind: 'anchor', anchor: step.anchor };
  return { kind: 'static' };
}

export function CrmFunnelStepItem({ step, index, isLast, context }: Props) {
  const target = stepLinkTarget(step, context);
  const stepClass = `crm-funnel-step crm-funnel-step--${step.state}${step.isActive ? ' crm-funnel-step--active' : ''}`;

  const inner = (
    <>
      <span className="crm-funnel-step__marker" aria-hidden>
        {stepMarker(step.state, index)}
      </span>
      <span className="crm-funnel-step__label">{step.label}</span>
      <span className="crm-funnel-step__label-short">{step.shortLabel}</span>
    </>
  );

  return (
    <li className={stepClass} aria-current={step.isActive ? 'step' : undefined}>
      {target.kind === 'href' ? (
        <Link href={target.href} className="crm-funnel-step__link">
          {inner}
        </Link>
      ) : target.kind === 'anchor' ? (
        <a href={target.anchor} className="crm-funnel-step__link">
          {inner}
        </a>
      ) : (
        <span className="crm-funnel-step__link">{inner}</span>
      )}
      {!isLast ? <span className="crm-funnel-step__connector" aria-hidden /> : null}
    </li>
  );
}
