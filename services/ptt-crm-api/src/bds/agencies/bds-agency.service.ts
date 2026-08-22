import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BdsInventoryService } from '../inventory/bds-inventory.service';
import { BdsPolicyService } from '../policies/bds-policy.service';
import {
  assertDiscountAllowed,
  assertOnePrice,
  computeNetFromCsBh,
} from '../policies/bds-policy.util';
import { BdsAgencyRepository } from './bds-agency.repository';
import type {
  AgencyKind,
  AgencyRow,
  BasketUnitRow,
  ContractRow,
  TierRow,
} from './bds-agency.types';
import {
  assertExclusiveAllowed,
  assertHoldQuota,
  canActivateAgency,
  canGrantExclusive,
  canHoldAgencyStatus,
  canOverrideTier,
  isInhousePool,
  parentKindAllowsF2,
  REVOKE_REASONS,
} from './bds-agency.util';

export type CreateAgencyBody = {
  code: string;
  name?: string;
  kind?: AgencyKind;
  parent_agency_id?: string;
  legal_name?: string;
  tax_id?: string;
};

export type CreateContractBody = {
  project_id: number;
  max_concurrent_holds?: number | null;
};

export type OverrideTierBody = {
  tier_code: string;
  actor_role: string;
  reason: string;
  until?: string;
};

export type GrantUnitsBody = {
  project_id: number;
  product_ids: number[];
  exclusivity?: 'exclusive' | 'shared';
  actor_role?: string;
  granted_by?: string;
};

export type QuoteBody = {
  list_price_vnd: number;
  discount_pct: number;
  net_price_vnd?: number;
  policy_id: string;
  discount_approved?: boolean;
};

@Injectable()
export class BdsAgencyService {
  constructor(
    private readonly repo: BdsAgencyRepository,
    private readonly inventory: BdsInventoryService,
    private readonly policies: BdsPolicyService,
  ) {}

  async seedTiers(tenantId?: string): Promise<TierRow[]> {
    return this.repo.ensureTiers(this.optionalTenant(tenantId));
  }

  async create(body: CreateAgencyBody, tenantId?: string): Promise<AgencyRow> {
    const code = String(body.code ?? '').trim();
    if (!code) throw new BadRequestException({ error: 'code' });

    const kind = (body.kind ?? 'f1') as AgencyKind;
    if (kind === 'f2') {
      const parentId = String(body.parent_agency_id ?? '').trim();
      if (!parentId) throw new BadRequestException({ error: 'parent_agency_id' });
      const parent = await this.repo.getAgency(parentId);
      if (!parent || !parentKindAllowsF2(parent.kind)) {
        throw new BadRequestException({ error: 'parent_agency_id' });
      }
      this.assertAgencyTenant(parent, tenantId);
    }

    try {
      return await this.repo.insertAgency({
        tenant_id: this.optionalTenant(tenantId),
        code,
        name: body.name,
        legal_name: body.legal_name,
        tax_id: body.tax_id,
        kind,
        parent_agency_id: body.parent_agency_id ?? null,
        status: 'prospect',
      });
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw new ConflictException({ error: 'code' });
      }
      throw err;
    }
  }

  async activate(id: string, actorRole: string, tenantId?: string): Promise<AgencyRow> {
    if (!canActivateAgency(actorRole)) throw new ForbiddenException();

    const agency = await this.getAgencyOrThrow(id, tenantId);
    await this.repo.ensureTiers(agency.tenant_id);
    const trial = await this.repo.getTierByCode(agency.tenant_id, 'trial');
    if (!trial) throw new NotFoundException();

    const updated = await this.repo.setAgencyStatusIf(
      agency.id,
      'active',
      { tier_id: trial.id },
      ['prospect', 'onboarding'],
    );
    if (!updated) throw new ConflictException({ error: 'agency_closed' });
    return updated;
  }

  async suspend(id: string, tenantId?: string): Promise<AgencyRow> {
    const agency = await this.getAgencyOrThrow(id, tenantId);
    const updated = await this.repo.setAgencyStatusIf(
      agency.id,
      'suspended',
      {},
      ['active', 'probation'],
    );
    if (!updated) throw new ConflictException({ error: 'agency_closed' });
    return updated;
  }

  async createContract(
    agencyId: string,
    body: CreateContractBody,
    tenantId?: string,
  ): Promise<ContractRow> {
    if (!Number.isFinite(body.project_id)) {
      throw new BadRequestException({ error: 'project_id' });
    }
    await this.inventory.listUnits(body.project_id, tenantId);
    await this.getAgencyOrThrow(agencyId, tenantId);

    try {
      return await this.repo.insertContract({
        agency_id: agencyId,
        project_id: body.project_id,
        status: 'active',
        max_concurrent_holds: body.max_concurrent_holds ?? null,
      });
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw new ConflictException({ error: 'contract_open' });
      }
      throw err;
    }
  }

  async overrideTier(
    id: string,
    body: OverrideTierBody,
    tenantId?: string,
  ): Promise<AgencyRow> {
    if (!canOverrideTier(body.actor_role)) throw new ForbiddenException();
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 10) throw new BadRequestException({ error: 'reason' });

    const agency = await this.getAgencyOrThrow(id, tenantId);
    await this.repo.ensureTiers(agency.tenant_id);
    const tier = await this.repo.getTierByCode(agency.tenant_id, String(body.tier_code ?? '').trim());
    if (!tier) throw new NotFoundException();

    const until = body.until ? new Date(body.until) : null;
    return this.repo.setAgencyTier(agency.id, tier.id, { reason, until });
  }

  async get(id: string, tenantId?: string): Promise<AgencyRow> {
    return this.getAgencyOrThrow(id, tenantId);
  }

  async list(tenantId?: string): Promise<AgencyRow[]> {
    return this.repo.listAgencies(this.optionalTenant(tenantId));
  }

  async grantUnits(
    agencyId: string,
    body: GrantUnitsBody,
    tenantId?: string,
  ): Promise<BasketUnitRow[]> {
    if (
      !Array.isArray(body.product_ids) ||
      body.product_ids.length === 0 ||
      body.product_ids.some((id) => !Number.isFinite(id))
    ) {
      throw new BadRequestException({ error: 'product_ids' });
    }

    const agency = await this.getAgencyOrThrow(agencyId, tenantId);
    if (agency.status === 'terminated') {
      throw new ConflictException({ error: 'agency_closed' });
    }

    const contract = await this.repo.getActiveContract(agency.id, body.project_id);
    if (!contract) throw new BadRequestException({ error: 'contract' });

    if (!agency.tier_id) throw new BadRequestException({ error: 'tier' });
    const tier = await this.repo.getTier(agency.tier_id);
    if (!tier) throw new BadRequestException({ error: 'tier' });

    const exclusivity = body.exclusivity ?? 'shared';
    try {
      assertExclusiveAllowed(tier.exclusive_allowed, exclusivity);
    } catch (e) {
      this.throwBadRequest(e);
    }

    if (exclusivity === 'exclusive' && !canGrantExclusive(String(body.actor_role ?? ''))) {
      throw new ForbiddenException();
    }

    const rule = await this.repo.getOrCreateRule(agency.id, body.project_id);
    const out: BasketUnitRow[] = [];

    for (const productId of body.product_ids) {
      const unit = await this.inventory.getOrThrow(productId, tenantId);
      if (Number(unit.project_id) !== body.project_id) throw new NotFoundException();
      if (isInhousePool(String(unit.pool ?? ''))) throw new NotFoundException();

      try {
        const row = await this.repo.grantUnit({
          rule_id: rule.id,
          agency_id: agency.id,
          project_id: body.project_id,
          product_id: productId,
          exclusivity,
          granted_by: body.granted_by,
        });
        out.push(row);
      } catch (err) {
        if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
          throw new BadRequestException({ error: 'exclusive' });
        }
        throw err;
      }
    }

    return out;
  }

  async revokeUnit(
    agencyId: string,
    productId: number,
    reason: string,
    tenantId?: string,
  ): Promise<BasketUnitRow> {
    const trimmed = String(reason ?? '').trim();
    if (!REVOKE_REASONS.has(trimmed)) {
      throw new BadRequestException({ error: 'reason' });
    }

    await this.getAgencyOrThrow(agencyId, tenantId);
    const open = await this.repo.getOpenUnit(agencyId, productId);
    if (!open) throw new NotFoundException();

    const unit = await this.inventory.getOrThrow(productId, tenantId);
    const status = String(unit.status);
    const holdId = unit.hold_id != null ? String(unit.hold_id).trim() : '';
    if (status === 'hold' || status === 'reserved' || status === 'booked' || holdId) {
      throw new BadRequestException({ error: 'unit_in_flight' });
    }

    const revoked = await this.repo.revokeUnit(open.id, trimmed, new Date());
    if (!revoked) throw new NotFoundException();
    return revoked;
  }

  async listBasket(
    agencyId: string,
    projectId?: number,
    tenantId?: string,
  ): Promise<BasketUnitRow[]> {
    await this.getAgencyOrThrow(agencyId, tenantId);
    const rows = await this.repo.listOpenUnits(agencyId, projectId);
    const filtered: BasketUnitRow[] = [];
    for (const row of rows) {
      const unit = await this.repo.getUnitPool(row.product_id);
      if (unit && !isInhousePool(unit.pool)) filtered.push(row);
    }
    return filtered;
  }

  async assertCanHold(agencyId: string, productId: number, tenantId?: string): Promise<void> {
    const agency = await this.getAgencyOrThrow(agencyId, tenantId);
    if (!canHoldAgencyStatus(agency.status)) {
      throw new ConflictException({ error: 'agency_suspended' });
    }

    const unit = await this.inventory.getOrThrow(productId, tenantId);
    if (isInhousePool(String(unit.pool ?? ''))) throw new NotFoundException();

    const projectId = Number(unit.project_id);
    const contract = await this.repo.getActiveContract(agency.id, projectId);
    if (!contract) throw new BadRequestException({ error: 'contract' });

    const inBasket = await this.repo.getOpenUnit(agency.id, productId);
    if (!inBasket) throw new NotFoundException();

    if (agency.kind === 'f2') {
      const parentId = String(agency.parent_agency_id ?? '').trim();
      if (!parentId) throw new NotFoundException();
      const parentOpen = await this.repo.getOpenUnit(parentId, productId);
      if (!parentOpen) throw new NotFoundException();
    }

    if (!agency.tier_id) throw new BadRequestException({ error: 'tier' });
    const tier = await this.repo.getTier(agency.tier_id);
    if (!tier) throw new BadRequestException({ error: 'tier' });

    const max =
      contract.max_concurrent_holds != null
        ? contract.max_concurrent_holds
        : tier.max_concurrent_holds;
    const openCount = await this.repo.countOpenHolds(agency.id);
    try {
      assertHoldQuota(openCount, max);
    } catch (e) {
      throw new ConflictException(e);
    }
  }

  async assertUnitVisible(agencyId: string, productId: number, tenantId?: string): Promise<void> {
    const agency = await this.getAgencyOrThrow(agencyId, tenantId);
    const unit = await this.inventory.getOrThrow(productId, tenantId);
    if (isInhousePool(String(unit.pool ?? ''))) throw new NotFoundException();

    const inBasket = await this.repo.getOpenUnit(agency.id, productId);
    if (!inBasket) throw new NotFoundException();

    if (agency.kind === 'f2') {
      const parentId = String(agency.parent_agency_id ?? '').trim();
      if (!parentId) throw new NotFoundException();
      const parentOpen = await this.repo.getOpenUnit(parentId, productId);
      if (!parentOpen) throw new NotFoundException();
    }
  }

  async quote(agencyId: string, body: QuoteBody, tenantId?: string) {
    await this.getAgencyOrThrow(agencyId, tenantId);
    const policy = await this.policies.get(body.policy_id, tenantId);

    try {
      assertDiscountAllowed(
        policy.discount_cap_pct,
        body.discount_pct,
        !!body.discount_approved,
      );
    } catch (e) {
      this.throwBadRequest(e);
    }

    const net = computeNetFromCsBh(body.list_price_vnd, body.discount_pct);
    if (body.net_price_vnd != null && Number.isFinite(body.net_price_vnd)) {
      const onePrice = (await this.repo.getProjectOnePrice(policy.project_id)) ?? true;
      try {
        assertOnePrice(onePrice, body.list_price_vnd, body.discount_pct, body.net_price_vnd);
      } catch (e) {
        this.throwBadRequest(e);
      }
    }

    return {
      list_price_vnd: body.list_price_vnd,
      discount_pct: body.discount_pct,
      net_price_vnd: net,
    };
  }

  private optionalTenant(tenantId?: string): string | null {
    const t = String(tenantId ?? '').trim();
    return t || null;
  }

  private async getAgencyOrThrow(id: string, tenantId?: string): Promise<AgencyRow> {
    const agency = await this.repo.getAgency(id);
    if (!agency) throw new NotFoundException();
    this.assertAgencyTenant(agency, tenantId);
    return agency;
  }

  private assertAgencyTenant(agency: AgencyRow, tenantId?: string): void {
    const t = String(tenantId ?? '').trim();
    if (!t) return;
    if (agency.tenant_id != null && String(agency.tenant_id).trim() !== '' && String(agency.tenant_id) !== t) {
      throw new NotFoundException();
    }
  }

  private throwBadRequest(err: unknown): never {
    if (err && typeof err === 'object' && (err as { error?: string }).error) {
      throw new BadRequestException(err);
    }
    throw err;
  }
}
