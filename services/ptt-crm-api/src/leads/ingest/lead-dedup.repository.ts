import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import { normalizeEmail, normalizePhone, pgPhoneNormSql } from './lead-contact.util';

export interface LeadDuplicateMatch {
  lead_id: number;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  owner_id: number | null;
}

@Injectable()
export class LeadDedupRepository implements OnModuleDestroy {
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

  async findContactDuplicates(input: {
    phone?: string;
    email?: string;
    excludeId?: number;
    b2bProjectId?: string | null;
  }): Promise<LeadDuplicateMatch[]> {
    const ph = normalizePhone(input.phone);
    const em = normalizeEmail(input.email);
    if (!ph && !em) return [];

    const clauses = ['COALESCE(is_duplicate, FALSE) IS NOT TRUE'];
    const params: unknown[] = [];
    const sub: string[] = [];
    if (ph) {
      sub.push(`${pgPhoneNormSql()} = $${params.length + 1}`);
      params.push(ph);
    }
    if (em) {
      sub.push(`lower(trim(email)) = $${params.length + 1}`);
      params.push(em);
    }
    clauses.push(`(${sub.join(' OR ')})`);
    if (input.excludeId) {
      clauses.push(`sqlite_lead_id <> $${params.length + 1}`);
      params.push(input.excludeId);
    }
    if (input.b2bProjectId !== undefined) {
      clauses.push(`b2b_project_id IS NOT DISTINCT FROM $${params.length + 1}::uuid`);
      params.push(input.b2bProjectId || null);
    }

    const result = await this.db.query(
      `SELECT sqlite_lead_id, full_name, phone, email, owner_id
       FROM crm_leads
       WHERE ${clauses.join(' AND ')}
       ORDER BY sqlite_lead_id ASC
       LIMIT 5`,
      params,
    );

    return result.rows.map((row) => ({
      lead_id: Number(row.sqlite_lead_id),
      full_name: row.full_name ?? null,
      phone: row.phone ?? null,
      email: row.email ?? null,
      owner_id: row.owner_id != null ? Number(row.owner_id) : null,
    }));
  }

  async findByExternalId(input: {
    clientId?: string | null;
    channel?: string;
    externalLeadId?: string | null;
  }): Promise<number | null> {
    const externalLeadId = String(input.externalLeadId ?? '').trim();
    if (!externalLeadId) return null;

    const clauses = ['external_lead_id = $1', 'COALESCE(is_duplicate, FALSE) IS NOT TRUE'];
    const params: unknown[] = [externalLeadId];
    if (input.clientId) {
      clauses.push(`agency_client_id = $${params.length + 1}::uuid`);
      params.push(input.clientId);
    }
    if (input.channel) {
      clauses.push(`lower(COALESCE(channel, '')) = $${params.length + 1}`);
      params.push(input.channel.trim().toLowerCase());
    }

    const result = await this.db.query(
      `SELECT sqlite_lead_id FROM crm_leads
       WHERE ${clauses.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT 1`,
      params,
    );
    const id = result.rows[0]?.sqlite_lead_id;
    return id != null ? Number(id) : null;
  }
}
