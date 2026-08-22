import { BadRequestException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';

const PROVIDER_CODES = new Set(['leonardo', 'flux', 'kling', 'runway', 'topaz', 'openai', 'ffmpeg']);

export type VdProviderRow = {
  id: number;
  code: string;
  label: string;
  created_at: string;
};

export type VdModelRow = {
  id: number;
  provider: string;
  code: string;
  capability_json: Record<string, unknown>;
  created_at: string;
};

type MemoryStore = {
  providers: VdProviderRow[];
  models: Array<VdModelRow & { provider_id: number }>;
  nextProviderId: number;
  nextModelId: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* fall through */
    }
  }
  return {};
}

function mapKnownError(err: unknown): never {
  const msg = err instanceof Error ? err.message : 'unknown';
  if (msg === 'vd_tables_missing' || msg === 'invalid_body') {
    throw new BadRequestException({ error: msg, message: msg });
  }
  throw err;
}

@Injectable()
export class VdAdminService implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = {
    providers: [],
    models: [],
    nextProviderId: 1,
    nextModelId: 1,
  };

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async ensurePgReady(): Promise<boolean> {
    if (this.pgReady === true) return true;
    try {
      await this.db.query(`SELECT 1 FROM vd_providers LIMIT 1`);
      this.pgReady = true;
      return true;
    } catch {
      return false;
    }
  }

  private assertWritableOrThrow(): void {
    if (this.config.contentMarketingVideoCinematicEnabled) {
      throw new Error('vd_tables_missing');
    }
  }

  async listProviders(): Promise<VdProviderRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, code, label, created_at FROM vd_providers ORDER BY code`,
      );
      return (res.rows as Record<string, unknown>[]).map((row) => ({
        id: Number(row.id),
        code: String(row.code ?? ''),
        label: String(row.label ?? ''),
        created_at: new Date(String(row.created_at)).toISOString(),
      }));
    }
    return this.memory.providers.slice().sort((a, b) => a.code.localeCompare(b.code));
  }

  async createProvider(body: Record<string, unknown>): Promise<VdProviderRow> {
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    if (!code || !label || !PROVIDER_CODES.has(code)) {
      throw new BadRequestException({ error: 'invalid_body', message: 'invalid_body' });
    }

    try {
      if (await this.ensurePgReady()) {
        const res = await this.db.query(
          `INSERT INTO vd_providers (code, label)
           VALUES ($1, $2)
           RETURNING id, code, label, created_at`,
          [code, label],
        );
        const row = res.rows[0] as Record<string, unknown>;
        return {
          id: Number(row.id),
          code: String(row.code ?? ''),
          label: String(row.label ?? ''),
          created_at: new Date(String(row.created_at)).toISOString(),
        };
      }
      this.assertWritableOrThrow();
      if (this.memory.providers.some((p) => p.code === code)) {
        throw new BadRequestException({ error: 'invalid_body', message: 'invalid_body' });
      }
      const row: VdProviderRow = {
        id: this.memory.nextProviderId++,
        code,
        label,
        created_at: new Date().toISOString(),
      };
      this.memory.providers.push(row);
      return row;
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === '23505') {
        throw new BadRequestException({ error: 'invalid_body', message: 'invalid_body' });
      }
      mapKnownError(err);
    }
  }

  async listModels(): Promise<VdModelRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT m.id, p.code AS provider, m.code, m.capability_json, m.created_at
         FROM vd_models m
         JOIN vd_providers p ON p.id = m.provider_id
         ORDER BY p.code, m.code`,
      );
      return (res.rows as Record<string, unknown>[]).map((row) => ({
        id: Number(row.id),
        provider: String(row.provider ?? ''),
        code: String(row.code ?? ''),
        capability_json: asRecord(row.capability_json),
        created_at: new Date(String(row.created_at)).toISOString(),
      }));
    }
    return this.memory.models
      .slice()
      .sort((a, b) => a.provider.localeCompare(b.provider) || a.code.localeCompare(b.code));
  }

  async createModel(body: Record<string, unknown>): Promise<VdModelRow> {
    const providerCode = typeof body.provider_code === 'string' ? body.provider_code.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!providerCode || !code) {
      throw new BadRequestException({ error: 'invalid_body', message: 'invalid_body' });
    }
    const capability = asRecord(body.capability_json);

    try {
      if (await this.ensurePgReady()) {
        const res = await this.db.query(
          `INSERT INTO vd_models (provider_id, code, capability_json)
           SELECT p.id, $2, $3::jsonb
           FROM vd_providers p
           WHERE p.code = $1
           RETURNING id, $1::text AS provider, code, capability_json, created_at`,
          [providerCode, code, JSON.stringify(capability)],
        );
        const row = res.rows[0] as Record<string, unknown> | undefined;
        if (!row) {
          throw new BadRequestException({ error: 'invalid_body', message: 'invalid_body' });
        }
        return {
          id: Number(row.id),
          provider: String(row.provider ?? providerCode),
          code: String(row.code ?? ''),
          capability_json: asRecord(row.capability_json),
          created_at: new Date(String(row.created_at)).toISOString(),
        };
      }
      this.assertWritableOrThrow();
      const provider = this.memory.providers.find((p) => p.code === providerCode);
      if (!provider) {
        throw new BadRequestException({ error: 'invalid_body', message: 'invalid_body' });
      }
      if (this.memory.models.some((m) => m.provider_id === provider.id && m.code === code)) {
        throw new BadRequestException({ error: 'invalid_body', message: 'invalid_body' });
      }
      const row: VdModelRow & { provider_id: number } = {
        id: this.memory.nextModelId++,
        provider_id: provider.id,
        provider: provider.code,
        code,
        capability_json: capability,
        created_at: new Date().toISOString(),
      };
      this.memory.models.push(row);
      return {
        id: row.id,
        provider: row.provider,
        code: row.code,
        capability_json: row.capability_json,
        created_at: row.created_at,
      };
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === '23505') {
        throw new BadRequestException({ error: 'invalid_body', message: 'invalid_body' });
      }
      mapKnownError(err);
    }
  }
}
