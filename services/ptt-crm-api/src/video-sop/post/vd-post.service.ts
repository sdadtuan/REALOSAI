import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { VdJobRepository } from '../jobs/vd-job.repository';
import type { VdJobRow } from '../jobs/vd-job.types';
import { VdDispatcherService } from '../orchestration/vd-dispatcher.service';
import {
  nextPostNode,
  POST_DAG_NODES,
  type VdPostDagNode,
} from '../orchestration/vd-dag';
import { VdProjectRepository } from '../project/vd-project.repository';
import { evaluateGate4Auto } from '../rules/vd-qc-auto';
import { assertCinematicEnabled } from '../video-sop-flags';

export type VdPostNodeStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export type VdPostNodeView = {
  id: VdPostDagNode;
  label: string;
  status: VdPostNodeStatus;
  job_id: number | null;
};

export type VdPostPipelineView = {
  project_id: number;
  nodes: VdPostNodeView[];
  next_node: VdPostDagNode | 'complete';
  gate4_auto: ReturnType<typeof evaluateGate4Auto> | null;
};

const LABELS: Record<VdPostDagNode, string> = {
  select_takes: 'Select takes',
  concat: 'Concat',
  loudness: 'Loudness',
  proxy: 'Proxy',
  optional_topaz: 'Topaz (optional)',
  package_zip: 'Package zip',
};

function postJobs(jobs: VdJobRow[]): VdJobRow[] {
  return jobs
    .filter((row) => row.job_type === 'cine_compose' || row.job_type === 'cine_enhance')
    .slice()
    .sort((a, b) => b.id - a.id);
}

@Injectable()
export class VdPostService {
  constructor(
    private readonly config: AppConfigService,
    private readonly projects: VdProjectRepository,
    private readonly jobs: VdJobRepository,
    private readonly dispatcher: VdDispatcherService,
  ) {}

  private nodeStatusFromJob(
    node: VdPostDagNode,
    completed: string[],
    running: string | null,
    failed: string | null,
    skipped: string[],
  ): VdPostNodeStatus {
    if (skipped.includes(node)) return 'skipped';
    if (failed === node) return 'failed';
    if (running === node) return 'running';
    if (completed.includes(node)) return 'succeeded';
    return 'pending';
  }

  buildPipelineView(projectId: number, jobs: VdJobRow[]): VdPostPipelineView {
    const latest = postJobs(jobs)[0];
    const output = latest?.output_json ?? {};
    const completed = Array.isArray(output.completed_nodes)
      ? (output.completed_nodes as string[]).filter((n) => POST_DAG_NODES.includes(n as VdPostDagNode))
      : [];
    const skipped = Array.isArray(output.skipped_nodes)
      ? (output.skipped_nodes as string[]).filter((n) => POST_DAG_NODES.includes(n as VdPostDagNode))
      : [];
    const running =
      latest && (latest.status === 'queued' || latest.status === 'running')
        ? (typeof output.current_node === 'string' ? output.current_node : nextPostNode(completed))
        : null;
    const failed =
      latest?.status === 'failed' && typeof output.failed_node === 'string'
        ? output.failed_node
        : null;

    const nodes: VdPostNodeView[] = POST_DAG_NODES.map((id) => ({
      id,
      label: LABELS[id],
      status: this.nodeStatusFromJob(id, completed, running, failed, skipped),
      job_id: latest?.id ?? null,
    }));

    const gate4Probe = output.gate4_probe;
    const gate4_auto =
      gate4Probe && typeof gate4Probe === 'object' && !Array.isArray(gate4Probe)
        ? evaluateGate4Auto(gate4Probe as never)
        : null;

    return {
      project_id: projectId,
      nodes,
      next_node: nextPostNode(completed),
      gate4_auto,
    };
  }

  async getPipeline(projectId: number): Promise<VdPostPipelineView> {
    assertCinematicEnabled(this.config);
    const project = await this.projects.getById(projectId);
    if (!project) throw new Error('vd_project_not_found');
    const jobs = await this.jobs.listByProjectId(projectId);
    return this.buildPipelineView(projectId, jobs);
  }

  async enqueueCompose(
    projectId: number,
    idempotencyKey: string,
  ): Promise<{ id: number; status: 'queued' }> {
    assertCinematicEnabled(this.config);
    const project = await this.projects.getById(projectId);
    if (!project) throw new Error('vd_project_not_found');
    const key = idempotencyKey.trim();
    if (!key) throw new Error('idempotency_key_required');

    const row = await this.dispatcher.enqueue({
      projectId,
      queue: 'q.media',
      jobType: 'cine_compose',
      payload: {
        credit_estimate: 8,
        nodes: [...POST_DAG_NODES],
      },
      idempotencyKey: key,
    });
    return { id: row.id, status: 'queued' };
  }
}
