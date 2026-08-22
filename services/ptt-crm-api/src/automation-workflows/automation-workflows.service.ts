import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LeadScoreContextRepository } from '../ai-intelligence/lead-score-context.repository';
import { computeLeadScoreV1 } from '../ai-intelligence/lead-score.engine';
import { AutomationWorkflowsRepository } from './automation-workflows.repository';
import {
  AutomationNodeType,
  CreateWorkflowBody,
  SimulateNodeResult,
  SimulateWorkflowBody,
  SimulateWorkflowResponse,
  UpdateWorkflowBody,
  UpsertWorkflowNodeBody,
  WorkflowDetailResponse,
  WorkflowListResponse,
} from './automation-workflows.types';

@Injectable()
export class AutomationWorkflowsService {
  constructor(
    private readonly repo: AutomationWorkflowsRepository,
    private readonly leadContext: LeadScoreContextRepository,
  ) {}

  private newRequestId(): string {
    return randomUUID();
  }

  private async assertReady(): Promise<void> {
    if (!(await this.repo.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'automation_workflows_not_ready',
        message: 'Apply RNOS-01 DDL (automation_workflows tables) before using workflow API',
      });
    }
  }

  async list(limit?: number, offset?: number, requestId?: string): Promise<WorkflowListResponse> {
    await this.assertReady();
    const lim = limit ?? 50;
    const off = offset ?? 0;
    const { rows, total } = await this.repo.list({ limit: lim, offset: off });
    return {
      data: { rows, total, limit: lim, offset: off },
      meta: { request_id: requestId?.trim() || this.newRequestId() },
      errors: [],
    };
  }

  async getById(id: string, requestId?: string): Promise<WorkflowDetailResponse> {
    await this.assertReady();
    const workflow = await this.repo.findById(id);
    if (!workflow) {
      throw new NotFoundException({ error: 'workflow_not_found', id });
    }
    const nodes = await this.repo.listNodes(id);
    return {
      data: { workflow, nodes },
      meta: { request_id: requestId?.trim() || this.newRequestId() },
      errors: [],
    };
  }

  async create(body: CreateWorkflowBody, createdBy?: string | null, requestId?: string): Promise<WorkflowDetailResponse> {
    await this.assertReady();
    const name = body.name?.trim() || 'Workflow mới';
    const triggerType = body.trigger_type ?? 'event';
    const triggerEvent = body.trigger_event?.trim() || 'lead.created';
    const workflow = await this.repo.insert({
      name,
      triggerType,
      createdBy: createdBy ?? null,
      definitionJson: { trigger_event: triggerEvent },
    });
    const nodes = await this.repo.replaceNodes(workflow.id, [
      {
        nodeKey: 'trigger_1',
        nodeType: 'trigger',
        configJson: { event: triggerEvent },
        nextNodeKey: null,
        sortOrder: 0,
      },
    ]);
    return {
      data: { workflow, nodes },
      meta: { request_id: requestId?.trim() || this.newRequestId() },
      errors: [],
    };
  }

  async update(id: string, body: UpdateWorkflowBody, requestId?: string): Promise<WorkflowDetailResponse> {
    await this.assertReady();
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({ error: 'workflow_not_found', id });
    }
    const definition = { ...existing.definition_json };
    if (body.trigger_event?.trim()) {
      definition.trigger_event = body.trigger_event.trim();
    }
    const workflow = await this.repo.update(id, {
      name: body.name?.trim() || undefined,
      triggerType: body.trigger_type,
      status: body.status,
      definitionJson: definition,
    });
    if (!workflow) {
      throw new NotFoundException({ error: 'workflow_not_found', id });
    }
    const nodes = await this.repo.listNodes(id);
    return {
      data: { workflow, nodes },
      meta: { request_id: requestId?.trim() || this.newRequestId() },
      errors: [],
    };
  }

  async replaceNodes(
    id: string,
    nodesInput: UpsertWorkflowNodeBody[],
    requestId?: string,
  ): Promise<WorkflowDetailResponse> {
    await this.assertReady();
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({ error: 'workflow_not_found', id });
    }
    if (existing.status === 'active') {
      throw new BadRequestException({
        error: 'workflow_active',
        message: 'Pause workflow before editing nodes',
      });
    }
    const nodes = nodesInput.map((n, idx) => {
      const nodeKey = n.node_key?.trim() || `node_${idx + 1}`;
      const nodeType = (n.node_type ?? 'delay') as AutomationNodeType;
      return {
        nodeKey,
        nodeType,
        configJson: n.config_json ?? {},
        nextNodeKey: n.next_node_key ?? null,
        sortOrder: n.sort_order ?? idx,
      };
    });
    if (!nodes.some((n) => n.nodeType === 'trigger')) {
      throw new BadRequestException({ error: 'trigger_required', message: 'Workflow must include a trigger node' });
    }
    const saved = await this.repo.replaceNodes(id, nodes);
    return {
      data: { workflow: existing, nodes: saved },
      meta: { request_id: requestId?.trim() || this.newRequestId() },
      errors: [],
    };
  }

  async activate(id: string, requestId?: string): Promise<WorkflowDetailResponse> {
    return this.update(id, { status: 'active' }, requestId);
  }

  async deactivate(id: string, requestId?: string): Promise<WorkflowDetailResponse> {
    return this.update(id, { status: 'paused' }, requestId);
  }

  async simulate(id: string, body: SimulateWorkflowBody, requestId?: string): Promise<SimulateWorkflowResponse> {
    await this.assertReady();
    const detail = await this.getById(id, requestId);
    const leadId = body.lead_id ?? (body.entity_type === 'lead' ? Number(body.entity_id) : NaN);
    if (!Number.isFinite(leadId) || leadId <= 0) {
      throw new BadRequestException({
        error: 'lead_id_required',
        message: 'Simulate requires lead_id or entity_type=lead with numeric entity_id',
      });
    }

    const steps: SimulateNodeResult[] = [];
    for (const node of detail.data.nodes) {
      if (node.node_type === 'trigger') {
        steps.push({
          node_key: node.node_key,
          node_type: node.node_type,
          status: 'ok',
          output: { event: node.config_json.event ?? detail.data.workflow.definition_json.trigger_event },
        });
        continue;
      }
      if (node.node_type === 'ai_score') {
        try {
          const ctx = await this.leadContext.loadLeadScoreContext(leadId);
          if (!ctx) {
            steps.push({
              node_key: node.node_key,
              node_type: node.node_type,
              status: 'error',
              error: 'lead_not_found',
            });
            continue;
          }
          const scored = computeLeadScoreV1(ctx);
          steps.push({
            node_key: node.node_key,
            node_type: node.node_type,
            status: 'ok',
            output: {
              dry_run: true,
              score: scored.score,
              confidence: scored.confidence,
              score_band: scored.explainability.score_band,
              factors: scored.explainability.factors.slice(0, 6),
            },
          });
        } catch (err) {
          steps.push({
            node_key: node.node_key,
            node_type: node.node_type,
            status: 'error',
            error: err instanceof Error ? err.message : 'ai_score_failed',
          });
        }
        continue;
      }
      if (node.node_type === 'ai_summarize') {
        try {
          const ctx = await this.leadContext.loadLeadScoreContext(leadId);
          if (!ctx) {
            steps.push({
              node_key: node.node_key,
              node_type: node.node_type,
              status: 'error',
              error: 'lead_not_found',
            });
            continue;
          }
          steps.push({
            node_key: node.node_key,
            node_type: node.node_type,
            status: 'ok',
            output: {
              dry_run: true,
              summary: `Lead #${leadId}: nguồn ${ctx.channel || 'unknown'}, campaign ${ctx.campaignId || 'N/A'}`,
              bullets: [
                'Simulate — không ghi ai_scores / ai_agent_runs',
                `Lead status: ${ctx.status || 'unknown'}`,
              ],
            },
          });
        } catch (err) {
          steps.push({
            node_key: node.node_key,
            node_type: node.node_type,
            status: 'error',
            error: err instanceof Error ? err.message : 'ai_summarize_failed',
          });
        }
        continue;
      }
      steps.push({
        node_key: node.node_key,
        node_type: node.node_type,
        status: 'skipped',
        output: { message: 'Node type not simulated in v1' },
      });
    }

    return {
      data: {
        workflow_id: id,
        dry_run: true,
        entity_type: 'lead',
        entity_id: String(leadId),
        steps,
      },
      meta: { request_id: requestId?.trim() || this.newRequestId() },
      errors: [],
    };
  }
}
