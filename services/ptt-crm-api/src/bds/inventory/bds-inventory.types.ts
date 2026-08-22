export const BDS_UNIT_STATUSES = [
  'available',
  'hold',
  'reserved',
  'booked',
  'sold',
  'locked',
] as const;
export type BdsUnitStatus = (typeof BDS_UNIT_STATUSES)[number];

export const UNIT_POOLS = ['inhouse', 'channel', 'reserved_vip', 'reserved_staff'] as const;
export type BdsUnitPool = (typeof UNIT_POOLS)[number];

export function coerceUnitPool(raw?: string): BdsUnitPool {
  const v = String(raw ?? 'inhouse');
  return (UNIT_POOLS as readonly string[]).includes(v) ? (v as BdsUnitPool) : 'inhouse';
}

export type ImportUnitRow = {
  unit_code: string;
  tower?: string;
  floor?: string;
  zone?: string;
  product_line?: string;
  pool?: string;
  status?: string;
  list_price_vnd?: string;
  net_price_vnd?: string;
  area_m2?: string;
  bedrooms?: string;
};

export type ImportResult = {
  imported: number;
  skipped_sold: Array<{ unit_code: string; reason: 'sold' }>;
  conflicts: Array<{ unit_code: string; error: string }>;
};

export const BDS_UNIT_EVENTS = [
  'hold',
  'ttl',
  'cancel',
  'reservation_fee',
  'reservation_expire',
  'deposit',
  'contract',
  'cdt_lock',
  'unlock',
  'reverse_sold',
] as const;
export type BdsUnitEvent = (typeof BDS_UNIT_EVENTS)[number];
