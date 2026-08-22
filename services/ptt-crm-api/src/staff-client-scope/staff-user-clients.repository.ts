import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { normalizeClientIds } from './staff-client-scope.util';

@Injectable()
export class StaffUserClientsRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private memory = new Map<string, string[]>();

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

  private async pgReady(): Promise<boolean> {
    try {
      await this.db.query(`SELECT 1 FROM staff_user_clients LIMIT 1`);
      return true;
    } catch {
      return false;
    }
  }

  async loadClientIdsForUser(userId: string): Promise<string[]> {
    const ref = userId.trim();
    if (!ref) return [];
    if (await this.pgReady()) {
      try {
        const result = await this.db.query<{ client_id: string }>(
          `SELECT client_id::text
           FROM staff_user_clients
           WHERE user_id = $1::uuid
           ORDER BY client_id::text`,
          [ref],
        );
        return normalizeClientIds(result.rows.map((r) => String(r.client_id)));
      } catch {
        return normalizeClientIds(this.memory.get(ref) ?? []);
      }
    }
    return normalizeClientIds(this.memory.get(ref) ?? []);
  }

  async replaceUserClients(userId: string, clientIds: string[], actorEmail: string): Promise<string[]> {
    const ref = userId.trim();
    const normalized = normalizeClientIds(clientIds);
    const actor = String(actorEmail ?? '').slice(0, 255);
    if (await this.pgReady()) {
      await this.db.query(`DELETE FROM staff_user_clients WHERE user_id = $1::uuid`, [ref]);
      for (const clientId of normalized) {
        await this.db.query(
          `INSERT INTO staff_user_clients (user_id, client_id, granted_by)
           VALUES ($1::uuid, $2::uuid, $3)
           ON CONFLICT (user_id, client_id) DO UPDATE SET granted_by = EXCLUDED.granted_by`,
          [ref, clientId, actor],
        );
      }
      return normalized;
    }
    this.memory.set(ref, normalized);
    return normalized;
  }
}
