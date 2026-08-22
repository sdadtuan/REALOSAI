import { VdJobRepository } from './vd-job.repository';

function makeRepo(): VdJobRepository {
  const repo = new VdJobRepository({
    databaseUrl: 'postgres://127.0.0.1:1/none',
    contentMarketingVideoCinematicEnabled: false,
  } as never);
  jest.spyOn(repo, 'ensurePgReady').mockResolvedValue(false);
  return repo;
}

describe('VdJobRepository provider ref (CT-04)', () => {
  it('saveProviderRef then findByProviderTask returns the job', async () => {
    const repo = makeRepo();
    const job = await repo.insert({
      project_id: 1,
      shot_id: null,
      queue: 'q.image',
      job_type: 'cine_keyframe',
      status: 'queued',
      idempotency_key: 'ref-a',
      input_json: {},
    });

    await repo.saveProviderRef(job.id, 'leonardo', 'task-111');
    const found = await repo.findByProviderTask('leonardo', 'task-111');
    expect(found?.id).toBe(job.id);
    expect(found?.idempotency_key).toBe('ref-a');
  });

  it('findByProviderTask returns null when unknown', async () => {
    const repo = makeRepo();
    expect(await repo.findByProviderTask('leonardo', 'missing')).toBeNull();
  });

  it('rememberRefIfAbsent skips submit when job already has a ref', async () => {
    const repo = makeRepo();
    const job = await repo.insert({
      project_id: 1,
      shot_id: null,
      queue: 'q.video.runway',
      job_type: 'cine_motion_draft',
      status: 'queued',
      idempotency_key: 'ref-b',
      input_json: {},
    });

    const submit = jest.fn().mockResolvedValue({ provider_task_id: 'task-new' });

    const first = await repo.rememberRefIfAbsent(job.id, 'runway', submit);
    expect(first.provider_task_id).toBe('task-new');
    expect(submit).toHaveBeenCalledTimes(1);

    const second = await repo.rememberRefIfAbsent(job.id, 'runway', submit);
    expect(second.provider_task_id).toBe('task-new');
    expect(submit).toHaveBeenCalledTimes(1);

    const found = await repo.findByProviderTask('runway', 'task-new');
    expect(found?.id).toBe(job.id);
  });

  it('saveProviderRef keeps first ref when job_id already has one', async () => {
    const repo = makeRepo();
    const job = await repo.insert({
      project_id: 1,
      shot_id: null,
      queue: 'q.image',
      job_type: 'cine_keyframe',
      status: 'queued',
      idempotency_key: 'ref-c',
      input_json: {},
    });

    await repo.saveProviderRef(job.id, 'leonardo', 'task-first');
    await expect(repo.saveProviderRef(job.id, 'leonardo', 'task-second')).resolves.toBeUndefined();
    const found = await repo.findByProviderTask('leonardo', 'task-first');
    expect(found?.id).toBe(job.id);
    expect(await repo.findByProviderTask('leonardo', 'task-second')).toBeNull();
  });

  it('rememberRefIfAbsent returns existing ref after unique violation', async () => {
    const repo = makeRepo();
    const job = await repo.insert({
      project_id: 1,
      shot_id: null,
      queue: 'q.video.runway',
      job_type: 'cine_motion_draft',
      status: 'queued',
      idempotency_key: 'ref-d',
      input_json: {},
    });

    await repo.saveProviderRef(job.id, 'runway', 'task-winner');
    jest
      .spyOn(repo as unknown as { findProviderRefByJobId: (id: number) => Promise<unknown> }, 'findProviderRefByJobId')
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        job_id: job.id,
        provider_code: 'runway',
        provider_task_id: 'task-winner',
      });
    jest.spyOn(repo, 'saveProviderRef').mockRejectedValue(
      Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }),
    );

    const submit = jest.fn().mockResolvedValue({ provider_task_id: 'task-loser' });
    const result = await repo.rememberRefIfAbsent(job.id, 'runway', submit);
    expect(result.provider_task_id).toBe('task-winner');
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe('VdJobRepository saveSaga (CT-17)', () => {
  it('persists saga under output_json.saga', async () => {
    const repo = makeRepo();
    const job = await repo.insert({
      project_id: 1,
      shot_id: null,
      queue: 'q.enhance',
      job_type: 'cine_enhance',
      status: 'running',
      idempotency_key: 'saga-a',
      input_json: {},
      output_json: { provider: 'topaz' },
    });

    const updated = await repo.saveSaga(job.id, {
      step: 3,
      request_id: 'req-1',
      parts: [{ partNum: 1, eTag: 'e1' }],
    });

    expect(updated.output_json.saga).toEqual({
      step: 3,
      request_id: 'req-1',
      parts: [{ partNum: 1, eTag: 'e1' }],
    });
    expect(updated.output_json.provider).toBe('topaz');
  });
});
