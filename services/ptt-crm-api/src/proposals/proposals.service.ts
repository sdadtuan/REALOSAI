import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { OpsProfilePgRepository } from '../ops/ops-profile-pg.repository';
import { OpsRouteMapLoader } from '../ops/ops-route-map.loader';
import { OpsService } from '../ops/ops.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { LeadsFunnelService } from '../leads-funnel/leads-funnel.service';
import { SpcService } from '../spc/spc.service';
import { skuFromDvTier } from '../spc/spc-sku.util';
import { ProposalsSqliteRepository } from './proposals-sqlite.repository';
import {
  normalizeQuoteTier,
  quoteExportFilename,
  quotePdfBuffer,
  resolveTierPricing,
  type QuotePackageTier,
} from './quote-pricing.util';
import {
  buildAutoQuoteLineInputs,
  filterCatalogServicesForSlug,
  loadDealRoomServiceDvMap,
  resolveServiceDvMapping,
} from './deal-room-quote.util';
import {
  CreateProposalBody,
  PatchProposalStatusBody,
  PROPOSAL_STATUS_FLOW,
  ProposalStatus,
  PutQuoteLinesBody,
  QuoteLineInput,
} from './proposals.types';

@Injectable()
export class ProposalsService {
  constructor(
    private readonly sqlite: ProposalsSqliteRepository,
    private readonly routeMap: OpsRouteMapLoader,
    private readonly profiles: OpsProfilePgRepository,
    private readonly lifecycle: ServiceLifecycleService,
    private readonly ops: OpsService,
    private readonly config: AppConfigService,
    private readonly funnel: LeadsFunnelService,
    private readonly spc: SpcService,
  ) {}

  private async assertG4ForLeadContext(leadId: number): Promise<void> {
    if (!this.config.dealRoomGateStrict) return;
    const gateResp = await this.funnel.getPresalesProposalGate(leadId);
    if (!gateResp.gate.ok) {
      throw new BadRequestException({
        error: 'g4_blocked',
        messages: gateResp.gate.messages,
        message:
          gateResp.gate.messages[0] ?? 'Hoàn thành G4 R5 trước khi tạo báo giá (BR-SCLOSE-001).',
      });
    }
  }

  list(customerIdRaw?: string, leadIdRaw?: string) {
    const leadId = Number(leadIdRaw ?? 0);
    if (Number.isFinite(leadId) && leadId > 0) {
      const proposals = this.sqlite.listByLeadId(leadId).map((p) => ({
        ...p,
        line_count: this.sqlite.listLines(p.id).length,
      }));
      return { proposals };
    }
    const customerId = Number(customerIdRaw ?? 0);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      throw new BadRequestException({ error: 'Cần customer_id hoặc lead_id' });
    }
    const proposals = this.sqlite.listByCustomer(customerId).map((p) => ({
      ...p,
      line_count: this.sqlite.listLines(p.id).length,
    }));
    return { proposals };
  }

  detail(proposalId: number) {
    const proposal = this.sqlite.getById(proposalId);
    if (!proposal) {
      throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    }
    return {
      ...proposal,
      lines: this.sqlite.listLines(proposalId),
    };
  }

  getLines(proposalId: number) {
    const proposal = this.sqlite.getById(proposalId);
    if (!proposal) throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    return { proposal_id: proposalId, lines: this.sqlite.listLines(proposalId) };
  }

  private resolveDvEntry(dvCode: string) {
    const code = String(dvCode ?? '').trim().toUpperCase();
    const entry = this.routeMap.getMap().services.find((s) => s.code === code);
    if (!entry) {
      throw new BadRequestException({ error: 'dv_not_found', dv_code: code });
    }
    return entry;
  }

  private async resolveLinePricing(line: QuoteLineInput) {
    if (line.sku_code?.trim()) {
      try {
        return await this.spc.resolveQuoteLineFromSku(
          line.sku_code,
          line.final_price_vnd,
          line.scope_notes,
        );
      } catch (err) {
        if (!line.dv_code || !line.package_tier) throw err;
      }
    }
    const dvCode = String(line.dv_code ?? '').trim().toUpperCase();
    if (!dvCode) {
      throw new BadRequestException({ error: 'dv_or_sku_required' });
    }
    const entry = this.resolveDvEntry(dvCode);
    const tier = normalizeQuoteTier(line.package_tier ?? 'standard');
    if (!tier) {
      throw new BadRequestException({ error: 'invalid_package_tier', tier: line.package_tier });
    }
    const skuCode = line.sku_code?.trim() || skuFromDvTier(entry.code, tier);
    try {
      return await this.spc.resolveQuoteLineFromSku(
        skuCode,
        line.final_price_vnd,
        line.scope_notes,
      );
    } catch {
      // fallback legacy tier_pricing
    }
    let tierPricing: Record<string, unknown> = {};
    try {
      const profile = await this.profiles.getByDvCode(entry.code);
      tierPricing = (profile?.tier_pricing ?? {}) as Record<string, unknown>;
    } catch {
      tierPricing = {};
    }
    const reference = resolveTierPricing(tierPricing, tier);
    const finalPrice =
      line.final_price_vnd != null && Number.isFinite(Number(line.final_price_vnd))
        ? Math.max(0, Number(line.final_price_vnd))
        : reference.suggested_vnd;
    return {
      sku_code: skuCode,
      dv_code: entry.code,
      package_tier: tier,
      service_slug: entry.service_slugs.primary,
      dv_name: entry.name_vi,
      reference_price_min: reference.min_vnd,
      reference_price_max: reference.max_vnd,
      final_price_vnd: finalPrice,
      scope_notes: String(line.scope_notes ?? ''),
    };
  }

  async create(body: CreateProposalBody) {
    let customerId = Number(body.customer_id ?? 0);
    const leadId = Number(body.lead_id ?? 0);
    let presalesId = Number(body.presales_id ?? 0);
    let serviceSlug = String(body.service_slug ?? '').trim();
    let lines = body.lines ?? [];
    const autoLines = Boolean(body.auto_lines);

    if (Number.isFinite(leadId) && leadId > 0) {
      await this.assertG4ForLeadContext(leadId);
      if (!customerId) {
        const handoffResp = await this.funnel.getPresalesProposalHandoff(leadId);
        customerId = Number(handoffResp.handoff.customer_id ?? 0);
      }
      if (!presalesId) {
        const funnel = await this.funnel.getFunnel(leadId);
        presalesId = Number(funnel.presales?.presales.id ?? 0);
      }
      if (!serviceSlug) {
        const funnel = await this.funnel.getFunnel(leadId);
        serviceSlug = String(funnel.presales?.presales.service_slug ?? '').trim();
      }
    }

    if (!customerId) {
      throw new BadRequestException({
        error: 'customer_required',
        message: 'Lead chưa gắn khách hàng — chọn customer_id hoặc promote lead trước.',
      });
    }

    if (autoLines) {
      const tier = normalizeQuoteTier(body.package_tier ?? 'standard') ?? 'standard';
      lines = await this.buildAutoLines(serviceSlug, tier);
    }

    const slugs = (body.service_slugs ?? []).map((s) => String(s).trim()).filter(Boolean);
    if (!lines.length && !slugs.length && !autoLines) {
      throw new BadRequestException({ error: 'Thiếu lines hoặc service_slugs' });
    }
    if (serviceSlug && !slugs.length) {
      slugs.push(serviceSlug);
    }

    const created = this.sqlite.create({
      ...body,
      customer_id: customerId,
      lead_id: leadId > 0 ? leadId : undefined,
      presales_id: presalesId > 0 ? presalesId : undefined,
      service_slugs: slugs,
    });
    if (lines.length) {
      const resolved = await Promise.all(lines.map((line) => this.resolveLinePricing(line)));
      this.sqlite.replaceLines(created.id, resolved);
    }
    return this.detail(created.id);
  }

  private async buildAutoLines(serviceSlug: string, tier: QuotePackageTier) {
    const map = this.routeMap.getMap();
    const dvMap = loadDealRoomServiceDvMap();
    const mapping = resolveServiceDvMapping(serviceSlug, map, dvMap);
    let tierPricing: Record<string, unknown> = {};
    try {
      const profile = await this.profiles.getByDvCode(mapping.primary_dv);
      tierPricing = (profile?.tier_pricing ?? {}) as Record<string, unknown>;
    } catch {
      tierPricing = {};
    }
    return buildAutoQuoteLineInputs(mapping, tierPricing, tier);
  }

  async putLines(proposalId: number, body: PutQuoteLinesBody) {
    const proposal = this.sqlite.getById(proposalId);
    if (!proposal) throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    if (proposal.status === 'accepted') {
      throw new BadRequestException({ error: 'proposal_already_accepted' });
    }
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw new BadRequestException({ error: 'lines_required' });
    }
    const resolved = await Promise.all(body.lines.map((line) => this.resolveLinePricing(line)));
    const items = this.sqlite.replaceLines(proposalId, resolved, body.price_adjustment_reason);
    return { proposal_id: proposalId, lines: items, total_vnd: items.reduce((s, l) => s + l.final_price_vnd, 0) };
  }

  patchStatus(proposalId: number, body: PatchProposalStatusBody, actorEmail = 'staff') {
    const proposal = this.sqlite.getById(proposalId);
    if (!proposal) throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    const next = body.status;
    const allowed = PROPOSAL_STATUS_FLOW[proposal.status] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException({
        error: 'invalid_status_transition',
        from: proposal.status,
        to: next,
      });
    }
    if (next === 'accepted') {
      return this.acceptProposal(proposalId, Boolean(body.spawn_week), actorEmail, body.price_adjustment_reason);
    }
    const updated = this.sqlite.patchStatus(proposalId, next, body.price_adjustment_reason);
    return { proposal: updated, lines: this.sqlite.listLines(proposalId) };
  }

  private async acceptProposal(
    proposalId: number,
    spawnWeek: boolean,
    actorEmail: string,
    priceAdjustmentReason?: string,
  ) {
    const proposal = this.sqlite.getById(proposalId);
    if (!proposal) throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    const lines = this.sqlite.listLines(proposalId);
    if (!lines.length) {
      throw new BadRequestException({ error: 'quote_lines_required_for_accept' });
    }

    const lifecycles: Array<{ line_id: number; lifecycle_id: number; dv_code: string }> = [];
    for (const line of lines) {
      if (line.lifecycle_id) {
        lifecycles.push({ line_id: line.id, lifecycle_id: line.lifecycle_id, dv_code: line.dv_code });
        continue;
      }
      const note = `Quote #${proposalId} · ${line.dv_code} ${line.package_tier} · ${line.final_price_vnd.toLocaleString('vi-VN')} VND`;
      const created = await this.lifecycle.create({
        customer_id: proposal.customer_id,
        service_slug: line.service_slug,
      });
      this.sqlite.activateLifecycle(created.id, 'onboard', note);
      this.sqlite.setLineLifecycle(line.id, created.id);
      const skuCode =
        line.sku_code?.trim() ||
        skuFromDvTier(line.dv_code, normalizeQuoteTier(line.package_tier) ?? 'standard');
      try {
        await this.lifecycle.setCommercialSku(created.id, skuCode);
      } catch {
        this.sqlite.setLifecycleSkuCode(created.id, skuCode);
      }
      lifecycles.push({ line_id: line.id, lifecycle_id: created.id, dv_code: line.dv_code });

      if (spawnWeek && this.config.opsWeeklySpawnEnabled && this.config.opsDvEnabled) {
        try {
          await this.ops.spawnWeek(created.id, actorEmail);
        } catch {
          // spawn optional — lifecycle still created
        }
      }
    }

    if (lifecycles.length === 1) {
      this.sqlite.setProposalLifecycle(proposalId, lifecycles[0].lifecycle_id);
    }

    const updated = this.sqlite.patchStatus(proposalId, 'accepted', priceAdjustmentReason);
    return {
      proposal: updated,
      lines: this.sqlite.listLines(proposalId),
      lifecycles,
    };
  }

  async exportQuote(proposalId: number, format: 'pdf' | 'docx' = 'pdf') {
    const proposal = this.sqlite.getById(proposalId);
    if (!proposal) throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    const lines = this.sqlite.listLines(proposalId);
    const map = this.routeMap.getMap();
    const exportLines = lines.map((line) => {
      const entry = map.services.find((s) => s.code === line.dv_code);
      return {
        dv_code: line.dv_code,
        dv_name: entry?.name_vi ?? line.dv_code,
        package_tier: line.package_tier,
        final_price_vnd: line.final_price_vnd,
      };
    });

    if (format === 'docx') {
      const text = exportLines
        .map(
          (l) =>
            `${l.dv_code} ${l.dv_name} (${l.package_tier}): ${l.final_price_vnd.toLocaleString('vi-VN')} VND`,
        )
        .join('\n');
      const body = `PTT Quote #${proposalId}\n${this.sqlite.getCustomerName(proposal.customer_id)}\n\n${text}\n\nTotal: ${proposal.total_vnd.toLocaleString('vi-VN')} VND`;
      return new StreamableFile(Buffer.from(body, 'utf8'), {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        disposition: `attachment; filename="${quoteExportFilename(proposalId, 'docx')}"`,
      });
    }

    const pdf = quotePdfBuffer({
      proposalId,
      customerName: this.sqlite.getCustomerName(proposal.customer_id),
      lines: exportLines,
      total_vnd: proposal.total_vnd,
      status: proposal.status,
      valid_until: proposal.valid_until,
    });
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${quoteExportFilename(proposalId, 'pdf')}"`,
    });
  }

  async getCatalogForQuote(serviceSlugRaw?: string) {
    try {
      return await this.spc.getQuoteCatalog(serviceSlugRaw);
    } catch {
      // legacy fallback when PG/SPC unavailable
    }
    const map = this.routeMap.getMap();
    const slug = String(serviceSlugRaw ?? '').trim();
    const base = {
      schema_version: map.schema_version,
      package_tiers: ['basic', 'standard', 'premium'] as QuotePackageTier[],
    };
    if (!slug) {
      return {
        ...base,
        services: map.services.map((s) => ({
          dv_code: s.code,
          name: s.name_vi,
          service_slug: s.service_slugs.primary,
          readiness: s.readiness,
          depends_on_dv: s.depends_on_dv ?? [],
        })),
        suggested_bundle: [] as string[],
        primary_dv: null as string | null,
      };
    }
    const dvMap = loadDealRoomServiceDvMap();
    const mapping = resolveServiceDvMapping(slug, map, dvMap);
    return {
      ...base,
      service_slug: slug,
      primary_dv: mapping.primary_dv,
      primary_name: mapping.primary_name,
      suggested_bundle: mapping.bundle_dv,
      services: filterCatalogServicesForSlug(map, mapping),
    };
  }

  generate(proposalId: number) {
    const proposal = this.sqlite.getById(proposalId);
    if (!proposal) {
      throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    }
    return {
      ok: true,
      stub: true,
      proposal_id: proposalId,
      sections: {},
      message: 'AI proposal stub — configure ANTHROPIC_API_KEY',
    };
  }

  remove(proposalId: number) {
    const ok = this.sqlite.delete(proposalId);
    if (!ok) {
      throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    }
    return {};
  }
}
