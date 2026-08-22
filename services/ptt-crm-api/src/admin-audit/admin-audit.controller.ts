import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { StaffUser } from '../staff-auth/staff-jwt.guard';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffPermissionsConfigureGuard,
  StaffPermissionsViewGuard,
} from '../staff-permissions/guards/staff-permissions.guard';
import { AdminAuditService } from './admin-audit.service';
import type {
  AdminAuditEventCategory,
  AdminAuditExportRequest,
  AdminAuditSeverity,
  AdminConfigSnapshotRequest,
} from './admin-audit.types';

function parseListParam(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

@Controller('api/v1/admin/audit')
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditService) {}

  @Get()
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  listEvents(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('actor') actor?: string,
    @Query('subject') subject?: string,
    @Query('category') category?: string,
    @Query('severity') severity?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.listEvents({
      from,
      to,
      actor,
      subject,
      category: parseListParam(category) as AdminAuditEventCategory[],
      severity: parseListParam(severity) as AdminAuditSeverity[],
      q,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('export')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard)
  createExport(@Body() body: AdminAuditExportRequest, @StaffUser() staff?: StaffJwtPayload) {
    return this.audit.createExport(staff?.email ?? '', body);
  }

  @Get('export/:jobId')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  @Header('Cache-Control', 'no-store')
  getExport(@Param('jobId') jobId: string, @Res({ passthrough: true }) res: Response) {
    const job = this.audit.getExportJob(jobId);
    if (job.status !== 'completed' || !job.download_body) {
      return {
        job_id: job.job_id,
        status: job.status,
        row_count: job.row_count,
        error_message: job.error_message,
      };
    }
    const ext = job.format === 'csv' ? 'csv' : 'json';
    res.setHeader('Content-Type', job.content_type ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="admin-audit-${jobId}.${ext}"`);
    return job.download_body;
  }

  @Post('snapshots')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard)
  signSnapshot(
    @Body() body: AdminConfigSnapshotRequest & { payload?: Record<string, unknown> },
    @StaffUser() staff?: StaffJwtPayload,
  ) {
    return this.audit.signSnapshot(staff?.email ?? '', body, body.payload ?? {});
  }

  @Get('events/:eventId')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  getEvent(@Param('eventId') eventId: string) {
    return this.audit.getEvent(decodeURIComponent(eventId));
  }
}
