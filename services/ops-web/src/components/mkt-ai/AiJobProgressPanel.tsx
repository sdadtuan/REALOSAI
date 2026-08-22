'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MktAiJobRow, MktAiMultiAgentStatusPayload } from '@/lib/mkt-ai-planner-api';
import {
  buildJobPanelGroups,
  pipelineDefaultExpanded,
  sortJobPanelGroupsMobileFirst,
  type JobPanelGroup,
  type JobPanelRow,
} from '@/components/mkt-ai/mkt-ai-job-panel.util';
import styles from '@/components/mkt-ai/mkt-ai-planner.module.css';

const JOB_LABELS: Record<string, string> = {
  brief_summarize: 'Brief',
  strategy_generate: 'Chiến lược',
  campaign_generate: 'Campaign',
  content_generate: 'Content',
  quality_score: 'Quality score',
  apply_to_tmmt: 'Apply TMMT',
  budget_simulate: 'Budget sim',
  strategy_scenarios: 'Scenarios',
  optimize: 'Optimize',
  multi_agent: 'Pipeline AI',
};

interface Props {
  jobs: MktAiJobRow[];
  multiAgentStatus?: MktAiMultiAgentStatusPayload | null;
  stubMode?: boolean;
  onRetry?: (type: 'strategy' | 'campaigns' | 'content' | 'quality') => void;
  retrying?: boolean;
}

function statusMeta(status: string): { icon: string; color: string; label: string } {
  if (status === 'succeeded') {
    return { icon: '●', color: 'var(--accent, #16a34a)', label: 'Thành công' };
  }
  if (status === 'failed') {
    return { icon: '✕', color: 'var(--danger, #dc2626)', label: 'Thất bại' };
  }
  if (status === 'running') {
    return { icon: '◐', color: '#2563eb', label: 'Đang chạy' };
  }
  if (status === 'pending') {
    return { icon: '○', color: 'var(--muted, #6b7280)', label: 'Chờ' };
  }
  if (status === 'skipped') {
    return { icon: '−', color: 'var(--muted, #6b7280)', label: 'Bỏ qua' };
  }
  return { icon: '○', color: 'var(--muted, #6b7280)', label: status };
}

function retryTypeForJob(jobType: string): 'strategy' | 'campaigns' | 'content' | 'quality' | null {
  if (jobType === 'strategy_generate') return 'strategy';
  if (jobType === 'campaign_generate') return 'campaigns';
  if (jobType === 'content_generate') return 'content';
  if (jobType === 'quality_score') return 'quality';
  return null;
}

function runningStepLabel(
  parent: JobPanelRow,
  multiAgentStatus?: MktAiMultiAgentStatusPayload | null,
): string | null {
  if (parent.status !== 'running' && parent.status !== 'pending') return null;
  if (multiAgentStatus?.parent_job?.id === parent.id) {
    const running = multiAgentStatus.steps?.find((s) => s.state === 'running');
    if (running?.label_vi) return running.label_vi;
    if (multiAgentStatus.current_step) {
      const step = multiAgentStatus.steps?.find((s) => s.step === multiAgentStatus.current_step);
      if (step?.label_vi) return step.label_vi;
    }
  }
  return null;
}

function JobRow({
  job,
  nested,
  onRetry,
  retrying,
}: {
  job: JobPanelRow;
  nested?: boolean;
  onRetry?: Props['onRetry'];
  retrying?: boolean;
}) {
  const meta = statusMeta(job.status);
  const failed = job.status === 'failed';
  const retryType = retryTypeForJob(job.job_type);

  return (
    <div className={nested ? styles.jobChildRow : styles.jobRow}>
      <div className={styles.jobRowMain}>
        <span className={styles.jobStatusIcon} style={{ color: meta.color }}>
          {meta.icon}
        </span>
        <span className={styles.jobRowLabel}>{JOB_LABELS[job.job_type] ?? job.job_type}</span>
        <span className={styles.jobRowStatus} style={{ color: meta.color }}>
          {meta.label}
        </span>
        {failed && retryType && onRetry ? (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={retrying}
            onClick={() => onRetry(retryType)}
          >
            Thử lại
          </button>
        ) : null}
      </div>
      {failed && job.error_message ? (
        <p className={`error ${styles.jobRowError}`}>{job.error_message.slice(0, 120)}</p>
      ) : null}
    </div>
  );
}

function PipelineGroup({
  group,
  expanded,
  onToggle,
  multiAgentStatus,
  onRetry,
  retrying,
}: {
  group: Extract<JobPanelGroup, { kind: 'pipeline' }>;
  expanded: boolean;
  onToggle: () => void;
  multiAgentStatus?: MktAiMultiAgentStatusPayload | null;
  onRetry?: Props['onRetry'];
  retrying?: boolean;
}) {
  const { parent, children } = group;
  const meta = statusMeta(parent.status);
  const runningStep = runningStepLabel(parent, multiAgentStatus);
  const childActive = children.some((c) => c.status === 'pending' || c.status === 'running');

  return (
    <li className={styles.jobPipelineGroup}>
      <button
        type="button"
        className={styles.jobPipelineParent}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className={styles.jobStatusIcon} style={{ color: meta.color }}>
          {meta.icon}
        </span>
        <span className={styles.jobPipelineParentLabel}>
          Pipeline AI
          <span className="muted"> · parent</span>
        </span>
        {runningStep ? (
          <span className={styles.jobRunningBadge}>{runningStep}</span>
        ) : childActive ? (
          <span className={styles.jobRunningBadge}>Đang chạy</span>
        ) : null}
        <span className={styles.jobRowStatus} style={{ color: meta.color }}>
          {meta.label}
        </span>
        <span className={styles.jobPipelineChevron} aria-hidden>
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      <ul
        className={
          expanded ? styles.jobPipelineChildren : `${styles.jobPipelineChildren} ${styles.jobPipelineChildrenCollapsed}`
        }
      >
        {children.length === 0 ? (
          <li className={styles.jobChildRow}>
            <span className="muted" style={{ fontSize: '0.75rem' }}>
              Chưa có bước con
            </span>
          </li>
        ) : (
          children.map((child) => (
            <li key={`${parent.id}-${child.id}`}>
              <JobRow job={child} nested onRetry={onRetry} retrying={retrying} />
            </li>
          ))
        )}
      </ul>
    </li>
  );
}

export function AiJobProgressPanel({ jobs, multiAgentStatus, stubMode, onRetry, retrying }: Props) {
  const [open, setOpen] = useState(true);
  const panelJobs = jobs as JobPanelRow[];
  const groups = useMemo(
    () => sortJobPanelGroupsMobileFirst(buildJobPanelGroups(panelJobs)),
    [panelJobs],
  );

  const [expandedPipelines, setExpandedPipelines] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setExpandedPipelines((prev) => {
      const next = { ...prev };
      for (const group of groups) {
        if (group.kind !== 'pipeline') continue;
        if (next[group.parent.id] === undefined && pipelineDefaultExpanded(group.parent)) {
          next[group.parent.id] = true;
        }
      }
      return next;
    });
  }, [groups]);

  const activeCount = panelJobs.filter((j) => j.status === 'pending' || j.status === 'running').length;
  const lastModel = [...panelJobs].reverse().find((j) => j.model_name)?.model_name;

  function togglePipeline(parentId: number) {
    setExpandedPipelines((prev) => ({ ...prev, [parentId]: !prev[parentId] }));
  }

  return (
    <aside className={`card ${styles.jobPanelAside}`}>
      <button
        type="button"
        className={`btn btn-sm btn-ghost ${styles.jobToggle}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Jobs AI{activeCount ? ` (${activeCount} đang chạy)` : ''}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      <div className={open ? undefined : styles.jobBodyCollapsed}>
        <h3 className={styles.jobPanelTitle}>
          Jobs AI
          {activeCount ? (
            <span className="muted" style={{ fontWeight: 400, fontSize: '0.8rem' }}>
              {' '}
              · {activeCount} đang chạy
            </span>
          ) : null}
        </h3>
        {groups.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Chưa có job — sinh chiến lược để bắt đầu.
          </p>
        ) : (
          <ul className={styles.jobPanelList}>
            {groups.map((group) =>
              group.kind === 'pipeline' ? (
                <PipelineGroup
                  key={`pipeline-${group.parent.id}`}
                  group={group}
                  expanded={expandedPipelines[group.parent.id] ?? pipelineDefaultExpanded(group.parent)}
                  onToggle={() => togglePipeline(group.parent.id)}
                  multiAgentStatus={multiAgentStatus}
                  onRetry={onRetry}
                  retrying={retrying}
                />
              ) : (
                <li key={group.job.id} className={styles.jobStandaloneRow}>
                  <JobRow job={group.job} onRetry={onRetry} retrying={retrying} />
                </li>
              ),
            )}
          </ul>
        )}
        {lastModel ? (
          <p className="muted" style={{ margin: '0.75rem 0 0', fontSize: '0.75rem' }}>
            Model: {lastModel}
            {stubMode ? ' (stub)' : ''}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
