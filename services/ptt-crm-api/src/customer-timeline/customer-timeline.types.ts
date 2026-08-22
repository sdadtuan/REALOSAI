import { TimelineEventSource, TimelineEventType } from './customer-timeline.constants';

export interface CustomerTimelineInsert {
  clientId?: string | null;
  entityType: string;
  entityId: string;
  eventType: TimelineEventType | string;
  eventSource: TimelineEventSource;
  title?: string | null;
  body?: string | null;
  payload?: Record<string, unknown>;
  occurredAt?: string | Date;
  actorId?: string | null;
  externalRef?: string | null;
}

export interface CustomerTimelineEvent {
  id: string;
  client_id: string | null;
  entity_type: string;
  entity_id: string;
  event_type: string;
  event_source: TimelineEventSource;
  title: string | null;
  body: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
  actor_id: string | null;
  external_ref: string | null;
  created_at: string;
}

export interface CustomerTimelineListQuery {
  entityType: string;
  entityId: string;
  limit?: number;
  offset?: number;
  eventSource?: TimelineEventSource;
}

export interface CustomerTimelineListResult {
  rows: CustomerTimelineEvent[];
  total: number;
}

export interface AiTimelineContextItem {
  event_type: string;
  event_source: TimelineEventSource;
  title: string | null;
  summary: string | null;
  occurred_at: string;
  payload_keys: string[];
}

export interface TimelineCompletenessReport {
  total_leads: number;
  leads_with_timeline: number;
  completeness_pct: number;
  sample_limit: number;
}

export interface CustomerTimelineViewEvent extends CustomerTimelineEvent {
  linked_lead_id?: number;
}

export interface CustomerTimelineViewResult {
  customer_id: number;
  linked_lead_ids: number[];
  events: CustomerTimelineViewEvent[];
  total: number;
  limit: number;
  offset: number;
  timeline_ready: boolean;
}

export interface TimelineBackfillResult {
  leads_processed: number;
  events_mirrored: number;
  leads_remaining: number;
}

export interface CustomerTimelineApiEnvelope<T> {
  data: T;
  meta: { request_id: string };
  errors: unknown[];
}
