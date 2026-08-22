import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { assertCinematicEnabled } from '../video-sop-flags';
import { VdDispatcherService } from '../orchestration/vd-dispatcher.service';
import { VdJobRepository } from './vd-job.repository';
import type { VdJobRow } from './vd-job.types';
import { isVdQueue } from './vd-job.types';

const HTTP_400 = new Set([
  'cmkt_cinematic_disabled',
  'vd_tables_missing',
  'invalid_body',
  'idempotency_key_required',
  'budget_exceeded',
]);

function mapKnownError(err: unknown): never {
  const msg = err instanceof Error ? err.message : 'unknown';
  if (msg === 'vd_job_not_found') {
    throw new NotFoundException({ error: msg, message: msg });
  }
  if (msg === 'idempotency_key_conflict') {
    throw new ConflictException({ error: msg, message: msg });
  }
  if (HTTP_400.has(msg)) {
    throw new BadRequestException({ error: msg, message: msg });
  }
  throw err;
}

@Injectable()
export class VdJobHttpService {
  constructor(
    private readonly config: AppConfigService,
    private readonly dispatcher: VdDispatcherService,
    private readonly jobs: VdJobRepository,
  ) {}

  async enqueue(
    projectId: number,
    body: Record<string, unknown>,
    idempotencyKey: string | undefined,
  ): Promise<{ id: number; status: 'queued' }> {
    const key = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
    if (!key) {
      throw new BadRequestException({
        error: 'idempotency_key_required',
        message: 'idempotency_key_required',
      });
    }

    try {
      assertCinematicEnabled(this.config);
    } catch (err) {
      mapKnownError(err);
    }

    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException({ error: 'invalid_body', message: 'invalid_body' });
    }

    const jobType = body.job_type;
    if (!isVdQueue(body.queue) || typeof jobType !== 'string' || !jobType.trim()) {
      throw new BadRequestException({ error: 'invalid_body', message: 'invalid_body' });
    }

    const payload =
      body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
        ? (body.payload as Record<string, unknown>)
        : {};

    let row: VdJobRow;
    try {
      row = await this.dispatcher.enqueue({
        projectId,
        queue: body.queue,
        jobType: jobType.trim(),
        payload,
        idempotencyKey: key,
      });
    } catch (err) {
      mapKnownError(err);
    }

    return { id: row.id, status: 'queued' };
  }

  list(projectId: number): Promise<VdJobRow[]> {
    return this.jobs.listByProjectId(projectId);
  }

  async get(id: number): Promise<VdJobRow> {
    const row = await this.jobs.getById(id);
    if (!row) {
      throw new NotFoundException({ error: 'vd_job_not_found', message: 'vd_job_not_found' });
    }
    return row;
  }
}
