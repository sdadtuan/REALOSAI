import { Injectable } from '@nestjs/common';
import { TicketsSqliteRepository } from './tickets-sqlite.repository';
import type {
  CreateTicketBody,
  CreateTicketMessageBody,
  ListTicketsQuery,
  PatchTicketBody,
  TicketMessageRow,
  TicketRow,
} from './tickets.types';

@Injectable()
export class TicketsService {
  constructor(private readonly repo: TicketsSqliteRepository) {}

  list(query: ListTicketsQuery) {
    return this.repo.list(query);
  }

  getById(id: number): TicketRow | null {
    return this.repo.getById(id);
  }

  create(body: CreateTicketBody): TicketRow {
    return this.repo.create(body);
  }

  patch(id: number, body: PatchTicketBody): TicketRow {
    return this.repo.patch(id, body);
  }

  listMessages(ticketId: number): TicketMessageRow[] {
    return this.repo.listMessages(ticketId);
  }

  addMessage(ticketId: number, body: CreateTicketMessageBody): TicketMessageRow {
    return this.repo.addMessage(ticketId, body);
  }
}
