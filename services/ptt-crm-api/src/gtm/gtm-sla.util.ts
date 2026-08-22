export type SlaTone = 'none' | 'warn' | 'danger';

export type AseanMarket = 'th' | 'id' | 'ph' | 'sg';

const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';

const MARKET_TZ: Record<AseanMarket, string> = {
  th: 'Asia/Bangkok',
  id: 'Asia/Jakarta',
  ph: 'Asia/Manila',
  sg: 'Asia/Singapore',
};

const MARKET_GMT: Record<AseanMarket, string> = {
  th: 'GMT+7',
  id: 'GMT+7',
  ph: 'GMT+8',
  sg: 'GMT+8',
};

export function resolveGtmTimezone(marketCountry: string | null | undefined): string {
  if (marketCountry && marketCountry in MARKET_TZ) {
    return MARKET_TZ[marketCountry as AseanMarket];
  }
  return DEFAULT_TZ;
}

export function formatSlaDeadlineLocal(
  createdAt: Date,
  marketCountry: string | null | undefined,
): { label: string; timezone_label: string } {
  const tz = resolveGtmTimezone(marketCountry);
  const deadline = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);
  const label = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(deadline);
  const gmt =
    marketCountry && marketCountry in MARKET_GMT
      ? MARKET_GMT[marketCountry as AseanMarket]
      : 'GMT+7';
  return { label, timezone_label: `${gmt} · ${tz}` };
}

const TZ = 'Asia/Bangkok';
const DAY_START = 8 * 60 + 30;
const DAY_END = 18 * 60;

type BangkokParts = {
  year: number;
  month: number;
  day: number;
  dow: number;
  minutes: number;
};

function bangkokParts(d: Date): BangkokParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '0';
  const weekday = pick('weekday');
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number.parseInt(pick('year'), 10),
    month: Number.parseInt(pick('month'), 10),
    day: Number.parseInt(pick('day'), 10),
    dow: dowMap[weekday] ?? 0,
    minutes: Number.parseInt(pick('hour'), 10) * 60 + Number.parseInt(pick('minute'), 10),
  };
}

function dateKey(p: BangkokParts): string {
  return `${p.year}-${p.month}-${p.day}`;
}

function isWeekday(dow: number): boolean {
  return dow >= 1 && dow <= 5;
}

function nextDayStart(d: Date): Date {
  return new Date(d.getTime() + 24 * 60 * 60 * 1000);
}

export function businessMinutesBetween(from: Date, to: Date): number {
  if (to <= from) return 0;

  let total = 0;
  let cursor = from;

  while (cursor < to) {
    const start = bangkokParts(cursor);
    if (!isWeekday(start.dow)) {
      cursor = nextDayStart(cursor);
      continue;
    }

    const end = bangkokParts(to);
    const sameDay = dateKey(start) === dateKey(end);

    const windowFrom = Math.max(start.minutes, DAY_START);
    const windowTo = sameDay ? Math.min(end.minutes, DAY_END) : DAY_END;

    if (windowFrom < DAY_END && windowTo > DAY_START && windowTo > windowFrom) {
      total += windowTo - windowFrom;
    }

    if (sameDay) break;
    cursor = nextDayStart(cursor);
  }

  return total;
}

export function gtmSlaTone(createdAt: Date, now: Date, status: string): SlaTone {
  if (status !== 'new') return 'none';
  const minutes = businessMinutesBetween(createdAt, now);
  if (minutes > 240) return 'danger';
  if (minutes > 120) return 'warn';
  return 'none';
}
