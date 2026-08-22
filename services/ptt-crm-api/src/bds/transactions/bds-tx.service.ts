import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { isBdsCollectionEnabled, isBdsCommissionEnabled } from '../bds.flags';
import { BdsCollectionService } from '../collection/bds-collection.service';
import { BdsCapiHookService } from '../commission/bds-capi-hook.service';
import { BdsCommissionService } from '../commission/bds-commission.service';
import { BdsHoldRepository, type HoldRow } from '../hold/bds-hold.repository';
import { BdsInventoryService } from '../inventory/bds-inventory.service';
import { BdsReProductPgRepository } from '../inventory/bds-re-product-pg.repository';
import {
  assertDiscountAllowed,
  assertOnePrice,
  computeNetFromCsBh,
} from '../policies/bds-policy.util';
import { BdsPolicyService } from '../policies/bds-policy.service';
import { BdsTxRepository } from './bds-tx.repository';
import type { TxRow } from './bds-tx.types';
import {
  assertDepositMin,
  canAdvanceTx,
  decideTxChannel,
  unitEventForCancel,
  unitEventForConvert,
  unitEventForContract,
  unitEventForReservation,
} from './bds-tx.util';

const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

function convertDepositRoute(holdId: string): string {
  return `POST /holds/${holdId}/convert-deposit`;
}

function reservationRoute(holdId: string): string {
  return `POST /holds/${holdId}/reservation`;
}

export type ConvertDepositBody = {
  deposit_vnd: number;
  policy_id: string;
  row_version: number;
  list_price_vnd?: number;
  discount_pct?: number;
  discount_approved?: boolean;
  net_price_vnd?: number;
};

export type ConvertOpts = {
  tenantId?: string;
  idempotencyKey?: string;
  now?: Date;
};

export type ReservationBody = {
  reservation_fee_vnd: number;
  row_version: number;
};

export type VbttBody = {
  vbtt_no: string;
};

export type ContractBody = {
  contract_no: string;
  row_version: number;
  buyer_waive_guarantee?: boolean;
  waive_file_id?: string;
};

@Injectable()
export class BdsTxService {
  private readonly logger = new Logger(BdsTxService.name);

  constructor(
    private readonly repo: BdsTxRepository,
    private readonly holds: BdsHoldRepository,
    private readonly inventory: BdsInventoryService,
    private readonly products: BdsReProductPgRepository,
    private readonly policies: BdsPolicyService,
    @Optional() private readonly collection?: BdsCollectionService | null,
    @Optional() private readonly commission?: BdsCommissionService | null,
    @Optional() private readonly capi?: BdsCapiHookService | null,
  ) {}

  async convertDeposit(
    holdId: string,
    body: ConvertDepositBody,
    opts: ConvertOpts = {},
  ): Promise<TxRow> {
    const now = opts.now ?? new Date();
    const idempotencyKey = String(opts.idempotencyKey ?? '').trim();
    const route = convertDepositRoute(holdId);

    if (idempotencyKey) {
      const existing = await this.repo.getIdempotency(route, idempotencyKey);
      if (existing && existing.created_at.getTime() > now.getTime() - IDEMPOTENCY_WINDOW_MS) {
        return existing.response_json as TxRow;
      }
    }

    if (!Number.isFinite(body.deposit_vnd)) {
      throw new BadRequestException({ error: 'deposit_vnd' });
    }
    if (!Number.isFinite(body.row_version)) {
      throw new BadRequestException({ error: 'row_version' });
    }
    const policyId = String(body.policy_id ?? '').trim();
    if (!policyId) {
      throw new BadRequestException({ error: 'policy_id' });
    }

    const hold = await this.getHoldOrThrow(holdId, opts.tenantId);
    const openTx = await this.repo.getOpenByProduct(hold.product_id);
    const fromReservation =
      openTx?.stage === 'reservation' && openTx.hold_id === hold.id;

    if (!fromReservation && hold.status !== 'active') {
      throw new ConflictException({ error: 'hold_closed' });
    }

    const unit = await this.inventory.getOrThrow(hold.product_id, opts.tenantId);
    try {
      unitEventForConvert(String(unit.status));
    } catch (e) {
      const err = e as { error?: string };
      if (err?.error) throw new ConflictException({ error: err.error });
      throw e;
    }

    const policy = await this.policies.get(policyId, opts.tenantId);
    if (policy.project_id !== hold.project_id) {
      throw new NotFoundException();
    }

    try {
      assertDepositMin(body.deposit_vnd, policy.deposit_min_vnd);
    } catch (e) {
      this.throwBadRequest(e);
    }

    const listPrice = body.list_price_vnd ?? Number(unit.list_price_vnd ?? 0);
    const discountPct = body.discount_pct ?? 0;
    try {
      assertDiscountAllowed(policy.discount_cap_pct, discountPct, !!body.discount_approved);
    } catch (e) {
      this.throwBadRequest(e);
    }

    const net = computeNetFromCsBh(listPrice, discountPct);
    const discountVnd = Math.round(listPrice - net);

    if (body.net_price_vnd != null && Number.isFinite(body.net_price_vnd)) {
      const onePrice = (await this.repo.getProjectOnePrice(hold.project_id)) ?? true;
      try {
        assertOnePrice(onePrice, listPrice, discountPct, body.net_price_vnd);
      } catch (e) {
        this.throwBadRequest(e);
      }
    }

    const tenantId =
      hold.tenant_id != null && String(hold.tenant_id).trim() !== ''
        ? String(hold.tenant_id)
        : unit.tenant_id != null && String(unit.tenant_id).trim() !== ''
          ? String(unit.tenant_id)
          : await this.repo.resolveProjectTenantId(hold.project_id);

    const depositExtras = {
      deposit_vnd: body.deposit_vnd,
      deposit_paid_at: now,
      list_price_vnd: listPrice,
      net_price_vnd: net,
      discount_vnd: discountVnd,
      policy_id: policyId,
    };

    let tx: TxRow;

    if (fromReservation && openTx) {
      const updated = await this.repo.setStageIf(
        openTx.id,
        'deposit',
        depositExtras,
        'reservation',
      );
      if (!updated) {
        throw new ConflictException({ error: 'tx_closed' });
      }
      tx = updated;
    } else {
      try {
        tx = await this.repo.insertTx({
          tenant_id: tenantId,
          project_id: hold.project_id,
          product_id: hold.product_id,
          hold_id: hold.id,
          lead_id: hold.lead_id,
          policy_id: policyId,
          channel_partner_id: hold.channel_partner_id,
          stage: 'deposit',
          channel: decideTxChannel(hold.channel_partner_id),
          list_price_vnd: listPrice,
          net_price_vnd: net,
          discount_vnd: discountVnd,
          deposit_vnd: body.deposit_vnd,
          deposit_paid_at: now,
        });
      } catch (err) {
        if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
          throw new ConflictException({ error: 'tx_open' });
        }
        throw err;
      }
    }

    try {
      await this.inventory.transition(
        hold.product_id,
        unitEventForConvert(String(unit.status)),
        body.row_version,
        opts.tenantId,
      );
    } catch (err) {
      if (!fromReservation) {
        await this.repo.setStageIf(tx.id, 'cancelled', { lost_reason: 'conflict' }, 'deposit');
      }
      if (err instanceof ConflictException) throw err;
      throw new ConflictException({ error: 'unit_locked' });
    }

    if (!fromReservation) {
      const converted = await this.holds.setHoldStatusIf(hold.id, 'converted', {}, 'active');
      if (!converted) {
        const unitAfter = await this.inventory.getOrThrow(hold.product_id, opts.tenantId);
        if (String(unitAfter.status) === 'booked') {
          try {
            await this.inventory.transition(
              hold.product_id,
              'cancel',
              Number(unitAfter.row_version),
              opts.tenantId,
            );
          } catch (cancelErr) {
            this.logger.warn(
              `convertDeposit rollback unit ${hold.product_id}: ${cancelErr instanceof Error ? cancelErr.message : String(cancelErr)}`,
            );
          }
        }
        await this.repo.setStageIf(tx.id, 'cancelled', { lost_reason: 'conflict' }, 'deposit');
        throw new ConflictException({ error: 'hold_closed' });
      }
    }

    if (idempotencyKey) {
      await this.repo.putIdempotency({
        route,
        key: idempotencyKey,
        status_code: 201,
        response_json: tx,
      });
    }

    if (isBdsCollectionEnabled()) {
      if (!this.collection) throw new NotFoundException();
      await this.collection.ensureScheduleForTx(tx.id, opts.tenantId, now);
    }

    return tx;
  }

  async reservation(
    holdId: string,
    body: ReservationBody,
    opts: ConvertOpts = {},
  ): Promise<TxRow> {
    const now = opts.now ?? new Date();
    const idempotencyKey = String(opts.idempotencyKey ?? '').trim();
    const route = reservationRoute(holdId);

    if (idempotencyKey) {
      const existing = await this.repo.getIdempotency(route, idempotencyKey);
      if (existing && existing.created_at.getTime() > now.getTime() - IDEMPOTENCY_WINDOW_MS) {
        return existing.response_json as TxRow;
      }
    }

    if (!Number.isFinite(body.reservation_fee_vnd) || body.reservation_fee_vnd <= 0) {
      throw new BadRequestException({ error: 'reservation_fee_vnd' });
    }
    if (!Number.isFinite(body.row_version)) {
      throw new BadRequestException({ error: 'row_version' });
    }

    const hold = await this.getHoldOrThrow(holdId, opts.tenantId);
    if (hold.status !== 'active') {
      throw new ConflictException({ error: 'hold_closed' });
    }

    const unit = await this.inventory.getOrThrow(hold.product_id, opts.tenantId);
    if (String(unit.status) !== 'hold') {
      throw new ConflictException({ error: 'unit_locked' });
    }

    const tenantId =
      hold.tenant_id != null && String(hold.tenant_id).trim() !== ''
        ? String(hold.tenant_id)
        : unit.tenant_id != null && String(unit.tenant_id).trim() !== ''
          ? String(unit.tenant_id)
          : await this.repo.resolveProjectTenantId(hold.project_id);

    let tx: TxRow;
    try {
      tx = await this.repo.insertTx({
        tenant_id: tenantId,
        project_id: hold.project_id,
        product_id: hold.product_id,
        hold_id: hold.id,
        lead_id: hold.lead_id,
        stage: 'reservation',
        channel: decideTxChannel(hold.channel_partner_id),
        channel_partner_id: hold.channel_partner_id,
        list_price_vnd: Number(unit.list_price_vnd ?? 0),
        reservation_fee_vnd: body.reservation_fee_vnd,
        reservation_paid_at: now,
      });
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw new ConflictException({ error: 'tx_open' });
      }
      throw err;
    }

    try {
      await this.inventory.transition(
        hold.product_id,
        unitEventForReservation(),
        body.row_version,
        opts.tenantId,
      );
    } catch (err) {
      await this.repo.setStageIf(tx.id, 'cancelled', { lost_reason: 'conflict' }, 'reservation');
      if (err instanceof ConflictException) throw err;
      throw new ConflictException({ error: 'unit_locked' });
    }

    const converted = await this.holds.setHoldStatusIf(hold.id, 'converted', {}, 'active');
    if (!converted) {
      const unitAfter = await this.inventory.getOrThrow(hold.product_id, opts.tenantId);
      if (String(unitAfter.status) === 'reserved') {
        try {
          await this.inventory.transition(
            hold.product_id,
            'cancel',
            Number(unitAfter.row_version),
            opts.tenantId,
          );
        } catch (cancelErr) {
          this.logger.warn(
            `reservation rollback unit ${hold.product_id}: ${cancelErr instanceof Error ? cancelErr.message : String(cancelErr)}`,
          );
        }
      }
      await this.repo.setStageIf(tx.id, 'cancelled', { lost_reason: 'conflict' }, 'reservation');
      throw new ConflictException({ error: 'hold_closed' });
    }

    if (idempotencyKey) {
      await this.repo.putIdempotency({
        route,
        key: idempotencyKey,
        status_code: 201,
        response_json: tx,
      });
    }

    return tx;
  }

  async vbtt(txId: string, body: VbttBody, tenantId?: string): Promise<TxRow> {
    const vbttNo = String(body.vbtt_no ?? '').trim();
    if (!vbttNo) {
      throw new BadRequestException({ error: 'vbtt_no' });
    }

    const tx = await this.getTxOrThrow(txId, tenantId);
    if (!canAdvanceTx(tx.stage, 'vbtt')) {
      throw new ConflictException({ error: 'tx_stage' });
    }

    if (isBdsCollectionEnabled()) {
      if (!this.collection) throw new NotFoundException();
      await this.collection.assertVbttPaidPct(tx, tenantId);
    }

    const now = new Date();
    const updated = await this.repo.setStageIf(
      tx.id,
      'vbtt',
      { vbtt_no: vbttNo, vbtt_at: now },
      tx.stage,
    );
    if (!updated) {
      throw new ConflictException({ error: 'tx_closed' });
    }
    if (isBdsCommissionEnabled()) {
      try {
        await this.commission?.onTxStage(updated, 'vbtt');
      } catch (err) {
        this.logger.warn(`commission vbtt hook failed tx=${updated.id}: ${String(err)}`);
      }
    }
    return updated;
  }

  async contract(txId: string, body: ContractBody, tenantId?: string): Promise<TxRow> {
    const contractNo = String(body.contract_no ?? '').trim();
    if (!contractNo) {
      throw new BadRequestException({ error: 'contract_no' });
    }
    if (!Number.isFinite(body.row_version)) {
      throw new BadRequestException({ error: 'row_version' });
    }

    const tx = await this.getTxOrThrow(txId, tenantId);
    if (!canAdvanceTx(tx.stage, 'contracted')) {
      throw new ConflictException({ error: 'tx_stage' });
    }

    const unit = await this.inventory.getOrThrow(tx.product_id, tenantId);
    if (String(unit.status) !== 'booked') {
      throw new ConflictException({ error: 'unit_locked' });
    }

    if (isBdsCollectionEnabled()) {
      if (!this.collection) throw new NotFoundException();
      await this.collection.assertCanContract(tx, {
        tenantId,
        buyerWaiveGuarantee: body.buyer_waive_guarantee,
        waiveFileId: body.waive_file_id,
      });
    }

    try {
      await this.inventory.transition(
        tx.product_id,
        unitEventForContract(),
        body.row_version,
        tenantId,
      );
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      throw new ConflictException({ error: 'unit_locked' });
    }

    const now = new Date();
    const updated = await this.repo.setStageIf(
      tx.id,
      'contracted',
      { contract_no: contractNo, contracted_at: now },
      tx.stage,
    );
    if (!updated) {
      this.logger.warn(`contract setStageIf miss after sold tx=${tx.id}`);
      throw new ConflictException({ error: 'tx_closed' });
    }
    if (isBdsCommissionEnabled()) {
      try {
        await this.commission?.onTxStage(updated, 'contracted');
      } catch (err) {
        this.logger.warn(`commission contract hook failed tx=${updated.id}: ${String(err)}`);
      }
    }
    try {
      await this.capi?.onPurchase(updated);
    } catch (err) {
      this.logger.warn(`capi purchase hook failed tx=${updated.id}: ${String(err)}`);
    }
    return updated;
  }

  async cancel(txId: string, reason: string, tenantId?: string): Promise<TxRow> {
    const trimmed = String(reason ?? '').trim();
    if (trimmed.length < 3) {
      throw new BadRequestException({ error: 'reason' });
    }

    const tx = await this.getTxOrThrow(txId, tenantId);
    if (!canAdvanceTx(tx.stage, 'cancelled')) {
      throw new ConflictException({ error: 'tx_closed' });
    }

    const unit = await this.inventory.getOrThrow(tx.product_id, tenantId);
    const unitStatus = String(unit.status);

    if (unitStatus === 'reserved' || unitStatus === 'booked') {
      try {
        unitEventForCancel(unitStatus);
        await this.inventory.transition(
          tx.product_id,
          'cancel',
          Number(unit.row_version),
          tenantId,
        );
      } catch (err) {
        if (err instanceof ConflictException) throw err;
        throw new ConflictException({ error: 'unit_locked' });
      }
      await this.products.setHoldPointers(tx.product_id, {
        hold_id: null,
        hold_lead_id: null,
        hold_at: '',
      });
    }

    const updated = await this.repo.setStageIf(
      tx.id,
      'cancelled',
      { lost_reason: trimmed },
      tx.stage,
    );
    if (!updated) {
      throw new ConflictException({ error: 'tx_closed' });
    }
    if (isBdsCommissionEnabled()) {
      try {
        await this.commission?.onTxCancelled(updated);
      } catch (err) {
        this.logger.warn(`commission cancel hook failed tx=${updated.id}: ${String(err)}`);
      }
    }
    return updated;
  }

  async cancelLaunchReservations(projectId: number, tenantId?: string): Promise<number> {
    const rows = await this.repo.listReservationByProject(projectId, tenantId);
    let cancelled = 0;
    for (const tx of rows) {
      try {
        const unit = await this.inventory.getOrThrow(tx.product_id, tenantId);
        if (String(unit.status) === 'reserved') {
          try {
            unitEventForCancel(String(unit.status));
            await this.inventory.transition(
              tx.product_id,
              'cancel',
              Number(unit.row_version),
              tenantId,
            );
            await this.products.setHoldPointers(tx.product_id, {
              hold_id: null,
              hold_lead_id: null,
              hold_at: '',
            });
          } catch (err) {
            this.logger.warn(
              `cancelLaunchReservations unit ${tx.product_id}: ${String(err)}`,
            );
          }
        }
        const updated = await this.repo.setStageIf(
          tx.id,
          'cancelled',
          { lost_reason: 'launch_window' },
          'reservation',
        );
        if (updated) cancelled += 1;
      } catch (err) {
        this.logger.warn(`cancelLaunchReservations tx=${tx.id}: ${String(err)}`);
      }
    }
    return cancelled;
  }

  async get(id: string, tenantId?: string): Promise<TxRow> {
    return this.getTxOrThrow(id, tenantId);
  }

  async listByProject(projectId: number, tenantId?: string): Promise<TxRow[]> {
    await this.inventory.listUnits(projectId, tenantId);
    return this.repo.listByProject(projectId);
  }

  private async getHoldOrThrow(holdId: string, tenantId?: string): Promise<HoldRow> {
    const hold = await this.holds.getHold(holdId);
    if (!hold) throw new NotFoundException();
    const t = String(tenantId ?? '').trim();
    if (t && hold.tenant_id != null && String(hold.tenant_id).trim() !== '' && String(hold.tenant_id) !== t) {
      throw new NotFoundException();
    }
    return hold;
  }

  private async getTxOrThrow(txId: string, tenantId?: string): Promise<TxRow> {
    const tx = await this.repo.getTx(txId);
    if (!tx) throw new NotFoundException();
    const t = String(tenantId ?? '').trim();
    if (t && tx.tenant_id != null && String(tx.tenant_id).trim() !== '' && String(tx.tenant_id) !== t) {
      throw new NotFoundException();
    }
    return tx;
  }

  private throwBadRequest(err: unknown): never {
    if (err && typeof err === 'object' && (err as { error?: string }).error) {
      throw new BadRequestException(err);
    }
    throw err;
  }
}
