import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import { mapMessageRow, mapTicketRow } from './tickets-pg.mapper';
import {
  CreateTicketBody,
  CreateTicketMessageBody,
  ListTicketsQuery,
  PatchTicketBody,
  TicketMessageRow,
  TicketRow,
  UpdateTicketSentimentInput,
  normalizeChannel,
  normalizeIssuePriority,
  normalizeIssueStatus,
  normalizeIssueType,
} from './tickets.types';

const TICKET_SELECT = `
  t.*,
  c.name AS customer_name,
  COALESCE(c.sqlite_customer_id, c.id) AS legacy_customer_id,
  st.name AS assigned_staff_name`;

@Injectable()
export class TicketsPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  private async resolveTicketPgId(
    legacyId: number,
  ): Promise<{ pgId: number; legacyId: number } | null> {
    const result = await this.db.query(
      `SELECT id, sqlite_ticket_id FROM crm_tickets
       WHERE sqlite_ticket_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_ticket_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [legacyId],
    );
    const row = result.rows[0] as { id?: unknown; sqlite_ticket_id?: unknown } | undefined;
    if (!row?.id) return null;
    const pgId = Number(row.id);
    const resolvedLegacyId = Number(row.sqlite_ticket_id ?? row.id);
    return { pgId, legacyId: resolvedLegacyId };
  }

  private async resolveCustomerPgId(
    legacyId: number,
  ): Promise<{ pgId: number; legacyId: number } | null> {
    const result = await this.db.query(
      `SELECT id, sqlite_customer_id FROM crm_customers
       WHERE sqlite_customer_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_customer_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [legacyId],
    );
    const row = result.rows[0] as { id?: unknown; sqlite_customer_id?: unknown } | undefined;
    if (!row?.id) return null;
    const pgId = Number(row.id);
    const resolvedLegacyId = Number(row.sqlite_customer_id ?? row.id);
    return { pgId, legacyId: resolvedLegacyId };
  }

  private async resolveAgencyClientId(customerPgId: number): Promise<string | null> {
    try {
      const result = await this.db.query(
        `SELECT TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id
         FROM crm_contracts ct
         WHERE ct.customer_id = $1
           AND ct.status = 'active'
           AND TRIM(COALESCE(ct.agency_client_id, '')) != ''
         ORDER BY ct.ends_on DESC NULLS LAST, ct.id DESC
         LIMIT 1`,
        [customerPgId],
      );
      const row = result.rows[0] as { agency_client_id?: unknown } | undefined;
      const id = String(row?.agency_client_id ?? '').trim();
      return id || null;
    } catch {
      return null;
    }
  }

  private async mapTicketWithAgency(row: Record<string, unknown>): Promise<TicketRow> {
    const customerPgId = Number(row.customer_id);
    const agencyClientId = Number.isFinite(customerPgId)
      ? await this.resolveAgencyClientId(customerPgId)
      : null;
    return mapTicketRow(row, agencyClientId);
  }

  async list(query: ListTicketsQuery = {}): Promise<{ tickets: TicketRow[]; total: number }> {
    const params: unknown[] = [];
    const where: string[] = [];
    let paramIdx = 1;

    if (query.status) {
      where.push(`t.status = $${paramIdx++}`);
      params.push(normalizeIssueStatus(query.status));
    }
    if (query.priority) {
      where.push(`t.priority = $${paramIdx++}`);
      params.push(normalizeIssuePriority(query.priority));
    }
    if (query.sentiment) {
      where.push(`t.sentiment_label = $${paramIdx++}`);
      params.push(String(query.sentiment).trim());
    }
    if (query.customer_id && Number.isFinite(query.customer_id)) {
      where.push(`(c.sqlite_customer_id = $${paramIdx} OR c.id = $${paramIdx})`);
      params.push(Number(query.customer_id));
      paramIdx++;
    }
    if (query.assigned_staff_id && Number.isFinite(query.assigned_staff_id)) {
      where.push(`t.assigned_staff_id = $${paramIdx++}`);
      params.push(Number(query.assigned_staff_id));
    }
    if (query.q) {
      const like = `%${String(query.q).trim()}%`;
      where.push(
        `(t.title ILIKE $${paramIdx} OR c.name ILIKE $${paramIdx} OR t.description ILIKE $${paramIdx})`,
      );
      params.push(like);
      paramIdx++;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalResult = await this.db.query(
      `SELECT COUNT(*)::int AS n
       FROM crm_tickets t
       LEFT JOIN crm_customers c ON c.id = t.customer_id
       ${whereSql}`,
      params,
    );
    const limit = Math.min(Math.max(Number(query.limit ?? 100) || 100, 1), 300);
    const offset = Math.max(Number(query.offset ?? 0) || 0, 0);
    const listResult = await this.db.query(
      `SELECT ${TICKET_SELECT}
       FROM crm_tickets t
       LEFT JOIN crm_customers c ON c.id = t.customer_id
       LEFT JOIN crm_staff st ON st.id = t.assigned_staff_id
       ${whereSql}
       ORDER BY t.updated_at DESC, t.id DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset],
    );
    const rows = listResult.rows as Array<Record<string, unknown>>;
    const tickets = await Promise.all(rows.map((row) => this.mapTicketWithAgency(row)));
    return {
      tickets,
      total: Number(totalResult.rows[0]?.n ?? 0),
    };
  }

  async create(body: CreateTicketBody): Promise<TicketRow> {
    const customerId = Number(body.customer_id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      throw new BadRequestException({ error: 'invalid_customer_id' });
    }
    const customer = await this.resolveCustomerPgId(customerId);
    if (!customer) throw new BadRequestException({ error: 'customer_not_found' });

    const title = String(body.title ?? '').trim().slice(0, 400);
    if (!title) throw new BadRequestException({ error: 'title_required' });

    let assignedStaffId: number | null = null;
    if (body.assigned_staff_id != null && body.assigned_staff_id !== 0) {
      assignedStaffId = Number(body.assigned_staff_id);
      if (!Number.isFinite(assignedStaffId)) assignedStaffId = null;
    }

    const ts = catalogTs();
    const insert = await this.db.query(
      `INSERT INTO crm_tickets (
         customer_id, ticket_type, status, priority, channel, title, description,
         resolution, assigned_staff_id, created_at, updated_at, resolved_at
       ) VALUES ($1, $2, 'moi', $3, $4, $5, $6, '', $7, $8::timestamptz, $8::timestamptz, NULL)
       RETURNING id`,
      [
        customer.pgId,
        normalizeIssueType(body.ticket_type),
        normalizeIssuePriority(body.priority),
        normalizeChannel(body.channel),
        title,
        String(body.description ?? '').trim().slice(0, 8000),
        assignedStaffId,
        ts,
      ],
    );
    const ticketPgId = Number(insert.rows[0]?.id);
    await this.db.query(
      `UPDATE crm_tickets SET sqlite_ticket_id = id
       WHERE id = $1 AND sqlite_ticket_id IS NULL`,
      [ticketPgId],
    );
    const created = await this.getById(ticketPgId);
    if (!created) {
      throw new Error('Failed to create ticket');
    }
    return created;
  }

  async patch(id: number, body: PatchTicketBody): Promise<TicketRow> {
    const resolved = await this.resolveTicketPgId(id);
    if (!resolved) throw new NotFoundException({ error: 'ticket_not_found' });
    const { pgId, legacyId } = resolved;

    const existingResult = await this.db.query(`SELECT * FROM crm_tickets WHERE id = $1`, [pgId]);
    const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
    if (!existing) throw new NotFoundException({ error: 'ticket_not_found' });

    const merged: Record<string, unknown> = { ...existing };
    for (const key of ['title', 'description', 'resolution'] as const) {
      if (key in body && typeof body[key] === 'string') {
        merged[key] = body[key]!.trim().slice(key === 'title' ? 0 : 8000);
      }
    }
    if ('ticket_type' in body) merged.ticket_type = normalizeIssueType(body.ticket_type);
    if ('priority' in body) merged.priority = normalizeIssuePriority(body.priority);
    if ('status' in body) merged.status = normalizeIssueStatus(body.status);
    if ('channel' in body) merged.channel = normalizeChannel(body.channel);
    if ('assigned_staff_id' in body) {
      const raw = body.assigned_staff_id;
      if (raw == null || raw === 0) merged.assigned_staff_id = null;
      else {
        const aid = Number(raw);
        merged.assigned_staff_id = Number.isFinite(aid) ? aid : null;
      }
    }

    const ts = catalogTs();
    const status = String(merged.status ?? 'moi');
    const existingResolvedAt = formatTsForUpdate(existing.resolved_at);
    const resolvedAt =
      status === 'da_xu_ly' || status === 'dong' ? existingResolvedAt || ts : null;
    let assignedStaffId: number | null = null;
    if (merged.assigned_staff_id != null && merged.assigned_staff_id !== '') {
      const aid = Number(merged.assigned_staff_id);
      assignedStaffId = Number.isFinite(aid) ? aid : null;
    }

    await this.db.query(
      `UPDATE crm_tickets
       SET ticket_type = $1, status = $2, priority = $3, channel = $4, title = $5, description = $6,
           resolution = $7, assigned_staff_id = $8, updated_at = $9::timestamptz, resolved_at = $10::timestamptz
       WHERE id = $11`,
      [
        String(merged.ticket_type ?? 'phan_anh'),
        status,
        String(merged.priority ?? 'binh_thuong'),
        String(merged.channel ?? 'khac'),
        String(merged.title ?? ''),
        String(merged.description ?? ''),
        String(merged.resolution ?? ''),
        assignedStaffId,
        ts,
        resolvedAt,
        pgId,
      ],
    );
    const updated = await this.getById(legacyId);
    if (!updated) throw new NotFoundException({ error: 'ticket_not_found' });
    return updated;
  }

  async getById(id: number): Promise<TicketRow | null> {
    const result = await this.db.query(
      `SELECT ${TICKET_SELECT}
       FROM crm_tickets t
       LEFT JOIN crm_customers c ON c.id = t.customer_id
       LEFT JOIN crm_staff st ON st.id = t.assigned_staff_id
       WHERE t.sqlite_ticket_id = $1 OR t.id = $1
       ORDER BY CASE WHEN t.sqlite_ticket_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [id],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapTicketWithAgency(row) : null;
  }

  async updateSentiment(ticketId: number, input: UpdateTicketSentimentInput): Promise<TicketRow> {
    const resolved = await this.resolveTicketPgId(ticketId);
    if (!resolved) throw new NotFoundException({ error: 'ticket_not_found' });
    const { pgId, legacyId } = resolved;

    await this.db.query(
      `UPDATE crm_tickets
       SET sentiment_label = $1, sentiment_score = $2, sentiment_confidence = $3,
           sentiment_scored_at = $4::timestamptz, updated_at = $4::timestamptz
       WHERE id = $5`,
      [input.label, input.score, input.confidence, input.scored_at, pgId],
    );
    const updated = await this.getById(legacyId);
    if (!updated) throw new NotFoundException({ error: 'ticket_not_found' });
    return updated;
  }

  async listMessages(ticketId: number): Promise<TicketMessageRow[]> {
    const resolved = await this.resolveTicketPgId(ticketId);
    if (!resolved) return [];
    const result = await this.db.query(
      `SELECT m.*, st.name AS author_staff_name
       FROM crm_ticket_messages m
       LEFT JOIN crm_staff st ON st.id = m.author_staff_id
       WHERE m.ticket_id = $1
       ORDER BY m.id ASC`,
      [resolved.pgId],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) =>
      mapMessageRow(row, resolved.legacyId),
    );
  }

  async addMessage(ticketId: number, body: CreateTicketMessageBody): Promise<TicketMessageRow> {
    const resolved = await this.resolveTicketPgId(ticketId);
    if (!resolved) throw new NotFoundException({ error: 'ticket_not_found' });

    const text = String(body.body ?? '').trim().slice(0, 8000);
    if (!text) throw new BadRequestException({ error: 'message_body_required' });

    let authorStaffId: number | null = null;
    if (body.author_staff_id != null && body.author_staff_id !== 0) {
      authorStaffId = Number(body.author_staff_id);
      if (!Number.isFinite(authorStaffId)) authorStaffId = null;
    }

    const ts = catalogTs();
    const insert = await this.db.query(
      `INSERT INTO crm_ticket_messages (ticket_id, author_staff_id, body, is_internal, created_at)
       VALUES ($1, $2, $3, $4, $5::timestamptz)
       RETURNING id`,
      [resolved.pgId, authorStaffId, text, body.is_internal !== false, ts],
    );
    const messagePgId = Number(insert.rows[0]?.id);
    await this.db.query(
      `UPDATE crm_ticket_messages SET sqlite_message_id = id
       WHERE id = $1 AND sqlite_message_id IS NULL`,
      [messagePgId],
    );
    await this.db.query(`UPDATE crm_tickets SET updated_at = $1::timestamptz WHERE id = $2`, [
      ts,
      resolved.pgId,
    ]);

    const rowResult = await this.db.query(
      `SELECT m.*, st.name AS author_staff_name
       FROM crm_ticket_messages m
       LEFT JOIN crm_staff st ON st.id = m.author_staff_id
       WHERE m.id = $1`,
      [messagePgId],
    );
    return mapMessageRow(rowResult.rows[0] as Record<string, unknown>, resolved.legacyId);
  }
}

function formatTsForUpdate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const s = String(value ?? '').trim();
  return s;
}
