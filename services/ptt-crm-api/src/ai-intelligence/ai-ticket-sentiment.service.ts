import { Injectable, NotFoundException } from '@nestjs/common';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { computeTicketSentiment } from './ticket-sentiment.engine';
import {
  TicketSentimentScoreRequest,
  TicketSentimentScoreResponse,
} from './ticket-sentiment.types';
import { TicketsSqliteRepository } from '../tickets/tickets-sqlite.repository';

@Injectable()
export class AiTicketSentimentService {
  constructor(
    private readonly audit: AiAuditService,
    private readonly tickets: TicketsSqliteRepository,
  ) {}

  async scoreTicket(input: TicketSentimentScoreRequest): Promise<TicketSentimentScoreResponse> {
    const ticketId = Number(input.ticket_id);
    if (!Number.isFinite(ticketId) || ticketId <= 0) {
      throw new NotFoundException({ error: 'ticket_not_found' });
    }

    const ticket = this.tickets.getById(ticketId);
    if (!ticket) {
      throw new NotFoundException({ error: 'ticket_not_found' });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const force = Boolean(input.force);

    if (
      !force &&
      ticket.sentiment_label &&
      ticket.sentiment_scored_at &&
      Date.now() - Date.parse(ticket.sentiment_scored_at) < 86_400_000
    ) {
      return {
        data: {
          ticket_id: ticketId,
          sentiment: {
            label: ticket.sentiment_label as 'positive' | 'neutral' | 'negative',
            score: ticket.sentiment_score ?? 50,
            confidence: ticket.sentiment_confidence ?? 0.5,
            factors: [],
          },
          agent_run_id: '',
          scored_at: ticket.sentiment_scored_at,
        },
        meta: { request_id: requestId },
        errors: [],
      };
    }

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.TICKET_SENTIMENT,
        entityType: 'ticket',
        entityId: String(ticketId),
        actorId: input.actorId ?? 'system',
        correlationId: requestId,
        modelName: 'ticket-sentiment-v1',
        input: { ticket_id: ticketId, force },
      },
      async () => {
        const snapshot = computeTicketSentiment({
          ticket_id: ticketId,
          title: ticket.title,
          description: ticket.description,
          ticket_type: ticket.ticket_type,
          priority: ticket.priority,
          resolution: ticket.resolution,
        });
        const scoredAt = new Date().toISOString();
        this.tickets.updateSentiment(ticketId, {
          label: snapshot.label,
          score: snapshot.score,
          confidence: snapshot.confidence,
          scored_at: scoredAt,
        });
        return {
          data: snapshot,
          output: {
            ticket_id: ticketId,
            sentiment_label: snapshot.label,
            sentiment_score: snapshot.score,
          },
        };
      },
    );

    const scoredAt = new Date().toISOString();
    return {
      data: {
        ticket_id: ticketId,
        sentiment: wrapped.data,
        agent_run_id: wrapped.runId,
        scored_at: scoredAt,
      },
      meta: { request_id: requestId },
      errors: [],
    };
  }
}
