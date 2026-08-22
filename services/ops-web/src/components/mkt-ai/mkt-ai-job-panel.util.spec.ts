import { describe, expect, it } from 'vitest';
import {
  buildJobPanelGroups,
  collectPipelineChildIds,
  sortJobPanelGroupsMobileFirst,
  type JobPanelRow,
} from './mkt-ai-job-panel.util';

const base = (overrides: Partial<JobPanelRow>): JobPanelRow => ({
  id: 1,
  lifecycle_id: 1,
  job_type: 'strategy_generate',
  status: 'succeeded',
  model_name: 'stub',
  error_message: null,
  latency_ms: 100,
  actor_email: 'a@test.vn',
  created_at: '2026-01-01T00:00:00Z',
  ended_at: null,
  ...overrides,
});

describe('mkt-ai-job-panel.util', () => {
  it('groups multi_agent parent with child_jobs refs and hides orphans', () => {
    const parent = base({
      id: 10,
      job_type: 'multi_agent',
      status: 'running',
      output_json: {
        child_jobs: [
          { job_id: 11, job_type: 'strategy_generate', status: 'succeeded' },
          { job_id: 12, job_type: 'campaign_generate', status: 'running' },
        ],
      },
    });
    const child11 = base({ id: 11, job_type: 'strategy_generate' });
    const child12 = base({ id: 12, job_type: 'campaign_generate', status: 'running' });
    const orphanHidden = base({ id: 13, job_type: 'quality_score' });

    const jobs = [orphanHidden, child11, child12, parent];
    const childIds = collectPipelineChildIds(jobs);
    expect(childIds.has(11)).toBe(true);
    expect(childIds.has(12)).toBe(true);
    expect(childIds.has(10)).toBe(false);

    const groups = buildJobPanelGroups(jobs, 8);
    expect(groups.some((g) => g.kind === 'pipeline' && g.parent.id === 10)).toBe(true);
    expect(groups.some((g) => g.kind === 'standalone' && g.job.id === 13)).toBe(true);
    expect(groups.some((g) => g.kind === 'standalone' && g.job.id === 11)).toBe(false);
  });

  it('sorts pipeline groups before standalone on mobile ordering helper', () => {
    const groups = buildJobPanelGroups(
      [
        base({ id: 1 }),
        base({
          id: 2,
          job_type: 'multi_agent',
          output_json: { child_jobs: [{ job_id: 3, job_type: 'strategy_generate', status: 'succeeded' }] },
        }),
        base({ id: 3 }),
      ],
      8,
    );
    const sorted = sortJobPanelGroupsMobileFirst(groups);
    expect(sorted[0]?.kind).toBe('pipeline');
  });
});
