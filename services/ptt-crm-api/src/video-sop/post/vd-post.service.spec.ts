import { VdPostService } from './vd-post.service';
import { POST_DAG_NODES } from '../orchestration/vd-dag';

describe('VdPostService', () => {
  const config = { contentMarketingVideoCinematicEnabled: true } as never;
  let projects: { getById: jest.Mock };
  let jobs: { listByProjectId: jest.Mock };
  let dispatcher: { enqueue: jest.Mock };
  let service: VdPostService;

  beforeEach(() => {
    projects = {
      getById: jest.fn().mockResolvedValue({ id: 3, stage: 'post_production', status: 'active' }),
    };
    jobs = { listByProjectId: jest.fn().mockResolvedValue([]) };
    dispatcher = { enqueue: jest.fn().mockResolvedValue({ id: 901, status: 'queued' }) };
    service = new VdPostService(config, projects as never, jobs as never, dispatcher as never);
  });

  it('lists only POST_DAG_NODES', async () => {
    const view = await service.getPipeline(3);
    expect(view.nodes.map((n) => n.id)).toEqual([...POST_DAG_NODES]);
    expect(view.next_node).toBe('select_takes');
  });

  it('enqueues cine_compose on q.media', async () => {
    const out = await service.enqueueCompose(3, 'idem-compose');
    expect(out).toEqual({ id: 901, status: 'queued' });
    expect(dispatcher.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ queue: 'q.media', jobType: 'cine_compose', projectId: 3 }),
    );
  });
});
