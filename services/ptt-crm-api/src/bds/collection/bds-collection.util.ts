import { BadRequestException } from '@nestjs/common';
import type { AgingBucket, PaymentTemplateRow } from './bds-collection.types';

export function parsePaymentTemplate(json: unknown): PaymentTemplateRow[] {
  if (!Array.isArray(json)) {
    throw new BadRequestException({ error: 'payment_template' });
  }
  const rows: PaymentTemplateRow[] = [];
  let sumPct = 0;
  for (const raw of json) {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException({ error: 'payment_template' });
    }
    const row = raw as Record<string, unknown>;
    const code = String(row.code ?? '').trim();
    const pct = Number(row.pct);
    const dueDays = Number(row.due_days_from_deposit ?? 0);
    if (!code || !Number.isFinite(pct) || pct < 0 || pct > 100) {
      throw new BadRequestException({ error: 'payment_template' });
    }
    if (!Number.isFinite(dueDays) || dueDays < 0) {
      throw new BadRequestException({ error: 'payment_template' });
    }
    sumPct += pct;
    rows.push({ code, pct, due_days_from_deposit: dueDays });
  }
  if (sumPct > 100) {
    throw new BadRequestException({ error: 'payment_template' });
  }
  return rows;
}

export function computePaidPct(totalPaidVnd: number, netPriceVnd: number): number {
  if (!Number.isFinite(netPriceVnd) || netPriceVnd <= 0) return 0;
  const pct = (100 * totalPaidVnd) / netPriceVnd;
  return Math.round(pct * 100) / 100;
}

export function assertReceiptWithinBalance(
  amountVnd: number,
  netPriceVnd: number,
  paidSoFarVnd: number,
): void {
  if (amountVnd + paidSoFarVnd > netPriceVnd) {
    throw new BadRequestException({ error: 'receipt_over' });
  }
}

export function agingBucket(overdueDays: number): AgingBucket {
  if (overdueDays <= 15) return '0_15';
  if (overdueDays <= 30) return '16_30';
  if (overdueDays <= 60) return '31_60';
  return '60_plus';
}

export function addDays(base: Date, days: number): Date {
  const out = new Date(base);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}
