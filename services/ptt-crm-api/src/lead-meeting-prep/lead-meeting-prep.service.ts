import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProposalsService } from '../proposals/proposals.service';
import { ProposalsSqliteRepository } from '../proposals/proposals-sqlite.repository';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { LeadMeetingPrepEnqueueService } from './lead-meeting-prep-enqueue.service';
import { LeadMeetingPrepInputResolver } from './lead-meeting-prep-input.resolver';
import { LeadMeetingPrepRepository } from './lead-meeting-prep.repository';
import { extractReadinessBreakdown } from './close-readiness.util';
import { buildQuoteLinesFromOfferLadder, type LmpOfferLadderRow } from './lmp-offer-ladder-quote.util';
import { buildLmpDealRoomSciSlice } from './lmp-sci-slice.util';
import { buildSciRedFlagBlockInfo } from './lmp-red-flag-block.util';
import { buildWinOutcomeFromDebrief, winOutcomeHasDebrief } from './lmp-win-outcome.util';
import type {
  ApplyOfferLadderResponse,
  LeadMeetingPrepDebriefBody,
  LeadMeetingPrepCallDebriefBody,
  LeadMeetingPrepFeedbackBody,
  LeadMeetingPrepStage,
  LeadMeetingPrepStatus,
  RunLeadMeetingPrepBody,
  SelectEntityBody,
  WinOutcomeJson,
} from './lead-meeting-prep.types';

const STATUS_LABEL_VI: Record<LeadMeetingPrepStatus, string> = {
  pending: 'Đang xếp hàng',
  running: 'Đang xử lý',
  awaiting_entity_choice: 'Cần chọn doanh nghiệp',
  ready: 'Sẵn sàng',
  failed: 'Lỗi',
  skipped: 'Bỏ qua',
  cancelled: 'Đã hủy',
};

const APPLY_LADDER_STAGES: LeadMeetingPrepStage[] = ['m2_qualify_win', 'm3_pre_close'];

@Injectable()
export class LeadMeetingPrepService {
  constructor(
    private readonly repo: LeadMeetingPrepRepository,
    private readonly enqueue: LeadMeetingPrepEnqueueService,
    private readonly inputResolver: LeadMeetingPrepInputResolver,
    private readonly proposals: ProposalsService,
    private readonly proposalsSqlite: ProposalsSqliteRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  async getMeetingPrep(leadId: number) {
    const ctx = await this.repo.getLeadContext(leadId);
    if (!ctx) {
      throw new NotFoundException({ error: 'Lead not found' });
    }

    let row = await this.repo.getByLeadId(leadId);
    const terminal = ['chot', 'lost'].includes(String(ctx.status ?? '').trim().toLowerCase());
    if (!row) {
      const resolved = this.inputResolver.resolve(ctx);
      return {
        ok: true,
        lead_id: leadId,
        status: 'skipped' as const,
        status_label_vi: STATUS_LABEL_VI.skipped,
        progress: {
          step: 'none',
          steps_completed: [] as string[],
          message_vi: 'Chưa chạy prep',
        },
        prep_stage: 'm1_first_strike' as const,
        close_readiness_score: null,
        input_snapshot: { input: resolved.input, sources_map: resolved.sources_map },
        entity_candidates: null,
        result: null,
        error: null,
        prep_version: 0,
        updated_at: null,
        win_outcome: null,
        debrief_pending: terminal,
      };
    }

    const stepsCompleted: string[] = [];
    if (row.status === 'ready' || row.status === 'failed') {
      stepsCompleted.push('collect', 'verify', 'strategize', 'arm');
    } else if (row.status === 'running') {
      stepsCompleted.push('collect', 'verify');
    }

    const result =
      row.status === 'ready' ? (row.result_json as Record<string, unknown>) : null;
    const readinessBreakdown = extractReadinessBreakdown(result);

    return {
      ok: true,
      lead_id: leadId,
      status: row.status,
      status_label_vi: STATUS_LABEL_VI[row.status],
      progress: {
        step: row.status === 'ready' ? 'done' : row.status,
        steps_completed: stepsCompleted,
        message_vi: STATUS_LABEL_VI[row.status],
      },
      prep_stage: row.prep_stage,
      close_readiness_score: row.close_readiness_score,
      readiness_breakdown: readinessBreakdown,
      input_snapshot: row.input_snapshot_json,
      entity_candidates:
        row.status === 'awaiting_entity_choice' ? row.entity_candidates_json : null,
      result,
      error: row.error_message,
      prep_version: row.prep_version,
      updated_at: row.updated_at,
      win_outcome: row.win_outcome_json as unknown as WinOutcomeJson,
      debrief_pending: terminal && !winOutcomeHasDebrief(row.win_outcome_json),
    };
  }

  async getDealRoomSlice(leadId: number) {
    const ctx = await this.repo.getLeadContext(leadId);
    if (!ctx) {
      throw new NotFoundException({ error: 'Lead not found' });
    }
    const row = await this.repo.getByLeadId(leadId);
    return {
      ok: true,
      lead_id: leadId,
      sci: buildLmpDealRoomSciSlice(row, leadId),
    };
  }

  async applyOfferLadder(
    leadId: number,
    options: { gdkdOverride?: boolean; actorPositionId?: number } = {},
  ): Promise<ApplyOfferLadderResponse> {
    const ctx = await this.repo.getLeadContext(leadId);
    if (!ctx) {
      throw new NotFoundException({ error: 'Lead not found' });
    }

    const row = await this.repo.getByLeadId(leadId);
    if (!row || row.status !== 'ready') {
      throw new BadRequestException({
        error: 'prep_not_ready',
        message: 'Cần prep status=ready trước khi áp offer ladder.',
      });
    }
    if (!APPLY_LADDER_STAGES.includes(row.prep_stage)) {
      throw new BadRequestException({
        error: 'prep_stage_invalid',
        message: 'apply-offer-ladder chỉ khả dụng ở M2/M3.',
      });
    }

    const sci = row.result_json?.close_intelligence as Record<string, unknown> | undefined;
    const redFlagBlock = buildSciRedFlagBlockInfo(sci);
    if (redFlagBlock.active) {
      let canOverride = false;
      if (options.gdkdOverride && options.actorPositionId) {
        const caps = await this.staffAuth.loadCaps(options.actorPositionId);
        canOverride = this.staffAuth.hasCap(caps, 'crm_leads', 'assign');
      }
      if (!canOverride) {
        throw new BadRequestException({
          error: 'sci_red_flag_block',
          message: redFlagBlock.reason,
          red_flags: redFlagBlock.flags,
        });
      }
    }

    const ladder = sci?.offer_ladder;
    if (!Array.isArray(ladder) || ladder.length !== 3) {
      throw new BadRequestException({
        error: 'offer_ladder_invalid',
        message: 'close_intelligence.offer_ladder phải có đúng 3 gói CB/TC/CS.',
      });
    }

    const lines = buildQuoteLinesFromOfferLadder(ladder as LmpOfferLadderRow[]);
    const existingDraft = this.proposalsSqlite
      .listByLeadId(leadId)
      .find((p) => p.status === 'draft');

    let proposalId: number;
    if (existingDraft) {
      const updated = await this.proposals.putLines(existingDraft.id, { lines });
      proposalId = updated.proposal_id;
    } else {
      const created = await this.proposals.create({
        lead_id: leadId,
        lines,
      });
      proposalId = Number(created.id);
    }

    return {
      ok: true,
      lead_id: leadId,
      proposal_id: proposalId,
      href: `/crm/proposals/${proposalId}/edit`,
      tiers_applied: ['CB', 'TC', 'CS'],
    };
  }

  async submitFeedback(
    leadId: number,
    body: LeadMeetingPrepFeedbackBody,
    actorEmail: string,
  ) {
    const row = await this.repo.getByLeadId(leadId);
    if (!row) {
      throw new NotFoundException({ error: 'meeting_prep_not_found' });
    }
    const feedback = await this.repo.insertFeedback({
      leadId,
      prepId: row.id,
      helpful: Boolean(body.helpful),
      notes: body.notes?.trim() || null,
      serviceDvCode: body.service_dv_code?.trim() || null,
      actorEmail: actorEmail || 'unknown',
    });
    return {
      ok: true,
      lead_id: leadId,
      feedback_id: feedback.id,
    };
  }

  async submitCallDebrief(
    leadId: number,
    body: LeadMeetingPrepCallDebriefBody,
    actorEmail: string,
  ) {
    const ctx = await this.repo.getLeadContext(leadId);
    if (!ctx) {
      throw new NotFoundException({ error: 'Lead not found' });
    }

    const status = String(ctx.status ?? '').trim().toLowerCase();
    if (status === 'chot' || status === 'lost') {
      throw new BadRequestException({
        error: 'terminal_status_use_debrief',
        message: 'Lead đã chốt/lost — dùng debrief chốt.',
      });
    }

    const hasObjection = Boolean(body.objection_faced?.trim());
    const hasFeedback = Boolean(body.am_feedback?.trim());
    const hasSciHelpful = body.sci_helpful !== undefined;
    if (!hasObjection && !hasFeedback && !hasSciHelpful) {
      throw new BadRequestException({
        error: 'debrief_empty',
        message: 'Vui lòng trả lời ít nhất một câu debrief.',
      });
    }

    const resolved = this.inputResolver.resolve(ctx);
    const prepRow = await this.repo.ensurePrepRow(leadId, {
      input: resolved.input,
      sources_map: resolved.sources_map,
    });

    const noteLines: string[] = ['[call_debrief]'];
    if (body.activity_id != null && Number.isFinite(body.activity_id)) {
      noteLines.push(`activity_id=${body.activity_id}`);
    }
    if (hasObjection) {
      noteLines.push(`objection: ${body.objection_faced!.trim()}`);
    }
    if (hasFeedback) {
      noteLines.push(`am: ${body.am_feedback!.trim()}`);
    }

    const feedback = await this.repo.insertFeedback({
      leadId,
      prepId: prepRow.id,
      helpful: hasSciHelpful ? Boolean(body.sci_helpful) : true,
      notes: noteLines.join('\n'),
      actorEmail: actorEmail || 'unknown',
    });

    return {
      ok: true,
      lead_id: leadId,
      feedback_id: feedback.id,
    };
  }

  async runMeetingPrep(leadId: number, body: RunLeadMeetingPrepBody = {}) {
    const ctx = await this.repo.getLeadContext(leadId);
    if (!ctx) {
      throw new NotFoundException({ error: 'Lead not found' });
    }

    const resolved = this.inputResolver.resolve(ctx);
    if (body.website_url?.trim()) {
      resolved.input.website_url = body.website_url.trim();
    }
    if (body.social_urls?.trim()) {
      resolved.input.social_urls = body.social_urls.trim();
    }

    const prepStage = body.prep_stage ?? 'm1_first_strike';

    const job = await this.enqueue.enqueueForStage({
      leadId,
      clientId: ctx.client_id,
      prepStage,
      mode: body.mode,
      force: Boolean(body.force),
    });

    return {
      ok: true,
      lead_id: leadId,
      enqueued: Boolean(job),
      job_id: job?.id ?? null,
      prep: await this.getMeetingPrep(leadId),
    };
  }

  async prepareClose(leadId: number) {
    const ctx = await this.repo.getLeadContext(leadId);
    if (!ctx) {
      throw new NotFoundException({ error: 'Lead not found' });
    }
    const job = await this.enqueue.enqueuePrepareClose(leadId, true);
    return {
      ok: true,
      lead_id: leadId,
      enqueued: Boolean(job),
      job_id: job?.id ?? null,
      prep: await this.getMeetingPrep(leadId),
    };
  }

  async submitDebrief(
    leadId: number,
    body: LeadMeetingPrepDebriefBody,
    actorEmail: string,
  ) {
    const ctx = await this.repo.getLeadContext(leadId);
    if (!ctx) {
      throw new NotFoundException({ error: 'Lead not found' });
    }

    const status = String(ctx.status ?? '').trim().toLowerCase();
    if (status !== 'chot' && status !== 'lost') {
      throw new BadRequestException({
        error: 'terminal_status_required',
        message: 'Debrief chỉ khả dụng khi lead ở trạng thái chot hoặc lost.',
      });
    }

    if (!body.closed_tier && !body.objection_faced?.trim() && !body.am_feedback?.trim()) {
      throw new BadRequestException({
        error: 'debrief_empty',
        message: 'Vui lòng trả lời ít nhất một câu debrief.',
      });
    }

    const prepRow = await this.repo.getByLeadId(leadId);
    const winOutcome = buildWinOutcomeFromDebrief({
      leadStatus: status,
      metaJson: ctx.meta_json ?? {},
      debrief: body,
      actorEmail,
      prepStage: prepRow?.prep_stage ?? null,
    });

    await this.repo.updateWinOutcome(leadId, winOutcome as unknown as Record<string, unknown>);

    const job = await this.enqueue.enqueueLearnAfterDebrief(leadId, ctx.client_id);

    return {
      ok: true,
      lead_id: leadId,
      win_outcome: winOutcome,
      learn_enqueued: Boolean(job),
      prep: await this.getMeetingPrep(leadId),
    };
  }

  async selectEntity(leadId: number, body: SelectEntityBody) {
    const entityId = String(body.entity_id ?? '').trim();
    if (!entityId) {
      throw new NotFoundException({ error: 'entity_id required' });
    }

    const job = await this.enqueue.enqueueAfterLeadCreated({
      leadId,
      prepStage: 'm1_first_strike',
      mode: 'resume_entity',
      selectedEntityId: entityId,
      force: true,
    });

    return {
      ok: true,
      lead_id: leadId,
      entity_id: entityId,
      enqueued: Boolean(job),
      job_id: job?.id ?? null,
      prep: await this.getMeetingPrep(leadId),
    };
  }
}
