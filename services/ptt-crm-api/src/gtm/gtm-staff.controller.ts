import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { AppConfigService } from '../config/app-config.service';
import type { Industry, PublicDemoLocale } from './gtm-validate.util';
import type { GtmStatus } from './gtm-status.util';
import { GtmService } from './gtm.service';
import { GtmSandboxService } from './gtm-sandbox.service';
import { GtmExportService } from './gtm-export.service';
import { GtmImportService } from './gtm-import.service';
import { GtmProposalService } from './gtm-proposal.service';
import type { PatchGtmDemoBody } from './gtm.types';
import { StaffGtmDemosViewGuard, StaffGtmDemosWriteGuard } from './guards/staff-gtm-demos.guard';
import { StaffGtmSandboxGrantGuard, StaffGtmDemosExportGuard } from './guards/staff-gtm-sandbox.guard';

@Controller('api/v1/gtm')
@UseGuards(StaffOrInternalKeyGuard)
export class GtmStaffController {
  constructor(
    private readonly gtm: GtmService,
    private readonly sandbox: GtmSandboxService,
    private readonly exportSvc: GtmExportService,
    private readonly importSvc: GtmImportService,
    private readonly proposalSvc: GtmProposalService,
    private readonly config: AppConfigService,
  ) {}

  @Get('demo-requests')
  @UseGuards(StaffGtmDemosViewGuard)
  listDemoRequests(
    @Query('status') status?: GtmStatus,
    @Query('industry') industry?: Industry,
    @Query('locale') locale?: PublicDemoLocale,
    @Query('market_country') market_country?: string,
    @Query('owner_user_id') owner_user_id?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.gtm.listDemoRequests({
      status,
      industry,
      locale,
      market_country,
      owner_user_id,
      limit: limit != null ? Number(limit) : undefined,
      offset: offset != null ? Number(offset) : undefined,
    });
  }

  @Get('demo-requests/export')
  @UseGuards(StaffGtmDemosExportGuard)
  async exportDemoRequests(
    @Res() res: Response,
    @Query('status') status?: GtmStatus,
    @Query('industry') industry?: Industry,
    @Query('locale') locale?: PublicDemoLocale,
    @Query('market_country') market_country?: string,
  ) {
    const buf = await this.exportSvc.exportDemoRequestsXlsx({ status, industry, locale, market_country });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="gtm-demo-requests.xlsx"');
    res.send(buf);
  }

  @Post('demo-requests/import')
  @UseGuards(StaffGtmDemosWriteGuard)
  @UseInterceptors(FileInterceptor('file'))
  async importDemoRequests(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) return { imported: 0, skipped: 0, errors: [{ row: 0, message: 'no_file' }] };
    return this.importSvc.importDemoRows(file.buffer, this.config.gtmIpSalt);
  }

  @Get('demo-requests/:id/proposal.pdf')
  @UseGuards(StaffGtmDemosViewGuard)
  async proposalPdf(@Param('id') id: string, @Res() res: Response) {
    const buf = await this.proposalSvc.buildProposalPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="pttcrm-proposal-${id}.pdf"`);
    res.send(buf);
  }

  @Patch('demo-requests/:id')
  @UseGuards(StaffGtmDemosWriteGuard)
  patchDemoRequest(@Param('id') id: string, @Body() body: PatchGtmDemoBody) {
    return this.gtm.patchDemoRequest(id, body);
  }

  @Post('demo-requests/:id/sandbox')
  @UseGuards(StaffGtmSandboxGrantGuard)
  grantSandbox(@Param('id') id: string) {
    return this.sandbox.grantSandbox(id);
  }
}
