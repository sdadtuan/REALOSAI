import { Injectable, Logger } from '@nestjs/common';
import { EnqueuedJob, JobQueueRepository } from '../webhooks/job-queue.repository';
import { AppConfigService } from '../config/app-config.service';
import { LeadMeetingPrepInputResolver } from './lead-meeting-prep-input.resolver';
import { LeadMeetingPrepRepository } from './lead-meeting-prep.repository';
import {
  buildLmpIdempotencyKey,
  LMP_M2_COLLECT_REUSE_HOURS,
  resolveModeForStage,
} from './lmp-stage.util';
import type { EnqueueLeadMeetingPrepInput, LeadMeetingPrepStage } from './lead-meeting-prep.types';

/** S-LMP-1 / S-LMP-5 — enqueue lead_meeting_prep at funnel moments. */
@Injectable()
export class LeadMeetingPrepEnqueueService {
  private readonly logger = new Logger(LeadMeetingPrepEnqueueService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly jobQueue: JobQueueRepository,
    private readonly repo: LeadMeetingPrepRepository,
    private readonly inputResolver: LeadMeetingPrepInputResolver,
  ) {}

  isEnabled(): boolean {
    return this.config.leadMeetingPrepEnabled && this.config.jobsEnabled;
  }

  async enqueueAfterLeadCreated(input: EnqueueLeadMeetingPrepInput): Promise<EnqueuedJob | null> {
    return this.enqueueForStage({
      ...input,
      prepStage: input.prepStage ?? 'm1_first_strike',
    });
  }

  async enqueueAfterIntakeGo(leadId: number, clientId?: string | null): Promise<EnqueuedJob | null> {
    return this.enqueueForStage({
      leadId,
      clientId,
      prepStage: 'm2_qualify_win',
    });
  }

  async enqueueAfterProposalGatePass(
    leadId: number,
    clientId?: string | null,
  ): Promise<EnqueuedJob | null> {
    return this.enqueueForStage({
      leadId,
      clientId,
      prepStage: 'm3_pre_close',
    });
  }

  async enqueuePrepareClose(leadId: number, force = true): Promise<EnqueuedJob | null> {
    return this.enqueueForStage({
      leadId,
      prepStage: 'm3_pre_close',
      force,
    });
  }

  /** S-LMP-6 — M4 learn loop after terminal status chot/lost. */
  async enqueueAfterTerminalStatus(
    leadId: number,
    terminalStatus: 'chot' | 'lost',
    clientId?: string | null,
  ): Promise<EnqueuedJob | null> {
    if (!this.isEnabled()) return null;
    return this.enqueueForStage({
      leadId,
      clientId,
      prepStage: 'm4_learn',
      mode: 'learn',
      force: false,
      terminalStatus,
    });
  }

  async enqueueLearnAfterDebrief(leadId: number, clientId?: string | null): Promise<EnqueuedJob | null> {
    if (!this.isEnabled()) return null;
    return this.enqueueForStage({
      leadId,
      clientId,
      prepStage: 'm4_learn',
      mode: 'learn',
      force: true,
    });
  }

  async enqueueForStage(input: EnqueueLeadMeetingPrepInput): Promise<EnqueuedJob | null> {
    if (!this.isEnabled()) return null;

    const leadId = Number(input.leadId);
    if (!Number.isFinite(leadId) || leadId <= 0) return null;

    try {
      if (!(await this.repo.tableReady())) {
        this.logger.warn(`lead_meeting_prep table missing — apply DDL lead=${leadId}`);
        return null;
      }

      const ctx = await this.repo.getLeadContext(leadId);
      if (!ctx) return null;

      const prepStage: LeadMeetingPrepStage = input.prepStage ?? 'm1_first_strike';
      const pilotOpts = {
        pilotClientIds: this.config.lmpPilotClientIds,
        pilotOnly: this.config.lmpPilotOnly,
      };
      const skipReason =
        prepStage === 'm1_first_strike'
          ? this.inputResolver.isEligibleForAutoEnqueue(ctx, pilotOpts)
          : this.inputResolver.isEligibleForEnqueue(ctx, pilotOpts);

      const resolved = this.inputResolver.resolve(ctx);
      const snapshot = {
        input: resolved.input,
        sources_map: resolved.sources_map,
      };

      if (skipReason || (prepStage !== 'm4_learn' && resolved.skip_reason)) {
        if (prepStage === 'm1_first_strike') {
          await this.repo.markSkipped(
            leadId,
            skipReason ?? resolved.skip_reason ?? 'skipped',
            snapshot,
          );
        }
        if (prepStage === 'm4_learn') {
          this.logger.debug(`M4 learn skipped lead=${leadId}: ${skipReason ?? resolved.skip_reason}`);
        }
        return null;
      }

      const existing = await this.repo.getByLeadId(leadId);
      const collectFresh = this.isCollectFresh(existing?.updated_at ?? null);
      const hasCollect = Boolean(existing?.collect_json && Object.keys(existing.collect_json).length);
      const mode =
        input.mode ??
        resolveModeForStage(prepStage, {
          hasCollect,
          collectFresh,
        });

      if (prepStage !== 'm4_learn') {
        await this.repo.upsertPending({
          leadId,
          prepStage,
          inputSnapshot: snapshot,
          selectedEntityId: input.selectedEntityId ?? null,
        });
      }

      const idempotencyKey = buildLmpIdempotencyKey(leadId, prepStage, Boolean(input.force));

      const job = await this.jobQueue.enqueueLeadMeetingPrepJob({
        leadId,
        clientId: input.clientId ?? ctx.client_id,
        correlationId: input.correlationId ?? undefined,
        prepStage,
        mode,
        selectedEntityId: input.selectedEntityId ?? null,
        idempotencyKey,
        terminalStatus: input.terminalStatus,
      });

      if (job?.created) {
        this.logger.debug(`lead_meeting_prep enqueued lead=${leadId} stage=${prepStage} mode=${mode}`);
      }
      return job;
    } catch (err) {
      this.logger.warn(`lead_meeting_prep enqueue skipped lead=${leadId}: ${String(err)}`);
      return null;
    }
  }

  private isCollectFresh(updatedAt: string | null): boolean {
    if (!updatedAt) return false;
    const ms = Date.parse(updatedAt);
    if (!Number.isFinite(ms)) return false;
    const ttlMs = LMP_M2_COLLECT_REUSE_HOURS * 60 * 60 * 1000;
    return Date.now() - ms <= ttlMs;
  }
}
