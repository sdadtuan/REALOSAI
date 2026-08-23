import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadCollectionExport,
  fetchBdsLeads,
  fetchBdsSpineBuyer,
  fetchCollectionAging,
  fetchProjectHolds,
  fetchProjectPolicies,
  postAgencyGrantUnits,
  postMilestoneReach,
  postPolicyActivate,
  postHoldApprove,
  postLeadVisit,
  postReceipt,
  postTxContract,
  postUnitHold,
  postCommissionScheme,
  postCommissionStatementLock,
  postUnitImport,
  postUnitLock,
} from './api';

describe('bds api client W1', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('lists holds by project', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'h1',
          status: 'pending',
          project_id: 9001,
          product_id: 1,
          lead_id: 1,
          channel_partner_id: '',
          note: '',
          approved_by: '',
          expires_at: null,
        },
      ],
    });
    const rows = await fetchProjectHolds('tok', 9001);
    expect(rows[0].id).toBe('h1');
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      '/api/v1/bds/projects/9001/holds',
    );
  });

  it('surfaces 409 hold_closed on approve without remapping', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'hold_closed' }),
    });
    await expect(postHoldApprove('tok', 'h1', 'gdkd@x')).rejects.toSatisfy((err: unknown) => {
      const msg = (err as Error).message;
      return msg.includes('409') && msg.includes('hold_closed') && !/đã có giữ chỗ/i.test(msg);
    });
  });

  it('posts contract with the given row_version', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'tx1' }),
    });
    await postTxContract('tok', 'tx1', { contract_no: 'HD-1', row_version: 7 });
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      '/api/v1/bds/transactions/tx1/contract',
    );
    expect(JSON.parse(init.body as string)).toEqual({ contract_no: 'HD-1', row_version: 7 });
  });

  it('surfaces 409 unit_locked on second hold', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'unit_locked' }),
    });
    await expect(
      postUnitHold('tok', 1, { lead_id: 2, row_version: 1 }, 'k1'),
    ).rejects.toSatisfy((err: unknown) => {
      const msg = (err as Error).message;
      return msg.includes('409') && msg.includes('unit_locked');
    });
  });

  it('lists buyers with required project_id', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, full_name: 'A', status: 'moi', re_project_id: 9001, received_at: null }],
    });
    const rows = await fetchBdsLeads('tok', 9001);
    expect(rows[0].id).toBe(1);
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      '/api/v1/bds/leads',
    );
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      'project_id=9001',
    );
  });

  it('fetchBdsLeads skips fetch when projectId is 0', async () => {
    const rows = await fetchBdsLeads('tok', 0);
    expect(rows).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetchBdsSpineBuyer hits spine path', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ lead_id: 9, lead_flow_kind: 're_buyer', full_name: 'A' }),
    });
    await fetchBdsSpineBuyer('tok', 9);
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      '/api/v1/bds/spine/buyer/9',
    );
  });

  it('posts visit', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'v1' }),
    });
    await postLeadVisit('tok', 9, { scheduled_at: '2026-08-23T10:00:00.000Z', staff_id: 1 });
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      '/api/v1/bds/leads/9/visits',
    );
  });

  it('fetchCollectionAging skips fetch when projectId is 0', async () => {
    const rows = await fetchCollectionAging('tok', 0);
    expect(rows).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('downloadCollectionExport skips fetch when projectId is 0', async () => {
    const click = vi.fn();
    vi.stubGlobal(
      'document',
      { createElement: () => ({ click, href: '', download: '' }) },
    );
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() });

    await downloadCollectionExport('tok', 0);

    expect(fetch).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it('lists aging with project_id', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          transaction_id: 'tx1',
          installment_id: 'i1',
          milestone_code: 'dot1',
          due_date: '2026-01-01',
          amount_vnd: 10,
          paid_vnd: 0,
          overdue_days: 3,
          bucket: '0_15',
        },
      ],
    });
    const rows = await fetchCollectionAging('tok', 9001);
    expect(rows[0].transaction_id).toBe('tx1');
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      '/api/v1/bds/collections/aging',
    );
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      'project_id=9001',
    );
  });

  it('posts receipt', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'r1' }),
    });
    await postReceipt('tok', { transaction_id: 'tx1', amount_vnd: 1000, method: 'bank' });
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      '/api/v1/bds/receipts',
    );
  });

  it('posts milestone reach at /milestones/:id/reach', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'm1', status: 'reached' }),
    });
    await postMilestoneReach('tok', 'm1', { actual_date: '2026-08-23' });
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      '/api/v1/bds/milestones/m1/reach',
    );
  });

  it('posts policy activate with Nest actor_role', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'p1', status: 'active' }),
    });
    await postPolicyActivate('tok', 'p1', {
      phase_id: 'ph1',
      price_list_id: 3,
      actor_role: 'cdt_sales_dir',
    });
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string).actor_role).toBe('cdt_sales_dir');
  });

  it('skips project-scoped W2 GETs when projectId is 0', async () => {
    await expect(fetchProjectPolicies('tok', 0)).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('surfaces 400 contract on grant units', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'contract' }),
    });
    await expect(
      postAgencyGrantUnits('tok', 'ag1', { project_id: 1, product_ids: [9] }),
    ).rejects.toSatisfy((err: unknown) => {
      const msg = (err as Error).message;
      return msg.includes('400') && msg.includes('contract');
    });
  });

  it('posts unit import csv on pack path', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ imported: 1, skipped_sold: [], conflicts: [] }),
    });
    await postUnitImport('tok', 7, 'unit_code\nA-01\n');
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      '/api/v1/bds/projects/7/units/import',
    );
  });

  it('lock requires explicit row_version in body', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1 }),
    });
    await postUnitLock('tok', 4, { row_version: 3, reason: 'ops' });
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({ row_version: 3, reason: 'ops' });
  });

  it('posts commission statement lock', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'st1',
        agency_id: 'ag1',
        period_month: '2026-08-01',
        gross_vnd: 1000,
        advance_vnd: 0,
        clawback_vnd: 0,
        net_vnd: 1000,
        status: 'locked',
      }),
    });
    await postCommissionStatementLock('tok', { agency_id: 'ag1', period_month: '2026-08-01' });
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      '/api/v1/bds/commission-statements/lock',
    );
  });

  it('posts commission scheme with base net', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'sch1', project_id: 9, status: 'draft', base: 'net' }),
    });
    await postCommissionScheme('tok', { project_id: 9, base: 'net' });
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({ project_id: 9, base: 'net' });
  });
});
