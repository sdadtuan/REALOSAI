import { useLifecycleTasksPg } from './lifecycle-tasks-routing.util';

describe('useLifecycleTasksPg', () => {
  it('uses PG when lifecycle PG flag is on', () => {
    expect(
      useLifecycleTasksPg({
        crmServiceLifecyclePg: true,
        sqliteDisabled: false,
      } as never),
    ).toBe(true);
  });

  it('uses PG when sqlite is disabled even without lifecycle PG flag', () => {
    expect(
      useLifecycleTasksPg({
        crmServiceLifecyclePg: false,
        sqliteDisabled: true,
      } as never),
    ).toBe(true);
  });

  it('uses sqlite repo only when both flags are off', () => {
    expect(
      useLifecycleTasksPg({
        crmServiceLifecyclePg: false,
        sqliteDisabled: false,
      } as never),
    ).toBe(false);
  });
});
