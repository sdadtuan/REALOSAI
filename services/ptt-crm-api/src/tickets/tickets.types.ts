import {
  ISSUE_PRIORITIES,
  ISSUE_PRIORITY_LABELS,
  ISSUE_STATUSES,
  ISSUE_STATUS_LABELS,
  ISSUE_TYPES,
  ISSUE_TYPE_LABELS,
  normalizeIssuePriority,
  normalizeIssueStatus,
  normalizeIssueType,
} from '../customers/customers.types';
import { CRM_CHANNELS, CRM_CHANNEL_LABELS, normalizeCaseChannel } from '../cases/cases.types';

export {
  ISSUE_PRIORITIES,
  ISSUE_PRIORITY_LABELS,
  ISSUE_STATUSES,
  ISSUE_STATUS_LABELS,
  ISSUE_TYPES,
  ISSUE_TYPE_LABELS,
  CRM_CHANNELS,
  CRM_CHANNEL_LABELS,
  normalizeIssuePriority,
  normalizeIssueStatus,
  normalizeIssueType,
  normalizeCaseChannel as normalizeChannel,
};

export interface TicketRow {
  id: number;
  customer_id: number;
  customer_name: string;
  agency_client_id: string | null;
  ticket_type: string;
  ticket_type_label: string;
  status: string;
  status_label: string;
  priority: string;
  priority_label: string;
  channel: string;
  channel_label: string;
  title: string;
  description: string;
  resolution: string;
  assigned_staff_id: number | null;
  assigned_staff_name: string;
  sentiment_label: string | null;
  sentiment_score: number | null;
  sentiment_confidence: number | null;
  sentiment_scored_at: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string;
}

export interface TicketMessageRow {
  id: number;
  ticket_id: number;
  author_staff_id: number | null;
  author_staff_name: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface CreateTicketBody {
  customer_id: number;
  ticket_type?: string;
  priority?: string;
  channel?: string;
  title: string;
  description?: string;
  assigned_staff_id?: number | null;
}

export interface PatchTicketBody {
  ticket_type?: string;
  priority?: string;
  status?: string;
  channel?: string;
  title?: string;
  description?: string;
  resolution?: string;
  assigned_staff_id?: number | null;
}

export interface ListTicketsQuery {
  q?: string;
  status?: string;
  priority?: string;
  sentiment?: string;
  customer_id?: number;
  assigned_staff_id?: number;
  limit?: number;
  offset?: number;
}

export interface CreateTicketMessageBody {
  body: string;
  is_internal?: boolean;
  author_staff_id?: number | null;
}

export interface UpdateTicketSentimentInput {
  label: string;
  score: number;
  confidence: number;
  scored_at: string;
}
