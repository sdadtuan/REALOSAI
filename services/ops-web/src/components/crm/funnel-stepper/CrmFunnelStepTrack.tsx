'use client';

import { CrmFunnelStepItem } from '@/components/crm/funnel-stepper/CrmFunnelStepItem';
import type { FunnelStepViewModel, FunnelStepperContext } from '@/lib/crm/funnel-stepper.types';

interface Props {
  steps: FunnelStepViewModel[];
  context: FunnelStepperContext;
}

export function CrmFunnelStepTrack({ steps, context }: Props) {
  return (
    <ol className="crm-funnel-stepper__track" aria-label="Tiến trình pre-sales lead">
      {steps.map((step, index) => (
        <CrmFunnelStepItem
          key={step.key}
          step={step}
          index={index}
          isLast={index === steps.length - 1}
          context={context}
        />
      ))}
    </ol>
  );
}
