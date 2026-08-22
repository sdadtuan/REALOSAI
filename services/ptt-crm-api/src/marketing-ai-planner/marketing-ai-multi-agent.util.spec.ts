import {
  DEFAULT_PIPELINE_STEPS,
  buildPipelineStepStates,
  findLatestMultiAgentParentJob,
  parseMultiAgentOutput,
  resolvePipelineSteps,
  rollupMultiAgentStatus,
  STEP_TO_JOB_TYPE,
} from './marketing-ai-multi-agent.util';

describe('marketing-ai-multi-agent.util', () => {
  it('resolvePipelineSteps defaults to 4 steps', () => {
    expect(resolvePipelineSteps({})).toEqual(DEFAULT_PIPELINE_STEPS);
  });

  it('resolvePipelineSteps honors skip_analyst and start_from_step', () => {
    expect(
      resolvePipelineSteps({ skip_analyst: true, start_from_step: 'planner' }),
    ).toEqual(['planner', 'copywriter']);
  });

  it('rollupMultiAgentStatus succeeded when all ok', () => {
    expect(
      rollupMultiAgentStatus([
        { step: 'strategist', job_type: 'strategy_generate', job_id: 1, status: 'succeeded' },
        { step: 'planner', job_type: 'campaign_generate', job_id: 2, status: 'succeeded' },
      ]),
    ).toBe('succeeded');
  });

  it('rollupMultiAgentStatus partial when mixed', () => {
    expect(
      rollupMultiAgentStatus([
        { step: 'strategist', job_type: 'strategy_generate', job_id: 1, status: 'succeeded' },
        { step: 'planner', job_type: 'campaign_generate', job_id: 2, status: 'failed' },
      ]),
    ).toBe('partial');
  });

  it('buildPipelineStepStates maps child jobs', () => {
    const states = buildPipelineStepStates({
      requestedSteps: ['strategist', 'planner'],
      childJobs: [
        { step: 'strategist', job_type: STEP_TO_JOB_TYPE.strategist, job_id: 9, status: 'succeeded' },
      ],
    });
    expect(states[0].state).toBe('succeeded');
    expect(states[1].state).toBe('pending');
  });

  it('parseMultiAgentOutput reads child_jobs', () => {
    const out = parseMultiAgentOutput({
      pipeline_key: 'default_v1',
      playbook_slug: 'meta-lead-gen',
      child_jobs: [{ step: 'strategist', job_id: 3, status: 'succeeded' }],
    });
    expect(out?.child_jobs[0].job_id).toBe(3);
  });

  it('findLatestMultiAgentParentJob picks first multi_agent row', () => {
    const job = findLatestMultiAgentParentJob([
      { job_type: 'multi_agent', status: 'succeeded', output_json: {} },
      { job_type: 'strategy_generate', status: 'succeeded', output_json: {} },
    ]);
    expect(job?.job_type).toBe('multi_agent');
  });
});
