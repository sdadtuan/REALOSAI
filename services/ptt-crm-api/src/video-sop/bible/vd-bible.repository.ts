import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';

export type VdStyleBibleBody = {
  palette: string[];
  lens: string;
  lighting: string;
  refs: string[];
};

export type VdCharacterBibleItem = {
  name: string;
  lock_regions: string[];
  notes: string;
};

type MemoryStore = {
  style: Map<number, Record<string, unknown>>;
  characters: Map<number, Record<string, unknown>>;
};

const DEFAULT_STYLE: VdStyleBibleBody = {
  palette: [],
  lens: '',
  lighting: '',
  refs: [],
};

const DEFAULT_CHARACTERS = { items: [] as VdCharacterBibleItem[] };

@Injectable()
export class VdBibleRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = {
    style: new Map(),
    characters: new Map(),
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
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM vd_style_bibles LIMIT 1`);
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

  async getStyle(projectId: number): Promise<VdStyleBibleBody> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT body_json FROM vd_style_bibles WHERE project_id = $1`,
        [projectId],
      );
      const row = res.rows[0] as { body_json?: unknown } | undefined;
      return normalizeStyle(row?.body_json);
    }
    return normalizeStyle(this.memory.style.get(projectId));
  }

  async upsertStyle(projectId: number, body: VdStyleBibleBody): Promise<VdStyleBibleBody> {
    const normalized = normalizeStyle(body);
    if (await this.ensurePgReady()) {
      await this.db.query(
        `INSERT INTO vd_style_bibles (project_id, body_json)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (project_id) DO UPDATE
           SET body_json = EXCLUDED.body_json, updated_at = now()`,
        [projectId, JSON.stringify(normalized)],
      );
      return normalized;
    }
    this.assertWritableOrThrow();
    this.memory.style.set(projectId, normalized);
    return normalized;
  }

  async getCharacters(projectId: number): Promise<{ items: VdCharacterBibleItem[] }> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT body_json FROM vd_character_bibles WHERE project_id = $1`,
        [projectId],
      );
      const row = res.rows[0] as { body_json?: unknown } | undefined;
      return normalizeCharacters(row?.body_json);
    }
    return normalizeCharacters(this.memory.characters.get(projectId));
  }

  async upsertCharacters(
    projectId: number,
    body: { items: VdCharacterBibleItem[] },
  ): Promise<{ items: VdCharacterBibleItem[] }> {
    const normalized = normalizeCharacters(body);
    if (await this.ensurePgReady()) {
      await this.db.query(
        `INSERT INTO vd_character_bibles (project_id, body_json)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (project_id) DO UPDATE
           SET body_json = EXCLUDED.body_json, updated_at = now()`,
        [projectId, JSON.stringify(normalized)],
      );
      return normalized;
    }
    this.assertWritableOrThrow();
    this.memory.characters.set(projectId, normalized);
    return normalized;
  }
}

function normalizeStyle(raw: unknown): VdStyleBibleBody {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_STYLE };
  }
  const obj = raw as Record<string, unknown>;
  const palette = Array.isArray(obj.palette)
    ? obj.palette.filter((v): v is string => typeof v === 'string').map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    palette,
    lens: typeof obj.lens === 'string' ? obj.lens.trim() : '',
    lighting: typeof obj.lighting === 'string' ? obj.lighting.trim() : '',
    refs: Array.isArray(obj.refs)
      ? obj.refs.filter((v): v is string => typeof v === 'string').map((s) => s.trim()).filter(Boolean)
      : [],
  };
}

function normalizeCharacters(raw: unknown): { items: VdCharacterBibleItem[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { items: [] };
  }
  const itemsRaw = (raw as { items?: unknown }).items;
  if (!Array.isArray(itemsRaw)) {
    return { items: [] };
  }
  const items: VdCharacterBibleItem[] = [];
  for (const entry of itemsRaw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) continue;
    const lock_regions = Array.isArray(row.lock_regions)
      ? row.lock_regions
          .filter((v): v is string => typeof v === 'string')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    items.push({
      name,
      lock_regions,
      notes: typeof row.notes === 'string' ? row.notes.trim() : '',
    });
  }
  return { items };
}

export { DEFAULT_CHARACTERS, DEFAULT_STYLE };
