import type { BdsUnitEvent, BdsUnitStatus } from './bds-inventory.types';

const NEXT: Record<string, BdsUnitStatus> = {
  'available:hold': 'hold',
  'available:cdt_lock': 'locked',
  'hold:ttl': 'available',
  'hold:cancel': 'available',
  'hold:reservation_fee': 'reserved',
  'hold:deposit': 'booked',
  'hold:cdt_lock': 'locked',
  'reserved:reservation_expire': 'available',
  'reserved:cancel': 'available',
  'reserved:deposit': 'booked',
  'reserved:cdt_lock': 'locked',
  'booked:cancel': 'available',
  'booked:contract': 'sold',
  'booked:cdt_lock': 'locked',
  'locked:unlock': 'available',
  'sold:reverse_sold': 'available',
};

export function assertUnitTransition(from: string, event: BdsUnitEvent): BdsUnitStatus {
  if (from === 'sold' && event !== 'reverse_sold') {
    throw new Error('sold');
  }
  const next = NEXT[`${from}:${event}`];
  if (!next) {
    throw new Error(`illegal_transition ${from} ${event}`);
  }
  return next;
}
