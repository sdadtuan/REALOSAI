import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  ApproveLeaveRequestBody,
  CreateLeaveRequestBody,
  LeaveRequestRow,
  LeaveStatus,
} from './hr-leave.types';

@Injectable()
export class HrLeaveRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private memory: LeaveRequestRow[] = [];
  private seq = 1;
  private pgReady: boolean | null = null;

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

  private async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM staff_leave_requests LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private mapRow(row: Record<string, unknown>): LeaveRequestRow {
    return {
      id: String(row.id),
      staff_user_id: String(row.staff_user_id),
      staff_email: String(row.staff_email ?? ''),
      leave_type: String(row.leave_type ?? 'annual'),
      date_from: String(row.date_from ?? '').slice(0, 10),
      date_to: String(row.date_to ?? '').slice(0, 10),
      reason: String(row.reason ?? ''),
      status: String(row.status ?? 'pending') as LeaveStatus,
      approver_user_id: row.approver_user_id ? String(row.approver_user_id) : null,
      approver_email: row.approver_email ? String(row.approver_email) : null,
      approved_at: row.approved_at ? String(row.approved_at) : null,
      audit_note: row.audit_note ? String(row.audit_note) : null,
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  private validateDates(from: string, to: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new BadRequestException({ error: 'invalid_dates', message: 'date_from/date_to phải YYYY-MM-DD' });
    }
    if (from > to) {
      throw new BadRequestException({ error: 'invalid_range', message: 'date_from phải ≤ date_to' });
    }
  }

  async create(userId: string, email: string, body: CreateLeaveRequestBody): Promise<LeaveRequestRow> {
    const dateFrom = String(body.date_from ?? '').trim();
    const dateTo = String(body.date_to ?? '').trim();
    this.validateDates(dateFrom, dateTo);
    const leaveType = String(body.leave_type ?? 'annual').trim() || 'annual';
    const reason = String(body.reason ?? '').trim();

    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `INSERT INTO staff_leave_requests
           (staff_user_id, staff_email, leave_type, date_from, date_to, reason, status)
         VALUES ($1::uuid, $2, $3, $4::date, $5::date, $6, 'pending')
         RETURNING id::text, staff_user_id::text, staff_email, leave_type,
                   date_from::text, date_to::text, reason, status,
                   approver_user_id::text, approver_email, approved_at::text,
                   audit_note, created_at::text, updated_at::text`,
        [userId, email, leaveType, dateFrom, dateTo, reason],
      );
      return this.mapRow(result.rows[0] as Record<string, unknown>);
    }

    const now = new Date().toISOString();
    const row: LeaveRequestRow = {
      id: String(this.seq++),
      staff_user_id: userId,
      staff_email: email,
      leave_type: leaveType,
      date_from: dateFrom,
      date_to: dateTo,
      reason,
      status: 'pending',
      approver_user_id: null,
      approver_email: null,
      approved_at: null,
      audit_note: null,
      created_at: now,
      updated_at: now,
    };
    this.memory.unshift(row);
    return row;
  }

  async listForUser(userId: string, limit = 50): Promise<LeaveRequestRow[]> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT id::text, staff_user_id::text, staff_email, leave_type,
                date_from::text, date_to::text, reason, status,
                approver_user_id::text, approver_email, approved_at::text,
                audit_note, created_at::text, updated_at::text
         FROM staff_leave_requests
         WHERE staff_user_id = $1::uuid
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit],
      );
      return result.rows.map((row) => this.mapRow(row as Record<string, unknown>));
    }
    return this.memory.filter((r) => r.staff_user_id === userId).slice(0, limit);
  }

  async listPending(limit = 100): Promise<LeaveRequestRow[]> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT id::text, staff_user_id::text, staff_email, leave_type,
                date_from::text, date_to::text, reason, status,
                approver_user_id::text, approver_email, approved_at::text,
                audit_note, created_at::text, updated_at::text
         FROM staff_leave_requests
         WHERE status = 'pending'
         ORDER BY created_at ASC
         LIMIT $1`,
        [limit],
      );
      return result.rows.map((row) => this.mapRow(row as Record<string, unknown>));
    }
    return this.memory.filter((r) => r.status === 'pending').slice(0, limit);
  }

  async getById(id: string): Promise<LeaveRequestRow | null> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT id::text, staff_user_id::text, staff_email, leave_type,
                date_from::text, date_to::text, reason, status,
                approver_user_id::text, approver_email, approved_at::text,
                audit_note, created_at::text, updated_at::text
         FROM staff_leave_requests
         WHERE id = $1
         LIMIT 1`,
        [id],
      );
      const row = result.rows[0];
      return row ? this.mapRow(row as Record<string, unknown>) : null;
    }
    return this.memory.find((r) => r.id === id) ?? null;
  }

  async approve(
    id: string,
    approverUserId: string,
    approverEmail: string,
    body: ApproveLeaveRequestBody,
  ): Promise<LeaveRequestRow> {
    const existing = await this.getById(id);
    if (!existing) throw new NotFoundException({ error: 'leave_not_found', id });
    if (existing.status !== 'pending') {
      throw new BadRequestException({ error: 'invalid_status', status: existing.status });
    }
    const status = (body.status === 'rejected' ? 'rejected' : 'approved') as LeaveStatus;
    const auditNote = String(body.audit_note ?? '').trim();

    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `UPDATE staff_leave_requests
         SET status = $2,
             approver_user_id = $3::uuid,
             approver_email = $4,
             approved_at = NOW(),
             audit_note = $5,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id::text, staff_user_id::text, staff_email, leave_type,
                   date_from::text, date_to::text, reason, status,
                   approver_user_id::text, approver_email, approved_at::text,
                   audit_note, created_at::text, updated_at::text`,
        [id, status, approverUserId, approverEmail, auditNote || null],
      );
      return this.mapRow(result.rows[0] as Record<string, unknown>);
    }

    existing.status = status;
    existing.approver_user_id = approverUserId;
    existing.approver_email = approverEmail;
    existing.approved_at = new Date().toISOString();
    existing.audit_note = auditNote || null;
    existing.updated_at = new Date().toISOString();
    return existing;
  }
}
