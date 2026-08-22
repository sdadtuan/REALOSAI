export type TicketSentimentLabel = 'positive' | 'neutral' | 'negative';

export interface TicketSentimentFactor {
  key: string;
  label: string;
  delta: number;
  sign: '+' | '-';
}

export interface TicketSentimentInput {
  ticket_id: number;
  title: string;
  description: string;
  ticket_type: string;
  priority: string;
  resolution?: string;
}

export interface TicketSentimentSnapshot {
  label: TicketSentimentLabel;
  score: number;
  confidence: number;
  factors: TicketSentimentFactor[];
}

export interface TicketSentimentScoreRequest {
  ticket_id: number;
  force?: boolean;
  actorId?: string | null;
  correlationId?: string;
}

export interface TicketSentimentScoreResponse {
  data: {
    ticket_id: number;
    sentiment: TicketSentimentSnapshot;
    agent_run_id: string;
    scored_at: string;
  };
  meta: { request_id: string };
  errors: unknown[];
}
