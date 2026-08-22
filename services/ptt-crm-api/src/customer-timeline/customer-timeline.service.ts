import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { LeadActivityRow } from '../crm-leads-legacy/crm-leads-legacy.types';
import { LeadV1 } from '../leads/leads.types';
import {
  TIMELINE_ENTITY,
  TIMELINE_EVENT,
  TimelineEventSource,
} from './customer-timeline.constants';
import { CustomerTimelineRepository } from './customer-timeline.repository';
import {
  AiTimelineContextItem,
  CustomerTimelineApiEnvelope,
  CustomerTimelineEvent,
  CustomerTimelineListQuery,
  CustomerTimelineViewResult,
  TimelineBackfillResult,
  TimelineCompletenessReport,
} from './customer-timeline.types';

function channelToEventSource(channel: string | null | undefined): TimelineEventSource {
  const ch = String(channel ?? '')
    .trim()
    .toLowerCase();
  if (ch === 'meta' || ch === 'facebook') return 'meta';
  if (ch === 'zalo') return 'zalo';
  if (ch === 'email') return 'email';
  if (ch === 'seo') return 'seo';
  return 'crm';
}

function activitySource(activityType: string): TimelineEventSource {
  if (activityType === 'call') return 'call';
  if (activityType === 'system') return 'system';
  return 'crm';
}

@Injectable()
export class CustomerTimelineService {
  private readonly logger = new Logger(CustomerTimelineService.name);

  constructor(private readonly repo: CustomerTimelineRepository) {}

  newRequestId(): string {
    return randomUUID();
  }

  async isReady(): Promise<boolean> {
    return this.repo.tableReady();
  }

  async getTimelineEnvelope(
    entityType: string,
    entityId: string,
    query: Omit<CustomerTimelineListQuery, 'entityType' | 'entityId'>,
    requestId?: string,
  ): Promise<
    CustomerTimelineApiEnvelope<{
      entity_type: string;
      entity_id: string;
      events: CustomerTimelineEvent[];
      total: number;
      limit: number;
      offset: number;
    }>
  > {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    const requestMeta = requestId ?? this.newRequestId();

    if (!(await this.repo.tableReady())) {
      return {
        data: {
          entity_type: entityType,
          entity_id: entityId,
          events: [],
          total: 0,
          limit,
          offset,
        },
        meta: { request_id: requestMeta },
        errors: [
          {
            code: 'timeline_not_ready',
            message: 'Timeline chưa sẵn sàng — cần apply DDL customer_timeline_events (RNOS-01).',
          },
        ],
      };
    }

    const result = await this.repo.listEvents({
      entityType,
      entityId,
      eventSource: query.eventSource,
      limit,
      offset,
    });
    return {
      data: {
        entity_type: entityType,
        entity_id: entityId,
        events: result.rows,
        total: result.total,
        limit,
        offset,
      },
      meta: { request_id: requestMeta },
      errors: [],
    };
  }

  async buildAiContext(
    entityType: string,
    entityId: string,
    limit = 20,
  ): Promise<AiTimelineContextItem[]> {
    if (!(await this.repo.tableReady())) {
      return [];
    }
    const result = await this.repo.listEvents({ entityType, entityId, limit });
    return result.rows.map((row) => ({
      event_type: row.event_type,
      event_source: row.event_source,
      title: row.title,
      summary: this.summarizeBody(row.body, row.payload),
      occurred_at: row.occurred_at,
      payload_keys: Object.keys(row.payload ?? {}),
    }));
  }

  async completenessReport(sampleLimit = 500): Promise<TimelineCompletenessReport> {
    await this.assertReady();
    return this.repo.completenessReport(sampleLimit);
  }

  async listLeadIdsMissingTimeline(limit = 50): Promise<number[]> {
    if (!(await this.repo.tableReady())) {
      return [];
    }
    return this.repo.listLeadIdsWithoutTimeline(limit);
  }

  async countLeadsMissingTimeline(): Promise<number> {
    if (!(await this.repo.tableReady())) {
      return 0;
    }
    return this.repo.countLeadsWithoutTimeline();
  }

  async getCustomerTimelineEnvelope(
    customerId: number,
    linkedLeadIds: number[],
    query: { limit?: number; offset?: number; eventSource?: CustomerTimelineListQuery['eventSource'] },
    requestId?: string,
  ): Promise<CustomerTimelineApiEnvelope<CustomerTimelineViewResult>> {
    const ready = await this.repo.tableReady();
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);

    if (!ready || !linkedLeadIds.length) {
      return {
        data: {
          customer_id: customerId,
          linked_lead_ids: linkedLeadIds,
          events: [],
          total: 0,
          limit,
          offset,
          timeline_ready: ready,
        },
        meta: { request_id: requestId ?? this.newRequestId() },
        errors: [],
      };
    }

    const result = await this.repo.listEventsForLeadIds(
      linkedLeadIds.map(String),
      query,
    );

    return {
      data: {
        customer_id: customerId,
        linked_lead_ids: linkedLeadIds,
        events: result.rows.map((row) => ({
          ...row,
          linked_lead_id: Number(row.entity_id),
        })),
        total: result.total,
        limit,
        offset,
        timeline_ready: true,
      },
      meta: { request_id: requestId ?? this.newRequestId() },
      errors: [],
    };
  }

  /** Mirror CRM activity → timeline (RNOS-16). */
  async recordActivityFromLegacy(
    leadId: number,
    activity: LeadActivityRow,
    clientId?: string | null,
  ): Promise<CustomerTimelineEvent | null> {
    if (!(await this.repo.tableReady())) {
      return null;
    }
    const resolvedClientId = clientId ?? (await this.resolveClientId(leadId));
    const activityType = String(activity.activity_type ?? 'note');
    const externalRef = `activity:${leadId}:${activity.id}`;

    try {
      const existing = await this.repo.findByExternalRef(externalRef);
      if (existing) return existing;

      return await this.repo.insertEvent({
        clientId: resolvedClientId,
        entityType: TIMELINE_ENTITY.LEAD,
        entityId: String(leadId),
        eventType: TIMELINE_EVENT.ACTIVITY,
        eventSource: activitySource(activityType),
        title: activity.activity_type_label || activityType,
        body: [activity.content, activity.result].filter(Boolean).join('\n').slice(0, 4000) || null,
        payload: {
          entity_type: TIMELINE_ENTITY.LEAD,
          entity_id: String(leadId),
          activity_id: activity.id,
          activity_type: activityType,
          next_action: activity.next_action || null,
        },
        occurredAt: activity.created_at,
        actorId: activity.created_by || null,
        externalRef,
      });
    } catch (err) {
      this.logMirrorError('recordActivityFromLegacy', err);
      return null;
    }
  }

  async recordStatusChange(input: {
    leadId: number;
    from: string | null | undefined;
    to: string;
    actorId?: string | null;
    note?: string;
    clientId?: string | null;
    occurredAt?: string;
  }): Promise<CustomerTimelineEvent | null> {
    if (!(await this.repo.tableReady())) {
      return null;
    }
    const resolvedClientId = input.clientId ?? (await this.resolveClientId(input.leadId));
    const externalRef = `status:${input.leadId}:${input.from ?? 'null'}:${input.to}:${input.occurredAt ?? ''}`;

    try {
      return await this.repo.insertEvent({
        clientId: resolvedClientId,
        entityType: TIMELINE_ENTITY.LEAD,
        entityId: String(input.leadId),
        eventType: TIMELINE_EVENT.STATUS_CHANGED,
        eventSource: 'crm',
        title: `Trạng thái: ${input.from ?? '?'} → ${input.to}`,
        body: input.note?.slice(0, 2000) || null,
        payload: {
          entity_type: TIMELINE_ENTITY.LEAD,
          entity_id: String(input.leadId),
          from_status: input.from ?? null,
          to_status: input.to,
        },
        occurredAt: input.occurredAt,
        actorId: input.actorId ?? null,
        externalRef,
      });
    } catch (err) {
      this.logMirrorError('recordStatusChange', err);
      return null;
    }
  }

  async recordLeadIngested(input: {
    leadId: number;
    channel?: string | null;
    clientId?: string | null;
    source?: string | null;
    externalLeadId?: string | null;
    campaignId?: string | null;
    attribution?: Record<string, unknown>;
    correlationId?: string | null;
    occurredAt?: string;
  }): Promise<CustomerTimelineEvent | null> {
    if (!(await this.repo.tableReady())) {
      return null;
    }
    const eventSource = channelToEventSource(input.channel);
    const ext = String(input.externalLeadId ?? '').trim();
    const externalRef =
      ext && input.channel
        ? `ingest:${String(input.channel).toLowerCase()}:${ext}`
        : `ingest:lead:${input.leadId}`;

    try {
      const existing = await this.repo.findByExternalRef(externalRef);
      if (existing) return existing;

      return await this.repo.insertEvent({
        clientId: input.clientId ?? (await this.resolveClientId(input.leadId)),
        entityType: TIMELINE_ENTITY.LEAD,
        entityId: String(input.leadId),
        eventType: TIMELINE_EVENT.LEAD_INGESTED,
        eventSource,
        title: `Lead ingest (${input.channel ?? 'unknown'})`,
        body: null,
        payload: {
          entity_type: TIMELINE_ENTITY.LEAD,
          entity_id: String(input.leadId),
          channel: input.channel ?? null,
          source: input.source ?? null,
          external_lead_id: input.externalLeadId ?? null,
          campaign_id: input.campaignId ?? null,
          correlation_id: input.correlationId ?? null,
          attribution: input.attribution ?? {},
        },
        occurredAt: input.occurredAt,
        actorId: 'system',
        externalRef,
      });
    } catch (err) {
      this.logMirrorError('recordLeadIngested', err);
      return null;
    }
  }

  async recordLeadCreatedFromV1(lead: LeadV1, correlationId?: string | null): Promise<void> {
    await this.recordLeadIngested({
      leadId: lead.id,
      channel: lead.channel,
      clientId: lead.client_id,
      source: lead.source,
      externalLeadId: lead.external_lead_id,
      campaignId: lead.campaign_id,
      correlationId,
      occurredAt: lead.received_at || lead.created_at,
      attribution: {
        channel: lead.channel,
        source: lead.source,
        campaign_id: lead.campaign_id,
      },
    });
  }

  /** RNOS-16 full — mirror AI copilot actions to unified timeline. */
  async recordAiAction(input: {
    entityType: string;
    entityId: string;
    title: string;
    body?: string | null;
    useCase: string;
    actorId?: string | null;
    clientId?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<CustomerTimelineEvent | null> {
    if (!(await this.repo.tableReady())) {
      return null;
    }
    const externalRef = `ai:${input.useCase}:${input.entityType}:${input.entityId}:${Date.now()}`;
    try {
      return await this.repo.insertEvent({
        clientId: input.clientId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        eventType: TIMELINE_EVENT.AI_ACTION,
        eventSource: 'ai',
        title: input.title,
        body: input.body?.slice(0, 4000) ?? null,
        payload: {
          use_case: input.useCase,
          ...(input.payload ?? {}),
        },
        occurredAt: new Date().toISOString(),
        actorId: input.actorId ?? null,
        externalRef,
      });
    } catch (err) {
      this.logMirrorError('recordAiAction', err);
      return null;
    }
  }

  private async resolveClientId(leadId: number): Promise<string | null> {
    return this.repo.getLeadClientId(leadId);
  }

  private summarizeBody(body: string | null, payload: Record<string, unknown>): string | null {
    if (body?.trim()) {
      return body.trim().slice(0, 280);
    }
    const parts: string[] = [];
    if (payload.from_status && payload.to_status) {
      parts.push(`${payload.from_status} → ${payload.to_status}`);
    }
    if (payload.channel) {
      parts.push(`channel=${String(payload.channel)}`);
    }
    if (payload.activity_type) {
      parts.push(`activity=${String(payload.activity_type)}`);
    }
    return parts.length ? parts.join(' · ') : null;
  }

  private async assertReady(): Promise<void> {
    if (!(await this.repo.tableReady())) {
      throw new Error('customer_timeline_events not ready — apply RNOS-01 DDL');
    }
  }

  private logMirrorError(op: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(`Timeline mirror ${op} failed: ${message}`);
  }
}
