import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { TicketsPgRepository } from './tickets-pg.repository';
import { TicketsSqliteRepository } from './tickets-sqlite.repository';
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
  constructor(
    private readonly sqlite: TicketsSqliteRepository,
    private readonly pg: TicketsPgRepository,
    private readonly config: AppConfigService,
  ) {}

  private get usePg(): boolean {
    return this.config.crmTicketsPg;
  }

  list(query: ListTicketsQuery) {
    return this.usePg ? this.pg.list(query) : this.sqlite.list(query);
  }

  getById(id: number): TicketRow | null | Promise<TicketRow | null> {
    return this.usePg ? this.pg.getById(id) : this.sqlite.getById(id);
  }

  create(body: CreateTicketBody): TicketRow | Promise<TicketRow> {
    return this.usePg ? this.pg.create(body) : this.sqlite.create(body);
  }

  patch(id: number, body: PatchTicketBody): TicketRow | Promise<TicketRow> {
    return this.usePg ? this.pg.patch(id, body) : this.sqlite.patch(id, body);
  }

  updateSentiment(
    ticketId: number,
    input: UpdateTicketSentimentInput,
  ): TicketRow | Promise<TicketRow> {
    return this.usePg
      ? this.pg.updateSentiment(ticketId, input)
      : this.sqlite.updateSentiment(ticketId, input);
  }

  listMessages(ticketId: number): TicketMessageRow[] | Promise<TicketMessageRow[]> {
    return this.usePg ? this.pg.listMessages(ticketId) : this.sqlite.listMessages(ticketId);
  }

  addMessage(
    ticketId: number,
    body: CreateTicketMessageBody,
  ): TicketMessageRow | Promise<TicketMessageRow> {
    return this.usePg ? this.pg.addMessage(ticketId, body) : this.sqlite.addMessage(ticketId, body);
  }
}
