import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { StaffUser } from '../staff-auth/staff-jwt.guard';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffPermissionsConfigureGuard,
  StaffPermissionsViewGuard,
} from './guards/staff-permissions.guard';
import { StaffPermissionsService } from './staff-permissions.service';
import { StaffPermissionsSimulatorService } from './staff-permissions-simulator.service';
import type { SimulatePermissionsBody } from './staff-permissions-simulator.service';
import { StaffPermissionsAccessReviewService } from './staff-permissions-access-review.service';
import type { AccessReviewCsvRow } from './staff-permissions-access-review.service';
import type { PatchStaffJobFunctionGrantsBody, PatchStaffPositionGrantsBody } from './staff-permissions.types';

@Controller('api/v1/staff/permissions')
export class StaffPermissionsController {
  constructor(
    private readonly permissions: StaffPermissionsService,
    private readonly simulator: StaffPermissionsSimulatorService,
    private readonly accessReview: StaffPermissionsAccessReviewService,
  ) {}

  @Get('catalog')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  getCatalog() {
    return this.permissions.getCatalog();
  }

  @Get('field-registry')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  getFieldRegistry() {
    return this.permissions.getFieldRegistry();
  }

  @Get('positions')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  listPositions() {
    return this.permissions.listPositions();
  }

  @Get('positions/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  getPosition(@Param('id') id: string) {
    return this.permissions.getPosition(Number(id));
  }

  @Get('positions/:id/export')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  exportPosition(@Param('id') id: string) {
    return this.permissions.exportPosition(Number(id));
  }

  @Patch('positions/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard)
  patchPosition(
    @Param('id') id: string,
    @Body() body: PatchStaffPositionGrantsBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    const actorEmail = staffUser?.email ?? '';
    return this.permissions.patchPosition(Number(id), body, actorEmail);
  }

  @Get('audit')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  listAudit(@Query('position_id') positionId?: string, @Query('limit') limit?: string) {
    const pid = positionId != null && positionId !== '' ? Number(positionId) : undefined;
    const lim = limit != null && limit !== '' ? Number(limit) : undefined;
    return this.permissions.listAudit(pid, lim);
  }

  @Get('job-functions')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  listJobFunctions() {
    return this.permissions.listJobFunctions();
  }

  @Get('job-functions/:code')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  getJobFunction(@Param('code') code: string) {
    return this.permissions.getJobFunction(code);
  }

  @Get('job-functions/:code/export')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  exportJobFunction(@Param('code') code: string) {
    return this.permissions.exportJobFunction(code);
  }

  @Patch('job-functions/:code')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard)
  patchJobFunction(
    @Param('code') code: string,
    @Body() body: PatchStaffJobFunctionGrantsBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    const actorEmail = staffUser?.email ?? '';
    return this.permissions.patchJobFunction(code, body, actorEmail);
  }

  @Post('simulate')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard)
  simulate(@Body() body: SimulatePermissionsBody) {
    return this.simulator.simulate(body);
  }

  @Get('access-review.zip')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard)
  async accessReviewZip(@Query('quarter') quarter: string, @Res() res: Response) {
    const { buffer, filename } = await this.accessReview.buildZip(quarter ?? '');
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });
    res.send(buffer);
  }

  @Post('access-review/apply')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard)
  applyAccessReviewCsv(
    @Body() body: { quarter?: string; rows?: AccessReviewCsvRow[] },
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    return this.accessReview.applyCsv(
      body.quarter ?? '',
      body.rows ?? [],
      staffUser?.email ?? '',
    );
  }

  @Get('access-review/actions')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard)
  listAccessReviewActions(@Query('quarter') quarter?: string) {
    return this.accessReview.listAppliedActions(quarter ?? '');
  }
}
