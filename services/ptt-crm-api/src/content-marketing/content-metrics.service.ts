import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import type { CmktMetricRow } from './content-marketing.types';

function parseMetricDate(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new BadRequestException({ error: 'metric_date_invalid', message: 'metric_date phải dạng YYYY-MM-DD.' });
  }
  return raw;
}

function parseOptionalLong(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new BadRequestException({ error: 'metric_value_invalid', field: value });
  }
  return Math.floor(n);
}

@Injectable()
export class ContentMetricsService {
  constructor(
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
  ) {}

  async listItemMetrics(lifecycleId: number, itemId: number): Promise<{ metrics: CmktMetricRow[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    const metrics = await this.repo.listItemMetrics(itemId);
    return { metrics };
  }

  async createMetric(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<{ metric: CmktMetricRow }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });

    const metricDate = parseMetricDate(body.metric_date ?? new Date().toISOString().slice(0, 10));
    const impressions = parseOptionalLong(body.impressions);
    const engagements = parseOptionalLong(body.engagements);
    const clicks = parseOptionalLong(body.clicks);
    const leads = parseOptionalLong(body.leads);
    if (impressions == null && engagements == null && clicks == null && leads == null) {
      throw new BadRequestException({
        error: 'metric_values_required',
        message: 'Cần ít nhất một giá trị impressions/engagements/clicks/leads.',
      });
    }

    const channel = String(body.channel ?? item.channel ?? '').trim() || item.channel;
    const source = String(body.source ?? 'manual').trim() || 'manual';
    const metric = await this.repo.insertMetricReturning({
      item_id: itemId,
      channel,
      metric_date: metricDate,
      impressions,
      engagements,
      clicks,
      leads,
      source,
      raw_json: typeof body.raw_json === 'object' && body.raw_json ? (body.raw_json as Record<string, unknown>) : {},
    });
    return { metric };
  }

  async patchMetric(
    lifecycleId: number,
    itemId: number,
    metricId: number,
    body: Record<string, unknown>,
  ): Promise<{ metric: CmktMetricRow }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });

    const existing = await this.repo.getMetricById(itemId, metricId);
    if (!existing) throw new NotFoundException({ error: 'metric_not_found', id: metricId });

    const patch: Partial<CmktMetricRow> = {};
    if (body.metric_date != null) patch.metric_date = parseMetricDate(body.metric_date);
    if (body.impressions !== undefined) patch.impressions = parseOptionalLong(body.impressions);
    if (body.engagements !== undefined) patch.engagements = parseOptionalLong(body.engagements);
    if (body.clicks !== undefined) patch.clicks = parseOptionalLong(body.clicks);
    if (body.leads !== undefined) patch.leads = parseOptionalLong(body.leads);
    if (body.channel != null) patch.channel = String(body.channel).trim();

    const metric = await this.repo.patchMetric(itemId, metricId, patch);
    if (!metric) throw new NotFoundException({ error: 'metric_not_found', id: metricId });
    return { metric };
  }
}
