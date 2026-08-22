import { businessMinutesBetween, formatSlaDeadlineLocal, gtmSlaTone, resolveGtmTimezone } from './gtm-sla.util';

describe('gtm-sla.util', () => {
  it('resolveGtmTimezone for Singapore', () => {
    expect(resolveGtmTimezone('sg')).toBe('Asia/Singapore');
    expect(resolveGtmTimezone(null)).toBe('Asia/Ho_Chi_Minh');
  });

  it('formatSlaDeadlineLocal uses market timezone', () => {
    const created = new Date('2026-08-14T09:00:00.000Z');
    const out = formatSlaDeadlineLocal(created, 'sg');
    expect(out.timezone_label).toContain('Asia/Singapore');
    expect(out.label.length).toBeGreaterThan(5);
  });

  it('freezes outside VN business hours', () => {
    const created = new Date('2026-08-14T19:00:00+07:00');
    const sat = new Date('2026-08-15T12:00:00+07:00');
    expect(businessMinutesBetween(created, sat)).toBe(0);
    expect(gtmSlaTone(created, sat, 'new')).toBe('none');
  });

  it('returns danger after 4 business hours on Friday 09:00 to 13:30', () => {
    const created = new Date('2026-08-14T09:00:00+07:00');
    const now = new Date('2026-08-14T13:30:00+07:00');
    expect(businessMinutesBetween(created, now)).toBeGreaterThan(240);
    expect(gtmSlaTone(created, now, 'new')).toBe('danger');
  });

  it('returns none for non-new status', () => {
    const created = new Date('2026-08-14T09:00:00+07:00');
    const now = new Date('2026-08-14T13:30:00+07:00');
    expect(gtmSlaTone(created, now, 'qualified')).toBe('none');
  });

  it('returns warn between 120 and 240 business minutes', () => {
    const created = new Date('2026-08-14T09:00:00+07:00');
    const now = new Date('2026-08-14T11:30:00+07:00');
    expect(gtmSlaTone(created, now, 'new')).toBe('warn');
  });
});
