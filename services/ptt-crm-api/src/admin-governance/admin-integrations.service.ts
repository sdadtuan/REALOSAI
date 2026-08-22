import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { AdminIntegrationRow } from './admin-governance.types';

@Injectable()
export class AdminIntegrationsService implements OnModuleDestroy {
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

  async listIntegrations(): Promise<{ integrations: AdminIntegrationRow[]; summary: Record<string, number> }> {
    const integrations: AdminIntegrationRow[] = [];

    integrations.push({
      id: 'webhook-meta',
      kind: 'webhook',
      name: 'Meta lead webhook (Nest)',
      status: this.config.webhooksNestMetaEnabled ? 'ok' : 'disabled',
      detail: this.config.webhooksNestMetaEnabled ? 'PTT_WEBHOOKS_NEST_META=1' : 'Disabled',
    });
    integrations.push({
      id: 'webhook-zalo',
      kind: 'webhook',
      name: 'Zalo OA webhook (Nest)',
      status: this.config.webhooksNestZaloEnabled ? 'ok' : 'disabled',
      detail: this.config.webhooksNestZaloEnabled ? 'PTT_WEBHOOKS_NEST_ZALO=1' : 'Disabled',
    });
    integrations.push({
      id: 'webhook-google',
      kind: 'webhook',
      name: 'Google Ads webhook (Nest)',
      status: this.config.webhooksNestGoogleEnabled ? 'ok' : 'disabled',
      detail: this.config.webhooksNestGoogleEnabled ? 'Enabled' : 'Disabled',
    });
    integrations.push({
      id: 'webhook-email',
      kind: 'webhook',
      name: 'Email webhook (Nest)',
      status: this.config.webhooksNestEmailEnabled ? 'ok' : 'disabled',
      detail: this.config.webhooksNestEmailEnabled ? 'Enabled' : 'Disabled',
    });
    integrations.push({
      id: 'staff-sso',
      kind: 'auth',
      name: 'Staff SSO (Keycloak)',
      status: this.config.staffSsoConfigured() ? 'ok' : 'warning',
      detail: this.config.staffAuthMode,
      redirect_href: '/admin/crm/sso/groups',
    });

    await this.appendChannelAccounts(integrations);

    const summary = { ok: 0, warning: 0, critical: 0, disabled: 0 };
    for (const row of integrations) {
      summary[row.status] = (summary[row.status] ?? 0) + 1;
    }

    return { integrations, summary };
  }

  health() {
    return this.listIntegrations().then(({ integrations, summary }) => ({
      ok: summary.ok >= integrations.length - 2,
      summary,
      expiring_count: integrations.filter((i) => i.status === 'warning').length,
      critical_count: integrations.filter((i) => i.status === 'critical').length,
    }));
  }

  rotateRequest(id: string, actorEmail: string) {
    const redirect =
      id.startsWith('channel-') && id.includes('-')
        ? `/agency/clients/${id.split('-').slice(2).join('-')}?tab=channels`
        : '/agency/clients';
    return {
      ok: true,
      integration_id: id,
      actor_email: actorEmail,
      redirect_href: redirect,
      note: 'R4 — rotate via agency client channels UI',
    };
  }

  private async appendChannelAccounts(integrations: AdminIntegrationRow[]) {
    try {
      const result = await this.db.query<{
        id: string;
        client_id: string;
        client_name: string;
        channel: string;
        token_status: string | null;
        token_expires_at: string | null;
      }>(
        `SELECT cca.id::text, cca.client_id::text, c.name AS client_name, cca.channel,
                cca.token_status, cca.token_expires_at::text
         FROM client_channel_accounts cca
         JOIN clients c ON c.id = cca.client_id
         WHERE cca.access_token_encrypted IS NOT NULL
         ORDER BY cca.token_expires_at NULLS LAST
         LIMIT 50`,
      );
      for (const row of result.rows) {
        const status = this.tokenStatus(row.token_status, row.token_expires_at);
        integrations.push({
          id: `channel-${row.channel}-${row.client_id}`,
          kind: 'oauth',
          name: `${row.channel.toUpperCase()} · ${row.client_name}`,
          status,
          detail: row.token_expires_at
            ? `Hết hạn ${row.token_expires_at.slice(0, 10)}`
            : row.token_status ?? 'connected',
          redirect_href: `/agency/clients/${row.client_id}?tab=channels`,
        });
      }
    } catch {
      // table may not exist in dev sqlite-only
    }
  }

  private tokenStatus(
    tokenStatus: string | null,
    expiresAt: string | null,
  ): AdminIntegrationRow['status'] {
    const st = String(tokenStatus ?? '').toLowerCase();
    if (st === 'expired' || st === 'revoked') return 'critical';
    if (!expiresAt) return st === 'valid' || st === 'ok' ? 'ok' : 'warning';
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'critical';
    if (ms <= 7 * 86_400_000) return 'warning';
    return 'ok';
  }
}
