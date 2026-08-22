import {
  BadRequestException,
  Body,
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
  StaffVdKeyframeEditGuard,
  StaffVdMotionEditGuard,
  StaffVdProjectViewGuard,
  StaffVdShotJobEnqueueGuard,
} from '../guards/staff-vd-project.guard';
import { VdMotionService } from '../render/vd-motion.service';
import { VdPromptService } from './vd-prompt.service';

const HTTP_400 = new Set([
  'cmkt_cinematic_disabled',
  'vd_tables_missing',
  'invalid_body',
  'idempotency_key_required',
  'stage_guard',
  'take_draft_required',
  'budget_exceeded',
]);

function mapKnownError(err: unknown): never {
  const msg = err instanceof Error ? err.message : 'unknown';
  if (msg === 'vd_shot_not_found' || msg === 'vd_project_not_found') {
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

@Controller('api/v1/vd')
@UseGuards(StaffOrInternalKeyGuard)
export class VdPromptController {
  constructor(
    private readonly prompts: VdPromptService,
    private readonly motion: VdMotionService,
  ) {}

  @Get('projects/:id/shots')
  @UseGuards(StaffVdProjectViewGuard)
  async listShots(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.prompts.listShotsByProject(id);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Get('projects/:id/keyframes')
  @UseGuards(StaffVdProjectViewGuard)
  async listKeyframes(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.prompts.listKeyframes(id);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post('shots/:id/jobs')
  @HttpCode(201)
  @UseGuards(StaffVdShotJobEnqueueGuard)
  async enqueueShotJob(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const jobType = typeof body?.job_type === 'string' ? body.job_type.trim() : '';
    try {
      if (jobType === 'cine_motion_draft') {
        return await this.motion.enqueueDraft(id, body ?? {}, idempotencyKey ?? '');
      }
      if (jobType === 'cine_motion_final') {
        return await this.motion.enqueueFinal(id, idempotencyKey ?? '');
      }
      return await this.prompts.enqueueKeyframe(id, body ?? {}, idempotencyKey);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post('shots/:id/approve-keyframe')
  @HttpCode(200)
  @UseGuards(StaffVdKeyframeEditGuard)
  async approveKeyframe(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.prompts.approveKeyframe(id);
    } catch (err) {
      mapKnownError(err);
    }
  }
}
