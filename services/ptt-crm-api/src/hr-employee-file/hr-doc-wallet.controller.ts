import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrEmployeeFileEnabledGuard } from './guards/hr-employee-file-enabled.guard';
import {
  StaffHrDocsDownloadGuard,
  StaffHrDocsEditGuard,
  StaffHrDocsViewGuard,
} from './guards/staff-hr-docs.guard';
import {
  StaffHrDocsApproveGuard,
  StaffHrWalletSelfGuard,
} from './guards/staff-hr-docs-approve.guard';
import { StaffHrEmployeeFileViewGuard } from './guards/staff-hr-employee-file.guard';
import { HrDocWalletService } from './hr-doc-wallet.service';
import type {
  ApproveHrDocWalletCardBody,
  CreateHrDocTypeBody,
  CreateHrDocWalletCardBody,
  PatchHrDocWalletCardBody,
  RejectHrDocWalletCardBody,
} from './hr-doc-wallet.types';
import { HR_DOC_WALLET_MAX_FILE_BYTES } from './hr-doc-wallet.types';

@Controller('api/v1/hr')
@UseGuards(StaffOrInternalKeyGuard, HrEmployeeFileEnabledGuard)
export class HrDocWalletController {
  constructor(private readonly wallet: HrDocWalletService) {}

  @Get('doc-types')
  @UseGuards(StaffHrDocsViewGuard)
  listDocTypes(@Req() req: Request & { staffUser?: StaffJwtPayload }) {
    return this.wallet.listDocTypes(req.staffUser);
  }

  @Post('doc-types')
  @UseGuards(StaffHrDocsEditGuard)
  createDocType(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Body() body: CreateHrDocTypeBody,
  ) {
    return this.wallet.createDocType(req.staffUser, body);
  }

  @Get('wallet/pending-review')
  @UseGuards(StaffHrDocsViewGuard)
  pendingReview(@Req() req: Request & { staffUser?: StaffJwtPayload }) {
    return this.wallet.listPendingReview(req.staffUser);
  }

  @Get('wallet/export/accounting.xlsx')
  @UseGuards(StaffHrDocsViewGuard)
  async exportAccounting(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.wallet.exportAccountingXlsx(req.staffUser);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('staff/wallet-roster-stats')
  @UseGuards(StaffHrEmployeeFileViewGuard)
  rosterStats(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Query('ids') ids?: string,
  ) {
    const staffIds = String(ids ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    return this.wallet.rosterStats(req.staffUser, staffIds);
  }

  @Get('staff/:id/wallet')
  @UseGuards(StaffHrDocsViewGuard)
  listWallet(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Query('category') category?: string,
    @Query('expiring_only') expiringOnly?: string,
    @Query('education_only') educationOnly?: string,
    @Query('missing_files') missingFiles?: string,
  ) {
    return this.wallet.listWallet(req.staffUser, Number(id), {
      category: category?.trim() || undefined,
      expiring_only: expiringOnly === '1' || expiringOnly === 'true',
      education_only: educationOnly === '1' || educationOnly === 'true',
      missing_files: missingFiles === '1' || missingFiles === 'true',
    });
  }

  @Post('staff/:id/wallet')
  @UseGuards(StaffHrDocsEditGuard)
  createCard(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Body() body: CreateHrDocWalletCardBody,
  ) {
    return this.wallet.createCard(req.staffUser, Number(id), body);
  }

  @Patch('staff/:id/wallet/:cardId')
  @UseGuards(StaffHrDocsEditGuard)
  patchCard(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Param('cardId') cardId: string,
    @Body() body: PatchHrDocWalletCardBody,
  ) {
    return this.wallet.patchCard(req.staffUser, Number(id), Number(cardId), body);
  }

  @Patch('staff/:id/wallet/:cardId/approve')
  @UseGuards(StaffHrDocsApproveGuard)
  approveCard(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Param('cardId') cardId: string,
    @Body() body: ApproveHrDocWalletCardBody,
  ) {
    return this.wallet.approveCard(req.staffUser, Number(id), Number(cardId), body);
  }

  @Patch('staff/:id/wallet/:cardId/reject')
  @UseGuards(StaffHrDocsApproveGuard)
  rejectCard(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Param('cardId') cardId: string,
    @Body() body: RejectHrDocWalletCardBody,
  ) {
    return this.wallet.rejectCard(req.staffUser, Number(id), Number(cardId), body);
  }

  @Post('staff/:id/wallet/:cardId/files')
  @UseGuards(StaffHrDocsEditGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: HR_DOC_WALLET_MAX_FILE_BYTES },
    }),
  )
  uploadFile(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Param('cardId') cardId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.wallet.uploadFile(req.staffUser, Number(id), Number(cardId), file);
  }

  @Get('staff/:id/wallet/:cardId/files/:fileId')
  @UseGuards(StaffHrDocsDownloadGuard)
  async downloadFile(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Param('cardId') cardId: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    const out = await this.wallet.downloadFile(
      req.staffUser,
      Number(id),
      Number(cardId),
      Number(fileId),
    );
    res.setHeader('Content-Type', out.file.mime_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(out.file.original_name || 'document')}"`,
    );
    res.send(out.buffer);
  }
}
