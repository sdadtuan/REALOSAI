import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import {
  AI_TOOLS_MIGRATION_VERSION,
  AiToolApiKeyCreateResult,
  AiToolApiKeyRecord,
  AiToolCallLogInsert,
} from './ai-tools.types';

const KEY_PREFIX = 'ptt_ai_';
const KEY_SECRET_BYTES = 24;

function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

function generatePlaintextKey(): string {
  return `${KEY_PREFIX}${randomBytes(KEY_SECRET_BYTES).toString('base64url')}`;
}

function mapKeyRow(row: Record<string, unknown>): AiToolApiKeyRecord {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    key_prefix: String(row.key_prefix ?? ''),
    client_id: (row.client_id as string | null) ?? null,
    allowed_tools: (row.allowed_tools as string[]) ?? [],
    rate_limit_per_min: Number(row.rate_limit_per_min ?? 60),
    is_active: Boolean(row.is_active),
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    revoked_at: row.revoked_at != null ? String(row.revoked_at) : null,
  };
}

const KEY_SELECT_COLUMNS = `
  id::text, name, key_prefix, client_id::text, allowed_tools,
  rate_limit_per_min, is_active, created_by, created_at::text, revoked_at::text
`;

@Injectable()
export class AiToolKeysRepository implements OnModuleDestroy {
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

  async tableReady(): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'ai_tool_api_keys'
         LIMIT 1`,
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch {
      return false;
    }
  }

  async migrationVersion(): Promise<string | null> {
    try {
      const result = await this.db.query(
        `SELECT version FROM schema_migrations
         WHERE version = $1
         LIMIT 1`,
        [AI_TOOLS_MIGRATION_VERSION],
      );
      return (result.rows[0]?.version as string | undefined) ?? null;
    } catch {
      return null;
    }
  }

  async create(
    name: string,
    allowedTools: string[],
    clientId?: string | null,
    createdBy?: string | null,
  ): Promise<AiToolApiKeyCreateResult> {
    const plaintextKey = generatePlaintextKey();
    const keyPrefix = plaintextKey.slice(0, 12);
    const keyHash = hashApiKey(plaintextKey);

    const result = await this.db.query(
      `INSERT INTO ai_tool_api_keys (
         name, key_prefix, key_hash, client_id, allowed_tools, created_by
       ) VALUES (
         $1, $2, $3, $4::uuid, $5::jsonb, $6
       )
       RETURNING id::text AS id`,
      [
        name,
        keyPrefix,
        keyHash,
        clientId ?? null,
        JSON.stringify(allowedTools),
        createdBy ?? null,
      ],
    );

    return {
      id: String(result.rows[0]?.id ?? ''),
      plaintextKey,
      keyPrefix,
    };
  }

  async revoke(id: string): Promise<void> {
    await this.db.query(
      `UPDATE ai_tool_api_keys
       SET is_active = false, revoked_at = NOW()
       WHERE id = $1::uuid AND revoked_at IS NULL`,
      [id],
    );
  }

  async validateKey(plaintext: string): Promise<AiToolApiKeyRecord | null> {
    if (!plaintext.startsWith(KEY_PREFIX)) {
      return null;
    }

    const keyHash = hashApiKey(plaintext);
    const result = await this.db.query(
      `SELECT ${KEY_SELECT_COLUMNS}
       FROM ai_tool_api_keys
       WHERE key_hash = $1
         AND is_active = true
         AND revoked_at IS NULL
       LIMIT 1`,
      [keyHash],
    );
    const row = result.rows[0];
    return row ? mapKeyRow(row) : null;
  }

  async listKeys(): Promise<AiToolApiKeyRecord[]> {
    const result = await this.db.query(
      `SELECT ${KEY_SELECT_COLUMNS}
       FROM ai_tool_api_keys
       ORDER BY created_at DESC`,
    );
    return result.rows.map(mapKeyRow);
  }

  async recordCall(entry: AiToolCallLogInsert): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO ai_tool_call_log (
         api_key_id, tool_name, input_json, output_json,
         status, latency_ms, agent_run_id
       ) VALUES (
         $1::uuid, $2, $3::jsonb, $4::jsonb, $5, $6, $7::uuid
       )
       RETURNING id::text AS id`,
      [
        entry.apiKeyId ?? null,
        entry.toolName,
        JSON.stringify(entry.inputJson ?? {}),
        JSON.stringify(entry.outputJson ?? {}),
        entry.status,
        entry.latencyMs ?? null,
        entry.agentRunId ?? null,
      ],
    );
    return String(result.rows[0]?.id ?? '');
  }
}
