/** Timeline event_type values (RNOS-16 / AI-UC-008). */
export const TIMELINE_EVENT = {
  LEAD_INGESTED: 'lead.ingested',
  STATUS_CHANGED: 'lead.status_changed',
  ACTIVITY: 'crm.activity',
  ASSIGNMENT: 'lead.assigned',
  AI_ACTION: 'ai.action',
  LEAD_MEETING_PREP_READY: 'lead_meeting_prep_ready',
} as const;

export type TimelineEventType = (typeof TIMELINE_EVENT)[keyof typeof TIMELINE_EVENT];

export const TIMELINE_EVENT_SOURCE = [
  'crm',
  'meta',
  'zalo',
  'email',
  'seo',
  'call',
  'system',
  'ai',
] as const;

export type TimelineEventSource = (typeof TIMELINE_EVENT_SOURCE)[number];

export const TIMELINE_ENTITY = {
  LEAD: 'lead',
  CUSTOMER: 'customer',
} as const;
