import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { PayrollMeService } from './payroll-me.service';

@Controller('api/v1/payroll/me')
@UseGuards(StaffOrInternalKeyGuard)
export class PayrollMeController {
  constructor(private readonly me: PayrollMeService) {}

  @Get('payslips')
  listPayslips(@Req() req: Request & { staffUser?: StaffJwtPayload }) {
    return this.me.listPayslips(req.staffUser);
  }

  @Get('payslips/download.xlsx')
  async downloadPayslip(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Res({ passthrough: false }) res: Response,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const { buffer, filename } = await this.me.downloadPayslipXlsx(req.staffUser, year, month);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
