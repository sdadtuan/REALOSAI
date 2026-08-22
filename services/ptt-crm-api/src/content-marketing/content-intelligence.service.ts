import { BadRequestException, Injectable } from '@nestjs/common';
import { ContentBrandContextService } from './content-brand-context.service';
import { ContentExternalMetricsService } from './content-external-metrics.service';
import { ContentJobWorkerService } from './content-job-worker.service';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import {
  aggregateIntelligence,
  buildTopicSuggestions,
  mergeExternalIntoChannels,
  parseMetricsRange,
  summarizeMetrics,
} from './content-intelligence.util';
import { parseSuggestionToIdea } from './content-suggestion-apply.util';
import type {
  CmktApplySuggestionsResult,
  CmktIntelligenceResponse,
  CmktJobRow,
  CmktMetricsSummaryResponse,
} from './content-marketing.types';

@Injectable()
export class ContentIntelligenceService {
  constructor(
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
    private readonly brandContext: ContentBrandContextService,
    private readonly worker: ContentJobWorkerService,
    private readonly externalMetrics: ContentExternalMetricsService,
  ) {}

  async getIntelligence(lifecycleId: number, rangeInput?: string | null): Promise<CmktIntelligenceResponse> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const range = parseMetricsRange(rangeInput);
    const [rows, publishedByChannel, cached, weeklyMemo, external] = await Promise.all([
      this.repo.listLifecycleMetricsInRange(lifecycleId, range.fromDate, range.toDate),
      this.repo.countPublishedItemsByChannel(lifecycleId, range.fromDate, range.toDate),
      this.repo.getLatestTopicSuggestions(lifecycleId),
      this.repo.getLatestWeeklyMemo(lifecycleId),
      this.externalMetrics.collect(lifecycleId, range),
    ]);
    const base = aggregateIntelligence(rows, range, publishedByChannel, cached);
    return {
      ...base,
      by_channel: mergeExternalIntoChannels(base.by_channel, external),
      external_metrics: external,
      weekly_memo: weeklyMemo,
    };
  }

  async getMetricsSummary(
    lifecycleId: number,
    rangeInput?: string | null,
  ): Promise<CmktMetricsSummaryResponse> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const range = parseMetricsRange(rangeInput);
    const rows = await this.repo.listLifecycleMetricsInRange(lifecycleId, range.fromDate, range.toDate);
    const publishedByChannel = await this.repo.countPublishedItemsByChannel(
      lifecycleId,
      range.fromDate,
      range.toDate,
    );
    return summarizeMetrics(rows, range, publishedByChannel);
  }

  async getSuggestions(lifecycleId: number, rangeInput?: string | null): Promise<{ suggestions: string[] }> {
    const intel = await this.getIntelligence(lifecycleId, rangeInput);
    return { suggestions: intel.suggestions };
  }

  async startTopicSuggestJob(
    lifecycleId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const range = parseMetricsRange(body.range != null ? String(body.range) : '30d');
    const job = await this.repo.createContentJob({
      lifecycle_id: lifecycleId,
      item_id: null,
      job_type: 'topic_suggest',
      input_json: { range: range.range },
      created_by: actorEmail,
    });
    const finished = await this.worker.processJob(job.id);
    return finished ?? job;
  }

  async startWeeklyMemoJob(
    lifecycleId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const range = parseMetricsRange(body.range != null ? String(body.range) : '7d');
    const job = await this.repo.createContentJob({
      lifecycle_id: lifecycleId,
      item_id: null,
      job_type: 'weekly_memo',
      input_json: { range: range.range },
      created_by: actorEmail,
    });
    const finished = await this.worker.processJob(job.id);
    return finished ?? job;
  }

  async startIntelligenceDigestJob(
    lifecycleId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const range = parseMetricsRange(body.range != null ? String(body.range) : '30d');
    const job = await this.repo.createContentJob({
      lifecycle_id: lifecycleId,
      item_id: null,
      job_type: 'intelligence_digest',
      input_json: { range: range.range },
      created_by: actorEmail,
    });
    const finished = await this.worker.processJob(job.id);
    return finished ?? job;
  }

  async applySuggestions(
    lifecycleId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktApplySuggestionsResult> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const leaderConfirm = body.leader_confirm === true;
    const suggestions =
      Array.isArray(body.suggestions) && body.suggestions.length
        ? body.suggestions.map(String)
        : await this.repo.getLatestTopicSuggestions(lifecycleId);

    if (!suggestions.length) {
      throw new BadRequestException({
        error: 'suggestions_empty',
        message: 'Không có gợi ý để apply — chạy topic suggest trước.',
      });
    }

    const rawIndices = Array.isArray(body.suggestion_indices)
      ? body.suggestion_indices.map((v) => Number(v)).filter((n) => Number.isFinite(n))
      : null;

    const entries =
      rawIndices != null && rawIndices.length
        ? rawIndices
            .filter((index) => index >= 0 && index < suggestions.length)
            .map((index) => ({ index, text: suggestions[index]! }))
        : suggestions.map((text, index) => ({ index, text }));

    if (!entries.length) {
      throw new BadRequestException({
        error: 'suggestion_indices_invalid',
        message: 'Chỉ số suggestion không hợp lệ.',
      });
    }

    if (entries.length > 1 && !leaderConfirm) {
      throw new BadRequestException({
        error: 'leader_confirm_required',
        message: 'Bulk apply cần leader_confirm=true.',
      });
    }

    const pillars = await this.repo.listPillars(lifecycleId);
    const pillarByName = new Map(pillars.map((p) => [p.name.toLowerCase(), p.id]));
    const created = [];

    for (const entry of entries) {
      const parsed = parseSuggestionToIdea({
        suggestion: entry.text,
        pillarNames: pillars.map((p) => p.name),
      });
      const pillarId =
        parsed.pillar_name != null
          ? pillarByName.get(parsed.pillar_name.toLowerCase()) ?? null
          : null;
      const row = await this.repo.createIdea(lifecycleId, {
        title: parsed.title,
        hook: parsed.hook,
        target_goal: parsed.target_goal,
        channel_hints: parsed.channel_hints,
        pillar_id: pillarId,
        status: 'backlog',
        meta_json: {
          source: 'intelligence',
          suggestion_index: entry.index,
          change_reason: entries.length > 1 ? 'intelligence_bulk_apply' : 'intelligence_apply',
        },
        source: 'intelligence',
        created_by: actorEmail,
      });
      created.push(row);
    }

    return {
      ok: true,
      ideas_created: created.length,
      idea_ids: created.map((i) => i.id),
      ideas: created,
    };
  }

  async bulkApplySuggestions(
    lifecycleId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktApplySuggestionsResult> {
    return this.applySuggestions(
      lifecycleId,
      { ...body, leader_confirm: true },
      actorEmail,
    );
  }

  async buildSuggestionsForLifecycle(lifecycleId: number, rangeInput?: string | null): Promise<string[]> {
    const range = parseMetricsRange(rangeInput);
    const [rows, publishedByChannel, brand, pillars] = await Promise.all([
      this.repo.listLifecycleMetricsInRange(lifecycleId, range.fromDate, range.toDate),
      this.repo.countPublishedItemsByChannel(lifecycleId, range.fromDate, range.toDate),
      this.brandContext.resolveForLifecycle(lifecycleId),
      this.repo.listPillars(lifecycleId),
    ]);
    const intelligence = aggregateIntelligence(rows, range, publishedByChannel);
    return buildTopicSuggestions({
      intelligence,
      pillarNames: pillars.map((p) => p.name),
      brandName: String(brand.brand_name ?? 'Brand'),
    });
  }
}
