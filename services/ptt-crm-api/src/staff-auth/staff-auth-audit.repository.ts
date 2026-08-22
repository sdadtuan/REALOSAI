import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export type StaffAuthAuditEvent =
  | 'sso_login'
  | 'sso_link'
  | 'fallback_password'
  | 'mfa_blocked'
  | 'token_revoked';

@Injectable()
export class StaffAuthAuditRepository {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async write(
    eventType: StaffAuthAuditEvent,
    params: { userId?: string | null; email?: string; detail?: Record<string, unknown> },
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO staff_auth_audit (user_id, email, event_type, detail_json)
         VALUES ($1::uuid, $2, $3, $4::jsonb)`,
        [
          params.userId ?? null,
          (params.email ?? '').trim().toLowerCase(),
          eventType,
          JSON.stringify(params.detail ?? {}),
        ],
      );
    } catch {
      /* table may not exist on fresh dev */
    }
  }
}
