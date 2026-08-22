import {
  parseAttendanceCsv,
  parseDeviceDirection,
  rollupDayTimes,
  timeLabelInTz,
  workDateInTz,
} from './hr-attendance.util';

describe('hr-attendance.util', () => {
  it('parseDeviceDirection maps status codes', () => {
    expect(parseDeviceDirection({ status: 0 })).toBe('in');
    expect(parseDeviceDirection({ status: 1 })).toBe('out');
    expect(parseDeviceDirection({ direction: 'check out' })).toBe('out');
  });

  it('parseAttendanceCsv reads header row', () => {
    const csv = 'pin,datetime,direction\n101,2026-08-19 08:30:00,in\n101,2026-08-19 17:30:00,out';
    const rows = parseAttendanceCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].pin).toBe('101');
    expect(rows[0].direction).toBe('in');
  });

  it('rollupDayTimes picks earliest in and latest out', () => {
    const { checkIn, checkOut } = rollupDayTimes([
      { direction: 'in', punched_at: '2026-08-19T01:30:00.000Z', status: 'accepted', source: 'device' },
      { direction: 'out', punched_at: '2026-08-19T10:30:00.000Z', status: 'accepted', source: 'device' },
      { direction: 'in', punched_at: '2026-08-19T02:00:00.000Z', status: 'rejected', source: 'device' },
    ]);
    expect(checkIn).toMatch(/^\d{2}:\d{2}$/);
    expect(checkOut).toMatch(/^\d{2}:\d{2}$/);
    expect(checkIn <= checkOut).toBe(true);
  });

  it('rollupDayTimes prefers device over gps (BR-HR-154)', () => {
    const { checkIn, checkOut } = rollupDayTimes([
      { direction: 'in', punched_at: '2026-08-19T00:30:00.000Z', status: 'accepted', source: 'gps' },
      { direction: 'in', punched_at: '2026-08-19T01:00:00.000Z', status: 'accepted', source: 'device' },
      { direction: 'out', punched_at: '2026-08-19T09:00:00.000Z', status: 'accepted', source: 'gps' },
      { direction: 'out', punched_at: '2026-08-19T10:00:00.000Z', status: 'accepted', source: 'device' },
    ]);
    expect(checkIn).toBe(timeLabelInTz('2026-08-19T01:00:00.000Z'));
    expect(checkOut).toBe(timeLabelInTz('2026-08-19T10:00:00.000Z'));
  });
});
