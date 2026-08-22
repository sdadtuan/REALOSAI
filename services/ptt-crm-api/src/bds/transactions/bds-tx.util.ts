import type { TxStage } from './bds-tx.types';

const CLOSED_STAGES = new Set<TxStage>(['cancelled', 'lost']);

const ADVANCES: Record<string, TxStage[]> = {
  reservation: ['deposit', 'cancelled'],
  deposit: ['vbtt', 'contracted', 'cancelled'],
  vbtt: ['contracted', 'cancelled'],
};

export function isOpenTxStage(stage: string): boolean {
  return !CLOSED_STAGES.has(String(stage) as TxStage);
}

export function assertDepositMin(depositVnd: number, minVnd: number): void {
  if (depositVnd < minVnd) {
    throw { error: 'deposit_min' };
  }
}

export function decideTxChannel(channelPartnerId?: string): 'inhouse' | 'agency' {
  return String(channelPartnerId ?? '').trim() ? 'agency' : 'inhouse';
}

export function canAdvanceTx(from: string, to: string): boolean {
  return (ADVANCES[from] ?? []).includes(to as TxStage);
}

export function unitEventForConvert(unitStatus: string): 'deposit' {
  const s = String(unitStatus);
  if (s !== 'hold' && s !== 'reserved') throw { error: 'unit_locked' };
  return 'deposit';
}

export function unitEventForReservation(): 'reservation_fee' {
  return 'reservation_fee';
}

export function unitEventForContract(): 'contract' {
  return 'contract';
}

export function unitEventForCancel(unitStatus: string): 'cancel' {
  const s = String(unitStatus);
  if (s !== 'reserved' && s !== 'booked') throw { error: 'unit_locked' };
  return 'cancel';
}
