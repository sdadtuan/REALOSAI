import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { isBdsCommissionEnabled } from '../bds.flags';
import { BdsCommissionService } from '../commission/bds-commission.service';
import { BdsTenantService } from '../tenant/bds-tenant.service';
import { BdsTxRepository } from '../transactions/bds-tx.repository';
import type { TxRow, TxStage } from '../transactions/bds-tx.types';
import { canAdvanceTx } from '../transactions/bds-tx.util';
import { BdsAftersalesRepository } from './bds-aftersales.repository';
import type { AftersalesBoardRow, AftersalesDetail } from './bds-aftersales.types';
import {
  appointmentDue,
  canAdvanceTitle,
  canHandover,
  isCheckStatus,
  isHandoverCheckCode,
  isTicketKind,
  isTicketStatus,
} from './bds-aftersales.util';

const POST_HANDOVER_STAGES = new Set<TxStage>(['handed_over', 'title_issued']);

@Injectable()
export class BdsAftersalesService {
  private readonly logger = new Logger(BdsAftersalesService.name);

  constructor(
    private readonly asRepo: BdsAftersalesRepository,
    private readonly txRepo: BdsTxRepository,
    private readonly tenants: BdsTenantService,
    @Optional() private readonly commission?: BdsCommissionService,
  ) {}

  private async assertTenantNotBroker(tenantId: string): Promise<void> {
    const tenant = await this.tenants.getMe(tenantId);
    if (tenant.mode === 'broker') {
      throw new NotFoundException();
    }
  }

  private async getTxOrThrow(txId: string, tenantId?: string): Promise<TxRow> {
    const row = await this.txRepo.getTx(txId);
    if (!row) {
      throw new NotFoundException();
    }
    if (tenantId && row.tenant_id && row.tenant_id !== tenantId) {
      throw new NotFoundException();
    }
    return row;
  }

  async listBoard(tenantId: string, projectId?: number): Promise<AftersalesBoardRow[]> {
    await this.assertTenantNotBroker(tenantId);
    const rows = await this.asRepo.listBoard(tenantId, projectId);
    return rows.map((row) => ({
      ...row,
      appointment_due: appointmentDue(row.handover_appointment_at),
    }));
  }

  async getDetail(txId: string, tenantId?: string): Promise<AftersalesDetail> {
    if (tenantId) await this.assertTenantNotBroker(tenantId);
    const tx = await this.getTxOrThrow(txId, tenantId);
    const checks = await this.asRepo.listChecks(tx.id);
    const tickets = await this.asRepo.listTickets(tx.id);
    return {
      tx,
      checks,
      tickets,
      appointment_due: appointmentDue(tx.handover_appointment_at),
    };
  }

  async ensureIntake(tx: TxRow): Promise<void> {
    if (tx.stage !== 'contracted') return;
    await this.asRepo.seedChecksIfEmpty(tx.id, tx.tenant_id ?? null);
  }

  async scheduleAppointment(
    txId: string,
    scheduledAtRaw: string,
    tenantId?: string,
  ): Promise<TxRow> {
    if (tenantId) await this.assertTenantNotBroker(tenantId);
    const tx = await this.getTxOrThrow(txId, tenantId);
    if (tx.stage !== 'contracted') {
      throw new ConflictException({ error: 'tx_stage' });
    }
    const scheduledAt = new Date(String(scheduledAtRaw ?? ''));
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException({ error: 'scheduled_at' });
    }
    const updated = await this.txRepo.setStageIf(
      tx.id,
      'contracted',
      { handover_appointment_at: scheduledAt },
      'contracted',
    );
    if (!updated) {
      throw new ConflictException({ error: 'tx_closed' });
    }
    return updated;
  }

  async upsertCheck(
    txId: string,
    body: { item_code?: string; status?: string; note?: string },
    tenantId?: string,
    checkedBy?: number | null,
  ): Promise<import('./bds-aftersales.types').HandoverCheckRow> {
    if (tenantId) await this.assertTenantNotBroker(tenantId);
    const tx = await this.getTxOrThrow(txId, tenantId);
    if (tx.stage !== 'contracted') {
      throw new ConflictException({ error: 'tx_stage' });
    }
    const itemCode = String(body.item_code ?? '').trim();
    const status = String(body.status ?? '').trim();
    if (!isHandoverCheckCode(itemCode)) {
      throw new BadRequestException({ error: 'item_code' });
    }
    if (!isCheckStatus(status)) {
      throw new BadRequestException({ error: 'status' });
    }
    return this.asRepo.upsertCheck({
      tenant_id: tx.tenant_id,
      transaction_id: tx.id,
      item_code: itemCode,
      status,
      note: String(body.note ?? ''),
      checked_by: checkedBy ?? null,
    });
  }

  async handover(
    txId: string,
    body: { waive?: boolean; waive_reason?: string; hasApproveCap?: boolean; waived_by?: number | null },
    tenantId?: string,
  ): Promise<TxRow> {
    if (tenantId) await this.assertTenantNotBroker(tenantId);
    const tx = await this.getTxOrThrow(txId, tenantId);
    if (!canAdvanceTx(tx.stage, 'handed_over')) {
      throw new ConflictException({ error: 'tx_stage' });
    }
    const checks = await this.asRepo.listChecks(tx.id);
    const waive = Boolean(body.waive);
    if (
      !canHandover(checks, {
        waive,
        hasApproveCap: Boolean(body.hasApproveCap),
        waiveReason: body.waive_reason,
      })
    ) {
      throw new BadRequestException({
        error: waive ? 'handover_waive' : 'handover_checklist',
      });
    }
    const now = new Date();
    const extra: Record<string, unknown> = { handover_at: now };
    if (waive) {
      extra.handover_waived_at = now;
      extra.handover_waive_reason = String(body.waive_reason ?? '').trim();
      if (body.waived_by != null) {
        extra.handover_waived_by = body.waived_by;
      }
    }
    const updated = await this.txRepo.setStageIf(tx.id, 'handed_over', extra, tx.stage);
    if (!updated) {
      throw new ConflictException({ error: 'tx_closed' });
    }
    if (isBdsCommissionEnabled()) {
      try {
        await this.commission?.onTxStage(updated, 'handed_over');
      } catch (err) {
        this.logger.warn(`commission handover hook failed tx=${updated.id}: ${String(err)}`);
      }
    }
    return updated;
  }

  async createTicket(
    txId: string,
    body: { kind?: string; title?: string; body?: string },
    tenantId?: string,
    openedBy?: number | null,
  ): Promise<import('./bds-aftersales.types').AftersalesTicketRow> {
    if (tenantId) await this.assertTenantNotBroker(tenantId);
    const tx = await this.getTxOrThrow(txId, tenantId);
    if (!POST_HANDOVER_STAGES.has(tx.stage)) {
      throw new BadRequestException({ error: 'not_handed_over' });
    }
    const kind = String(body.kind ?? 'defect').trim();
    const title = String(body.title ?? '').trim();
    if (!isTicketKind(kind)) {
      throw new BadRequestException({ error: 'kind' });
    }
    if (title.length < 3) {
      throw new BadRequestException({ error: 'title' });
    }
    return this.asRepo.insertTicket({
      tenant_id: tx.tenant_id,
      transaction_id: tx.id,
      kind,
      title,
      body: String(body.body ?? ''),
      opened_by: openedBy ?? null,
    });
  }

  async patchTicket(
    ticketId: string,
    status: string,
    tenantId?: string,
  ): Promise<import('./bds-aftersales.types').AftersalesTicketRow> {
    if (tenantId) await this.assertTenantNotBroker(tenantId);
    if (!isTicketStatus(status)) {
      throw new BadRequestException({ error: 'status' });
    }
    const updated = await this.asRepo.updateTicketStatus(ticketId, status, tenantId);
    if (!updated) {
      throw new NotFoundException();
    }
    return updated;
  }

  async setTitle(txId: string, toStatus: string, tenantId?: string): Promise<TxRow> {
    if (tenantId) await this.assertTenantNotBroker(tenantId);
    const tx = await this.getTxOrThrow(txId, tenantId);
    const from = tx.title_status ?? 'not_started';
    if (!canAdvanceTitle(from, toStatus)) {
      throw new BadRequestException({ error: 'title_status' });
    }

    if (toStatus === 'issued') {
      if (tx.stage !== 'handed_over' && tx.stage !== 'title_issued') {
        throw new BadRequestException({ error: 'title_status' });
      }
      if (tx.stage === 'handed_over') {
        const updated = await this.txRepo.setStageIf(
          tx.id,
          'title_issued',
          { title_status: 'issued', title_issued_at: new Date() },
          'handed_over',
        );
        if (!updated) throw new ConflictException({ error: 'tx_closed' });
        return updated;
      }
      const updated = await this.txRepo.setStageIf(
        tx.id,
        'title_issued',
        { title_status: 'issued', title_issued_at: tx.title_issued_at ?? new Date() },
        'title_issued',
      );
      if (!updated) throw new ConflictException({ error: 'tx_closed' });
      return updated;
    }

    if (toStatus === 'handed_to_buyer') {
      if (tx.stage !== 'title_issued') {
        throw new BadRequestException({ error: 'title_status' });
      }
      const updated = await this.txRepo.setStageIf(
        tx.id,
        'title_issued',
        { title_status: 'handed_to_buyer' },
        'title_issued',
      );
      if (!updated) throw new ConflictException({ error: 'tx_closed' });
      return updated;
    }

    if (tx.stage !== 'contracted' && tx.stage !== 'handed_over' && tx.stage !== 'title_issued') {
      throw new BadRequestException({ error: 'title_status' });
    }
    const updated = await this.txRepo.setStageIf(
      tx.id,
      tx.stage,
      { title_status: 'submitted' },
      tx.stage,
    );
    if (!updated) throw new ConflictException({ error: 'tx_closed' });
    return updated;
  }
}
