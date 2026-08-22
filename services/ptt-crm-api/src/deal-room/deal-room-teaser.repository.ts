import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { DealRoomTeaserTokenRow } from './deal-room-teaser.types';

@Injectable()
export class DealRoomTeaserRepository implements OnModuleDestroy {
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

  async tablesReady(): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_deal_teaser_tokens'`,
      );
      return (result.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async revokeActiveForLead(leadId: number): Promise<number> {
    const result = await this.db.query(
      `UPDATE crm_deal_teaser_tokens
       SET revoked_at = NOW()
       WHERE lead_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [leadId],
    );
    return result.rowCount ?? 0;
  }

  async insertToken(input: {
    leadId: number;
    tokenHash: string;
    expiresAt: Date;
    createdBy: number | null;
  }): Promise<DealRoomTeaserTokenRow> {
    const result = await this.db.query(
      `INSERT INTO crm_deal_teaser_tokens (lead_id, token_hash, expires_at, created_by)
       VALUES ($1, $2, $3::timestamptz, $4)
       RETURNING id, lead_id, token_hash, expires_at::text, revoked_at::text, created_by, created_at::text`,
      [input.leadId, input.tokenHash, input.expiresAt.toISOString(), input.createdBy],
    );
    return result.rows[0] as DealRoomTeaserTokenRow;
  }

  async findActiveByLeadId(leadId: number): Promise<DealRoomTeaserTokenRow | null> {
    const result = await this.db.query(
      `SELECT id, lead_id, token_hash, expires_at::text, revoked_at::text, created_by, created_at::text
       FROM crm_deal_teaser_tokens
       WHERE lead_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY id DESC
       LIMIT 1`,
      [leadId],
    );
    return (result.rows[0] as DealRoomTeaserTokenRow | undefined) ?? null;
  }

  async findByTokenHash(tokenHash: string): Promise<DealRoomTeaserTokenRow | null> {
    const result = await this.db.query(
      `SELECT id, lead_id, token_hash, expires_at::text, revoked_at::text, created_by, created_at::text
       FROM crm_deal_teaser_tokens
       WHERE token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );
    return (result.rows[0] as DealRoomTeaserTokenRow | undefined) ?? null;
  }

  async revokeByLeadId(leadId: number): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE crm_deal_teaser_tokens
       SET revoked_at = NOW()
       WHERE lead_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [leadId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
