import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  buildAuditCursor,
  mapAdminAuditLogRow,
  mapOrgAuditRow,
  mapPermissionAuditRow,
  mapPiiAccessRow,
  mapRbacAuditRow,
  parseAuditCursor,
} from './admin-audit.mapper';
import type { AdminAuditEvent, AdminAuditListQuery } from './admin-audit.types';

type TableReady = {
  permission_audit: boolean;
  org_audit: boolean;
  rbac_audit: boolean;
  pii_access: boolean;
  admin_audit_log: boolean;
  export_jobs: boolean;
  snapshots: boolean;
};

@Injectable()
export class AdminAuditRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private ready: TableReady | null = null;

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

  private async ensureReady(): Promise<TableReady> {
    if (this.ready) return this.ready;
    const ready: TableReady = {
      permission_audit: false,
      org_audit: false,
      rbac_audit: false,
      pii_access: false,
      admin_audit_log: false,
      export_jobs: false,
      snapshots: false,
    };
    const checks: Array<[keyof TableReady, string]> = [
      ['permission_audit', 'staff_permission_audit'],
      ['org_audit', 'staff_org_audit'],
      ['rbac_audit', 'staff_rbac_audit_log'],
      ['pii_access', 'staff_pii_access_log'],
      ['admin_audit_log', 'admin_audit_log'],
      ['export_jobs', 'admin_audit_export_jobs'],
      ['snapshots', 'admin_config_snapshots'],
    ];
    for (const [key, table] of checks) {
      try {
        await this.db.query(`SELECT 1 FROM ${table} LIMIT 1`);
        ready[key] = true;
      } catch {
        ready[key] = false;
      }
    }
    this.ready = ready;
    return ready;
  }

  private defaultFrom(query: AdminAuditListQuery): Date {
    if (query.from) {
      const d = new Date(query.from);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }

  private defaultTo(query: AdminAuditListQuery): Date {
    if (query.to) {
      const d = new Date(query.to);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date();
  }

  async listEvents(query: AdminAuditListQuery): Promise<{ events: AdminAuditEvent[]; has_more: boolean }> {
    const ready = await this.ensureReady();
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const from = this.defaultFrom(query);
    const to = this.defaultTo(query);
    const cursor = parseAuditCursor(query.cursor);
    const fetchLimit = limit + 1;

    const branches: AdminAuditEvent[] = [];

    if (ready.permission_audit) {
      try {
        const params: unknown[] = [from.toISOString(), to.toISOString()];
        let sql = `
          SELECT a.id, a.actor_email, a.position_id, COALESCE(p.code, '') AS position_code,
                 a.diff_json, a.created_at::text
          FROM staff_permission_audit a
          LEFT JOIN crm_positions p ON p.id = a.position_id AND a.position_id > 0
          WHERE a.created_at >= $1::timestamptz AND a.created_at <= $2::timestamptz`;
        if (query.actor?.trim()) {
          params.push(`%${query.actor.trim().toLowerCase()}%`);
          sql += ` AND lower(a.actor_email) LIKE $${params.length}`;
        }
        if (cursor) {
          params.push(cursor.created_at, cursor.sort_key.replace('permission_audit:', ''));
          sql += ` AND (a.created_at, a.id) < ($${params.length - 1}::timestamptz, $${params.length}::bigint)`;
        }
        sql += ` ORDER BY a.created_at DESC, a.id DESC LIMIT ${fetchLimit}`;
        const result = await this.db.query(sql, params);
        for (const row of result.rows) {
          branches.push(
            mapPermissionAuditRow({
              id: Number(row.id),
              actor_email: String(row.actor_email ?? ''),
              position_id: Number(row.position_id),
              position_code: String(row.position_code ?? ''),
              diff_json: (row.diff_json ?? {}) as Record<string, unknown>,
              created_at: String(row.created_at),
            }),
          );
        }
      } catch {
        /* skip branch */
      }
    }

    if (ready.org_audit) {
      try {
        const params: unknown[] = [from.toISOString(), to.toISOString()];
        let sql = `
          SELECT id, actor_email, entity_type, entity_id, action, diff_json, created_at::text
          FROM staff_org_audit
          WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`;
        if (query.actor?.trim()) {
          params.push(`%${query.actor.trim().toLowerCase()}%`);
          sql += ` AND lower(actor_email) LIKE $${params.length}`;
        }
        if (query.subject?.trim()) {
          params.push(`%${query.subject.trim().toLowerCase()}%`);
          sql += ` AND (lower(entity_id) LIKE $${params.length} OR lower(diff_json::text) LIKE $${params.length})`;
        }
        sql += ` ORDER BY created_at DESC, id DESC LIMIT ${fetchLimit}`;
        const result = await this.db.query(sql, params);
        for (const row of result.rows) {
          branches.push(
            mapOrgAuditRow({
              id: Number(row.id),
              actor_email: String(row.actor_email ?? ''),
              entity_type: String(row.entity_type),
              entity_id: String(row.entity_id),
              action: String(row.action),
              diff_json: (row.diff_json ?? {}) as Record<string, unknown>,
              created_at: String(row.created_at),
            }),
          );
        }
      } catch {
        /* skip */
      }
    }

    if (ready.rbac_audit) {
      try {
        const params: unknown[] = [from.toISOString(), to.toISOString()];
        let sql = `
          SELECT id, event_type, actor_email, subject_user_id::text, section_id, action,
                 metadata_json, created_at::text
          FROM staff_rbac_audit_log
          WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`;
        if (query.actor?.trim()) {
          params.push(`%${query.actor.trim().toLowerCase()}%`);
          sql += ` AND lower(actor_email) LIKE $${params.length}`;
        }
        sql += ` ORDER BY created_at DESC, id DESC LIMIT ${fetchLimit}`;
        const result = await this.db.query(sql, params);
        for (const row of result.rows) {
          branches.push(
            mapRbacAuditRow({
              id: Number(row.id),
              event_type: String(row.event_type),
              actor_email: String(row.actor_email ?? ''),
              subject_user_id: row.subject_user_id ? String(row.subject_user_id) : undefined,
              section_id: String(row.section_id ?? ''),
              action: String(row.action ?? ''),
              metadata_json: (row.metadata_json ?? {}) as Record<string, unknown>,
              created_at: String(row.created_at),
            }),
          );
        }
      } catch {
        /* skip */
      }
    }

    if (ready.pii_access) {
      try {
        const params: unknown[] = [from.toISOString(), to.toISOString()];
        let sql = `
          SELECT id, actor_email, resource_type, resource_id, field_path, action, request_path, created_at::text
          FROM staff_pii_access_log
          WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`;
        if (query.actor?.trim()) {
          params.push(`%${query.actor.trim().toLowerCase()}%`);
          sql += ` AND lower(actor_email) LIKE $${params.length}`;
        }
        sql += ` ORDER BY created_at DESC, id DESC LIMIT ${fetchLimit}`;
        const result = await this.db.query(sql, params);
        for (const row of result.rows) {
          branches.push(
            mapPiiAccessRow({
              id: Number(row.id),
              actor_email: String(row.actor_email ?? ''),
              resource_type: String(row.resource_type),
              resource_id: String(row.resource_id),
              field_path: String(row.field_path),
              action: String(row.action),
              request_path: String(row.request_path ?? ''),
              created_at: String(row.created_at),
            }),
          );
        }
      } catch {
        /* skip */
      }
    }

    if (ready.admin_audit_log) {
      try {
        const params: unknown[] = [from.toISOString(), to.toISOString()];
        let sql = `
          SELECT id, event_type, actor_email, category, severity, subject_label, subject_id,
                 action, summary, diff_json, created_at::text
          FROM admin_audit_log
          WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`;
        if (query.actor?.trim()) {
          params.push(`%${query.actor.trim().toLowerCase()}%`);
          sql += ` AND lower(actor_email) LIKE $${params.length}`;
        }
        sql += ` ORDER BY created_at DESC, id DESC LIMIT ${fetchLimit}`;
        const result = await this.db.query(sql, params);
        for (const row of result.rows) {
          branches.push(
            mapAdminAuditLogRow({
              id: Number(row.id),
              event_type: String(row.event_type),
              actor_email: String(row.actor_email ?? ''),
              category: String(row.category ?? 'config_snapshot'),
              severity: String(row.severity ?? 'info'),
              subject_label: String(row.subject_label ?? ''),
              subject_id: String(row.subject_id ?? ''),
              action: String(row.action ?? row.event_type),
              summary: String(row.summary ?? row.event_type),
              diff_json: (row.diff_json ?? {}) as Record<string, unknown>,
              created_at: String(row.created_at),
            }),
          );
        }
      } catch {
        /* skip */
      }
    }

    let events = branches.sort((a, b) => {
      const t = b.created_at.localeCompare(a.created_at);
      if (t !== 0) return t;
      return b.id.localeCompare(a.id);
    });

    if (query.category?.length) {
      const set = new Set(query.category);
      events = events.filter((e) => set.has(e.category));
    }
    if (query.severity?.length) {
      const set = new Set(query.severity);
      events = events.filter((e) => set.has(e.severity));
    }
    if (query.q?.trim()) {
      const needle = query.q.trim().toLowerCase();
      events = events.filter(
        (e) =>
          e.summary.toLowerCase().includes(needle) ||
          e.actor_email.toLowerCase().includes(needle) ||
          (e.subject_label ?? '').toLowerCase().includes(needle),
      );
    }

    const has_more = events.length > limit;
    const page = events.slice(0, limit);
    return { events: page, has_more };
  }

  async getEventById(id: string): Promise<AdminAuditEvent | null> {
    const [source, pk] = id.includes(':') ? id.split(':', 2) : ['', id];
    const ready = await this.ensureReady();
    if (source === 'permission_audit' && ready.permission_audit) {
      const result = await this.db.query(
        `SELECT a.id, a.actor_email, a.position_id, COALESCE(p.code, '') AS position_code,
                a.diff_json, a.created_at::text
         FROM staff_permission_audit a
         LEFT JOIN crm_positions p ON p.id = a.position_id AND a.position_id > 0
         WHERE a.id = $1`,
        [Number(pk)],
      );
      const row = result.rows[0];
      if (!row) return null;
      return mapPermissionAuditRow({
        id: Number(row.id),
        actor_email: String(row.actor_email ?? ''),
        position_id: Number(row.position_id),
        position_code: String(row.position_code ?? ''),
        diff_json: (row.diff_json ?? {}) as Record<string, unknown>,
        created_at: String(row.created_at),
      });
    }
    if (source === 'org_audit' && ready.org_audit) {
      const result = await this.db.query(
        `SELECT id, actor_email, entity_type, entity_id, action, diff_json, created_at::text
         FROM staff_org_audit WHERE id = $1`,
        [Number(pk)],
      );
      const row = result.rows[0];
      if (!row) return null;
      return mapOrgAuditRow({
        id: Number(row.id),
        actor_email: String(row.actor_email ?? ''),
        entity_type: String(row.entity_type),
        entity_id: String(row.entity_id),
        action: String(row.action),
        diff_json: (row.diff_json ?? {}) as Record<string, unknown>,
        created_at: String(row.created_at),
      });
    }
    if (source === 'rbac_audit' && ready.rbac_audit) {
      const result = await this.db.query(
        `SELECT id, event_type, actor_email, subject_user_id::text, section_id, action,
                metadata_json, created_at::text
         FROM staff_rbac_audit_log WHERE id = $1`,
        [Number(pk)],
      );
      const row = result.rows[0];
      if (!row) return null;
      return mapRbacAuditRow({
        id: Number(row.id),
        event_type: String(row.event_type),
        actor_email: String(row.actor_email ?? ''),
        subject_user_id: row.subject_user_id ? String(row.subject_user_id) : undefined,
        section_id: String(row.section_id ?? ''),
        action: String(row.action ?? ''),
        metadata_json: (row.metadata_json ?? {}) as Record<string, unknown>,
        created_at: String(row.created_at),
      });
    }
    if (source === 'pii_access' && ready.pii_access) {
      const result = await this.db.query(
        `SELECT id, actor_email, resource_type, resource_id, field_path, action, request_path, created_at::text
         FROM staff_pii_access_log WHERE id = $1`,
        [Number(pk)],
      );
      const row = result.rows[0];
      if (!row) return null;
      return mapPiiAccessRow({
        id: Number(row.id),
        actor_email: String(row.actor_email ?? ''),
        resource_type: String(row.resource_type),
        resource_id: String(row.resource_id),
        field_path: String(row.field_path),
        action: String(row.action),
        request_path: String(row.request_path ?? ''),
        created_at: String(row.created_at),
      });
    }
    if (source === 'admin_audit_log' && ready.admin_audit_log) {
      const result = await this.db.query(
        `SELECT id, event_type, actor_email, category, severity, subject_label, subject_id,
                action, summary, diff_json, created_at::text
         FROM admin_audit_log WHERE id = $1`,
        [Number(pk)],
      );
      const row = result.rows[0];
      if (!row) return null;
      return mapAdminAuditLogRow({
        id: Number(row.id),
        event_type: String(row.event_type),
        actor_email: String(row.actor_email ?? ''),
        category: String(row.category ?? 'config_snapshot'),
        severity: String(row.severity ?? 'info'),
        subject_label: String(row.subject_label ?? ''),
        subject_id: String(row.subject_id ?? ''),
        action: String(row.action ?? row.event_type),
        summary: String(row.summary ?? row.event_type),
        diff_json: (row.diff_json ?? {}) as Record<string, unknown>,
        created_at: String(row.created_at),
      });
    }
    return null;
  }

  async logSyntheticEvent(input: {
    event_type: string;
    actor_email: string;
    category: string;
    severity: string;
    subject_label: string;
    subject_id: string;
    action: string;
    summary: string;
    diff_json: Record<string, unknown>;
  }): Promise<void> {
    const ready = await this.ensureReady();
    if (!ready.admin_audit_log) return;
    await this.db.query(
      `INSERT INTO admin_audit_log
         (event_type, actor_email, category, severity, subject_label, subject_id, action, summary, diff_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        input.event_type,
        input.actor_email,
        input.category,
        input.severity,
        input.subject_label,
        input.subject_id,
        input.action,
        input.summary,
        JSON.stringify(input.diff_json ?? {}),
      ],
    );
  }

  async insertPermissionFunctionAudit(
    functionCode: string,
    actorEmail: string,
    diff: Record<string, unknown>,
  ): Promise<void> {
    const ready = await this.ensureReady();
    if (!ready.permission_audit) return;
    const payload = {
      function_code: functionCode,
      added: diff.added ?? [],
      removed: diff.removed ?? [],
    };
    await this.db.query(
      `INSERT INTO staff_permission_audit (actor_email, position_id, diff_json)
       VALUES ($1, 0, $2::jsonb)`,
      [actorEmail || '', JSON.stringify(payload)],
    );
  }

  async logPiiAccess(input: {
    actor_email: string;
    actor_user_id?: string;
    resource_type: string;
    resource_id: string;
    field_path: string;
    action?: string;
    request_path?: string;
  }): Promise<void> {
    const ready = await this.ensureReady();
    if (!ready.pii_access) return;
    await this.db.query(
      `INSERT INTO staff_pii_access_log
         (actor_email, actor_user_id, resource_type, resource_id, field_path, action, request_path)
       VALUES ($1, $2::uuid, $3, $4, $5, $6, $7)`,
      [
        input.actor_email,
        input.actor_user_id ?? null,
        input.resource_type,
        input.resource_id,
        input.field_path,
        input.action ?? 'view',
        input.request_path ?? '',
      ],
    );
  }

  async createSnapshot(input: {
    snapshot_type: string;
    entity_key: string;
    payload_json: Record<string, unknown>;
    signed_by: string;
    note: string;
  }): Promise<number> {
    const ready = await this.ensureReady();
    if (!ready.snapshots) {
      throw new Error('admin_config_snapshots_unavailable');
    }
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO admin_config_snapshots (snapshot_type, entity_key, payload_json, signed_by, note)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       RETURNING id`,
      [
        input.snapshot_type,
        input.entity_key,
        JSON.stringify(input.payload_json),
        input.signed_by,
        input.note,
      ],
    );
    return Number(result.rows[0]?.id ?? 0);
  }

  async latestSnapshot(snapshotType: string, entityKey: string): Promise<{
    id: number;
    payload_json: Record<string, unknown>;
    signed_at: string;
  } | null> {
    const ready = await this.ensureReady();
    if (!ready.snapshots) return null;
    const result = await this.db.query(
      `SELECT id, payload_json, signed_at::text
       FROM admin_config_snapshots
       WHERE snapshot_type = $1 AND entity_key = $2
       ORDER BY signed_at DESC, id DESC
       LIMIT 1`,
      [snapshotType, entityKey],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      payload_json: (row.payload_json ?? {}) as Record<string, unknown>,
      signed_at: String(row.signed_at),
    };
  }

  buildNextCursor(events: AdminAuditEvent[], hasMore: boolean): string | null {
    if (!hasMore || !events.length) return null;
    return buildAuditCursor(events[events.length - 1]!);
  }
}
