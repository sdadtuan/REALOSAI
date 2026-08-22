import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import {
  StaffVdBudgetEditGuard,
  StaffVdProjectViewGuard,
} from '../guards/staff-vd-project.guard';
import { VdCostService } from './vd-cost.service';

const HTTP_400 = new Set([
  'cmkt_cinematic_disabled',
  'vd_tables_missing',
  'invalid_body',
  'project_not_closed',
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
export class VdCostController {
  constructor(private readonly costs: VdCostService) {}

  @Get(':id/budget')
  @UseGuards(StaffVdProjectViewGuard)
  async getBudget(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.costs.getBudget(id);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Put(':id/budget')
  @UseGuards(StaffVdBudgetEditGuard)
  async setBudget(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    try {
      return await this.costs.setBudget(id, body ?? {});
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Get(':id/costs')
  @UseGuards(StaffVdProjectViewGuard)
  async listCosts(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.costs.listCosts(id);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Get(':id/costs/export.xlsx')
  @UseGuards(StaffVdProjectViewGuard)
  async exportCosts(
    @Param('id', ParseIntPipe) id: number,
    @Query('close') closeRaw: string | undefined,
    @Res() res: Response,
  ) {
    try {
      const accountingClose = closeRaw === '1' || closeRaw === 'true';
      const buf = await this.costs.exportXlsx(id, accountingClose);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="vd-costs-${id}.xlsx"`);
      res.send(buf);
    } catch (err) {
      mapKnownError(err);
    }
  }
}
