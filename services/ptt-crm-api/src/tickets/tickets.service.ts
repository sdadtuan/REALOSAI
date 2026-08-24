import { Injectable } from '@nestjs/common';
import { TicketsPgRepository } from './tickets-pg.repository';
import type {
  CreateTicketBody,
  CreateTicketMessageBody,
  ListTicketsQuery,
  PatchTicketBody,
  TicketMessageRow,
  TicketRow,
  UpdateTicketSentimentInput,
} from './tickets.types';

@Injectable()
export class TicketsService {
  constructor(private readonly pg: TicketsPgRepository) {}

  list(query: ListTicketsQuery) {
    return this.pg.list(query);
  }

  getById(id: number): Promise<TicketRow | null> {
    return this.pg.getById(id);
  }

  create(body: CreateTicketBody): Promise<TicketRow> {
    return this.pg.create(body);
  }

  patch(id: number, body: PatchTicketBody): Promise<TicketRow> {
    return this.pg.patch(id, body);
  }

  updateSentiment(ticketId: number, input: UpdateTicketSentimentInput): Promise<TicketRow> {
    return this.pg.updateSentiment(ticketId, input);
  }

  listMessages(ticketId: number): Promise<TicketMessageRow[]> {
    return this.pg.listMessages(ticketId);
  }

  addMessage(ticketId: number, body: CreateTicketMessageBody): Promise<TicketMessageRow> {
    return this.pg.addMessage(ticketId, body);
  }
}
