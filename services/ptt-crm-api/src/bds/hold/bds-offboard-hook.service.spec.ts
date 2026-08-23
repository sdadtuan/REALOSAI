import { ConflictException } from '@nestjs/common';
import { BdsOffboardHookService } from './bds-offboard-hook.service';

function makeHook(overrides?: {
  pack?: boolean;
  ticketsOn?: boolean;
  holds?: Array<{ id: string; status: string; tenant_id?: string | null }>;
  deposit?: Record<string, boolean>;
  cancel?: jest.Mock;
  reassign?: jest.Mock;
}) {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevTk = process.env.PTT_STAFF_TICKETS;
  process.env.PTT_BDS_PACK = overrides?.pack === false ? '0' : '1';
  process.env.PTT_STAFF_TICKETS = overrides?.ticketsOn === false ? '0' : '1';
  const cancel = overrides?.cancel ?? jest.fn().mockImplementation(async (id: string) => ({ id }));
  const svc = new BdsOffboardHookService(
    { listOpenByStaff: jest.fn().mockResolvedValue(overrides?.holds ?? []) } as never,
    {
      hasDepositForHold: jest
        .fn()
        .mockImplementation(async (id: string) => Boolean(overrides?.deposit?.[id])),
    } as never,
    { cancel } as never,
    {
      reassignOpenTicketsOnOffboard:
        overrides?.reassign ?? jest.fn().mockResolvedValue(2),
    } as never,
  );
  return {
    svc,
    cancel,
    restore() {
      process.env.PTT_BDS_PACK = prevPack;
      process.env.PTT_STAFF_TICKETS = prevTk;
    },
  };
}

describe('BdsOffboardHookService', () => {
  it('PACK=0 does not list or cancel', async () => {
    const ctx = makeHook({ pack: false, ticketsOn: false, holds: [{ id: 'h1', status: 'active' }] });
    try {
      await expect(ctx.svc.onStaffOffboarded({ crmStaffId: 9 })).resolves.toEqual({
        holds_released: 0,
        holds_kept: 0,
        tickets_reassigned: 0,
      });
      expect(ctx.cancel).not.toHaveBeenCalled();
    } finally {
      ctx.restore();
    }
  });

  it('U-08 cancels undeposited hold via BdsHoldService.cancel', async () => {
    const ctx = makeHook({
      holds: [{ id: 'h-empty', status: 'active', tenant_id: 't1' }],
      deposit: { 'h-empty': false },
    });
    try {
      const out = await ctx.svc.onStaffOffboarded({ crmStaffId: 9 });
      expect(out.holds_released).toBe(1);
      expect(out.holds_kept).toBe(0);
      expect(ctx.cancel).toHaveBeenCalledWith('h-empty', 'offboard hold', 't1');
    } finally {
      ctx.restore();
    }
  });

  it('U-07 does not cancel hold with deposit TX', async () => {
    const ctx = makeHook({
      holds: [{ id: 'h-dep', status: 'active' }],
      deposit: { 'h-dep': true },
    });
    try {
      const out = await ctx.svc.onStaffOffboarded({ crmStaffId: 9 });
      expect(out.holds_released).toBe(0);
      expect(out.holds_kept).toBe(1);
      expect(ctx.cancel).not.toHaveBeenCalled();
    } finally {
      ctx.restore();
    }
  });

  it('keeps hold when cancel conflicts', async () => {
    const ctx = makeHook({
      holds: [{ id: 'h1', status: 'active' }],
      deposit: { h1: false },
      cancel: jest.fn().mockRejectedValue(new ConflictException({ error: 'hold_closed' })),
    });
    try {
      const out = await ctx.svc.onStaffOffboarded({ crmStaffId: 9 });
      expect(out.holds_kept).toBe(1);
      expect(out.holds_released).toBe(0);
    } finally {
      ctx.restore();
    }
  });

  it('keeps hold when deposit lookup throws (fail-closed)', async () => {
    const prev = process.env.PTT_BDS_PACK;
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_STAFF_TICKETS = '0';
    const svc = new BdsOffboardHookService(
      { listOpenByStaff: jest.fn().mockResolvedValue([{ id: 'h1', status: 'active' }]) } as never,
      { hasDepositForHold: jest.fn().mockRejectedValue(new Error('no table')) } as never,
      { cancel: jest.fn() } as never,
      { reassignOpenTicketsOnOffboard: jest.fn() } as never,
    );
    try {
      const out = await svc.onStaffOffboarded({ crmStaffId: 9 });
      expect(out).toEqual({ holds_released: 0, holds_kept: 1, tickets_reassigned: 0 });
    } finally {
      process.env.PTT_BDS_PACK = prev;
    }
  });
});
