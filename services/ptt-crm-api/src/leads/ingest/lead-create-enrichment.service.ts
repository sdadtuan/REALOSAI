import { ConflictException, Injectable, BadRequestException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { CreateLeadV1Body } from '../leads.types';
import { PTT_OPERATING_COMPANY_ID } from '../../b2b-projects/b2b-projects.constants';
import { B2bFirstAssignService } from '../../b2b-projects/b2b-first-assign.service';
import { LeadAutoAssignService } from './lead-auto-assign.service';
import { LeadDedupRepository } from './lead-dedup.repository';
import { normalizeEmail, normalizePhone } from './lead-contact.util';
import { LeadIngestRulesRepository } from './lead-ingest-rules.repository';

export interface EnrichedCreateLeadBody extends CreateLeadV1Body {
  is_duplicate?: boolean;
  meta?: Record<string, unknown>;
  owner_company_id?: string | null;
  b2b_first_assign?: {
    projectId: string;
    strategy: string;
    reason: string;
    confidence: number | null;
  };
}

@Injectable()
export class LeadCreateEnrichmentService {
  constructor(
    private readonly dedup: LeadDedupRepository,
    private readonly rulesRepo: LeadIngestRulesRepository,
    private readonly autoAssign: LeadAutoAssignService,
    private readonly b2bFirstAssign: B2bFirstAssignService,
    private readonly appConfig: AppConfigService,
  ) {}

  async enrich(body: CreateLeadV1Body): Promise<EnrichedCreateLeadBody> {
    const phone = normalizePhone(body.phone);
    const email = normalizeEmail(body.email);
    const meta: Record<string, unknown> = {
      nest_write: true,
      created_via: 'POST /api/v1/leads',
      ingest_path: 'nest_manual',
    };

    const isB2bFlow =
      body.lead_flow_kind === 'b2b_prospect' ||
      (!body.lead_flow_kind && !String(body.client_id ?? '').trim());

    let clientId = body.client_id ?? null;
    let b2bProjectId = body.b2b_project_id ?? null;
    let ownerCompanyId: string | null = body.owner_company_id ?? null;

    if (this.appConfig.b2bProjectOs && isB2bFlow) {
      if (!String(b2bProjectId ?? '').trim()) {
        throw new BadRequestException({ error: 'b2b_project_required' });
      }
      ownerCompanyId = PTT_OPERATING_COMPANY_ID;
      clientId = null;
    }

    const existingExternal = await this.dedup.findByExternalId({
      clientId: clientId ?? undefined,
      channel: body.channel,
      externalLeadId: body.external_lead_id,
    });
    if (existingExternal) {
      throw new ConflictException({
        error: 'duplicate_external_id',
        message: `Lead external ID đã tồn tại (#${existingExternal})`,
        lead_id: existingExternal,
      });
    }

    const dupMatches = await this.dedup.findContactDuplicates({
      phone,
      email,
      b2bProjectId: b2bProjectId ?? undefined,
    });
    const isDuplicate = dupMatches.length > 0;
    const duplicateOfId = isDuplicate ? dupMatches[0].lead_id : null;
    if (duplicateOfId) {
      meta.duplicate_of_id = duplicateOfId;
      meta.dedup_matches = dupMatches.slice(0, 3).map((row) => row.lead_id);
    }

    let ownerId = body.owner_id ?? null;
    let assignStrategy = '';
    let b2bFirstAssignMeta: EnrichedCreateLeadBody['b2b_first_assign'];
    const explicitOwner = ownerId != null && Number(ownerId) > 0;

    if (
      !explicitOwner &&
      !isDuplicate &&
      this.appConfig.b2bProjectOs &&
      isB2bFlow &&
      b2bProjectId
    ) {
      const scoreRaw = (body as CreateLeadV1Body & { meta?: Record<string, unknown> }).meta
        ?.lead_score;
      const score =
        typeof scoreRaw === 'number'
          ? scoreRaw
          : typeof scoreRaw === 'string' && scoreRaw.trim()
            ? Number(scoreRaw)
            : null;
      const assign = await this.b2bFirstAssign.assign({
        projectId: b2bProjectId,
        score: Number.isFinite(score) ? score : null,
        channel: body.channel,
        source: body.source,
        phone: phone || body.phone,
      });
      if (assign.ownerId) {
        ownerId = assign.ownerId;
        assignStrategy = assign.strategy;
        meta.assign_strategy = assign.strategy;
        meta.assign_reason = assign.reason;
        if (assign.confidence != null) meta.assign_confidence = assign.confidence;
        meta.auto_assigned_at = new Date().toISOString();
        b2bFirstAssignMeta = {
          projectId: b2bProjectId,
          strategy: assign.strategy,
          reason: assign.reason,
          confidence: assign.confidence,
        };
      } else {
        meta.assign_failed = true;
        meta.assign_failed_at = new Date().toISOString();
        meta.assign_failed_reason = assign.reason || 'empty_pool';
      }
    } else if (!explicitOwner && !isDuplicate) {
      const industrySlug = clientId
        ? await this.rulesRepo.fetchClientIndustry(clientId)
        : null;
      meta.industry_slug = industrySlug ?? null;
      const assign = await this.autoAssign.assignOwner({
        industrySlug,
        serviceSlug: 'lead-gen',
      });
      if (assign) {
        ownerId = assign.owner_id;
        assignStrategy = assign.strategy;
        meta.assign_strategy = assign.strategy;
        meta.assign_pool_key = assign.pool_key;
        meta.auto_assigned_at = new Date().toISOString();
      } else if (await this.rulesRepo.fetchSnapshot()) {
        meta.assign_failed = true;
        meta.assign_failed_at = new Date().toISOString();
        meta.assign_failed_reason = 'Không tìm được nhân viên phù hợp (assign-scopes / snapshot)';
      }
    }

    if (assignStrategy) {
      meta.assign_strategy = assignStrategy;
    }

    if (body.lead_flow_kind === 'spa_operational' || body.lead_flow_kind === 'b2b_prospect') {
      meta.lead_flow_kind = body.lead_flow_kind;
    }

    return {
      ...body,
      phone: phone || body.phone,
      email: email || body.email,
      client_id: clientId,
      b2b_project_id: b2bProjectId,
      owner_company_id: ownerCompanyId,
      owner_id: ownerId,
      status: body.status?.trim() || 'moi',
      is_duplicate: isDuplicate,
      meta,
      b2b_first_assign: b2bFirstAssignMeta,
    };
  }
}
