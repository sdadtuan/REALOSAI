import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BdsPolicyRepository,
  type PolicyRow,
  type PriceListItemRow,
  type PriceListRow,
  type UpdatePolicyDraftInput,
} from './bds-policy.repository';
import type { FeeUnit, PolicyAudience, VatMode } from './bds-policy.types';
import {
  assertDiscountAllowed,
  assertOnePrice,
  canActivatePolicy,
  computeNetFromCsBh,
  maintenanceFeeTotal,
} from './bds-policy.util';

export type CreatePolicyBody = {
  code?: string;
  name?: string;
  audience?: PolicyAudience;
  discount_cap_pct?: number;
  hold_ttl_minutes?: number | null;
  deposit_min_vnd?: number;
  vbtt_min_paid_pct?: number;
  hdmb_min_paid_pct?: number;
  payment_template_json?: unknown;
  vat_mode?: VatMode;
  maintenance_fee_vnd?: number;
  fee_unit?: FeeUnit;
  rules_json?: unknown;
  effective_from?: string | null;
  effective_to?: string | null;
};

export type ActivateBody = {
  phase_id: string;
  price_list_id: number;
  actor_role: string;
  activated_by?: string;
};

export type ArchiveBody = {
  actor_role: string;
};

export type QuoteBody = {
  list_price_vnd: number;
  discount_pct: number;
  discount_approved?: boolean;
  net_price_vnd?: number;
  area_m2?: number;
};

export type CreatePriceListBody = {
  version_code: string;
  name?: string;
  effective_date?: string;
  notes?: string;
  created_by?: string;
};

export type AddPriceListItemBody = {
  unit_code: string;
  zone?: string;
  list_price_vnd?: number;
  net_price_vnd?: number;
  notes?: string;
};

const AUDIENCES: readonly PolicyAudience[] = ['direct', 'broker', 'all'];

function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === '23505');
}

function utilError(err: unknown): { error: string } | null {
  if (err && typeof err === 'object' && 'error' in err) {
    return err as { error: string };
  }
  return null;
}

@Injectable()
export class BdsPolicyService {
  constructor(private readonly repo: BdsPolicyRepository) {}

  private optionalTenant(tenantId?: string): string | undefined {
    const t = String(tenantId ?? '').trim();
    return t || undefined;
  }

  private async assertProjectExists(projectId: number): Promise<void> {
    const exists = await this.repo.getProjectOnePrice(projectId);
    if (exists === null) throw new NotFoundException();
  }

  private async assertProjectTenant(projectId: number, tenantId?: string): Promise<void> {
    await this.assertProjectExists(projectId);
    const t = this.optionalTenant(tenantId);
    if (!t) return;
    const projectTenant = await this.repo.resolveProjectTenantId(projectId);
    if (!projectTenant || projectTenant !== t) {
      throw new NotFoundException();
    }
  }

  private async assertPolicyTenant(policy: PolicyRow, tenantId?: string): Promise<void> {
    const t = this.optionalTenant(tenantId);
    if (!t) return;
    if (!policy.tenant_id || policy.tenant_id !== t) {
      throw new NotFoundException();
    }
  }

  private async getPolicyOrThrow(id: string, tenantId?: string): Promise<PolicyRow> {
    const policy = await this.repo.getPolicy(id);
    if (!policy) throw new NotFoundException();
    await this.assertPolicyTenant(policy, tenantId);
    return policy;
  }

  private validateAudience(audience?: PolicyAudience): PolicyAudience {
    const a = (audience ?? 'all') as PolicyAudience;
    if (!AUDIENCES.includes(a)) {
      throw new BadRequestException({ error: 'audience' });
    }
    return a;
  }

  private validateDiscountCapPct(pct?: number): number {
    const n = pct ?? 0;
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw new BadRequestException({ error: 'discount_cap_pct' });
    }
    return n;
  }

  async create(projectId: number, body: CreatePolicyBody, tenantId?: string): Promise<PolicyRow> {
    await this.assertProjectTenant(projectId, tenantId);
    const code = String(body.code ?? '').trim();
    if (!code) throw new BadRequestException({ error: 'code' });

    const unitTenant = await this.repo.resolveProjectTenantId(projectId);

    try {
      return await this.repo.insertPolicy({
        tenant_id: unitTenant,
        project_id: projectId,
        code,
        name: body.name,
        audience: this.validateAudience(body.audience),
        discount_cap_pct: this.validateDiscountCapPct(body.discount_cap_pct),
        hold_ttl_minutes: body.hold_ttl_minutes ?? null,
        deposit_min_vnd: body.deposit_min_vnd,
        vbtt_min_paid_pct: body.vbtt_min_paid_pct,
        hdmb_min_paid_pct: body.hdmb_min_paid_pct,
        payment_template_json: body.payment_template_json,
        vat_mode: body.vat_mode,
        maintenance_fee_vnd: body.maintenance_fee_vnd,
        fee_unit: body.fee_unit,
        rules_json: body.rules_json,
        effective_from: body.effective_from ? new Date(body.effective_from) : null,
        effective_to: body.effective_to ? new Date(body.effective_to) : null,
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException({ error: 'policy_code' });
      throw err;
    }
  }

  async updateDraft(
    id: string,
    body: CreatePolicyBody,
    tenantId?: string,
  ): Promise<PolicyRow> {
    const current = await this.getPolicyOrThrow(id, tenantId);
    if (current.status !== 'draft') {
      throw new ConflictException({ error: 'policy_locked' });
    }

    const patch: UpdatePolicyDraftInput = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.audience !== undefined) patch.audience = this.validateAudience(body.audience);
    if (body.discount_cap_pct !== undefined) {
      patch.discount_cap_pct = this.validateDiscountCapPct(body.discount_cap_pct);
    }
    if (body.code !== undefined) {
      const code = String(body.code).trim();
      if (!code) throw new BadRequestException({ error: 'code' });
      patch.code = code;
    }
    if (body.hold_ttl_minutes !== undefined) patch.hold_ttl_minutes = body.hold_ttl_minutes;
    if (body.deposit_min_vnd !== undefined) patch.deposit_min_vnd = body.deposit_min_vnd;
    if (body.vbtt_min_paid_pct !== undefined) patch.vbtt_min_paid_pct = body.vbtt_min_paid_pct;
    if (body.hdmb_min_paid_pct !== undefined) patch.hdmb_min_paid_pct = body.hdmb_min_paid_pct;
    if (body.payment_template_json !== undefined) {
      patch.payment_template_json = body.payment_template_json;
    }
    if (body.vat_mode !== undefined) patch.vat_mode = body.vat_mode;
    if (body.maintenance_fee_vnd !== undefined) patch.maintenance_fee_vnd = body.maintenance_fee_vnd;
    if (body.fee_unit !== undefined) patch.fee_unit = body.fee_unit;
    if (body.rules_json !== undefined) patch.rules_json = body.rules_json;
    if (body.effective_from !== undefined) {
      patch.effective_from = body.effective_from ? new Date(String(body.effective_from)) : null;
    }
    if (body.effective_to !== undefined) {
      patch.effective_to = body.effective_to ? new Date(String(body.effective_to)) : null;
    }

    const updated = await this.repo.updateDraft(id, patch);
    if (!updated) throw new ConflictException({ error: 'policy_locked' });
    return updated;
  }

  async get(id: string, tenantId?: string): Promise<PolicyRow> {
    return this.getPolicyOrThrow(id, tenantId);
  }

  async listByProject(projectId: number, tenantId?: string): Promise<PolicyRow[]> {
    await this.assertProjectTenant(projectId, tenantId);
    return this.repo.listByProject(projectId);
  }

  async createPriceList(
    projectId: number,
    body: CreatePriceListBody,
    tenantId?: string,
  ): Promise<PriceListRow> {
    await this.assertProjectTenant(projectId, tenantId);
    const versionCode = String(body.version_code ?? '').trim();
    if (!versionCode) throw new BadRequestException({ error: 'version_code' });

    const unitTenant = await this.repo.resolveProjectTenantId(projectId);

    try {
      return await this.repo.insertPriceList({
        project_id: projectId,
        tenant_id: unitTenant,
        version_code: versionCode,
        name: body.name,
        effective_date: body.effective_date,
        notes: body.notes,
        created_by: body.created_by,
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException({ error: 'version_code' });
      throw err;
    }
  }

  async listPriceLists(projectId: number, tenantId?: string): Promise<PriceListRow[]> {
    await this.assertProjectTenant(projectId, tenantId);
    return this.repo.listPriceLists(projectId);
  }

  async addPriceListItem(
    priceListId: number,
    body: AddPriceListItemBody,
    tenantId?: string,
  ): Promise<PriceListItemRow> {
    const list = await this.repo.getPriceList(priceListId);
    if (!list) throw new NotFoundException();
    await this.assertProjectTenant(list.project_id, tenantId);
    if (list.status === 'active') {
      throw new ConflictException({ error: 'price_list_locked' });
    }

    const unitCode = String(body.unit_code ?? '').trim();
    if (!unitCode) throw new BadRequestException({ error: 'unit_code' });

    return this.repo.upsertPriceListItem(priceListId, {
      unit_code: unitCode,
      zone: body.zone,
      list_price_vnd: body.list_price_vnd,
      net_price_vnd: body.net_price_vnd,
      notes: body.notes,
    });
  }

  async activate(id: string, body: ActivateBody, tenantId?: string): Promise<PolicyRow> {
    const policy = await this.getPolicyOrThrow(id, tenantId);

    if (!canActivatePolicy(body.actor_role)) {
      throw new ForbiddenException({ error: 'activate_forbidden' });
    }
    if (policy.status === 'archived') {
      throw new ConflictException({ error: 'policy_closed' });
    }
    if (policy.status === 'active') {
      throw new ConflictException({ error: 'already_active' });
    }

    const phaseId = String(body.phase_id ?? '').trim();
    if (!phaseId) throw new BadRequestException({ error: 'phase_id' });

    const phase = await this.repo.getPhase(phaseId);
    if (!phase || phase.project_id !== policy.project_id) {
      throw new NotFoundException();
    }

    if (!Number.isFinite(body.price_list_id)) {
      throw new BadRequestException({ error: 'price_list_id' });
    }
    const priceList = await this.repo.getPriceList(body.price_list_id);
    if (!priceList || priceList.project_id !== policy.project_id) {
      throw new NotFoundException();
    }

    await this.repo.archiveActiveAudience(policy.project_id, policy.audience, policy.id);

    const updated = await this.repo.setPolicyStatusIf(
      policy.id,
      'active',
      { activated_by: body.activated_by ?? '' },
      'draft',
    );
    if (!updated) throw new ConflictException({ error: 'policy_locked' });

    await this.repo.setPhaseSnapshot(phaseId, policy.id, body.price_list_id);
    await this.repo.setPriceListPolicy(body.price_list_id, policy.id);

    return updated;
  }

  async archive(id: string, body: ArchiveBody, tenantId?: string): Promise<PolicyRow> {
    const policy = await this.getPolicyOrThrow(id, tenantId);

    if (!canActivatePolicy(body.actor_role)) {
      throw new ForbiddenException({ error: 'activate_forbidden' });
    }
    if (policy.status !== 'draft' && policy.status !== 'active') {
      throw new ConflictException({ error: 'policy_closed' });
    }

    const updated = await this.repo.setPolicyStatusIf(
      policy.id,
      'archived',
      {},
      policy.status,
    );
    if (!updated) throw new ConflictException({ error: 'policy_closed' });
    return updated;
  }

  async quote(
    id: string,
    body: QuoteBody,
    tenantId?: string,
  ): Promise<{
    list_price_vnd: number;
    discount_pct: number;
    net_price_vnd: number;
    maintenance_fee_vnd: number;
  }> {
    const policy = await this.getPolicyOrThrow(id, tenantId);

    if (!Number.isFinite(body.list_price_vnd) || !Number.isFinite(body.discount_pct)) {
      throw new BadRequestException({ error: 'quote' });
    }

    try {
      assertDiscountAllowed(
        policy.discount_cap_pct,
        body.discount_pct,
        body.discount_approved === true,
      );
    } catch (err) {
      const e = utilError(err);
      if (e) throw new BadRequestException(e);
      throw err;
    }

    const net = computeNetFromCsBh(body.list_price_vnd, body.discount_pct);

    if (Number.isFinite(body.net_price_vnd)) {
      const onePrice = (await this.repo.getProjectOnePrice(policy.project_id)) ?? true;
      try {
        assertOnePrice(onePrice, body.list_price_vnd, body.discount_pct, Number(body.net_price_vnd));
      } catch (err) {
        const e = utilError(err);
        if (e) throw new BadRequestException(e);
        throw err;
      }
    }

    return {
      list_price_vnd: body.list_price_vnd,
      discount_pct: body.discount_pct,
      net_price_vnd: net,
      maintenance_fee_vnd: maintenanceFeeTotal(
        policy.maintenance_fee_vnd,
        policy.fee_unit,
        body.area_m2 ?? 0,
      ),
    };
  }
}
