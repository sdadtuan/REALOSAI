import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentBrandContextService } from './content-brand-context.service';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import {
  buildSnapshotJson,
  computePlannerSourceHash,
  extractCalendarRows,
  extractIdeasFromPlanner,
  extractPillarsFromPlanner,
  normalizeIdeaTitle,
} from './content-plan-snapshot.util';
import {
  buildDriftDiffPayload,
  type CmktDriftCalendarRow,
} from './content-plan-drift-diff.util';
import type { CmktIngestResult, CmktPlanSnapshotPayload } from './content-marketing.types';

@Injectable()
export class ContentPlanSnapshotService {
  constructor(
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
    private readonly brandContext: ContentBrandContextService,
  ) {}

  async getPlanSnapshot(lifecycleId: number): Promise<CmktPlanSnapshotPayload> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const active = await this.repo.getActiveUnsealedSnapshot(lifecycleId);
    const sealedLatest = active ?? (await this.repo.getActiveSnapshotSummary(lifecycleId));
    const plannerSource = await this.repo.loadPlannerSource(lifecycleId);
    const currentHash = plannerSource ? computePlannerSourceHash(plannerSource) : null;
    const snapshotRow = active ?? sealedLatest;
    const pillars = snapshotRow
      ? await this.repo.listPillars(lifecycleId, snapshotRow.id)
      : await this.repo.listPillars(lifecycleId);

    return {
      snapshot: snapshotRow
        ? {
            id: snapshotRow.id,
            lifecycle_id: lifecycleId,
            marketing_plan_id: snapshotRow.marketing_plan_id,
            sealed: snapshotRow.sealed,
            source_hash: snapshotRow.source_hash,
            ingested_at: snapshotRow.ingested_at.toISOString(),
            ingested_by: snapshotRow.ingested_by,
            snapshot_json: snapshotRow.snapshot_json,
            brand_context_json: snapshotRow.brand_context_json,
          }
        : null,
      pillars,
      planner: {
        marketing_plan_id: plannerSource?.marketing_plan_id ?? null,
        has_applied_plan: Boolean(plannerSource?.marketing_plan_id),
        current_source_hash: currentHash,
        drift:
          Boolean(snapshotRow?.source_hash) &&
          Boolean(currentHash) &&
          snapshotRow!.source_hash !== currentHash,
      },
    };
  }

  async ingestPlanSnapshot(
    lifecycleId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktIngestResult> {
    await this.core.ensureLifecycleEnabled(lifecycleId);

    const plannerSource = await this.repo.loadPlannerSource(lifecycleId);
    if (!plannerSource?.marketing_plan_id) {
      throw new BadRequestException({
        error: 'no_applied_plan',
        message: 'Chưa có TMMT chính thức — Apply AI Planner trước khi import.',
      });
    }

    const requestedPlanId =
      body.marketing_plan_id != null ? Number(body.marketing_plan_id) : plannerSource.marketing_plan_id;
    if (requestedPlanId !== plannerSource.marketing_plan_id) {
      throw new BadRequestException({
        error: 'marketing_plan_mismatch',
        expected: plannerSource.marketing_plan_id,
        received: requestedPlanId,
      });
    }

    const mode = String(body.mode ?? 'merge').toLowerCase();
    if (mode !== 'merge' && mode !== 'replace') {
      throw new BadRequestException({ error: 'invalid_ingest_mode', mode });
    }
    const importCalendar = body.import_calendar !== false;
    const importPillars = body.import_pillars !== false;

    const snapshotJson = buildSnapshotJson(plannerSource);
    const brandContextJson = this.brandContext.buildFromBrief(plannerSource.brief_json);
    const sourceHash = computePlannerSourceHash(plannerSource);

    if (mode === 'replace') {
      await this.repo.archivePlannerImportedIdeas(lifecycleId);
    }

    const snapshotId = await this.repo.upsertActiveSnapshot({
      lifecycle_id: lifecycleId,
      marketing_plan_id: plannerSource.marketing_plan_id,
      snapshot_json: snapshotJson,
      brand_context_json: brandContextJson,
      source_hash: sourceHash,
      ingested_by: actorEmail,
    });

    let pillarsUpserted = 0;
    if (importPillars) {
      pillarsUpserted = await this.repo.replacePillarsForSnapshot(
        lifecycleId,
        snapshotId,
        extractPillarsFromPlanner(plannerSource),
      );
    }

    const warnings: string[] = [];
    let ideasCreated = 0;
    if (importCalendar) {
      const existingTitles = await this.repo.listIdeaTitleKeys(lifecycleId);
      const drafts = extractIdeasFromPlanner(plannerSource, { importCalendar: true });

      for (const draft of drafts) {
        const key = normalizeIdeaTitle(draft.title);
        if (existingTitles.has(key)) {
          warnings.push(`Skipped duplicate title: ${draft.title}`);
          continue;
        }
        await this.repo.createIdeaFromImport(lifecycleId, {
          title: draft.title,
          hook: draft.hook,
          target_goal: draft.target_goal,
          channel_hints: draft.channel_hints,
          meta_json: draft.meta_json,
          created_by: actorEmail,
        });
        existingTitles.add(key);
        ideasCreated++;
      }

      if (!drafts.length) {
        warnings.push('No calendar rows found in Planner content_json');
      }
    }

    return {
      ok: true,
      snapshot_id: snapshotId,
      ideas_created: ideasCreated,
      pillars_upserted: pillarsUpserted,
      warnings,
    };
  }

  async sealPlanSnapshot(lifecycleId: number): Promise<{ ok: boolean; snapshot_id: number; sealed: boolean }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const sealed = await this.repo.sealActiveSnapshot(lifecycleId);
    if (!sealed) {
      throw new NotFoundException({ error: 'no_active_snapshot' });
    }
    return { ok: true, snapshot_id: sealed.id, sealed: true };
  }

  async getPlannerDrift(lifecycleId: number): Promise<boolean> {
    const snapshot = await this.repo.getActiveSnapshotSummary(lifecycleId);
    const plannerSource = await this.repo.loadPlannerSource(lifecycleId);
    if (!snapshot?.source_hash || !plannerSource) return false;
    return snapshot.source_hash !== computePlannerSourceHash(plannerSource);
  }

  async getDriftDiff(lifecycleId: number) {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const snapshotRow = await this.repo.getActiveSnapshotSummary(lifecycleId);
    const plannerSource = await this.repo.loadPlannerSource(lifecycleId);
    const drift = await this.getPlannerDrift(lifecycleId);

    const snapshotPillars = snapshotRow
      ? (
          await this.repo.listPillars(lifecycleId, snapshotRow.id)
        ).map((p) => ({
          name: p.name,
          goal: p.goal,
          topics: p.topics_json ?? [],
          sort_order: p.sort_order,
        }))
      : [];

    const snapshotCalendar: CmktDriftCalendarRow[] = Array.isArray(
      snapshotRow?.snapshot_json?.calendar,
    )
      ? (snapshotRow!.snapshot_json.calendar as Array<Record<string, unknown>>).map((r) => ({
          title: String(r.title ?? ''),
          date: String(r.date ?? r.scheduled_at ?? ''),
          channel: String(r.channel ?? ''),
          type: String(r.type ?? r.format ?? ''),
        }))
      : [];

    const currentPillars = plannerSource ? extractPillarsFromPlanner(plannerSource) : [];
    const currentCalendar: CmktDriftCalendarRow[] = plannerSource
      ? extractCalendarRows(plannerSource.content_json).map((r) => ({
          title: String(r.title ?? ''),
          date: String(r.date ?? ''),
          channel: String(r.channel ?? ''),
          type: String(r.type ?? ''),
        }))
      : [];

    return buildDriftDiffPayload({
      drift,
      canReingest: Boolean(plannerSource?.marketing_plan_id),
      snapshotPillars,
      currentPillars,
      snapshotCalendar,
      currentCalendar,
    });
  }
}
