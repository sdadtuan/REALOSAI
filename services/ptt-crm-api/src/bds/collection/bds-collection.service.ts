import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { isStaffTicketsEnabled } from '../../staff-tickets/staff-ticket.flags';
import { StaffTicketService } from '../../staff-tickets/staff-ticket.service';
import { BdsPolicyService } from '../policies/bds-policy.service';
import { BdsProjectOsService } from '../project-os/bds-project-os.service';
import { BdsTxRepository } from '../transactions/bds-tx.repository';
import type { TxRow } from '../transactions/bds-tx.types';
import { BdsCollectionRepository } from './bds-collection.repository';
import type {
  AgingRow,
  AssertContractOpts,
  CreateReceiptBody,
  HdmbGateStatus,
  MortgageRow,
  ReceiptRow,
  UpsertMortgageBody,
} from './bds-collection.types';
import {
  addDays,
  agingBucket,
  assertReceiptWithinBalance,
  computePaidPct,
  parsePaymentTemplate,
} from './bds-collection.util';
import {
  assertHdmbLegalGate,
  assertHdmbPaidPct,
  evaluateHdmbLegalGate,
} from './bds-hdmb-gate.util';

const RECEIPT_STAGES = new Set(['deposit', 'vbtt', 'contracted']);

function daysBetween(due: Date, asOf: Date): number {
  const dueMs = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const asOfMs = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  return Math.max(0, Math.floor((asOfMs - dueMs) / (24 * 60 * 60 * 1000)));
}

@Injectable()
export class BdsCollectionService {
  private readonly logger = new Logger(BdsCollectionService.name);

  constructor(
    private readonly repo: BdsCollectionRepository,
    private readonly txRepo: BdsTxRepository,
    private readonly policies: BdsPolicyService,
    private readonly projectOs: BdsProjectOsService,
    @Optional() private readonly tickets?: StaffTicketService | null,
  ) {}

  async ensureScheduleForTx(txId: string, tenantId?: string, now = new Date()): Promise<void> {
    const tx = await this.getTxOrThrow(txId, tenantId);
    if (await this.repo.getScheduleByTx(tx.id)) return;

    if (!tx.policy_id) {
      throw new BadRequestException({ error: 'policy_id' });
    }
    const policy = await this.policies.get(tx.policy_id, tenantId);
    const template = parsePaymentTemplate(policy.payment_template_json);
    const anchor = tx.deposit_paid_at ?? now;
    const net = tx.net_price_vnd;

    const schedule = await this.repo.insertSchedule({
      tenant_id: tx.tenant_id,
      transaction_id: tx.id,
      project_id: tx.project_id,
      policy_id: tx.policy_id,
      source: 'deposit',
    });

    const installments = template.map((row, seq) => ({
      tenant_id: tx.tenant_id,
      schedule_id: schedule.id,
      transaction_id: tx.id,
      seq,
      milestone_code: row.code,
      due_date: addDays(anchor, row.due_days_from_deposit),
      amount_vnd: Math.round((net * row.pct) / 100),
    }));
    if (installments.length > 0) {
      await this.repo.insertInstallments(installments);
    }

    const depositIncluded = await this.repo.hasReceiptForMilestone(tx.id, 'deposit');
    const receiptSum = await this.repo.sumReceiptsByTx(tx.id);
    const totalPaid = receiptSum + (depositIncluded ? 0 : tx.deposit_vnd);
    const paidPct = computePaidPct(totalPaid, net);
    await this.repo.updateTxPaidPct(tx.id, paidPct);

    if (isStaffTicketsEnabled()) {
      try {
        await this.tryHdmbGateTickets(tx, tenantId);
        await this.tickets?.autoDoneCollectionSchedule(
          String(tx.tenant_id ?? tenantId ?? ''),
          tx.id,
        );
      } catch (err) {
        this.logger.warn(`ensureSchedule hdmb gate tx=${tx.id}: ${String(err)}`);
      }
    }
  }

  private async tryHdmbGateTickets(tx: TxRow, tenantId?: string): Promise<void> {
    if (!isStaffTicketsEnabled() || !this.tickets) return;
    const gate = await this.getHdmbGate(tx.id, tenantId);
    if (!gate.ready) return;
    const tid = String(tx.tenant_id ?? tenantId ?? '').trim();
    if (!tid) return;
    await this.tickets.maybeCreateHdmbGateTickets(tid, {
      id: tx.id,
      project_id: tx.project_id,
    });
  }

  async tryHdmbGateTicketsForProject(projectId: number, tenantId?: string): Promise<void> {
    if (!isStaffTicketsEnabled() || !this.tickets) return;
    const txs = await this.txRepo.listByProject(projectId);
    for (const tx of txs) {
      if (!['deposit', 'vbtt'].includes(tx.stage)) continue;
      try {
        await this.tryHdmbGateTickets(tx, tenantId);
      } catch (err) {
        this.logger.warn(`project hdmb gate tx=${tx.id}: ${String(err)}`);
      }
    }
  }

  async createReceipt(body: CreateReceiptBody, tenantId?: string): Promise<ReceiptRow> {
    const txId = String(body.transaction_id ?? '').trim();
    if (!txId) throw new BadRequestException({ error: 'transaction_id' });
    if (!Number.isFinite(body.amount_vnd) || body.amount_vnd < 0) {
      throw new BadRequestException({ error: 'amount_vnd' });
    }
    const method = body.method;
    if (!['bank', 'cash', 'loan'].includes(method)) {
      throw new BadRequestException({ error: 'method' });
    }

    const tx = await this.getTxOrThrow(txId, tenantId);
    if (!RECEIPT_STAGES.has(tx.stage)) {
      throw new ConflictException({ error: 'tx_stage' });
    }

    const receiptSum = await this.repo.sumReceiptsByTx(tx.id);
    const depositIncluded = await this.repo.hasReceiptForMilestone(tx.id, 'deposit');
    const paidSoFar = receiptSum + (depositIncluded ? 0 : tx.deposit_vnd);
    assertReceiptWithinBalance(body.amount_vnd, tx.net_price_vnd, paidSoFar);

    const installmentId = String(body.installment_id ?? '').trim() || null;
    if (installmentId) {
      const inst = await this.repo.getInstallment(installmentId);
      if (!inst || inst.transaction_id !== tx.id) throw new NotFoundException();
    }

    const paidAt = body.paid_at ? new Date(body.paid_at) : new Date();
    const receipt = await this.repo.insertReceipt({
      tenant_id: tx.tenant_id,
      transaction_id: tx.id,
      installment_id: installmentId,
      receipt_no: String(body.receipt_no ?? ''),
      amount_vnd: body.amount_vnd,
      paid_at: paidAt,
      method,
      note: String(body.note ?? ''),
      created_by: String(body.created_by ?? ''),
    });

    const totalPaid = paidSoFar + body.amount_vnd;
    await this.repo.updateTxPaidPct(tx.id, computePaidPct(totalPaid, tx.net_price_vnd));

    if (isStaffTicketsEnabled()) {
      try {
        const refreshed = await this.getTxOrThrow(tx.id, tenantId);
        await this.tryHdmbGateTickets(refreshed, tenantId);
      } catch (err) {
        this.logger.warn(`receipt hdmb gate tx=${tx.id}: ${String(err)}`);
      }
    }

    if (installmentId) {
      const inst = await this.repo.getInstallment(installmentId);
      if (inst) {
        const newPaid = inst.paid_vnd + body.amount_vnd;
        const status =
          newPaid >= inst.amount_vnd ? 'paid' : newPaid > 0 ? 'partial' : inst.status;
        await this.repo.updateInstallmentPaid(installmentId, newPaid, status, inst.overdue_days);
      }
    }

    return receipt;
  }

  async listAging(projectId: number, tenantId?: string, now = new Date()): Promise<AgingRow[]> {
    await this.projectOs.listLegalDocs(projectId, tenantId);
    const rows = await this.repo.listOverdueInstallments(projectId, now);
    return rows.map((row) => {
      const overdueDays = daysBetween(row.due_date, now);
      return {
        transaction_id: row.transaction_id,
        installment_id: row.id,
        milestone_code: row.milestone_code,
        due_date: row.due_date,
        amount_vnd: row.amount_vnd,
        paid_vnd: row.paid_vnd,
        overdue_days: overdueDays,
        bucket: agingBucket(overdueDays),
      };
    });
  }

  async upsertMortgage(
    txId: string,
    body: UpsertMortgageBody,
    tenantId?: string,
  ): Promise<MortgageRow> {
    const tx = await this.getTxOrThrow(txId, tenantId);
    const status = body.status ?? 'applying';
    const row = await this.repo.upsertMortgage({
      tenant_id: tx.tenant_id,
      transaction_id: tx.id,
      bank_name: body.bank_name,
      amount_vnd: body.amount_vnd,
      status,
      file_id: body.file_id,
      note: body.note,
    });
    await this.repo.updateTxMortgageStatus(tx.id, status);
    return row;
  }

  async getHdmbGate(txId: string, tenantId?: string, now = new Date()): Promise<HdmbGateStatus> {
    const tx = await this.getTxOrThrow(txId, tenantId);
    const docs = await this.projectOs.listLegalDocs(tx.project_id, tenantId);
    const legal = evaluateHdmbLegalGate({ docs, now });

    let hdmbMin = 30;
    if (tx.policy_id) {
      const policy = await this.policies.get(tx.policy_id, tenantId);
      hdmbMin = Number(policy.hdmb_min_paid_pct ?? 30);
    }

    const paidPct = tx.paid_pct;
    const paidReady = paidPct + 1e-9 >= hdmbMin;
    return {
      legal,
      paid_pct: paidPct,
      hdmb_min_paid_pct: hdmbMin,
      paid_ready: paidReady,
      ready: legal.ready && paidReady,
    };
  }

  async assertCanContract(tx: TxRow, opts: AssertContractOpts = {}): Promise<void> {
    const docs = await this.projectOs.listLegalDocs(tx.project_id, opts.tenantId);
    assertHdmbLegalGate({
      docs,
      now: new Date(),
      buyerWaiveGuarantee: opts.buyerWaiveGuarantee,
      waiveFileId: opts.waiveFileId,
    });

    let minPct = 30;
    if (tx.policy_id) {
      const policy = await this.policies.get(tx.policy_id, opts.tenantId);
      minPct = Number(policy.hdmb_min_paid_pct ?? 30);
    }
    assertHdmbPaidPct(tx.paid_pct, minPct);
  }

  async assertVbttPaidPct(tx: TxRow, tenantId?: string): Promise<void> {
    let minPct = 0;
    if (tx.policy_id) {
      const policy = await this.policies.get(tx.policy_id, tenantId);
      minPct = Number(policy.vbtt_min_paid_pct ?? 0);
    }
    if (minPct > 0 && tx.paid_pct + 1e-9 < minPct) {
      throw new BadRequestException({ error: 'paid_pct' });
    }
  }

  exportReceiptsCsv(
    projectId: number,
    from?: string,
    to?: string,
  ): Promise<string> {
    return this.repo.listReceiptsForExport(projectId, from, to).then((rows) => {
      const header = 'receipt_id,transaction_id,receipt_no,amount_vnd,paid_at,method';
      const lines = rows.map(
        (r) =>
          `${r.id},${r.transaction_id},${JSON.stringify(r.receipt_no)},${r.amount_vnd},${r.paid_at.toISOString()},${r.method}`,
      );
      return [header, ...lines].join('\n');
    });
  }

  private async getTxOrThrow(txId: string, tenantId?: string): Promise<TxRow> {
    const tx = await this.txRepo.getTx(txId);
    if (!tx) throw new NotFoundException();
    const t = String(tenantId ?? '').trim();
    if (t && tx.tenant_id != null && String(tx.tenant_id).trim() !== '' && String(tx.tenant_id) !== t) {
      throw new NotFoundException();
    }
    return tx;
  }
}
