import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import {
  StaffVdPostEditGuard,
  StaffVdProjectViewGuard,
} from '../guards/staff-vd-project.guard';
import { POST_DAG_NODES } from '../orchestration/vd-dag';
import { VdPostService } from './vd-post.service';

const HTTP_400 = new Set([
  'cmkt_cinematic_disabled',
  'vd_tables_missing',
  'invalid_body',
  'idempotency_key_required',
  'stage_guard',
  'budget_exceeded',
  'dag_invalid',
]);

function mapKnownError(err: unknown): never {
  const msg = err instanceof Error ? err.message : 'unknown';
  if (msg === 'vd_project_not_found') {
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

@Controller('api/v1/vd/projects')
@UseGuards(StaffOrInternalKeyGuard)
export class VdPostController {
  constructor(private readonly post: VdPostService) {}

  @Get(':id/post')
  @UseGuards(StaffVdProjectViewGuard)
  async getPipeline(@Param('id', ParseIntPipe) id: number) {
    try {
      const view = await this.post.getPipeline(id);
      const invalid = view.nodes.some((node) => !POST_DAG_NODES.includes(node.id));
      if (invalid) throw new Error('dag_invalid');
      return view;
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post(':id/post/compose')
  @HttpCode(201)
  @UseGuards(StaffVdPostEditGuard)
  async enqueueCompose(
    @Param('id', ParseIntPipe) id: number,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    try {
      return await this.post.enqueueCompose(id, idempotencyKey ?? '');
    } catch (err) {
      mapKnownError(err);
    }
  }
}
