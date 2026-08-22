import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { StaleAccountRow, StaleAccountRisk } from './admin-governance.types';

const SENSITIVE_SECTIONS = new Set(['crm_data_config', 'crm_staff_roster', 'ai_admin']);

@Injectable()
export class StaleAccountService implements OnModuleDestroy {
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

  async listStaleAccounts(opts?: {
    inactive_days?: number;
    include_never_logged_in?: boolean;
    admin_only?: boolean;
  }): Promise<{ accounts: StaleAccountRow[]; threshold_days: number }> {
    const inactiveDays = Math.max(1, Number(opts?.inactive_days ?? 90));
    const includeNever = opts?.include_never_logged_in !== false;
    const adminOnly = Boolean(opts?.admin_only);

    try {
      const result = await this.db.query<{
        id: string;
        email: string;
        display_name: string;
        active: boolean;
        account_kind: string;
        last_login_at: string | null;
        position_code: string | null;
        admin_cap_count: string;
        created_at: string;
      }>(
        `SELECT u.id::text, u.email, u.display_name, u.active,
                COALESCE(u.account_kind, 'staff') AS account_kind,
                u.last_login_at::text, p.code AS position_code,
                u.created_at::text,
                (
                  SELECT COUNT(*)::text
                  FROM staff_section_permissions sp
                  WHERE sp.position_id = u.position_id
                    AND sp.action IN ('configure', 'delete', 'view_pii')
                    AND sp.section_id = ANY($3::text[])
                ) AS admin_cap_count
         FROM staff_users u
         LEFT JOIN crm_positions p ON p.id = u.position_id
         WHERE (
           ($2::boolean AND u.last_login_at IS NULL AND u.active IS TRUE
             AND u.created_at < NOW() - INTERVAL '7 days')
           OR (u.last_login_at IS NOT NULL AND u.last_login_at < NOW() - ($1 || ' days')::interval)
           OR (u.active IS FALSE)
         )
         ORDER BY u.last_login_at NULLS FIRST, u.email
         LIMIT 500`,
        [String(inactiveDays), includeNever, [...SENSITIVE_SECTIONS]],
      );

      let accounts: StaleAccountRow[] = result.rows.map((row) => {
        const adminCapCount = Number(row.admin_cap_count ?? 0);
        const lastLogin = row.last_login_at;
        let daysSince: number | null = null;
        if (lastLogin) {
          daysSince = Math.floor((Date.now() - new Date(lastLogin).getTime()) / 86_400_000);
        }
        let risk: StaleAccountRisk = 'stale';
        if (!row.active) risk = 'inactive';
        else if (!lastLogin) risk = 'never_logged_in';
        else if (adminCapCount > 0 && (daysSince ?? 0) >= inactiveDays) risk = 'orphaned_admin';

        return {
          user_id: row.id,
          email: row.email,
          display_name: row.display_name,
          active: row.active,
          account_kind: row.account_kind,
          last_login_at: lastLogin,
          days_since_login: daysSince,
          position_code: row.position_code,
          risk,
          admin_cap_count: adminCapCount,
        };
      });

      if (adminOnly) {
        accounts = accounts.filter((a) => a.admin_cap_count > 0 || a.risk === 'orphaned_admin');
      }

      return { accounts, threshold_days: inactiveDays };
    } catch {
      return { accounts: [], threshold_days: inactiveDays };
    }
  }
}
