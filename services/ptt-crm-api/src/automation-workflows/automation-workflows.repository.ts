import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  AutomationNodeType,
  AutomationTriggerType,
  AutomationWorkflowNodeRecord,
  AutomationWorkflowRecord,
  AutomationWorkflowStatus,
} from './automation-workflows.types';

function mapWorkflow(row: Record<string, unknown>): AutomationWorkflowRecord {
  return {
    id: String(row.id ?? ''),
    client_id: (row.client_id as string | null) ?? null,
    name: String(row.name ?? ''),
    trigger_type: String(row.trigger_type ?? 'event') as AutomationTriggerType,
    status: String(row.status ?? 'draft') as AutomationWorkflowStatus,
    version: Number(row.version ?? 1),
    definition_json: (row.definition_json as Record<string, unknown>) ?? {},
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

function mapNode(row: Record<string, unknown>): AutomationWorkflowNodeRecord {
  return {
    id: String(row.id ?? ''),
    workflow_id: String(row.workflow_id ?? ''),
    node_key: String(row.node_key ?? ''),
    node_type: String(row.node_type ?? 'trigger') as AutomationNodeType,
    config_json: (row.config_json as Record<string, unknown>) ?? {},
    next_node_key: (row.next_node_key as string | null) ?? null,
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ''),
  };
}

@Injectable()
export class AutomationWorkflowsRepository implements OnModuleDestroy {
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
         WHERE table_schema = 'public' AND table_name = 'automation_workflows'
         LIMIT 1`,
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch {
      return false;
    }
  }

  async list(args: { limit: number; offset: number }): Promise<{ rows: AutomationWorkflowRecord[]; total: number }> {
    const limit = Math.min(Math.max(args.limit, 1), 100);
    const offset = Math.max(args.offset, 0);
    const count = await this.db.query(`SELECT COUNT(*)::int AS n FROM automation_workflows`);
    const total = Number(count.rows[0]?.n ?? 0);
    const result = await this.db.query(
      `SELECT id::text, client_id::text, name, trigger_type, status, version,
              definition_json, created_by, created_at, updated_at
       FROM automation_workflows
       ORDER BY updated_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return { rows: result.rows.map(mapWorkflow), total };
  }

  async findById(id: string): Promise<AutomationWorkflowRecord | null> {
    const result = await this.db.query(
      `SELECT id::text, client_id::text, name, trigger_type, status, version,
              definition_json, created_by, created_at, updated_at
       FROM automation_workflows WHERE id = $1::uuid`,
      [id],
    );
    return result.rows[0] ? mapWorkflow(result.rows[0]) : null;
  }

  async insert(args: {
    name: string;
    triggerType: AutomationTriggerType;
    definitionJson: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<AutomationWorkflowRecord> {
    const result = await this.db.query(
      `INSERT INTO automation_workflows (name, trigger_type, definition_json, created_by)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING id::text, client_id::text, name, trigger_type, status, version,
                 definition_json, created_by, created_at, updated_at`,
      [args.name, args.triggerType, JSON.stringify(args.definitionJson), args.createdBy ?? null],
    );
    return mapWorkflow(result.rows[0]);
  }

  async update(
    id: string,
    patch: {
      name?: string;
      triggerType?: AutomationTriggerType;
      status?: AutomationWorkflowStatus;
      definitionJson?: Record<string, unknown>;
    },
  ): Promise<AutomationWorkflowRecord | null> {
    const result = await this.db.query(
      `UPDATE automation_workflows
       SET name = COALESCE($2, name),
           trigger_type = COALESCE($3, trigger_type),
           status = COALESCE($4, status),
           definition_json = COALESCE($5::jsonb, definition_json),
           updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id::text, client_id::text, name, trigger_type, status, version,
                 definition_json, created_by, created_at, updated_at`,
      [
        id,
        patch.name ?? null,
        patch.triggerType ?? null,
        patch.status ?? null,
        patch.definitionJson ? JSON.stringify(patch.definitionJson) : null,
      ],
    );
    return result.rows[0] ? mapWorkflow(result.rows[0]) : null;
  }

  async listNodes(workflowId: string): Promise<AutomationWorkflowNodeRecord[]> {
    const result = await this.db.query(
      `SELECT id::text, workflow_id::text, node_key, node_type, config_json,
              next_node_key, sort_order, created_at
       FROM automation_workflow_nodes
       WHERE workflow_id = $1::uuid
       ORDER BY sort_order ASC, node_key ASC`,
      [workflowId],
    );
    return result.rows.map(mapNode);
  }

  async replaceNodes(
    workflowId: string,
    nodes: Array<{
      nodeKey: string;
      nodeType: AutomationNodeType;
      configJson: Record<string, unknown>;
      nextNodeKey?: string | null;
      sortOrder: number;
    }>,
  ): Promise<AutomationWorkflowNodeRecord[]> {
    await this.db.query(`DELETE FROM automation_workflow_nodes WHERE workflow_id = $1::uuid`, [workflowId]);
    const out: AutomationWorkflowNodeRecord[] = [];
    for (const node of nodes) {
      const result = await this.db.query(
        `INSERT INTO automation_workflow_nodes (
           workflow_id, node_key, node_type, config_json, next_node_key, sort_order
         ) VALUES ($1::uuid, $2, $3, $4::jsonb, $5, $6)
         RETURNING id::text, workflow_id::text, node_key, node_type, config_json,
                   next_node_key, sort_order, created_at`,
        [
          workflowId,
          node.nodeKey,
          node.nodeType,
          JSON.stringify(node.configJson),
          node.nextNodeKey ?? null,
          node.sortOrder,
        ],
      );
      out.push(mapNode(result.rows[0]));
    }
    return out;
  }
}
