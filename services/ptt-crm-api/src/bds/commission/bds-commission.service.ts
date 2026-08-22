import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { isBdsCommissionEnabled } from '../bds.flags';
import { BdsAgencyRepository } from '../agencies/bds-agency.repository';
import type { TxRow } from '../transactions/bds-tx.types';
import { BdsCommissionRepository } from './bds-commission.repository';
import type {
  InsertSchemeTierInput,
  InsertSplitInput,
  LedgerRow,
  SchemeBase,
  SchemeRow,
  StatementRow,
  TriggerStage,
} from './bds-commission.types';
import {
  assertSplitsSum100,
  computeLineAmount,
  computeStatementNet,
  periodMonthStart,
  pickSchemeTier,
} from './bds-commission.util';

@Injectable()
export class BdsCommissionService {
  private readonly logger = new Logger(BdsCommissionService.name);

  constructor(
    private readonly repo: BdsCommissionRepository,
    private readonly agencies: BdsAgencyRepository,
  ) {}

  async createScheme(
    body: { project_id: number; phase_id?: string; base?: SchemeBase },
    tenantId?: string,
  ): Promise<SchemeRow> {
    const projectId = Number(body.project_id);
    if (!Number.isFinite(projectId)) {
      throw new BadRequestException({ error: 'project_id' });
    }
    const base = String(body.base ?? 'net').trim() as SchemeBase;
    if (base !== 'net' && base !== 'list') {
      throw new BadRequestException({ error: 'base' });
    }
    const tid = String(tenantId ?? '').trim() || null;
    return this.repo.insertScheme({
      tenant_id: tid,
      project_id: projectId,
      phase_id: body.phase_id ?? null,
      base,
    });
  }

  async putTiers(
    schemeId: string,
    rows: InsertSchemeTierInput[],
    tenantId?: string,
  ): Promise<unknown> {
    const scheme = await this.getSchemeOrThrow(schemeId, tenantId);
    if (scheme.status !== 'draft') {
      throw new ConflictException({ error: 'scheme_not_draft' });
    }
    return this.repo.replaceSchemeTiers(schemeId, rows);
  }

  async putSplits(
    schemeId: string,
    rows: InsertSplitInput[],
    tenantId?: string,
  ): Promise<unknown> {
    const scheme = await this.getSchemeOrThrow(schemeId, tenantId);
    if (scheme.status !== 'draft') {
      throw new ConflictException({ error: 'scheme_not_draft' });
    }
    assertSplitsSum100(rows);
    return this.repo.replaceSplits(schemeId, rows);
  }

  async activate(schemeId: string, tenantId?: string): Promise<SchemeRow> {
    const scheme = await this.getSchemeOrThrow(schemeId, tenantId);
    const active = await this.repo.getActiveScheme(scheme.project_id, scheme.tenant_id ?? tenantId);
    if (active && active.id !== schemeId) {
      throw new ConflictException({ error: 'scheme_active' });
    }
    if (scheme.status === 'active') return scheme;
    return this.repo.activateScheme(schemeId);
  }

  async listCommissions(
    agencyId: string,
    periodMonth: string,
    tenantId?: string,
  ): Promise<LedgerRow[]> {
    await this.assertAgencyTenant(agencyId, tenantId);
    return this.repo.listLedgerByAgencyPeriod(agencyId, periodMonth);
  }

  async onTxStage(tx: TxRow, trigger: TriggerStage, now = new Date()): Promise<void> {
    if (!isBdsCommissionEnabled()) return;
    const partnerId = String(tx.channel_partner_id ?? '').trim();
    if (!partnerId) return;

    const scheme = await this.repo.getActiveScheme(tx.project_id, tx.tenant_id ?? undefined);
    if (!scheme) {
      this.logger.warn(`commission: no active scheme project=${tx.project_id} tx=${tx.id}`);
      return;
    }

    const splits = await this.repo.listSplits(scheme.id);
    const split = splits.find((s) => s.trigger_stage === trigger);
    if (!split) return;

    const agency = await this.agencies.getAgency(partnerId);
    if (!agency) {
      this.logger.warn(`commission: agency missing ${partnerId} tx=${tx.id}`);
      return;
    }

    const tierRows = await this.repo.listSchemeTiers(scheme.id);
    const tierDefs = await this.agencies.listTiers(agency.tenant_id);
    const enriched = tierRows.map((row) => {
      const def = tierDefs.find((t) => t.id === row.min_tier_id);
      return { ...row, min_score: def?.min_score ?? 0 };
    });

    const agencyTier = agency.tier_id ? await this.agencies.getTier(agency.tier_id) : null;
    const agencyMinScore = agencyTier?.min_score ?? 0;
    const picked = pickSchemeTier(enriched, agencyMinScore);
    if (!picked) {
      this.logger.warn(`commission: no tier match agency=${partnerId} tx=${tx.id}`);
      return;
    }

    const baseVnd =
      scheme.base === 'list' ? Number(tx.list_price_vnd) : Number(tx.net_price_vnd);
    const amount = computeLineAmount(baseVnd, picked.pct, split.pct);
    if (amount <= 0) return;

    await this.repo.insertLedger({
      tenant_id: tx.tenant_id,
      agency_id: partnerId,
      transaction_id: tx.id,
      scheme_id: scheme.id,
      scheme_tier_id: picked.id ?? null,
      trigger_stage: trigger,
      status: 'accrued',
      base_vnd: baseVnd,
      pct: picked.pct,
      amount_vnd: amount,
      period_month: periodMonthStart(now),
    });
  }

  async onTxCancelled(tx: TxRow, now = new Date()): Promise<void> {
    if (!isBdsCommissionEnabled()) return;
    const partnerId = String(tx.channel_partner_id ?? '').trim();
    if (!partnerId) return;
    await this.repo.clawbackOpenLines(tx.id, periodMonthStart(now));
  }

  async lockStatement(
    agencyId: string,
    periodMonth: string,
    tenantId?: string,
  ): Promise<StatementRow> {
    await this.assertAgencyTenant(agencyId, tenantId);
    const lines = await this.repo.listLedgerByAgencyPeriod(agencyId, periodMonth);
    const gross = lines
      .filter((l) => l.status === 'accrued')
      .reduce((sum, l) => sum + l.amount_vnd, 0);
    const clawback = lines
      .filter((l) => l.status === 'clawback')
      .reduce((sum, l) => sum + l.amount_vnd, 0);
    const advance = await this.repo.sumAdvances(agencyId, periodMonth);
    const net = computeStatementNet({ grossVnd: gross, advanceVnd: advance, clawbackVnd: clawback });

    const accruedSum = lines
      .filter((l) => l.status === 'accrued')
      .reduce((sum, l) => sum + l.amount_vnd, 0);
    if (gross !== accruedSum) {
      throw new ConflictException({ error: 'statement_mismatch' });
    }

    return this.repo.upsertStatement({
      tenant_id: tenantId ?? null,
      agency_id: agencyId,
      period_month: periodMonth,
      gross_vnd: gross,
      advance_vnd: advance,
      clawback_vnd: clawback,
      net_vnd: net,
      status: 'locked',
    });
  }

  async approveStatement(id: string, tenantId?: string): Promise<StatementRow> {
    await this.getStatementOrThrow(id, tenantId);
    const updated = await this.repo.setStatementStatusIf(id, 'approved', 'locked');
    if (!updated) throw new ConflictException({ error: 'statement_status' });
    return updated;
  }

  async payStatement(id: string, tenantId?: string): Promise<StatementRow> {
    const stmt = await this.getStatementOrThrow(id, tenantId);
    const updated = await this.repo.setStatementStatusIf(id, 'paid', 'approved');
    if (!updated) throw new ConflictException({ error: 'statement_status' });
    await this.repo.markAccruedPaidForPeriod(stmt.agency_id, stmt.period_month);
    return updated;
  }

  async createAdvance(
    body: { agency_id: string; amount_vnd: number; period_month: string; note?: string },
    tenantId?: string,
  ): Promise<unknown> {
    const agencyId = String(body.agency_id ?? '').trim();
    const amount = Number(body.amount_vnd);
    const periodMonth = String(body.period_month ?? '').trim();
    if (!agencyId || !Number.isFinite(amount) || amount <= 0 || !periodMonth) {
      throw new BadRequestException({ error: 'advance_body' });
    }
    await this.assertAgencyTenant(agencyId, tenantId);

    const existing = await this.repo.getStatementByAgencyPeriod(agencyId, periodMonth);
    if (existing && ['locked', 'approved', 'paid'].includes(existing.status)) {
      throw new ConflictException({ error: 'period_locked' });
    }

    const cap = await this.agencies.maxAdvanceCapVnd(agencyId);
    const used = await this.repo.sumAdvances(agencyId, periodMonth);
    if (used + amount > cap) {
      throw new BadRequestException({ error: 'advance_cap' });
    }

    return this.repo.insertAdvance({
      tenant_id: tenantId ?? null,
      agency_id: agencyId,
      amount_vnd: amount,
      period_month: periodMonth,
      note: body.note,
    });
  }

  private async getSchemeOrThrow(id: string, tenantId?: string): Promise<SchemeRow> {
    const scheme = await this.repo.getScheme(id);
    if (!scheme) throw new NotFoundException();
    const t = String(tenantId ?? '').trim();
    if (t && scheme.tenant_id != null && String(scheme.tenant_id).trim() !== '' && scheme.tenant_id !== t) {
      throw new NotFoundException();
    }
    return scheme;
  }

  private async getStatementOrThrow(id: string, tenantId?: string): Promise<StatementRow> {
    const stmt = await this.repo.getStatement(id, tenantId);
    if (!stmt) throw new NotFoundException();
    return stmt;
  }

  private async assertAgencyTenant(agencyId: string, tenantId?: string): Promise<void> {
    const agency = await this.agencies.getAgency(agencyId);
    if (!agency) throw new NotFoundException();
    const t = String(tenantId ?? '').trim();
    if (t && agency.tenant_id != null && String(agency.tenant_id).trim() !== '' && agency.tenant_id !== t) {
      throw new NotFoundException();
    }
  }
}
