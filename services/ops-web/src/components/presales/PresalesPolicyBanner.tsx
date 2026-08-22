'use client';

import { useEffect, useState } from 'react';
import type { LeadFunnelSnapshot } from '@/lib/api';
import { fetchPresalesPolicyPreview } from '@/lib/api';
import { winPolicyOpaEnabled } from '@/lib/win/flags';
import type { StoredStaffUser } from '@/lib/auth';
import { resolvePresalesSolutionCaps } from '@/lib/crm/presales-solution-caps';

export interface PresalesPolicyPreview {
  action: 'release' | 'claim';
  allowed: boolean;
  policy_id?: string;
  reason?: string;
  bundle_version: string;
}

export function PresalesPolicyBanner({
  funnel,
  user,
  token,
  action = 'release',
}: {
  funnel: LeadFunnelSnapshot | null;
  user?: StoredStaffUser | null;
  token?: string;
  action?: 'release' | 'claim';
}) {
  const [preview, setPreview] = useState<PresalesPolicyPreview | null>(null);
  const caps = resolvePresalesSolutionCaps(user ?? null);
  const show =
    winPolicyOpaEnabled() &&
    funnel?.presales_on_lead_enabled &&
    ((action === 'release' && caps.canRelease) || (action === 'claim' && caps.canClaim));

  useEffect(() => {
    if (!show || !token || !funnel?.lead_id) {
      setPreview(null);
      return;
    }
    void fetchPresalesPolicyPreview(token, funnel.lead_id, action)
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [show, token, funnel?.lead_id, action]);

  if (!show || !preview || preview.allowed) return null;

  return (
    <div className="banner banner-warning" data-testid="presales-policy-banner">
      <strong>Policy chặn thao tác {action === 'release' ? 'Trả Sales' : 'Nhận case'}</strong>
      <p style={{ margin: '0.35rem 0 0' }}>
        <code>{preview.policy_id}</code>
        {preview.reason ? ` — ${preview.reason}` : null}
      </p>
      <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
        Bundle {preview.bundle_version} · OPA fail-closed trước khi submit
      </p>
    </div>
  );
}
