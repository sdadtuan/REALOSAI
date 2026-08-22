import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { isDncBlocked } from './b2b-dnc.util';

@Injectable()
export class B2bDncRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private cache: { loadedAt: number; phones: string[] } | null = null;

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

  async tableReady(): Promise<boolean> {
    const result = await this.db.query(`SELECT to_regclass('public.crm_b2b_dnc') AS reg`);
    return result.rows[0]?.reg != null;
  }

  async listPhones(): Promise<string[]> {
    const now = Date.now();
    if (this.cache && now - this.cache.loadedAt < 60_000) {
      return this.cache.phones;
    }
    if (!(await this.tableReady())) {
      this.cache = { loadedAt: now, phones: [] };
      return [];
    }
    const result = await this.db.query(`SELECT phone_norm FROM crm_b2b_dnc ORDER BY phone_norm`);
    const phones = result.rows.map((row) => String(row.phone_norm ?? ''));
    this.cache = { loadedAt: now, phones };
    return phones;
  }

  async isBlocked(phone: string): Promise<boolean> {
    const list = await this.listPhones();
    return isDncBlocked(phone, list);
  }
}

@Injectable()
export class B2bDncService {
  constructor(private readonly repo: B2bDncRepository) {}

  isBlocked(phone: string): Promise<boolean> {
    return this.repo.isBlocked(phone);
  }
}
