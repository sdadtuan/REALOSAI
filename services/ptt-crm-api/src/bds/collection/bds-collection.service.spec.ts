import { BadRequestException } from '@nestjs/common';
import { BdsCollectionService } from './bds-collection.service';

const validHdmbDocs = [
  { doc_type: 'so_xd_du_dieu_kien_ban', status: 'valid' },
  { doc_type: 'bao_lanh_nh', status: 'valid' },
  { doc_type: 'mau_hdmb', status: 'valid' },
];

describe('BdsCollectionService', () => {
  function make() {
    const repo = {
      getScheduleByTx: jest.fn().mockResolvedValue(null),
      insertSchedule: jest.fn().mockResolvedValue({ id: 'sch1' }),
      insertInstallments: jest.fn().mockResolvedValue([]),
      sumReceiptsByTx: jest.fn().mockResolvedValue(0),
      hasReceiptForMilestone: jest.fn().mockResolvedValue(false),
      updateTxPaidPct: jest.fn(),
      insertReceipt: jest.fn().mockImplementation(async (row) => ({ id: 'rc1', ...row })),
      getInstallment: jest.fn(),
      updateInstallmentPaid: jest.fn(),
      listOverdueInstallments: jest.fn().mockResolvedValue([]),
      upsertMortgage: jest.fn(),
      listReceiptsForExport: jest.fn().mockResolvedValue([]),
    };
    const txRepo = {
      getTx: jest.fn(),
    };
    const policies = {
      get: jest.fn(),
    };
    const projectOs = {
      listLegalDocs: jest.fn().mockResolvedValue([]),
    };
    const svc = new BdsCollectionService(
      repo as never,
      txRepo as never,
      policies as never,
      projectOs as never,
    );
    return { svc, repo, txRepo, policies, projectOs };
  }

  it('createReceipt updates paid_pct', async () => {
    const { svc, repo, txRepo } = make();
    repo.sumReceiptsByTx.mockResolvedValue(0);
    txRepo.getTx.mockResolvedValue({
      id: 'tx1',
      net_price_vnd: 100_000_000,
      deposit_vnd: 30_000_000,
      stage: 'deposit',
      tenant_id: 't1',
    });
    await svc.createReceipt({ transaction_id: 'tx1', amount_vnd: 0, method: 'bank' }, 't1');
    expect(repo.updateTxPaidPct).toHaveBeenCalledWith('tx1', 30);
  });

  it('receipt over net throws receipt_over', async () => {
    const { svc, txRepo, repo } = make();
    txRepo.getTx.mockResolvedValue({
      id: 'tx1',
      net_price_vnd: 100,
      deposit_vnd: 90,
      stage: 'deposit',
      tenant_id: null,
    });
    repo.sumReceiptsByTx.mockResolvedValue(15);
    await expect(
      svc.createReceipt({ transaction_id: 'tx1', amount_vnd: 10, method: 'bank' }),
    ).rejects.toMatchObject({ response: { error: 'receipt_over' } });
  });

  it('assertCanContract BDS-31 throws legal_gate_hdmb', async () => {
    const { svc, projectOs } = make();
    projectOs.listLegalDocs.mockResolvedValue([]);
    await expect(
      svc.assertCanContract({
        id: 'tx1',
        project_id: 1,
        net_price_vnd: 1e9,
        paid_pct: 50,
        policy_id: 'p1',
      } as never),
    ).rejects.toMatchObject({ response: { error: 'legal_gate_hdmb' } });
  });

  it('assertCanContract BDS-32 throws paid_pct', async () => {
    const { svc, projectOs, policies } = make();
    projectOs.listLegalDocs.mockResolvedValue(validHdmbDocs);
    policies.get.mockResolvedValue({ hdmb_min_paid_pct: 30 });
    await expect(
      svc.assertCanContract({
        id: 'tx1',
        project_id: 1,
        net_price_vnd: 1e9,
        paid_pct: 20,
        policy_id: 'p1',
      } as never),
    ).rejects.toMatchObject({ response: { error: 'paid_pct' } });
  });

  it('getHdmbGate reflects legal and paid columns', async () => {
    const { svc, txRepo, projectOs, policies } = make();
    txRepo.getTx.mockResolvedValue({
      id: 'tx1',
      project_id: 1,
      paid_pct: 25,
      policy_id: 'p1',
      tenant_id: null,
    });
    projectOs.listLegalDocs.mockResolvedValue(validHdmbDocs);
    policies.get.mockResolvedValue({ hdmb_min_paid_pct: 30 });
    const gate = await svc.getHdmbGate('tx1');
    expect(gate.legal.ready).toBe(true);
    expect(gate.paid_ready).toBe(false);
    expect(gate.ready).toBe(false);
  });

  it('assertVbttPaidPct blocks when below vbtt min', async () => {
    const { svc, policies } = make();
    policies.get.mockResolvedValue({ vbtt_min_paid_pct: 10 });
    await expect(
      svc.assertVbttPaidPct({ policy_id: 'p1', paid_pct: 5 } as never),
    ).rejects.toMatchObject({ response: { error: 'paid_pct' } });
  });

  it('createReceipt invalid method → 400', async () => {
    const { svc } = make();
    await expect(
      svc.createReceipt({ transaction_id: 'tx1', amount_vnd: 1, method: 'crypto' as never }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
