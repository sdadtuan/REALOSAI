'use client';

type Props = {
  status: string;
  expiresOn?: string | null;
};

export function HrExpiryChip({ status, expiresOn }: Props) {
  const s = String(status ?? 'valid');
  if (s === 'expired') {
    return <span className="hr-expiry-chip hr-expiry-chip--expired">Hết hạn</span>;
  }
  if (s === 'pending_review') {
    return <span className="hr-expiry-chip hr-expiry-chip--expiring">Chờ HR duyệt</span>;
  }
  if (s === 'revoked') {
    return <span className="hr-expiry-chip hr-expiry-chip--expired">Từ chối</span>;
  }
  if (s === 'expiring') {
    return (
      <span className="hr-expiry-chip hr-expiry-chip--expiring">
        Sắp hết hạn{expiresOn ? ` · ${expiresOn.slice(0, 10)}` : ''}
      </span>
    );
  }
  if (expiresOn) {
    return <span className="hr-expiry-chip hr-expiry-chip--ok">Hạn {expiresOn.slice(0, 10)}</span>;
  }
  return <span className="hr-expiry-chip hr-expiry-chip--muted">Vô thời hạn</span>;
}
