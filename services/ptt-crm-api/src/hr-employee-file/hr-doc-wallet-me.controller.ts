import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request, Response } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrEmployeeFileEnabledGuard } from './guards/hr-employee-file-enabled.guard';
import { StaffHrWalletSelfGuard } from './guards/staff-hr-docs-approve.guard';
import { HrDocWalletMeService } from './hr-doc-wallet-me.service';
import type { CreateHrDocWalletCardBody } from './hr-doc-wallet.types';
import { HR_DOC_WALLET_MAX_FILE_BYTES } from './hr-doc-wallet.types';

@Controller('api/v1/hr/me/wallet')
@UseGuards(StaffOrInternalKeyGuard, HrEmployeeFileEnabledGuard, StaffHrWalletSelfGuard)
export class HrDocWalletMeController {
  constructor(private readonly meWallet: HrDocWalletMeService) {}

  @Get('types')
  listTypes(@Req() req: Request & { staffUser?: StaffJwtPayload }) {
    return this.meWallet.listSelfSubmitTypes(req.staffUser);
  }

  @Get()
  list(@Req() req: Request & { staffUser?: StaffJwtPayload }) {
    return this.meWallet.listMyWallet(req.staffUser);
  }

  @Post()
  submit(@Req() req: Request & { staffUser?: StaffJwtPayload }, @Body() body: CreateHrDocWalletCardBody) {
    return this.meWallet.submitCard(req.staffUser, body);
  }

  @Post(':cardId/files')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: HR_DOC_WALLET_MAX_FILE_BYTES },
    }),
  )
  upload(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('cardId') cardId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.meWallet.uploadMyFile(req.staffUser, Number(cardId), file);
  }

  @Get(':cardId/files/:fileId')
  async download(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('cardId') cardId: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    const out = await this.meWallet.downloadMyFile(req.staffUser, Number(cardId), Number(fileId));
    res.setHeader('Content-Type', out.file.mime_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(out.file.original_name || 'document')}"`,
    );
    res.send(out.buffer);
  }
}
