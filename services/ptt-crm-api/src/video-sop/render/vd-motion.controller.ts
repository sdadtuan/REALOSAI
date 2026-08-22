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
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import {
  StaffVdMotionEditGuard,
  StaffVdProjectViewGuard,
} from '../guards/staff-vd-project.guard';
import { VdMotionService } from './vd-motion.service';

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
export class VdMotionController {
  constructor(private readonly motion: VdMotionService) {}

  @Get('projects/:id/render-estimate')
  @UseGuards(StaffVdProjectViewGuard)
  async renderEstimate(
    @Param('id', ParseIntPipe) projectId: number,
    @Query('shot_id') shotIdRaw: string,
    @Query('job_type') jobTypeRaw?: string,
  ) {
    const shotId = Number(shotIdRaw);
    if (!Number.isFinite(shotId) || shotId <= 0) {
      throw new BadRequestException({ error: 'invalid_body', message: 'invalid_body' });
    }
    try {
      return await this.motion.getRenderEstimate(projectId, shotId, jobTypeRaw ?? 'cine_motion_draft');
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Get('projects/:id/takes')
  @UseGuards(StaffVdProjectViewGuard)
  async listTakes(@Param('id', ParseIntPipe) projectId: number) {
    try {
      return await this.motion.listTakes(projectId);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post('shots/:id/take-score')
  @HttpCode(200)
  @UseGuards(StaffVdMotionEditGuard)
  async recordTakeScore(
    @Param('id', ParseIntPipe) shotId: number,
    @Body() body: Record<string, unknown>,
  ) {
    const assetId = Number(body?.asset_id);
    const verdict = body?.verdict === 'failed' ? 'failed' : body?.verdict === 'passed' ? 'passed' : null;
    if (!Number.isFinite(assetId) || assetId <= 0 || !verdict) {
      throw new BadRequestException({ error: 'invalid_body', message: 'invalid_body' });
    }
    const artifact =
      body?.artifact_json && typeof body.artifact_json === 'object' && !Array.isArray(body.artifact_json)
        ? (body.artifact_json as Record<string, unknown>)
        : {};
    try {
      return await this.motion.recordTakeScore(shotId, assetId, verdict, artifact);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post('shots/:id/select-take')
  @HttpCode(200)
  @UseGuards(StaffVdMotionEditGuard)
  async selectTake(@Param('id', ParseIntPipe) shotId: number, @Body() body: Record<string, unknown>) {
    const assetId = Number(body?.asset_id);
    if (!Number.isFinite(assetId) || assetId <= 0) {
      throw new BadRequestException({ error: 'invalid_body', message: 'invalid_body' });
    }
    try {
      return await this.motion.selectTake(shotId, assetId);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post('shots/:id/motion/draft')
  @HttpCode(201)
  @UseGuards(StaffVdMotionEditGuard)
  async enqueueDraft(
    @Param('id', ParseIntPipe) shotId: number,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    try {
      return await this.motion.enqueueDraft(shotId, body ?? {}, idempotencyKey ?? '');
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post('shots/:id/motion/final')
  @HttpCode(201)
  @UseGuards(StaffVdMotionEditGuard)
  async enqueueFinal(
    @Param('id', ParseIntPipe) shotId: number,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    try {
      return await this.motion.enqueueFinal(shotId, idempotencyKey ?? '');
    } catch (err) {
      mapKnownError(err);
    }
  }
}
