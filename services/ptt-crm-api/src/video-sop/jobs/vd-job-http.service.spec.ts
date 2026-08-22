import { BadRequestException, ConflictException } from '@nestjs/common';
import { VdJobHttpService } from './vd-job-http.service';

function makeService() {
  const config = { contentMarketingVideoCinematicEnabled: true };
  const dispatcher = { enqueue: jest.fn() };
  const jobs = { listByProjectId: jest.fn(), getById: jest.fn() };
  const svc = new VdJobHttpService(config as never, dispatcher as never, jobs as never);
  return { svc, dispatcher };
}

describe('VdJobHttpService', () => {
  it('rejects null or undefined enqueue body with invalid_body', async () => {
    const { svc, dispatcher } = makeService();

    for (const body of [null, undefined]) {
      try {
        await svc.enqueue(1, body as never, 'key-1');
        throw new Error('expected invalid_body');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).getStatus()).toBe(400);
        expect((err as BadRequestException).getResponse()).toEqual(
          expect.objectContaining({ error: 'invalid_body' }),
        );
      }
    }

    expect(dispatcher.enqueue).not.toHaveBeenCalled();
  });

  it('maps idempotency_key_conflict to 409', async () => {
    const { svc, dispatcher } = makeService();
    dispatcher.enqueue.mockRejectedValue(new Error('idempotency_key_conflict'));

    await expect(
      svc.enqueue(2, { queue: 'q.image', job_type: 'cine_keyframe' }, 'job-shared'),
    ).rejects.toBeInstanceOf(ConflictException);

    try {
      await svc.enqueue(2, { queue: 'q.image', job_type: 'cine_keyframe' }, 'job-shared');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getStatus()).toBe(409);
      expect((err as ConflictException).getResponse()).toEqual(
        expect.objectContaining({ error: 'idempotency_key_conflict' }),
      );
    }
  });
});
