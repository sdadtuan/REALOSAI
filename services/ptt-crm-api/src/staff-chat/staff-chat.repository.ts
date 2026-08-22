import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  MemberRole,
  MemberRow,
  MessageKind,
  MessageRow,
  RoomKind,
  RoomRow,
  RoomSensitivity,
  RoomStatus,
} from './staff-chat.types';

@Injectable()
export class StaffChatRepository implements OnModuleDestroy {
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

  private mapRoom(row: Record<string, unknown>): RoomRow {
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      kind: String(row.kind) as RoomKind,
      code: String(row.code),
      name: String(row.name),
      department_id: row.department_id == null ? null : Number(row.department_id),
      project_id: row.project_id == null ? null : Number(row.project_id),
      sensitivity: String(row.sensitivity ?? 'normal') as RoomSensitivity,
      status: String(row.status ?? 'active') as RoomStatus,
      created_by: row.created_by == null ? null : Number(row.created_by),
      expires_at: this.optDate(row.expires_at),
      entity_type: row.entity_type == null ? null : String(row.entity_type),
      entity_id: row.entity_id == null ? null : String(row.entity_id),
      created_at: this.asDate(row.created_at),
    };
  }

  private mapMember(row: Record<string, unknown>): MemberRow {
    return {
      room_id: String(row.room_id),
      staff_id: Number(row.staff_id),
      role: String(row.role) as MemberRole,
      joined_at: this.asDate(row.joined_at),
      muted: Boolean(row.muted),
      last_read_message_id:
        row.last_read_message_id == null ? null : String(row.last_read_message_id),
    };
  }

  private mapMessage(row: Record<string, unknown>): MessageRow {
    return {
      id: String(row.id),
      room_id: String(row.room_id),
      author_staff_id: row.author_staff_id == null ? null : Number(row.author_staff_id),
      kind: String(row.kind ?? 'text') as MessageKind,
      body: String(row.body ?? ''),
      reply_to_id: row.reply_to_id == null ? null : String(row.reply_to_id),
      entity_type: row.entity_type == null ? null : String(row.entity_type),
      entity_id: row.entity_id == null ? null : String(row.entity_id),
      hidden: false,
      file_ids: row.file_ids ?? [],
      edited_at: this.optDate(row.edited_at),
      tombstoned_at: this.optDate(row.tombstoned_at),
      tombstone_reason: String(row.tombstone_reason ?? ''),
      created_at: this.asDate(row.created_at),
    };
  }

  async upsertRoom(input: {
    tenant_id: string;
    kind: RoomKind;
    code: string;
    name: string;
    department_id?: number | null;
    project_id?: number | null;
    sensitivity: RoomSensitivity;
    status?: RoomStatus;
    created_by?: number | null;
    expires_at?: Date | null;
    entity_type?: string | null;
    entity_id?: string | null;
  }): Promise<RoomRow> {
    const res = await this.db.query(
      `INSERT INTO crm_staff_rooms (
         tenant_id, kind, code, name, department_id, project_id, sensitivity,
         status, created_by, expires_at, entity_type, entity_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (tenant_id, code) DO UPDATE SET
         name = EXCLUDED.name,
         expires_at = COALESCE(EXCLUDED.expires_at, crm_staff_rooms.expires_at),
         status = COALESCE(EXCLUDED.status, crm_staff_rooms.status),
         entity_type = COALESCE(EXCLUDED.entity_type, crm_staff_rooms.entity_type),
         entity_id = COALESCE(EXCLUDED.entity_id, crm_staff_rooms.entity_id),
         project_id = COALESCE(EXCLUDED.project_id, crm_staff_rooms.project_id)
       RETURNING *`,
      [
        input.tenant_id,
        input.kind,
        input.code,
        input.name,
        input.department_id ?? null,
        input.project_id ?? null,
        input.sensitivity,
        input.status ?? 'active',
        input.created_by ?? null,
        input.expires_at ?? null,
        input.entity_type ?? null,
        input.entity_id ?? null,
      ],
    );
    return this.mapRoom(res.rows[0] as Record<string, unknown>);
  }

  async getById(id: string): Promise<RoomRow | null> {
    const res = await this.db.query(`SELECT * FROM crm_staff_rooms WHERE id = $1 LIMIT 1`, [id]);
    return res.rows[0] ? this.mapRoom(res.rows[0] as Record<string, unknown>) : null;
  }

  async getByCode(tenantId: string, code: string): Promise<RoomRow | null> {
    const res = await this.db.query(
      `SELECT * FROM crm_staff_rooms WHERE tenant_id = $1 AND code = $2 LIMIT 1`,
      [tenantId, code],
    );
    return res.rows[0] ? this.mapRoom(res.rows[0] as Record<string, unknown>) : null;
  }

  async listForStaff(tenantId: string, staffId: number): Promise<RoomRow[]> {
    const res = await this.db.query(
      `SELECT r.*
       FROM crm_staff_rooms r
       INNER JOIN crm_staff_room_members m ON m.room_id = r.id
       WHERE r.tenant_id = $1
         AND m.staff_id = $2
         AND r.status IN ('active', 'archived')
       ORDER BY r.kind, r.name`,
      [tenantId, staffId],
    );
    return res.rows.map((row) => this.mapRoom(row as Record<string, unknown>));
  }

  async upsertMember(roomId: string, staffId: number, role: MemberRole): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_staff_room_members (room_id, staff_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (room_id, staff_id) DO UPDATE SET
         role = CASE
           WHEN crm_staff_room_members.role = 'owner' THEN 'owner'
           ELSE EXCLUDED.role
         END`,
      [roomId, staffId, role],
    );
  }

  async getMember(roomId: string, staffId: number): Promise<MemberRow | null> {
    const res = await this.db.query(
      `SELECT * FROM crm_staff_room_members WHERE room_id = $1 AND staff_id = $2 LIMIT 1`,
      [roomId, staffId],
    );
    return res.rows[0] ? this.mapMember(res.rows[0] as Record<string, unknown>) : null;
  }

  async listMembers(roomId: string): Promise<MemberRow[]> {
    const res = await this.db.query(
      `SELECT * FROM crm_staff_room_members WHERE room_id = $1 ORDER BY joined_at`,
      [roomId],
    );
    return res.rows.map((row) => this.mapMember(row as Record<string, unknown>));
  }

  async setLastRead(roomId: string, staffId: number, messageId: string): Promise<void> {
    await this.db.query(
      `UPDATE crm_staff_room_members
       SET last_read_message_id = $3
       WHERE room_id = $1 AND staff_id = $2`,
      [roomId, staffId, messageId],
    );
  }

  async insertMessage(input: {
    room_id: string;
    author_staff_id: number | null;
    kind: MessageKind;
    body: string;
    reply_to_id?: string | null;
    entity_type?: string | null;
    entity_id?: string | null;
    file_ids?: unknown;
    idempotency_key?: string | null;
  }): Promise<MessageRow> {
    const res = await this.db.query(
      `INSERT INTO crm_staff_messages (
         room_id, author_staff_id, kind, body, reply_to_id,
         entity_type, entity_id, file_ids, idempotency_key
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       RETURNING *`,
      [
        input.room_id,
        input.author_staff_id,
        input.kind,
        input.body,
        input.reply_to_id ?? null,
        input.entity_type ?? null,
        input.entity_id ?? null,
        JSON.stringify(input.file_ids ?? []),
        input.idempotency_key ?? null,
      ],
    );
    return this.mapMessage(res.rows[0] as Record<string, unknown>);
  }

  async getMessage(id: string): Promise<MessageRow | null> {
    const res = await this.db.query(`SELECT * FROM crm_staff_messages WHERE id = $1 LIMIT 1`, [id]);
    return res.rows[0] ? this.mapMessage(res.rows[0] as Record<string, unknown>) : null;
  }

  async listMessages(roomId: string, beforeId?: string, limit = 50): Promise<MessageRow[]> {
    const res = await this.db.query(
      `SELECT * FROM crm_staff_messages
       WHERE room_id = $1
         AND (
           $2::uuid IS NULL
           OR created_at < (SELECT created_at FROM crm_staff_messages WHERE id = $2)
         )
       ORDER BY created_at DESC
       LIMIT $3`,
      [roomId, beforeId ?? null, limit],
    );
    return res.rows.map((row) => this.mapMessage(row as Record<string, unknown>));
  }

  async updateMessageBody(id: string, body: string, editedAt: Date): Promise<MessageRow | null> {
    const res = await this.db.query(
      `UPDATE crm_staff_messages SET body = $2, edited_at = $3 WHERE id = $1 RETURNING *`,
      [id, body, editedAt],
    );
    return res.rows[0] ? this.mapMessage(res.rows[0] as Record<string, unknown>) : null;
  }

  async tombstone(id: string, reason: string, at: Date): Promise<MessageRow | null> {
    const res = await this.db.query(
      `UPDATE crm_staff_messages
       SET tombstoned_at = $3, tombstone_reason = $2
       WHERE id = $1
       RETURNING *`,
      [id, reason, at],
    );
    return res.rows[0] ? this.mapMessage(res.rows[0] as Record<string, unknown>) : null;
  }

  async getDepartmentIdByCode(code: string): Promise<number | null> {
    const res = await this.db.query(
      `SELECT id FROM crm_departments WHERE code = $1 LIMIT 1`,
      [code],
    );
    return res.rows[0] ? Number(res.rows[0].id) : null;
  }

  async listStaffIdsByDepartmentCodes(codes: string[]): Promise<number[]> {
    if (!codes.length) return [];
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
  }

  async getStaffDepartmentCode(staffId: number): Promise<string | null> {
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
  }

  async getStaffPositionCode(staffId: number): Promise<string | null> {
    const res = await this.db.query<{ code: string }>(
      `SELECT p.code
       FROM crm_staff cs
       LEFT JOIN staff_users u ON lower(trim(u.email)) = lower(trim(cs.email))
       JOIN crm_positions p ON p.id = COALESCE(u.position_id, cs.position_id)
       WHERE cs.id = $1
       LIMIT 1`,
      [staffId],
    );
    return res.rows[0]?.code ?? null;
  }
}
