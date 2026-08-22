import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { CloseRequires, QueueRow, QueueSeed, TicketKind, TicketPriority, TicketRow, TicketStatus } from './staff-ticket.types';

@Injectable()
export class StaffTicketRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  private optDate(value: unknown): Date | null {
    if (value == null || value === '') return null;
    return value instanceof Date ? value : new Date(String(value));
  }

  private asDate(value: unknown): Date {
    if (value instanceof Date) return value;
    return new Date(String(value));
  }

  private parseCloseRequires(value: unknown): CloseRequires {
    if (value && typeof value === 'object' && 'type' in value) {
      return value as CloseRequires;
    }
    return { type: 'none' };
  }

  private mapQueue(row: Record<string, unknown>): QueueRow {
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      code: String(row.code),
      name: String(row.name),
      kind_default: String(row.kind_default) as TicketKind,
      assignee_dept_code: row.assignee_dept_code == null ? null : String(row.assignee_dept_code),
      assignee_dept_id: row.assignee_dept_id == null ? null : Number(row.assignee_dept_id),
      sla_minutes: row.sla_minutes == null ? null : Number(row.sla_minutes),
      sla_pauses_on_waiting: Boolean(row.sla_pauses_on_waiting),
      close_requires: this.parseCloseRequires(row.close_requires),
      sensitivity: String(row.sensitivity ?? 'normal') as 'normal' | 'restricted',
      created_at: this.asDate(row.created_at),
    };
  }

  private mapTicket(row: Record<string, unknown>): TicketRow {
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      number: String(row.number),
      kind: String(row.kind) as TicketKind,
      queue_code: String(row.queue_code),
      title: String(row.title),
      body: String(row.body ?? ''),
      status: String(row.status ?? 'open') as TicketStatus,
      priority: String(row.priority ?? 'p2') as TicketPriority,
      requester_staff_id: Number(row.requester_staff_id),
      requester_dept_code: row.requester_dept_code == null ? null : String(row.requester_dept_code),
      assignee_staff_id: row.assignee_staff_id == null ? null : Number(row.assignee_staff_id),
      assignee_dept_code: row.assignee_dept_code == null ? null : String(row.assignee_dept_code),
      project_id: row.project_id == null ? null : Number(row.project_id),
      entity_type: row.entity_type == null ? null : String(row.entity_type),
      entity_id: row.entity_id == null ? null : String(row.entity_id),
      room_id: row.room_id == null ? null : String(row.room_id),
      parent_id: row.parent_id == null ? null : String(row.parent_id),
      sla_due_at: this.optDate(row.sla_due_at),
      sla_breached: Boolean(row.sla_breached),
      blocked_reason: String(row.blocked_reason ?? ''),
      waiting_on: String(row.waiting_on ?? ''),
      completed_at: this.optDate(row.completed_at),
      cancelled_reason: String(row.cancelled_reason ?? ''),
      created_by: row.created_by == null ? null : Number(row.created_by),
      idempotency_key: row.idempotency_key == null ? null : String(row.idempotency_key),
      created_at: this.asDate(row.created_at),
    };
  }

  async upsertQueue(input: QueueSeed & { tenant_id: string }): Promise<QueueRow> {
    const res = await this.db.query(
      `INSERT INTO crm_staff_ticket_queues (
         tenant_id, code, name, kind_default, assignee_dept_code,
         sla_minutes, sla_pauses_on_waiting, close_requires, sensitivity
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       ON CONFLICT (tenant_id, code) DO UPDATE SET
         name = EXCLUDED.name,
         kind_default = EXCLUDED.kind_default,
         assignee_dept_code = EXCLUDED.assignee_dept_code,
         sla_minutes = EXCLUDED.sla_minutes,
         sla_pauses_on_waiting = EXCLUDED.sla_pauses_on_waiting,
         close_requires = EXCLUDED.close_requires,
         sensitivity = EXCLUDED.sensitivity
       RETURNING *`,
      [
        input.tenant_id,
        input.code,
        input.name,
        input.kind_default,
        input.assignee_dept_code,
        input.sla_minutes,
        input.sla_pauses_on_waiting,
        JSON.stringify(input.close_requires),
        input.sensitivity,
      ],
    );
    return this.mapQueue(res.rows[0] as Record<string, unknown>);
  }

  async listQueues(tenantId: string): Promise<QueueRow[]> {
    const res = await this.db.query(
      `SELECT * FROM crm_staff_ticket_queues WHERE tenant_id = $1 ORDER BY code`,
      [tenantId],
    );
    return res.rows.map((row) => this.mapQueue(row as Record<string, unknown>));
  }

  async getQueue(tenantId: string, code: string): Promise<QueueRow | null> {
    const res = await this.db.query(
      `SELECT * FROM crm_staff_ticket_queues WHERE tenant_id = $1 AND code = $2 LIMIT 1`,
      [tenantId, code],
    );
    return res.rows[0] ? this.mapQueue(res.rows[0] as Record<string, unknown>) : null;
  }

  async nextNumber(tenantId: string): Promise<string> {
    const res = await this.db.query<{ last_n: number }>(
      `INSERT INTO crm_staff_ticket_counters (tenant_id, last_n)
       VALUES ($1, 1)
       ON CONFLICT (tenant_id) DO UPDATE SET last_n = crm_staff_ticket_counters.last_n + 1
       RETURNING last_n`,
      [tenantId],
    );
    const n = Number(res.rows[0]?.last_n ?? 1);
    return `T-${n}`;
  }

  async insertTicket(row: {
    tenant_id: string;
    number: string;
    kind: TicketKind;
    queue_code: string;
    title: string;
    body?: string;
    status?: TicketStatus;
    priority?: TicketPriority;
    requester_staff_id: number;
    requester_dept_code?: string | null;
    assignee_staff_id?: number | null;
    assignee_dept_code?: string | null;
    project_id?: number | null;
    entity_type?: string | null;
    entity_id?: string | null;
    room_id?: string | null;
    parent_id?: string | null;
    sla_due_at?: Date | null;
    created_by?: number | null;
    idempotency_key?: string | null;
  }): Promise<TicketRow> {
    const res = await this.db.query(
      `INSERT INTO crm_staff_tickets (
         tenant_id, number, kind, queue_code, title, body, status, priority,
         requester_staff_id, requester_dept_code, assignee_staff_id, assignee_dept_code,
         project_id, entity_type, entity_id, room_id, parent_id, sla_due_at, created_by, idempotency_key
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
       ) RETURNING *`,
      [
        row.tenant_id,
        row.number,
        row.kind,
        row.queue_code,
        row.title,
        row.body ?? '',
        row.status ?? 'open',
        row.priority ?? 'p2',
        row.requester_staff_id,
        row.requester_dept_code ?? null,
        row.assignee_staff_id ?? null,
        row.assignee_dept_code ?? null,
        row.project_id ?? null,
        row.entity_type ?? null,
        row.entity_id ?? null,
        row.room_id ?? null,
        row.parent_id ?? null,
        row.sla_due_at ?? null,
        row.created_by ?? null,
        row.idempotency_key ?? null,
      ],
    );
    return this.mapTicket(res.rows[0] as Record<string, unknown>);
  }

  async getById(id: string): Promise<TicketRow | null> {
    const res = await this.db.query(`SELECT * FROM crm_staff_tickets WHERE id = $1 LIMIT 1`, [id]);
    return res.rows[0] ? this.mapTicket(res.rows[0] as Record<string, unknown>) : null;
  }

  async getByIdempotencyKey(tenantId: string, key: string): Promise<TicketRow | null> {
    const res = await this.db.query(
      `SELECT * FROM crm_staff_tickets WHERE tenant_id = $1 AND idempotency_key = $2 LIMIT 1`,
      [tenantId, key],
    );
    return res.rows[0] ? this.mapTicket(res.rows[0] as Record<string, unknown>) : null;
  }

  async getOpenByEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
    queueCode: string,
  ): Promise<TicketRow | null> {
    const res = await this.db.query(
      `SELECT * FROM crm_staff_tickets
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND queue_code = $4
         AND status IN ('open', 'in_progress')
       LIMIT 1`,
      [tenantId, entityType, entityId, queueCode],
    );
    return res.rows[0] ? this.mapTicket(res.rows[0] as Record<string, unknown>) : null;
  }

  async listTickets(
    tenantId: string,
    filter: {
      inbox?: 'mine' | 'dept_queue' | 'inbound' | 'outbound';
      staffId: number;
      deptCode: string | null;
      queue?: string;
      overdue?: boolean;
      projectId?: number;
    },
  ): Promise<TicketRow[]> {
    const clauses = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (filter.queue) {
      clauses.push(`queue_code = $${idx++}`);
      params.push(filter.queue);
    }
    if (filter.projectId != null) {
      clauses.push(`project_id = $${idx++}`);
      params.push(filter.projectId);
    }
    if (filter.overdue) {
      clauses.push(`sla_due_at IS NOT NULL AND sla_due_at < NOW()`);
      clauses.push(`status IN ('open', 'in_progress', 'blocked', 'waiting')`);
    }

    switch (filter.inbox) {
      case 'mine':
        clauses.push(`(assignee_staff_id = $${idx} OR requester_staff_id = $${idx})`);
        params.push(filter.staffId);
        idx += 1;
        break;
      case 'dept_queue':
        if (filter.deptCode) {
          clauses.push(`assignee_staff_id IS NULL`);
          clauses.push(`assignee_dept_code = $${idx++}`);
          params.push(filter.deptCode);
          clauses.push(`status IN ('open', 'in_progress', 'blocked', 'waiting')`);
        }
        break;
      case 'inbound':
        if (filter.deptCode) {
          clauses.push(`kind = 'cross'`);
          clauses.push(`assignee_dept_code = $${idx++}`);
          params.push(filter.deptCode);
        }
        break;
      case 'outbound':
        if (filter.deptCode) {
          clauses.push(`requester_dept_code = $${idx++}`);
          params.push(filter.deptCode);
          clauses.push(`assignee_dept_code IS DISTINCT FROM $${idx++}`);
          params.push(filter.deptCode);
        }
        break;
      default:
        break;
    }

    const res = await this.db.query(
      `SELECT * FROM crm_staff_tickets WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 200`,
      params,
    );
    return res.rows.map((row) => this.mapTicket(row as Record<string, unknown>));
  }

  async updateTicket(
    id: string,
    patch: Partial<{
      title: string;
      body: string;
      priority: TicketPriority;
      status: TicketStatus;
      assignee_staff_id: number | null;
      blocked_reason: string;
      waiting_on: string;
      completed_at: Date | null;
      cancelled_reason: string;
      sla_breached: boolean;
      sla_due_at: Date | null;
    }>,
  ): Promise<TicketRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [id];
    let idx = 2;
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      sets.push(`${key} = $${idx++}`);
      params.push(value);
    }
    if (!sets.length) return this.getById(id);
    const res = await this.db.query(
      `UPDATE crm_staff_tickets SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params,
    );
    return res.rows[0] ? this.mapTicket(res.rows[0] as Record<string, unknown>) : null;
  }

  async insertEvent(
    ticketId: string,
    kind: string,
    actorStaffId: number | null,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_staff_ticket_events (ticket_id, kind, actor_staff_id, payload)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [ticketId, kind, actorStaffId, JSON.stringify(payload ?? {})],
    );
  }

  async addWatcher(ticketId: string, staffId: number): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_staff_ticket_watchers (ticket_id, staff_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [ticketId, staffId],
    );
  }

  async listWatchers(ticketId: string): Promise<number[]> {
    const res = await this.db.query<{ staff_id: number }>(
      `SELECT staff_id FROM crm_staff_ticket_watchers WHERE ticket_id = $1`,
      [ticketId],
    );
    return res.rows.map((row) => Number(row.staff_id));
  }

  async insertComment(ticketId: string, staffId: number, body: string): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_staff_ticket_comments (ticket_id, author_staff_id, body) VALUES ($1, $2, $3)`,
      [ticketId, staffId, body],
    );
  }

  async latestCommentLen(ticketId: string): Promise<number> {
    const res = await this.db.query<{ len: number }>(
      `SELECT COALESCE(LENGTH(body), 0) AS len
       FROM crm_staff_ticket_comments
       WHERE ticket_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [ticketId],
    );
    return Number(res.rows[0]?.len ?? 0);
  }

  async countInstallments(txId: string): Promise<number> {
    try {
      const res = await this.db.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM bds_payment_installments WHERE transaction_id = $1`,
        [txId],
      );
      return Number(res.rows[0]?.c ?? 0);
    } catch {
      return 0;
    }
  }

  async getStaffDepartmentCode(staffId: number): Promise<string | null> {
    try {
      const res = await this.db.query<{ code: string }>(
        `SELECT d.code
         FROM crm_staff cs
         LEFT JOIN staff_users u ON lower(trim(u.email)) = lower(trim(cs.email))
         JOIN crm_positions p ON p.id = COALESCE(u.position_id, cs.position_id)
         JOIN crm_departments d ON d.id = p.department_id
         WHERE cs.id = $1
         LIMIT 1`,
        [staffId],
      );
      return res.rows[0]?.code ?? null;
    } catch {
      return null;
    }
  }

  async listStaffIdsByDepartmentCodes(codes: string[]): Promise<number[]> {
    if (!codes.length) return [];
    try {
      const res = await this.db.query<{ id: string | number }>(
        `SELECT DISTINCT x.id FROM (
           SELECT cs.id
           FROM staff_users u
           JOIN crm_positions p ON p.id = u.position_id
           JOIN crm_departments d ON d.id = p.department_id
           JOIN crm_staff cs ON lower(trim(cs.email)) = lower(trim(u.email))
           WHERE d.code = ANY($1::text[]) AND COALESCE(u.active, TRUE)
           UNION
           SELECT cs.id
           FROM crm_staff cs
           JOIN crm_positions p ON p.id = cs.position_id
           JOIN crm_departments d ON d.id = p.department_id
           WHERE d.code = ANY($1::text[]) AND COALESCE(cs.active, TRUE)
         ) x`,
        [codes],
      );
      return res.rows
        .map((row) => Number(row.id))
        .filter((id) => Number.isFinite(id) && id > 0);
    } catch {
      return [];
    }
  }

  async listOpenByEntityQueues(
    tenantId: string,
    entityType: string,
    entityId: string,
    queueCodes: string[],
  ): Promise<TicketRow[]> {
    if (!queueCodes.length) return [];
    const res = await this.db.query(
      `SELECT * FROM crm_staff_tickets
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
         AND queue_code = ANY($4::text[])
         AND status IN ('open', 'in_progress', 'blocked', 'waiting')
       ORDER BY created_at`,
      [tenantId, entityType, entityId, queueCodes],
    );
    return res.rows.map((row) => this.mapTicket(row as Record<string, unknown>));
  }

  async listComments(
    ticketId: string,
    limit = 100,
  ): Promise<Array<{ id: string; author_staff_id: number; body: string; created_at: Date }>> {
    const res = await this.db.query(
      `SELECT id::text, author_staff_id, body, created_at
       FROM crm_staff_ticket_comments
       WHERE ticket_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [ticketId, limit],
    );
    return res.rows.map((row) => ({
      id: String((row as Record<string, unknown>).id),
      author_staff_id: Number((row as Record<string, unknown>).author_staff_id),
      body: String((row as Record<string, unknown>).body ?? ''),
      created_at: this.asDate((row as Record<string, unknown>).created_at),
    }));
  }

  async listEvents(
    ticketId: string,
    limit = 100,
  ): Promise<Array<{ id: string; kind: string; actor_staff_id: number | null; payload: Record<string, unknown>; created_at: Date }>> {
    const res = await this.db.query(
      `SELECT id::text, kind, actor_staff_id, payload, created_at
       FROM crm_staff_ticket_events
       WHERE ticket_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [ticketId, limit],
    );
    return res.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        kind: String(r.kind),
        actor_staff_id: r.actor_staff_id == null ? null : Number(r.actor_staff_id),
        payload: (r.payload && typeof r.payload === 'object' ? r.payload : {}) as Record<string, unknown>,
        created_at: this.asDate(r.created_at),
      };
    });
  }

  async getLatestSlaRemainingMs(ticketId: string): Promise<number | null> {
    const res = await this.db.query(
      `SELECT payload
       FROM crm_staff_ticket_events
       WHERE ticket_id = $1 AND kind = 'sla_pause'
       ORDER BY created_at DESC
       LIMIT 1`,
      [ticketId],
    );
    const payload = res.rows[0]?.payload as Record<string, unknown> | undefined;
    const ms = payload?.sla_remaining_ms;
    return ms == null ? null : Number(ms);
  }

  async exportRows(
    tenantId: string,
    filter: { inbox?: string; queue?: string; projectId?: number; staffId?: number; deptCode?: string | null },
  ): Promise<TicketRow[]> {
    return this.listTickets(tenantId, {
      inbox: filter.inbox as 'mine' | 'dept_queue' | 'inbound' | 'outbound' | undefined,
      staffId: filter.staffId ?? 0,
      deptCode: filter.deptCode ?? null,
      queue: filter.queue,
      projectId: filter.projectId,
    });
  }

  async getStaffUserUuid(staffId: number): Promise<string | null> {
    try {
      const res = await this.db.query<{ user_id: string }>(
        `SELECT u.id::text AS user_id
         FROM crm_staff cs
         LEFT JOIN staff_users u ON lower(trim(u.email)) = lower(trim(cs.email))
         WHERE cs.id = $1 AND u.id IS NOT NULL
         LIMIT 1`,
        [staffId],
      );
      return res.rows[0]?.user_id ?? null;
    } catch {
      return null;
    }
  }

  async listStaffIdsByDeptAndPosition(deptCode: string, positionCode: string): Promise<number[]> {
    try {
      const res = await this.db.query<{ id: string | number }>(
        `SELECT DISTINCT x.id FROM (
           SELECT cs.id
           FROM staff_users u
           JOIN crm_positions p ON p.id = u.position_id
           JOIN crm_departments d ON d.id = p.department_id
           JOIN crm_staff cs ON lower(trim(cs.email)) = lower(trim(u.email))
           WHERE d.code = $1 AND p.code = $2 AND COALESCE(u.active, TRUE)
           UNION
           SELECT cs.id
           FROM crm_staff cs
           JOIN crm_positions p ON p.id = cs.position_id
           JOIN crm_departments d ON d.id = p.department_id
           WHERE d.code = $1 AND p.code = $2 AND COALESCE(cs.active, TRUE)
         ) x`,
        [deptCode, positionCode],
      );
      return res.rows
        .map((row) => Number(row.id))
        .filter((id) => Number.isFinite(id) && id > 0);
    } catch {
      return [];
    }
  }

  async markSlaBreachedDue(now: Date): Promise<TicketRow[]> {
    const res = await this.db.query(
      `UPDATE crm_staff_tickets t
       SET sla_breached = TRUE
       WHERE t.sla_due_at IS NOT NULL
         AND t.sla_due_at < $1
         AND NOT t.sla_breached
         AND t.status IN ('open', 'in_progress', 'blocked')
         AND NOT (
           t.status = 'waiting'
           AND EXISTS (
             SELECT 1 FROM crm_staff_ticket_queues q
             WHERE q.tenant_id = t.tenant_id
               AND q.code = t.queue_code
               AND q.sla_pauses_on_waiting
           )
         )
       RETURNING t.*`,
      [now],
    );
    return res.rows.map((row) => this.mapTicket(row as Record<string, unknown>));
  }
}
