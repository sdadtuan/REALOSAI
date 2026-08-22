import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AdminAuditRepository } from '../admin-audit/admin-audit.repository';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class GuestAccountExpiryService implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly audit: AdminAuditRepository,
  ) {}

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

  async deactivateExpired(): Promise<{ deactivated: number; emails: string[] }> {
    try {
      const result = await this.db.query<{ id: string; email: string }>(
        `UPDATE staff_users
         SET active = FALSE, updated_at = NOW()
         WHERE active IS TRUE
           AND expires_at IS NOT NULL
           AND expires_at <= NOW()
         RETURNING id::text, email`,
      );
      const emails: string[] = [];
      for (const row of result.rows) {
        emails.push(String(row.email));
        await this.audit.logSyntheticEvent({
          event_type: 'guest_account_expired',
          actor_email: 'system',
          category: 'org_user',
          severity: 'warning',
          subject_label: String(row.email),
          subject_id: String(row.id),
          action: 'deactivate_expired',
          summary: `Tài khoản guest/contractor hết hạn — ${row.email}`,
          diff_json: { user_id: row.id },
        });
      }
      return { deactivated: result.rowCount ?? 0, emails };
    } catch {
      return { deactivated: 0, emails: [] };
    }
  }
}
