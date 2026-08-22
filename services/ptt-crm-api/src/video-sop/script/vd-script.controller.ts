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
  Put,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffVdProjectViewGuard, StaffVdScriptEditGuard } from '../guards/staff-vd-project.guard';
import { VdScriptService } from './vd-script.service';

const HTTP_400 = new Set([
  'stage_guard',
  'cmkt_cinematic_disabled',
  'vd_tables_missing',
  'invalid_body',
  'idempotency_key_required',
  'feasibility_blocked',
  'shotlist_immutable',
]);

function mapKnownError(err: unknown): never {
  const msg = err instanceof Error ? err.message : 'unknown';
  if (msg === 'vd_project_not_found' || msg === 'vd_script_not_found' || msg === 'vd_idea_not_found') {
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
export class VdScriptController {
  constructor(private readonly scripts: VdScriptService) {}

  @Post('projects/:id/ideas/generate')
  @HttpCode(201)
  @UseGuards(StaffVdScriptEditGuard)
  async generateIdeas(
    @Param('id', ParseIntPipe) id: number,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    try {
      return await this.scripts.generateIdeas(id, idempotencyKey);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Get('projects/:id/ideas')
  @UseGuards(StaffVdProjectViewGuard)
  async listIdeas(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.scripts.listIdeas(id);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post('projects/:id/ideas/:ideaId/select')
  @UseGuards(StaffVdScriptEditGuard)
  async selectIdea(
    @Param('id', ParseIntPipe) id: number,
    @Param('ideaId', ParseIntPipe) ideaId: number,
  ) {
    try {
      return await this.scripts.selectIdea(id, ideaId);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Get('projects/:id/scripts')
  @UseGuards(StaffVdProjectViewGuard)
  async listScripts(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.scripts.listScripts(id);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post('projects/:id/scripts')
  @UseGuards(StaffVdScriptEditGuard)
  async createScript(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    try {
      return await this.scripts.createScript(id, body ?? {});
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Put('projects/:id/scripts')
  @UseGuards(StaffVdScriptEditGuard)
  async saveScript(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    try {
      return await this.scripts.saveScript(id, body ?? {});
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Get('scripts/:id/shots')
  @UseGuards(StaffVdProjectViewGuard)
  async listShots(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.scripts.listShots(id);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post('scripts/:id/shots')
  @UseGuards(StaffVdScriptEditGuard)
  async addShot(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    try {
      return await this.scripts.addShot(id, body ?? {});
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Get('prompt-templates')
  @UseGuards(StaffVdProjectViewGuard)
  async listTemplates() {
    try {
      return await this.scripts.listTemplates();
    } catch (err) {
      mapKnownError(err);
    }
  }
}
