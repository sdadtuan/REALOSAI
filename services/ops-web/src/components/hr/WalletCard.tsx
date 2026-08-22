'use client';

import { HrExpiryChip } from '@/components/hr/HrExpiryChip';
import type { HrDocWalletCardDto } from '@/lib/hr-employee-file-api';

const CATEGORY_HUE: Record<string, string> = {
  identity: 'var(--hr-cat-identity, #2563eb)',
  contract: 'var(--hr-cat-contract, #7c3aed)',
  insurance: 'var(--hr-cat-insurance, #0891b2)',
  education: 'var(--hr-cat-education, #059669)',
  cert: 'var(--hr-cat-cert, #d97706)',
  license: 'var(--hr-cat-license, #dc2626)',
  medical: 'var(--hr-cat-medical, #db2777)',
  family: 'var(--hr-cat-family, #4f46e5)',
  other: 'var(--hr-cat-other, #64748b)',
};

type Props = {
  card: HrDocWalletCardDto;
  onClick?: () => void;
};

export function WalletCard({ card, onClick }: Props) {
  const hue = CATEGORY_HUE[String(card.type_category ?? 'other')] ?? CATEGORY_HUE.other;
  const title = card.title?.trim() || card.type_label || card.type_code;

  return (
    <button
      type="button"
      className="wallet-card"
      style={{ ['--wallet-hue' as string]: hue }}
      onClick={onClick}
    >
      <div className="wallet-card__top">
        <span className="wallet-card__type">{card.type_label ?? card.type_code}</span>
        {card.pinned ? <span className="wallet-card__pin">📌</span> : null}
      </div>
      <p className="wallet-card__title">{title}</p>
      <p className="wallet-card__meta muted">
        {card.issuer || card.doc_no || '—'}
      </p>
      <div className="wallet-card__footer">
        <HrExpiryChip status={card.status} expiresOn={card.expires_on} />
        <span className="wallet-card__files muted">{card.file_count} file</span>
      </div>
    </button>
  );
}
