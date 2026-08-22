'use client';

import { useEffect, useState } from 'react';
import {
  approveBreakGlassGrant,
  fetchActiveBreakGlassGrants,
  requestBreakGlass,
  type BreakGlassGrant,
} from '@/lib/api';
import { getAccessToken, hasCap, type StoredStaffUser } from '@/lib/auth';

const DEFAULT_CAPS = [{ section: 'crm_gdkd', action: 'override' }];

export function BreakGlassRequestModal({
  user,
  open,
  onClose,
  onUpdated,
}: {
  user: StoredStaffUser;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [grants, setGrants] = useState<BreakGlassGrant[]>([]);
  const canApprove =
    hasCap(user, 'crm_gdkd', 'override') || hasCap(user, 'crm_data_config', 'configure');

  useEffect(() => {
    if (!open || !canApprove) return;
    void (async () => {
      const access = getAccessToken();
      if (!access) return;
      try {
        const out = await fetchActiveBreakGlassGrants(access);
        setGrants(out.grants.filter((g) => g.status === 'pending'));
      } catch {
        setGrants([]);
      }
    })();
  }, [open, canApprove]);

  if (!open) return null;

  async function handleRequest() {
    const access = getAccessToken();
    if (!access) return;
    setBusy(true);
    setError('');
    try {
      await requestBreakGlass(access, {
        reason: reason.trim(),
        caps_requested: DEFAULT_CAPS,
      });
      setReason('');
      onUpdated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yêu cầu break-glass thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove(id: string, approve: boolean) {
    const access = getAccessToken();
    if (!access) return;
    setBusy(true);
    setError('');
    try {
      await approveBreakGlassGrant(access, id, { approve });
      const out = await fetchActiveBreakGlassGrants(access);
      setGrants(out.grants.filter((g) => g.status === 'pending'));
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duyệt break-glass thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="win-modal-backdrop" role="dialog" aria-modal="true" data-testid="break-glass-modal">
      <div className="win-modal card stack-gap">
        <h3 className="section-title">Break-glass (TTL 4h)</h3>
        <p className="muted">Cấp tạm quyền GDKD override — tự thu hồi sau 4 giờ, có audit.</p>
        {error ? <p className="error">{error}</p> : null}

        <label className="stack-gap" style={{ gap: '0.25rem' }}>
          <span className="muted">Lý do</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Mô tả tình huống khẩn cấp…"
          />
        </label>

        <div className="toolbar-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Đóng
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || reason.trim().length < 8}
            onClick={() => void handleRequest()}
          >
            Gửi yêu cầu
          </button>
        </div>

        {canApprove && grants.length > 0 ? (
          <section className="stack-gap">
            <h4 className="section-title">Chờ duyệt</h4>
            {grants.map((grant) => (
              <div key={grant.id} className="win-info-callout stack-gap">
                <p>
                  <strong>{grant.user_email ?? grant.user_id}</strong> — {grant.reason}
                </p>
                <div className="toolbar-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={busy}
                    onClick={() => void handleApprove(grant.id, true)}
                  >
                    Duyệt
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={busy}
                    onClick={() => void handleApprove(grant.id, false)}
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
