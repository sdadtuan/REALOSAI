'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { L1GateChecklist, type L1GateChecklistItem } from '@/components/deal-room/L1GateChecklist';
import { createDealRoomQuote, exportLeadDealRoomPack } from '@/lib/api';
import { QUOTE_TIER_LABEL } from '@/lib/quote-api';

type QuoteTier = {
  tier: string;
  tier_label: string;
  total_vnd: number | null;
  reference_min_vnd: number | null;
  reference_max_vnd: number | null;
  is_reference: boolean;
};

interface Props {
  leadId: number;
  token: string;
  canCreate: boolean;
  blockReason: string;
  proposalsHref: string;
  canExportPack: boolean;
  exportBlockReason?: string;
  proposalId?: number | null;
  proposalStatus?: string | null;
  proposalTotalVnd?: number | null;
  customerId?: number | null;
  presalesId?: number | null;
  serviceSlug?: string;
  tiers?: QuoteTier[];
  l1Checklist?: L1GateChecklistItem[];
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
  onQuoteCreated?: () => void | Promise<void>;
}

function formatVnd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('vi-VN')} ₫`;
}

export function DealRoomQuotePanel({
  leadId,
  token,
  canCreate,
  blockReason,
  proposalsHref,
  canExportPack,
  exportBlockReason,
  proposalId,
  proposalStatus,
  proposalTotalVnd,
  customerId,
  presalesId,
  serviceSlug = '',
  tiers = [],
  l1Checklist = [],
  onMessage,
  onError,
  onQuoteCreated,
}: Props) {
  const [exportBusy, setExportBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'basic' | 'standard' | 'premium'>('standard');

  const tierCards = useMemo(() => {
    if (tiers.length) return tiers;
    return (['basic', 'standard', 'premium'] as const).map((tier) => ({
      tier,
      tier_label: QUOTE_TIER_LABEL[tier] ?? tier,
      total_vnd: null,
      reference_min_vnd: null,
      reference_max_vnd: null,
      is_reference: true,
    }));
  }, [tiers]);

  async function handleExportPack() {
    if (!canExportPack || exportBusy) return;
    setExportBusy(true);
    onError?.('');
    try {
      const { blob, filename } = await exportLeadDealRoomPack(token, leadId, {
        proposal_id: proposalId ?? undefined,
        include_timeline: true,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      onMessage?.(`Đã tải Pack PDF: ${filename}`);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Export Pack PDF thất bại');
    } finally {
      setExportBusy(false);
    }
  }

  async function handleCreateQuote(tier: 'basic' | 'standard' | 'premium') {
    if (!canCreate || createBusy) return;
    setCreateBusy(true);
    setSelectedTier(tier);
    onError?.('');
    try {
      const created = await createDealRoomQuote(token, {
        lead_id: leadId,
        presales_id: presalesId ?? undefined,
        customer_id: customerId ?? undefined,
        service_slug: serviceSlug || undefined,
        package_tier: tier,
        auto_lines: true,
      });
      const lineCount = created.lines?.length ?? 0;
      onMessage?.(
        `Đã tạo báo giá #${created.id} · ${QUOTE_TIER_LABEL[tier] ?? tier}${
          lineCount ? ` · ${lineCount} dòng DV` : ''
        }`,
      );
      await onQuoteCreated?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Tạo báo giá thất bại');
    } finally {
      setCreateBusy(false);
    }
  }

  const packTitle =
    exportBlockReason ||
    (!canExportPack ? 'Hoàn thành G4 R5 và bật PTT_DEAL_ROOM_PACK_PDF để export' : 'Tải Plan+Quote Pack PDF');

  return (
    <section className="deal-room-panel" aria-label="Quote">
      <div className="deal-room-panel__head">
        <h3 className="deal-room-panel__title">Báo giá</h3>
        {proposalId ? (
          <span className="deal-room-badge deal-room-badge--ok">
            #{proposalId} · {proposalStatus ?? 'draft'}
          </span>
        ) : null}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Gói Basic / Standard / Premium — catalog DV{serviceSlug ? ` · ${serviceSlug}` : ''}. Giá tham khảo từ
        ops_service_profile.
      </p>

      {!canCreate && l1Checklist.length ? (
        <div style={{ marginTop: '0.75rem' }}>
          <L1GateChecklist items={l1Checklist} />
        </div>
      ) : null}

      {!canCreate && !l1Checklist.length && blockReason ? (
        <ul className="deal-room-checklist deal-room-checklist--block" style={{ marginTop: '0.75rem' }}>
          <li>{blockReason}</li>
        </ul>
      ) : null}

      {proposalId ? (
        <div className="deal-room-quote-summary" style={{ marginTop: '0.75rem' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            Tổng báo giá: <strong>{formatVnd(proposalTotalVnd)}</strong>
          </p>
          <Link href={`/crm/proposals?customer_id=${customerId ?? ''}&lead_id=${leadId}&wizard=1`} className="btn btn-sm btn-secondary" style={{ marginTop: '0.5rem' }}>
            Chỉnh sửa dòng DV →
          </Link>
        </div>
      ) : null}

      <div className="deal-room-tier-grid" style={{ marginTop: '1rem' }}>
        {tierCards.map((card) => {
          const isSelected = selectedTier === card.tier;
          const min = card.reference_min_vnd;
          const max = card.reference_max_vnd;
          const refLabel =
            min != null && max != null && min !== max
              ? `${formatVnd(min)} – ${formatVnd(max)}`
              : formatVnd(card.total_vnd);
          return (
            <article
              key={card.tier}
              className={`deal-room-tier-card${isSelected ? ' deal-room-tier-card--selected' : ''}`}
            >
              <h4 className="deal-room-tier-card__title">{card.tier_label}</h4>
              <p className="deal-room-tier-card__price">{formatVnd(card.total_vnd)}</p>
              <p className="deal-room-tier-card__ref muted">
                {card.is_reference ? `Tham khảo: ${refLabel}` : 'Đã lưu trên proposal'}
              </p>
              <button
                type="button"
                className={`btn btn-sm ${card.tier === 'standard' ? 'btn-primary' : 'btn-secondary'}`}
                disabled={!canCreate || createBusy}
                title={
                  canCreate
                    ? `Tạo báo giá gói ${card.tier_label}`
                    : blockReason || 'Hoàn thành checklist G4 trước'
                }
                onClick={() => void handleCreateQuote(card.tier as 'basic' | 'standard' | 'premium')}
              >
                {createBusy && isSelected
                  ? 'Đang tạo…'
                  : card.tier === 'standard'
                    ? 'Tạo Standard (1-click)'
                    : `Chọn ${card.tier_label}`}
              </button>
            </article>
          );
        })}
      </div>

      <div className="deal-room-actions" style={{ marginTop: '1rem' }}>
        <Link href={proposalsHref} className="btn btn-sm btn-secondary" title="Mở trang Proposals đầy đủ">
          Quote Builder →
        </Link>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={!canExportPack || exportBusy}
          title={packTitle}
          onClick={() => void handleExportPack()}
        >
          {exportBusy ? 'Đang xuất PDF…' : 'Export Pack PDF'}
        </button>
      </div>
    </section>
  );
}
