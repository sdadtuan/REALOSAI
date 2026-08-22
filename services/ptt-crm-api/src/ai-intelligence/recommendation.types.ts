export type FollowUpChannelHint = 'zalo' | 'email' | 'note';

export type RecommendationStatus = 'pending' | 'accepted' | 'dismissed' | 'executed' | 'expired';

export type RecommendationType = 'follow_up_draft';

export interface AiRecommendationRecord {
  id: string;
  client_id: string | null;
  entity_type: string;
  entity_id: string;
  recommendation_type: string;
  recommendation_text: string;
  action_json: Record<string, unknown>;
  confidence: number | null;
  status: RecommendationStatus;
  dismissed_reason: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  agent_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRecommendationRequest {
  type: string;
  entityType: string;
  entityId: string;
  channelHint?: FollowUpChannelHint;
  contextText?: string;
  actorId?: string | null;
  actorName?: string | null;
  actorUserId?: number | null;
  correlationId?: string;
}

export interface PatchRecommendationRequest {
  status: 'accepted' | 'dismissed';
  finalText?: string;
  dismissReason?: string;
  actorId?: string | null;
  actorName?: string | null;
  actorUserId?: number | null;
  correlationId?: string;
}

export interface RecommendationResponse {
  data: {
    id: string;
    recommendation_type: string;
    entity_type: string;
    entity_id: string;
    text: string;
    channel_hint: FollowUpChannelHint;
    subject?: string | null;
    confidence: number;
    status: RecommendationStatus;
    agent_run_id: string;
    stub_mode: boolean;
    activity_id?: number;
  };
  meta: { request_id: string; latency_ms?: number };
  errors: [];
}

export interface RecommendationListResponse {
  data: {
    entity_type: string;
    entity_id: string;
    recommendations: AiRecommendationRecord[];
  };
  meta: { request_id: string };
  errors: [];
}

export const FOLLOW_UP_CHANNELS: FollowUpChannelHint[] = ['zalo', 'email', 'note'];

export const CHANNEL_LABELS: Record<FollowUpChannelHint, string> = {
  zalo: 'Zalo',
  email: 'Email',
  note: 'Ghi chú nội bộ',
};
