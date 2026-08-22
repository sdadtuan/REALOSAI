import { BadRequestException } from '@nestjs/common';

export const REQUIRED_SALE_DOC_TYPES = [
  'quy_hoach_1_500',
  'qsd_dat',
  'nghia_vu_tai_chinh',
  'gpxd',
  'nghiem_thu_mong',
  'bao_lanh_nh',
  'so_xd_du_dieu_kien_ban',
] as const;

export type RequiredSaleDocType = (typeof REQUIRED_SALE_DOC_TYPES)[number];
export type LegalGate = 'blocked' | 'enough_to_sell' | 'restricted';

export type LegalGateDoc = {
  doc_type: string;
  status: string;
  expires_on?: string | Date | null;
};

function dateKey(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function isLegalDocExpired(doc: LegalGateDoc, now: Date): boolean {
  if (doc.status === 'expired') return true;
  if (doc.expires_on != null && doc.expires_on !== '') {
    return dateKey(doc.expires_on) < dateKey(now);
  }
  return false;
}

export function isLegalDocValid(doc: LegalGateDoc, now: Date): boolean {
  return doc.status === 'valid' && !isLegalDocExpired(doc, now);
}

export function computeLegalGate(
  docs: LegalGateDoc[],
  now: Date,
  overrideUntil: Date | null,
): LegalGate {
  if (overrideUntil instanceof Date && overrideUntil > now) {
    return 'enough_to_sell';
  }

  const required = new Set<string>(REQUIRED_SALE_DOC_TYPES);
  if (docs.some((d) => required.has(d.doc_type) && isLegalDocExpired(d, now))) {
    return 'restricted';
  }

  for (const docType of REQUIRED_SALE_DOC_TYPES) {
    const ofType = docs.filter((d) => d.doc_type === docType);
    if (!ofType.some((d) => isLegalDocValid(d, now))) return 'blocked';
  }

  return 'enough_to_sell';
}

export function assertOpenPhaseAllowed(legalGate: string): void {
  if (legalGate !== 'enough_to_sell') {
    throw new BadRequestException({ error: 'legal_gate' });
  }
}
