import { Controller, Get, Headers, Post, Param, Query, UseGuards, Body } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { CrmLeadsLegacyService } from '../crm-leads-legacy/crm-leads-legacy.service';
import { TimelineEventSource } from './customer-timeline.constants';
import { CustomerTimelineService } from './customer-timeline.service';
import {
  CustomerTimelineApiEnvelope,
  TimelineCompletenessReport,
  TimelineBackfillResult,
} from './customer-timeline.types';

@Controller('api/v1/timeline')
export class CustomerTimelineController {
  constructor(private readonly timeline: CustomerTimelineService) {}

  @Get(':entityType/:entityId')
  @UseGuards(StaffOrInternalKeyGuard)
  getTimeline(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('event_source') eventSource?: TimelineEventSource,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.timeline.getTimelineEnvelope(
      entityType,
      entityId,
      {
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
        eventSource,
      },
      correlationId?.trim() || requestId?.trim() || undefined,
    );
  }
}

@Controller('api/v1/ai/timeline')
export class AiTimelineController {
  constructor(
    private readonly timeline: CustomerTimelineService,
    private readonly legacyLeads: CrmLeadsLegacyService,
  ) {}

  /** AI context builder input — RNOS-16 / RNOS-03 prep. */
  @Get('context')
  @UseGuards(StaffOrInternalKeyGuard)
  async getAiContext(
    @Query('entity_type') entityType: string,
    @Query('entity_id') entityId: string,
    @Query('limit') limit?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<CustomerTimelineApiEnvelope<{ items: Awaited<ReturnType<CustomerTimelineService['buildAiContext']>> }>> {
    const items = await this.timeline.buildAiContext(
      entityType,
      entityId,
      limit ? Number(limit) : 20,
    );
    return {
      data: { items },
      meta: { request_id: correlationId?.trim() || requestId?.trim() || this.timeline.newRequestId() },
      errors: [],
    };
  }

  /** Phase 0 gate — timeline completeness ≥70% on pilot sample. */
  @Get('completeness')
  @UseGuards(StaffOrInternalKeyGuard)
  async completeness(
    @Query('sample_limit') sampleLimit?: string,
    @Headers('x-request-id') requestId?: string,
  ): Promise<CustomerTimelineApiEnvelope<TimelineCompletenessReport & { gate_pass: boolean }>> {
    const report = await this.timeline.completenessReport(
      sampleLimit ? Number(sampleLimit) : 500,
    );
    return {
      data: {
        ...report,
        gate_pass: report.completeness_pct >= 70,
      },
      meta: { request_id: requestId ?? this.timeline.newRequestId() },
      errors: [],
    };
  }

  /** AI-UC-008 — one-time legacy activity mirror to raise completeness ≥70%. */
  @Post('backfill')
  @UseGuards(StaffOrInternalKeyGuard)
  async backfill(
    @Body() body: { limit?: number },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<CustomerTimelineApiEnvelope<TimelineBackfillResult>> {
    const result = await this.legacyLeads.backfillTimelineBatch(
      body?.limit ? Number(body.limit) : 50,
    );
    return {
      data: result,
      meta: { request_id: correlationId?.trim() || requestId?.trim() || this.timeline.newRequestId() },
      errors: [],
    };
  }
}
