'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmailPortalShell } from '@/components/email/EmailPortalShell';
import { EmailApprovalCard } from '@/components/email/EmailApprovalCard';
import {
  portalEmailApproveCampaign,
  portalEmailPendingApprovals,
  portalEmailRejectCampaign,
  type PortalEmailApprovalRow,
} from '@/lib/api';

export default function PortalEmailApprovalsPage() {
  return (
    <EmailPortalShell title="Email approvals" subtitle="Campaign chờ phê duyệt trước khi gửi">
      {({ token, user, emailEnabled }) =>
        emailEnabled ? (
          <EmailApprovalsContent token={token} isApprover={user.role === 'approver'} />
        ) : null
      }
    </EmailPortalShell>
  );
}

function EmailApprovalsContent({ token, isApprover }: { token: string; isApprover: boolean }) {
  const [items, setItems] = useState<PortalEmailApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (authToken: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await portalEmailPendingApprovals(authToken);
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải approvals thất bại');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(token);
  }, [token, load]);

  async function approve(campaignId: string) {
    await portalEmailApproveCampaign(token, campaignId);
    await load(token);
  }

  async function reject(campaignId: string, note: string) {
    await portalEmailRejectCampaign(token, campaignId, note);
    await load(token);
  }

  return (
    <>
      {!isApprover ? (
        <p className="portal-callout portal-callout--warn">
          Chỉ role <strong>approver</strong> mới phê duyệt campaign.
        </p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? (
        <p className="muted">Đang tải…</p>
      ) : items.length === 0 ? (
        <div className="portal-empty-state">
          <p className="portal-empty-state__title">Không có campaign chờ duyệt</p>
        </div>
      ) : (
        <div className="email-approval-list">
          {items.map((item) => (
            <EmailApprovalCard
              key={item.campaign_id}
              item={item}
              canAct={isApprover}
              onApprove={approve}
              onReject={reject}
            />
          ))}
        </div>
      )}
    </>
  );
}
