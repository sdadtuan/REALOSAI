'use client';

import Link from 'next/link';
import type { AiRecommendationInboxItem } from '@/lib/ai-api';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  accepted: 'Đã chấp nhận',
  dismissed: 'Đã bỏ',
  executed: 'Đã thực hiện',
  expired: 'Hết hạn',
};

const REASON_LABELS: Record<string, string> = {
  wrong_tone: 'Sai tone',
  wrong_fact: 'Sai thông tin',
  not_needed: 'Không cần',
  other: 'Khác',
  user_dismissed: 'Người dùng bỏ',
  dismissed_by_user: 'Người dùng bỏ',
};

function formatReason(reason: string | null): string {
  if (!reason) return '—';
  return REASON_LABELS[reason] ?? reason;
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('vi-VN');
}

export function InsightsInboxTable({ rows }: { rows: AiRecommendationInboxItem[] }) {
  if (!rows.length) {
    return <p className="muted">Chưa có gợi ý AI trong khoảng thời gian đã chọn.</p>;
  }

  return (
    <div className="ai-insights-table-wrap">
      <table className="ai-insights-table">
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Loại</th>
            <th>Entity</th>
            <th>Trạng thái</th>
            <th>Lý do bỏ</th>
            <th>Nội dung</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{formatWhen(row.updated_at || row.created_at)}</td>
              <td>{row.recommendation_type}</td>
              <td>
                {row.entity_type === 'lead' ? (
                  <Link href={`/crm/leads/${row.entity_id}`}>Lead #{row.entity_id}</Link>
                ) : (
                  `${row.entity_type} #${row.entity_id}`
                )}
              </td>
              <td>{STATUS_LABELS[row.status] ?? row.status}</td>
              <td>{formatReason(row.dismissed_reason)}</td>
              <td className="ai-insights-table__text" title={row.recommendation_text}>
                {row.recommendation_text.slice(0, 120)}
                {row.recommendation_text.length > 120 ? '…' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
