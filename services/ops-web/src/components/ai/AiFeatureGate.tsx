'use client';

import type { ReactNode } from 'react';
import { aiCopilotEnabled, aiCopilotRolloutMode, canUseAiCopilot } from '@/lib/ai-flags';
import type { StoredStaffUser } from '@/lib/auth';

interface Props {
  user: StoredStaffUser | null;
  children: ReactNode;
}

/** RNOS-06 / E1 — hide copilot when flag off or user outside rollout cohort. */
export function AiFeatureGate({ user, children }: Props) {
  if (!aiCopilotEnabled()) {
    return null;
  }
  if (user && !canUseAiCopilot(user.id, user.caps)) {
    const mode = aiCopilotRolloutMode();
    return (
      <div className="ai-copilot-gate muted">
        {mode === 'team'
          ? 'Copilot yêu cầu quyền CRM leads. Liên hệ quản trị nếu bạn là CSKH.'
          : 'Copilot chỉ dành cho nhóm pilot. Liên hệ quản trị để tham gia.'}
      </div>
    );
  }
  return <>{children}</>;
}
