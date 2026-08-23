'use client';

import { g0BannerMessage, type BdsG0Status } from '@/lib/bds/g0-copy';

type Props = {
  status: BdsG0Status | null;
  loading?: boolean;
};

export function BdsG0Banner({ status, loading }: Props) {
  if (loading || !status || status.ready) return null;
  const text = g0BannerMessage(status.missing_position_codes);
  if (!text) return null;
  return (
    <div
      role="alert"
      className="page-card"
      style={{
        borderLeft: '4px solid #dc2626',
        background: '#fef2f2',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
      }}
    >
      <strong>G0 — Roster chưa sẵn sàng</strong>
      <p className="muted" style={{ margin: '0.35rem 0 0' }}>
        {text} Gán đủ 5 vị trí A trên Org trước khi mở ra quân.
      </p>
    </div>
  );
}
