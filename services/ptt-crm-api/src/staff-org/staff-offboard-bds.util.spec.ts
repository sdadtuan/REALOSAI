import { runStaffOffboardBdsSideEffect } from './staff-offboard-bds.util';

describe('runStaffOffboardBdsSideEffect', () => {
  it('returns zeros when crmStaffId missing', async () => {
    const getHook = jest.fn();
    await expect(runStaffOffboardBdsSideEffect(getHook, undefined)).resolves.toEqual({
      holds_released: 0,
      holds_kept: 0,
      tickets_reassigned: 0,
    });
    expect(getHook).not.toHaveBeenCalled();
  });

  it('merges hook counts', async () => {
    const hook = {
      onStaffOffboarded: jest.fn().mockResolvedValue({
        holds_released: 1,
        holds_kept: 1,
        tickets_reassigned: 3,
      }),
    };
    const out = await runStaffOffboardBdsSideEffect(() => hook, 9);
    expect(hook.onStaffOffboarded).toHaveBeenCalledWith({ crmStaffId: 9 });
    expect(out).toEqual({ holds_released: 1, holds_kept: 1, tickets_reassigned: 3 });
  });

  it('returns zeros when getHook throws', async () => {
    await expect(
      runStaffOffboardBdsSideEffect(() => {
        throw new Error('not registered');
      }, 9),
    ).resolves.toEqual({ holds_released: 0, holds_kept: 0, tickets_reassigned: 0 });
  });

  it('returns zeros when onStaffOffboarded throws', async () => {
    await expect(
      runStaffOffboardBdsSideEffect(
        () => ({ onStaffOffboarded: jest.fn().mockRejectedValue(new Error('hold down')) }),
        9,
      ),
    ).resolves.toEqual({ holds_released: 0, holds_kept: 0, tickets_reassigned: 0 });
  });
});
