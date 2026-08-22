import { resolveIsActivePttStaff } from './b2b-staff-active.util';

describe('resolveIsActivePttStaff', () => {
  it('inactive staff is not active PTT', () => {
    expect(resolveIsActivePttStaff({ active: false })).toBe(false);
    expect(resolveIsActivePttStaff({ active: true })).toBe(true);
  });

  it('null active is not active PTT', () => {
    expect(resolveIsActivePttStaff({ active: null })).toBe(false);
  });
});
