import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { isBdsAgencyEnabled, isBdsProjectOsEnabled } from '../bds.flags';
import { BdsAgencyService } from '../agencies/bds-agency.service';
import { BdsInventoryService } from '../inventory/bds-inventory.service';
import { BdsReProductPgRepository } from '../inventory/bds-re-product-pg.repository';
import { BdsProjectOsService } from '../project-os/bds-project-os.service';
import {
  BdsHoldRepository,
  type HoldRow,
} from './bds-hold.repository';
import { computeExpiresAt, decideHoldActor, initialHoldStatus, ttlMinutes } from './bds-hold.util';

const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

function idempotencyRoute(productId: number): string {
  return `POST /units/${productId}/holds`;
}

export type CreateHoldBody = {
  lead_id: number;
  row_version: number;
  channel_partner_id?: string;
  note?: string;
  requested_by_staff_id?: number;
};

export type CreateHoldOpts = {
  tenantId?: string;
  idempotencyKey?: string;
  now?: Date;
};

@Injectable()
export class BdsHoldService {
  private readonly logger = new Logger(BdsHoldService.name);

  constructor(
    private readonly inventory: BdsInventoryService,
    private readonly products: BdsReProductPgRepository,
    private readonly repo: BdsHoldRepository,
    @Optional() private readonly projectOs?: BdsProjectOsService | null,
    @Optional() private readonly agency?: BdsAgencyService | null,
  ) {}

  async create(productId: number, body: CreateHoldBody, opts: CreateHoldOpts = {}): Promise<HoldRow> {
    if (!Number.isInteger(body.lead_id) || body.lead_id <= 0) {
      throw new BadRequestException({ error: 'lead_id' });
    }
    if (!Number.isFinite(body.row_version)) {
      throw new BadRequestException({ error: 'row_version' });
    }

    const now = opts.now ?? new Date();
    const idempotencyKey = String(opts.idempotencyKey ?? '').trim();
    const route = idempotencyRoute(productId);
    if (idempotencyKey) {
      const existing = await this.repo.getIdempotency(route, idempotencyKey);
      if (existing && existing.created_at.getTime() > now.getTime() - IDEMPOTENCY_WINDOW_MS) {
        return existing.response_json as HoldRow;
      }
    }

    const unit = await this.inventory.getOrThrow(productId, opts.tenantId);
    if (String(unit.status) !== 'available') {
      throw new ConflictException({ error: 'unit_locked' });
    }

    const ctx = (await this.repo.getProjectHoldContext(Number(unit.project_id))) ?? {
      status: '',
      current_phase_id: null,
      settings_json: {},
    };
    const settings = ctx.settings_json ?? {};
    const autoApproveInternal = settings.auto_approve_internal_hold !== false;
    const actor = decideHoldActor(body.channel_partner_id);
    const status = initialHoldStatus(actor, autoApproveInternal);

    if (actor === 'channel') {
      await this.assertChannelPhase(Number(unit.project_id));
    }

    if (isBdsAgencyEnabled() && actor === 'channel') {
      if (!this.agency) throw new NotFoundException();
      await this.agency.assertCanHold(String(body.channel_partner_id ?? ''), productId, opts.tenantId);
    }

    const rawTtl = settings.hold_ttl_minutes;
    const tenantTtl =
      typeof rawTtl === 'number' && Number.isFinite(rawTtl) ? rawTtl : undefined;
    const expiresAt =
      status === 'active' ? computeExpiresAt(now, ttlMinutes(ctx.status, tenantTtl)) : null;

    const unitTenant =
      unit.tenant_id != null && String(unit.tenant_id).trim() !== ''
        ? String(unit.tenant_id)
        : await this.products.resolveProjectTenantId(Number(unit.project_id));

    let hold: HoldRow;
    try {
      hold = await this.repo.insertHold({
        tenant_id: unitTenant,
        project_id: Number(unit.project_id),
        product_id: productId,
        lead_id: body.lead_id,
        requested_by_staff_id: body.requested_by_staff_id ?? null,
        channel_partner_id: body.channel_partner_id,
        status,
        expires_at: expiresAt,
        note: body.note,
      });
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        if (idempotencyKey) {
          const replay = await this.repo.getIdempotency(route, idempotencyKey);
          if (replay) return replay.response_json as HoldRow;
        }
        throw new ConflictException({ error: 'unit_locked' });
      }
      throw err;
    }

    if (status === 'active') {
      try {
        await this.inventory.transition(productId, 'hold', body.row_version, opts.tenantId);
      } catch (err) {
        await this.repo.setHoldStatus(hold.id, 'cancelled', 'conflict');
        if (err instanceof ConflictException) throw err;
        throw new ConflictException({ error: 'unit_locked' });
      }
      await this.products.setHoldPointers(productId, {
        hold_id: hold.id,
        hold_lead_id: body.lead_id,
        hold_at: now.toISOString(),
      });
    }

    if (idempotencyKey) {
      await this.repo.putIdempotency({
        route,
        key: idempotencyKey,
        status_code: 201,
        response_json: hold,
      });
    }

    return hold;
  }

  async approve(holdId: string, approvedBy: string, tenantId?: string): Promise<HoldRow> {
    const hold = await this.getHoldOrThrow(holdId, tenantId);
    if (hold.status !== 'pending') {
      throw new ConflictException({ error: 'hold_closed' });
    }

    const unit = await this.inventory.getOrThrow(hold.product_id, tenantId);
    if (String(unit.status) !== 'available') {
      throw new ConflictException({ error: 'unit_locked' });
    }

    const now = new Date();
    const expiresAt = await this.computeHoldExpiresAt(hold.project_id, now);
    const updated = await this.repo.setHoldStatusIf(
      hold.id,
      'active',
      {
        expires_at: expiresAt,
        approved_by: String(approvedBy ?? ''),
        approved_at: now,
      },
      'pending',
    );
    if (!updated) throw new ConflictException({ error: 'hold_closed' });

    try {
      await this.inventory.transition(
        hold.product_id,
        'hold',
        Number(unit.row_version),
        tenantId,
      );
    } catch (err) {
      await this.repo.setHoldStatus(hold.id, 'cancelled', 'conflict');
      if (err instanceof ConflictException) throw err;
      throw new ConflictException({ error: 'unit_locked' });
    }

    await this.products.setHoldPointers(hold.product_id, {
      hold_id: hold.id,
      hold_lead_id: hold.lead_id,
      hold_at: now.toISOString(),
    });

    return updated;
  }

  async reject(holdId: string, reason: string, tenantId?: string): Promise<HoldRow> {
    const trimmed = String(reason ?? '').trim();
    if (trimmed.length < 3) {
      throw new BadRequestException({ error: 'reason' });
    }

    const hold = await this.getHoldOrThrow(holdId, tenantId);
    if (hold.status !== 'pending') {
      throw new ConflictException({ error: 'hold_closed' });
    }

    const updated = await this.repo.setHoldStatusIf(
      hold.id,
      'rejected',
      { reason: trimmed },
      'pending',
    );
    if (!updated) throw new ConflictException({ error: 'hold_closed' });
    return updated;
  }

  async cancel(holdId: string, reason: string, tenantId?: string): Promise<HoldRow> {
    const trimmed = String(reason ?? '').trim();
    if (trimmed.length < 3) {
      throw new BadRequestException({ error: 'reason' });
    }

    const hold = await this.getHoldOrThrow(holdId, tenantId);
    if (hold.status !== 'pending' && hold.status !== 'active') {
      throw new ConflictException({ error: 'hold_closed' });
    }

    if (hold.status === 'active') {
      const unit = await this.inventory.getOrThrow(hold.product_id, tenantId);
      if (String(unit.status) === 'hold') {
        try {
          await this.inventory.transition(
            hold.product_id,
            'cancel',
            Number(unit.row_version),
            tenantId,
          );
          await this.products.setHoldPointers(hold.product_id, {
            hold_id: null,
            hold_lead_id: null,
            hold_at: '',
          });
        } catch (err) {
          if (err instanceof ConflictException) throw err;
          throw new ConflictException({ error: 'unit_locked' });
        }
      }
    }

    const updated = await this.repo.setHoldStatusIf(
      hold.id,
      'cancelled',
      { reason: trimmed },
      hold.status,
    );
    if (!updated) throw new ConflictException({ error: 'hold_closed' });
    return updated;
  }

  async get(id: string, tenantId?: string): Promise<HoldRow> {
    return this.getHoldOrThrow(id, tenantId);
  }

  async listByProject(projectId: number, tenantId?: string): Promise<HoldRow[]> {
    await this.inventory.listUnits(projectId, tenantId);
    return this.repo.listByProject(projectId);
  }

  async expireDue(now = new Date()): Promise<number> {
    const due = await this.repo.listActiveDue(now);
    let expired = 0;
    for (const hold of due) {
      try {
        const unit = await this.inventory.getOrThrow(hold.product_id);
        if (String(unit.status) === 'hold' && String(unit.hold_id ?? '') === hold.id) {
          try {
            await this.inventory.transition(
              hold.product_id,
              'ttl',
              Number(unit.row_version),
              undefined,
            );
            await this.products.setHoldPointers(hold.product_id, {
              hold_id: null,
              hold_lead_id: null,
              hold_at: '',
            });
          } catch (err) {
            this.logger.warn(
              `expireDue hold ${hold.id}: ${err instanceof Error ? err.message : String(err)}`,
            );
            continue;
          }
        }
        const updated = await this.repo.setHoldStatusIf(hold.id, 'expired', {}, 'active');
        if (updated) expired += 1;
      } catch (err) {
        this.logger.warn(
          `expireDue hold ${hold.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return expired;
  }

  private async getHoldOrThrow(holdId: string, tenantId?: string): Promise<HoldRow> {
    const hold = await this.repo.getHold(holdId);
    if (!hold) throw new NotFoundException();
    const t = String(tenantId ?? '').trim();
    if (t && hold.tenant_id != null && String(hold.tenant_id).trim() !== '' && String(hold.tenant_id) !== t) {
      throw new NotFoundException();
    }
    return hold;
  }

  private async computeHoldExpiresAt(projectId: number, now: Date): Promise<Date> {
    const ctx = (await this.repo.getProjectHoldContext(projectId)) ?? {
      status: '',
      current_phase_id: null,
      settings_json: {},
    };
    const rawTtl = ctx.settings_json?.hold_ttl_minutes;
    const tenantTtl =
      typeof rawTtl === 'number' && Number.isFinite(rawTtl) ? rawTtl : undefined;
    return computeExpiresAt(now, ttlMinutes(ctx.status, tenantTtl));
  }

  private async assertChannelPhase(projectId: number): Promise<void> {
    if (!isBdsProjectOsEnabled()) return;
    const phases = (await this.projectOs?.listPhases(projectId)) ?? [];
    const open = phases.some((p) => p.status === 'active' && p.open_to_channel === true);
    if (!open) {
      throw new BadRequestException({ error: 'phase_closed' });
    }
  }
}
