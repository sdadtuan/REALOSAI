import { createHash, randomBytes } from 'crypto';
import type {
  DeviceIngestRecord,
  HrAttendanceDirection,
  RollupPunchInput,
} from './hr-attendance.types';

const HR_ATTENDANCE_TZ = 'Asia/Ho_Chi_Minh';

export function hashDeviceKey(plaintext: string): string {
  return createHash('sha256').update(String(plaintext).trim()).digest('hex');
}

export function generateDeviceKey(): string {
  return randomBytes(24).toString('hex');
}

export function workDateInTz(isoOrDate: string | Date, tz = HR_ATTENDANCE_TZ): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${day}`;
}

export function timeLabelInTz(isoOrDate: string | Date, tz = HR_ATTENDANCE_TZ): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export function parseDeviceDirection(raw: DeviceIngestRecord): HrAttendanceDirection {
  const dir = String(raw.direction ?? raw.in_out ?? '').trim().toLowerCase();
  if (dir === 'in' || dir === 'i' || dir === 'check in' || dir === 'checkin') return 'in';
  if (dir === 'out' || dir === 'o' || dir === 'check out' || dir === 'checkout') return 'out';
  const status = raw.status;
  if (status === 0 || status === '0') return 'in';
  if (status === 1 || status === '1') return 'out';
  return 'auto';
}

export function parseDevicePunchedAt(raw: DeviceIngestRecord): Date | null {
  const text = String(raw.punched_at ?? raw.time ?? raw.datetime ?? '').trim();
  if (!text) return null;
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizePin(raw: string | number | undefined): string {
  return String(raw ?? '').trim();
}

export type CsvPunchRow = {
  pin: string;
  punched_at: Date;
  direction: HrAttendanceDirection;
};

export function parseAttendanceCsv(text: string): CsvPunchRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const header = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase());
  const hasHeader = header.some((h) => ['pin', 'time', 'datetime', 'punched_at'].includes(h));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const pinIdx = hasHeader ? header.findIndex((h) => h === 'pin' || h === 'userid' || h === 'user') : 0;
  const timeIdx = hasHeader
    ? header.findIndex((h) => ['time', 'datetime', 'punched_at', 'date'].includes(h))
    : 1;
  const dirIdx = hasHeader
    ? header.findIndex((h) => ['direction', 'in_out', 'status', 'type'].includes(h))
    : 2;

  const out: CsvPunchRow[] = [];
  for (const line of dataLines) {
    const cols = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    const pin = normalizePin(cols[pinIdx >= 0 ? pinIdx : 0]);
    const timeText = cols[timeIdx >= 0 ? timeIdx : 1] ?? '';
    const punchedAt = parseDevicePunchedAt({ time: timeText });
    if (!pin || !punchedAt) continue;
    const dirRaw = dirIdx >= 0 ? cols[dirIdx] : undefined;
    const direction = parseDeviceDirection({
      direction: dirRaw,
      status: dirRaw,
      in_out: dirRaw,
    });
    out.push({ pin, punched_at: punchedAt, direction });
  }
  return out;
}

export function rollupDayTimes(punches: RollupPunchInput[]): { checkIn: string; checkOut: string } {
  const accepted = punches.filter((p) => p.status === 'accepted');
  if (!accepted.length) return { checkIn: '', checkOut: '' };

  const bySource = (source: RollupPunchInput['source']) =>
    accepted.filter((p) => p.source === source);

  const pickIn = (items: RollupPunchInput[]): string => {
    const candidates = items.filter((p) => p.direction === 'in' || p.direction === 'auto');
    if (!candidates.length) return '';
    const sorted = [...candidates].sort(
      (a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime(),
    );
    return timeLabelInTz(sorted[0].punched_at);
  };

  const pickOut = (items: RollupPunchInput[]): string => {
    const candidates = items.filter((p) => p.direction === 'out' || p.direction === 'auto');
    if (!candidates.length) return '';
    const sorted = [...candidates].sort(
      (a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime(),
    );
    return timeLabelInTz(sorted[sorted.length - 1].punched_at);
  };

  // BR-HR-154: device wins; GPS fills gaps only
  const device = bySource('device');
  const gps = bySource('gps');
  const manual = bySource('manual');

  const checkIn = pickIn(device) || pickIn(gps) || pickIn(manual);
  const checkOut = pickOut(device) || pickOut(gps) || pickOut(manual);

  if (checkIn && checkOut && checkIn === checkOut) {
    const sorted = [...accepted].sort(
      (a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime(),
    );
    if (sorted.length > 1) {
      return {
        checkIn: timeLabelInTz(sorted[0].punched_at),
        checkOut: timeLabelInTz(sorted[sorted.length - 1].punched_at),
      };
    }
  }

  return { checkIn, checkOut };
}

export function collectRollupSources(punches: RollupPunchInput[]): string[] {
  const sources = new Set<string>();
  for (const p of punches) {
    if (p.status === 'accepted') sources.add(p.source);
  }
  return [...sources].sort();
}

export { HR_ATTENDANCE_TZ };
