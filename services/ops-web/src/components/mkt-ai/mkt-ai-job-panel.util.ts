import type { MktAiJobRow } from '@/lib/mkt-ai-planner-api';

export type JobPanelRow = MktAiJobRow & {
  parent_job_id?: number | null;
  output_json?: Record<string, unknown>;
};

export type JobPanelChildRef = {
  step?: string;
  job_type: string;
  job_id: number;
  status: string;
  latency_ms?: number;
  error_message?: string;
};

export type JobPanelGroup =
  | { kind: 'standalone'; job: JobPanelRow }
  | {
      kind: 'pipeline';
      parent: JobPanelRow;
      children: JobPanelRow[];
      childRefs: JobPanelChildRef[];
    };

function childRefsFromParent(job: JobPanelRow): JobPanelChildRef[] {
  const raw = job.output_json?.child_jobs;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => item as JobPanelChildRef)
    .filter((ref) => ref && Number.isFinite(ref.job_id));
}

/** Collect child job ids — hide them from top-level (orphan filter). */
export function collectPipelineChildIds(jobs: JobPanelRow[]): Set<number> {
  const childIds = new Set<number>();
  for (const job of jobs) {
    if (job.parent_job_id != null && job.parent_job_id > 0) {
      childIds.add(job.id);
    }
    if (job.job_type === 'multi_agent') {
      for (const ref of childRefsFromParent(job)) {
        childIds.add(ref.job_id);
      }
    }
  }
  return childIds;
}

function syntheticChildRow(parent: JobPanelRow, ref: JobPanelChildRef): JobPanelRow {
  return {
    id: ref.job_id,
    lifecycle_id: parent.lifecycle_id,
    job_type: ref.job_type,
    status: ref.status,
    model_name: '',
    error_message: ref.error_message ?? null,
    latency_ms: ref.latency_ms ?? null,
    actor_email: '',
    created_at: parent.created_at,
    ended_at: null,
  };
}

export function buildJobPanelGroups(jobs: JobPanelRow[], limit = 8): JobPanelGroup[] {
  if (jobs.length === 0) return [];

  const byId = new Map(jobs.map((j) => [j.id, j]));
  const childIds = collectPipelineChildIds(jobs);
  const scanWindow = Math.max(limit * 3, 16);
  const recent = [...jobs].slice(-scanWindow).reverse();
  const roots = recent.filter((j) => !childIds.has(j.id));

  const groups: JobPanelGroup[] = [];
  for (const job of roots) {
    if (job.job_type === 'multi_agent') {
      const childRefs = childRefsFromParent(job);
      const children: JobPanelRow[] = [];
      const seen = new Set<number>();

      for (const ref of childRefs) {
        const row = byId.get(ref.job_id) ?? syntheticChildRow(job, ref);
        if (!seen.has(row.id)) {
          seen.add(row.id);
          children.push(row);
        }
      }

      for (const row of byId.values()) {
        if (row.parent_job_id === job.id && !seen.has(row.id)) {
          seen.add(row.id);
          children.push(row);
        }
      }

      groups.push({ kind: 'pipeline', parent: job, children, childRefs });
    } else {
      groups.push({ kind: 'standalone', job });
    }

    if (groups.length >= limit) break;
  }

  return groups;
}

export function sortJobPanelGroupsMobileFirst(groups: JobPanelGroup[]): JobPanelGroup[] {
  return [...groups].sort((a, b) => {
    if (a.kind === 'pipeline' && b.kind !== 'pipeline') return -1;
    if (b.kind === 'pipeline' && a.kind !== 'pipeline') return 1;
    return 0;
  });
}

export function pipelineDefaultExpanded(parent: JobPanelRow): boolean {
  return parent.status === 'pending' || parent.status === 'running';
}
