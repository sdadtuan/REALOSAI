import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';

export type VdDeliveryPackageRow = {
  id: number;
  project_id: number;
  zip_storage_key: string;
  file_names_json: string[];
  meta_json: Record<string, unknown>;
  created_at: string;
};

type MemoryStore = {
  packages: VdDeliveryPackageRow[];
  nextId: number;
};

@Injectable()
export class VdDeliveryRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = { packages: [], nextId: 1 };

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
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM vd_delivery_packages LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private assertWritableOrThrow(): void {
    if (this.config.contentMarketingVideoCinematicEnabled) {
      throw new Error('vd_tables_missing');
    }
  }

  private mapRow(row: Record<string, unknown>): VdDeliveryPackageRow {
    const names = row.file_names_json;
    const meta = row.meta_json;
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      zip_storage_key: String(row.zip_storage_key ?? ''),
      file_names_json: Array.isArray(names) ? names.map(String) : [],
      meta_json:
        meta && typeof meta === 'object' && !Array.isArray(meta)
          ? (meta as Record<string, unknown>)
          : {},
      created_at: new Date(String(row.created_at)).toISOString(),
    };
  }

  async insert(input: {
    project_id: number;
    zip_storage_key: string;
    file_names_json: string[];
    meta_json: Record<string, unknown>;
  }): Promise<VdDeliveryPackageRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO vd_delivery_packages (project_id, zip_storage_key, file_names_json, meta_json)
         VALUES ($1, $2, $3::jsonb, $4::jsonb)
         RETURNING id, project_id, zip_storage_key, file_names_json, meta_json, created_at`,
        [
          input.project_id,
          input.zip_storage_key,
          JSON.stringify(input.file_names_json),
          JSON.stringify(input.meta_json),
        ],
      );
      return this.mapRow(res.rows[0] as Record<string, unknown>);
    }
    this.assertWritableOrThrow();
    const row: VdDeliveryPackageRow = {
      id: this.memory.nextId++,
      project_id: input.project_id,
      zip_storage_key: input.zip_storage_key,
      file_names_json: input.file_names_json,
      meta_json: input.meta_json,
      created_at: new Date().toISOString(),
    };
    this.memory.packages.push(row);
    return row;
  }

  async getLatestByProjectId(projectId: number): Promise<VdDeliveryPackageRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, project_id, zip_storage_key, file_names_json, meta_json, created_at
         FROM vd_delivery_packages
         WHERE project_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [projectId],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return row ? this.mapRow(row) : null;
    }
    return (
      this.memory.packages
        .filter((row) => row.project_id === projectId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
    );
  }
}
