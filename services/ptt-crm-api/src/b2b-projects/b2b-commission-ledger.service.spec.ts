import { B2bCommissionLedgerService } from './b2b-commission-ledger.service';
import { B2bCommissionLedgerRepository } from './b2b-commission-ledger.repository';

describe('B2bCommissionLedgerService', () => {
  it('posts ledger from split 30/70 on 10M', async () => {
    const repo = {
      loadSplit: jest.fn(async () => ({
        first_touch_staff_id: 10,
        closer_staff_id: 20,
        first_touch_pct: 30,
        closer_pct: 70,
      })),
      insertPosted: jest.fn(async (input) => ({
        id: 'l1',
        lead_id: input.leadId,
        contract_id: input.contractId,
        first_touch_staff_id: input.firstTouchStaffId,
        closer_staff_id: input.closerStaffId,
        first_touch_amt: input.firstTouchAmt,
        closer_amt: input.closerAmt,
        status: 'posted',
        posted_at: '2026-08-19',
      })),
    };
    const svc = new B2bCommissionLedgerService(repo as never, { b2bProjectOs: true } as never);
    const out = await svc.postOnContractActive({ leadId: 1, contractId: 99, amountVnd: 10_000_000 });
    expect(out.posted).toBe(true);
    expect(repo.insertPosted).toHaveBeenCalledWith(
      expect.objectContaining({
        firstTouchAmt: 3_000_000,
        closerAmt: 7_000_000,
      }),
    );
  });

  it('hop-only lead without split does not post', async () => {
    const repo = {
      loadSplit: jest.fn(async () => null),
      insertPosted: jest.fn(),
    };
    const svc = new B2bCommissionLedgerService(repo as never, { b2bProjectOs: true } as never);
    const out = await svc.postOnContractActive({ leadId: 1, contractId: 99, amountVnd: 10_000_000 });
    expect(out.posted).toBe(false);
    expect(repo.insertPosted).not.toHaveBeenCalled();
  });
});
