import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import {
  StaffVdBibleEditGuard,
  StaffVdProjectViewGuard,
} from '../guards/staff-vd-project.guard';
import { VdBibleService } from './vd-bible.service';

const HTTP_400 = new Set([
  'cmkt_cinematic_disabled',
  'vd_tables_missing',
  'invalid_body',
]);

function mapKnownError(err: unknown): never {
  const msg = err instanceof Error ? err.message : 'unknown';
  if (msg === 'vd_project_not_found') {
    throw new NotFoundException({ error: msg, message: msg });
  }
  if (HTTP_400.has(msg)) {
    throw new BadRequestException({ error: msg, message: msg });
  }
  throw err;
}

@Controller('api/v1/vd/projects')
@UseGuards(StaffOrInternalKeyGuard)
export class VdBibleController {
  constructor(private readonly bibles: VdBibleService) {}

  @Get(':id/bibles/style')
  @UseGuards(StaffVdProjectViewGuard)
  async getStyle(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.bibles.getStyle(id);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Put(':id/bibles/style')
  @UseGuards(StaffVdBibleEditGuard)
  async saveStyle(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    try {
      return await this.bibles.saveStyle(id, body ?? {});
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Get(':id/bibles/characters')
  @UseGuards(StaffVdProjectViewGuard)
  async getCharacters(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.bibles.getCharacters(id);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Put(':id/bibles/characters')
  @UseGuards(StaffVdBibleEditGuard)
  async saveCharacters(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    try {
      return await this.bibles.saveCharacters(id, body ?? {});
    } catch (err) {
      mapKnownError(err);
    }
  }
}
