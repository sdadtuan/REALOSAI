import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { isStaffChatEnabled } from '../../staff-chat/staff-chat.flags';
import { StaffChatService } from '../../staff-chat/staff-chat.service';
import { isStaffTicketsLaunchOpsEnabled } from '../../staff-tickets/staff-ticket.flags';
import { StaffTicketService } from '../../staff-tickets/staff-ticket.service';
import { BdsHoldService } from '../hold/bds-hold.service';
import { BdsProjectOsService } from '../project-os/bds-project-os.service';
import { BdsTenantService } from '../tenant/bds-tenant.service';
import { BdsTxService } from '../transactions/bds-tx.service';
import { BdsLaunchRepository } from './bds-launch.repository';
import type {
  CreateLaunchInput,
  EnqueueConflictInput,
  LaunchRow,
  PromoteNextOpts,
  QueueRow,
  WarRoomResponse,
} from './bds-launch.types';
import { DEFAULT_HOLD_TTL_SECONDS, canCloseLaunch, canOpenLaunch, ttlRemainingSec } from './bds-launch.util';

function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === '23505');
}

function parseOptDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class BdsLaunchService {
  private readonly logger = new Logger(BdsLaunchService.name);

  constructor(
    private readonly repo: BdsLaunchRepository,
    private readonly tenants: BdsTenantService,
    @Optional() private readonly projectOs?: BdsProjectOsService | null,
    @Optional() private readonly txs?: BdsTxService | null,
    @Optional() @Inject(forwardRef(() => BdsHoldService)) private readonly holds?: BdsHoldService | null,
    @Optional() private readonly chat?: StaffChatService | null,
    @Optional() private readonly tickets?: StaffTicketService | null,
  ) {}

  private async assertNotBroker(tenantId: string): Promise<void> {
    const tenant = await this.tenants.getMe(tenantId);
    if (tenant.mode === 'broker') {
      throw new NotFoundException();
    }
  }

  private assertTenant(row: LaunchRow, tenantId?: string): void {
    const t = String(tenantId ?? '').trim();
    if (t && row.tenant_id != null && String(row.tenant_id).trim() !== '' && String(row.tenant_id) !== t) {
      throw new NotFoundException();
    }
  }

  private async getOrThrow(id: string, tenantId?: string): Promise<LaunchRow> {
    const row = await this.repo.getById(id);
    if (!row) throw new NotFoundException();
    this.assertTenant(row, tenantId);
    return row;
  }

  async create(input: CreateLaunchInput, tenantId: string): Promise<LaunchRow> {
    await this.assertNotBroker(tenantId);
    const projectId = Number(input.project_id);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      throw new BadRequestException({ error: 'project_id' });
    }

    let holdTtl = DEFAULT_HOLD_TTL_SECONDS;
    if (input.hold_ttl_seconds != null) {
      const raw = Number(input.hold_ttl_seconds);
      if (!Number.isFinite(raw) || raw <= 0 || raw > 86400) {
        throw new BadRequestException({ error: 'hold_ttl_seconds' });
      }
      holdTtl = Math.round(raw);
    }

    let phaseId = input.phase_id ? String(input.phase_id).trim() : '';
    if (phaseId === '') phaseId = '';
    let priceListId = input.price_list_id == null ? null : Number(input.price_list_id);

    if (phaseId) {
      const phase = await this.projectOs?.getPhase(phaseId, tenantId);
      if (!phase || Number(phase.project_id) !== projectId) {
        throw new NotFoundException();
      }
      if (priceListId == null && phase.price_list_id != null) {
        priceListId = Number(phase.price_list_id);
      }
    }

    return this.repo.insert({
      tenant_id: tenantId,
      project_id: projectId,
      phase_id: phaseId || null,
      starts_at: parseOptDate(input.starts_at),
      ends_at: parseOptDate(input.ends_at),
      hold_ttl_seconds: holdTtl,
      price_list_id: priceListId != null && Number.isFinite(priceListId) ? priceListId : null,
    });
  }

  async open(id: string, tenantId: string): Promise<LaunchRow> {
    await this.assertNotBroker(tenantId);
    const row = await this.getOrThrow(id, tenantId);
    if (!canOpenLaunch(row.status)) {
      throw new ConflictException({ error: 'launch_status' });
    }

    const other = await this.repo.getOpenByProject(row.project_id);
    if (other && other.id !== row.id) {
      throw new ConflictException({ error: 'launch_open' });
    }

    let priceListId = row.price_list_id;
    if (priceListId == null && row.phase_id && this.projectOs) {
      try {
        const phase = await this.projectOs.getPhase(row.phase_id, tenantId);
        if (phase && Number(phase.project_id) === row.project_id && phase.price_list_id != null) {
          priceListId = Number(phase.price_list_id);
        }
      } catch (err) {
        this.logger.warn(`open snapshot phase ${row.phase_id}: ${String(err)}`);
      }
    }

    let updated: LaunchRow | null;
    try {
      updated = await this.repo.setStatusIf(
        row.id,
        'open',
        { opened_at: new Date(), price_list_id: priceListId },
        'draft',
      );
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException({ error: 'launch_open' });
      }
      throw err;
    }
    if (!updated) {
      throw new ConflictException({ error: 'launch_status' });
    }
    if (isStaffChatEnabled()) {
      try {
        await this.chat?.ensureLaunchHuddle({
          tenantId,
          launchId: updated.id,
          projectId: updated.project_id,
          expiresAt: updated.ends_at,
        });
      } catch (err) {
        this.logger.warn(`ensureLaunchHuddle ${updated.id}: ${String(err)}`);
      }
    }
    if (isStaffTicketsLaunchOpsEnabled()) {
      try {
        await this.tickets?.createHandoffTicket(tenantId, {
          queue_code: 'ops_action',
          title: `Launch mở · dự án ${updated.project_id}`,
          body: updated.id,
          entity_type: 'launch',
          entity_id: updated.id,
          requester_dept_code: 'ban_kd',
          project_id: updated.project_id,
        });
      } catch (err) {
        this.logger.warn(`launch ops_action ${updated.id}: ${String(err)}`);
      }
    }
    return updated;
  }

  async close(id: string, tenantId: string): Promise<LaunchRow> {
    await this.assertNotBroker(tenantId);
    const row = await this.getOrThrow(id, tenantId);
    if (!canCloseLaunch(row.status)) {
      throw new ConflictException({ error: 'launch_status' });
    }

    const updated = await this.repo.setStatusIf(row.id, 'closed', { closed_at: new Date() }, 'open');
    if (!updated) {
      throw new ConflictException({ error: 'launch_status' });
    }

    try {
      await this.txs?.cancelLaunchReservations(row.project_id, tenantId);
    } catch (err) {
      this.logger.warn(`cancelLaunchReservations ${row.project_id}: ${String(err)}`);
    }
    if (isStaffChatEnabled()) {
      try {
        await this.chat?.archiveLaunchHuddle(tenantId, row.id);
      } catch (err) {
        this.logger.warn(`archiveLaunchHuddle ${row.id}: ${String(err)}`);
      }
    }
    return updated;
  }

  async list(tenantId: string, projectId?: number): Promise<LaunchRow[]> {
    await this.assertNotBroker(tenantId);
    return this.repo.listByTenant(tenantId, projectId);
  }

  async get(id: string, tenantId: string): Promise<LaunchRow> {
    await this.assertNotBroker(tenantId);
    return this.getOrThrow(id, tenantId);
  }

  async warRoom(id: string, tenantId: string): Promise<WarRoomResponse> {
    await this.assertNotBroker(tenantId);
    const launch = await this.getOrThrow(id, tenantId);
    const [holds, queues, conflicts] = await Promise.all([
      this.repo.listActiveHoldsForProject(launch.project_id),
      this.repo.listWaiting(launch.id),
      this.repo.countWaitingByProduct(launch.id),
    ]);
    const now = new Date();
    return {
      launch,
      holds: holds.map((h) => ({
        hold_id: h.id,
        product_id: h.product_id,
        lead_id: h.lead_id,
        status: h.status,
        expires_at: h.expires_at,
        ttl_remaining_sec: ttlRemainingSec(h.expires_at, now),
      })),
      queues,
      conflicts,
    };
  }

  async enqueueOnConflict(projectId: number, input: EnqueueConflictInput): Promise<QueueRow | null> {
    const open = await this.repo.getOpenByProject(projectId);
    if (!open) return null;
    if (!Number.isInteger(input.lead_id) || input.lead_id <= 0) return null;
    if (!Number.isInteger(input.product_id) || input.product_id <= 0) return null;
    return this.repo.enqueue({
      tenant_id: input.tenant_id ?? open.tenant_id,
      launch_id: open.id,
      product_id: input.product_id,
      lead_id: input.lead_id,
      requested_by_staff_id: input.requested_by_staff_id ?? null,
      channel_partner_id: String(input.channel_partner_id ?? ''),
    });
  }

  async promoteNext(
    projectId: number,
    productId: number,
    opts: PromoteNextOpts,
  ): Promise<unknown | null> {
    const open = await this.repo.getOpenByProject(projectId);
    if (!open) return null;
    const waiting = await this.repo.peekWaiting(open.id, productId);
    if (!waiting) return null;
    if (!this.holds) return null;

    const hold = await this.holds.create(
      productId,
      {
        lead_id: waiting.lead_id,
        row_version: opts.row_version,
        channel_partner_id: waiting.channel_partner_id || undefined,
        requested_by_staff_id: waiting.requested_by_staff_id ?? undefined,
      },
      { tenantId: opts.tenantId },
    );
    await this.repo.setQueueStatusIf(waiting.id, 'promoted', 'waiting');
    return hold;
  }
}
