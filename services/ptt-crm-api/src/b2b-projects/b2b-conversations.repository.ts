import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export interface B2bConversationMessageRow {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  provider_message_id: string | null;
  created_at: string;
}

@Injectable()
export class B2bConversationsRepository implements OnModuleDestroy {
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

  async tablesReady(): Promise<boolean> {
    const result = await this.db.query(
      `SELECT to_regclass('public.crm_b2b_conversation_threads') AS reg`,
    );
    return result.rows[0]?.reg != null;
  }

  async findLeadByZaloUser(projectId: string, userId: string): Promise<number | null> {
    const result = await this.db.query(
      `SELECT id
       FROM crm_leads
       WHERE b2b_project_id = $1::uuid
         AND (
           meta_json->>'user_id' = $2
           OR meta_json->'meta'->>'user_id' = $2
           OR meta_json->>'zalo_user_id' = $2
         )
       ORDER BY created_at DESC
       LIMIT 1`,
      [projectId, userId],
    );
    const id = result.rows[0]?.id;
    return id != null ? Number(id) : null;
  }

  async upsertThread(input: {
    leadId: number;
    projectId: string;
    oaId: string;
    externalUserId: string;
  }): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO crm_b2b_conversation_threads (lead_id, project_id, channel, oa_id, external_user_id)
       VALUES ($1, $2::uuid, 'zalo', $3, $4)
       ON CONFLICT (project_id, channel, oa_id, external_user_id)
       DO UPDATE SET lead_id = EXCLUDED.lead_id
       RETURNING id::text`,
      [input.leadId, input.projectId, input.oaId, input.externalUserId],
    );
    return String(result.rows[0].id);
  }

  async insertMessage(input: {
    threadId: string;
    direction: 'inbound' | 'outbound';
    body: string;
    providerMessageId?: string;
  }): Promise<void> {
    if (input.providerMessageId) {
      const dup = await this.db.query(
        `SELECT 1 FROM crm_b2b_conversation_messages
         WHERE thread_id = $1::uuid AND provider_message_id = $2 LIMIT 1`,
        [input.threadId, input.providerMessageId],
      );
      if ((dup.rowCount ?? 0) > 0) return;
    }
    await this.db.query(
      `INSERT INTO crm_b2b_conversation_messages (thread_id, direction, body, provider_message_id)
       VALUES ($1::uuid, $2, $3, $4)`,
      [input.threadId, input.direction, input.body, input.providerMessageId ?? null],
    );
  }

  async getThreadByLeadId(leadId: number): Promise<{ id: string; oa_id: string; external_user_id: string } | null> {
    const result = await this.db.query(
      `SELECT id::text, oa_id, external_user_id
       FROM crm_b2b_conversation_threads
       WHERE lead_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [leadId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      oa_id: String(row.oa_id),
      external_user_id: String(row.external_user_id),
    };
  }

  async listMessages(threadId: string, limit = 100): Promise<B2bConversationMessageRow[]> {
    const result = await this.db.query(
      `SELECT id::text, direction, body, provider_message_id, created_at::text
       FROM crm_b2b_conversation_messages
       WHERE thread_id = $1::uuid
       ORDER BY created_at ASC
       LIMIT $2`,
      [threadId, limit],
    );
    return result.rows as B2bConversationMessageRow[];
  }
}
