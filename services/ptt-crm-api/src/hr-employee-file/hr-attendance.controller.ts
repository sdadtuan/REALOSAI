import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrEmployeeFileEnabledGuard } from './guards/hr-employee-file-enabled.guard';
import {
  StaffHrAttendanceDeviceGuard,
  StaffHrAttendanceGpsGuard,
  StaffHrAttendanceReviewGuard,
  StaffHrAttendanceViewGuard,
} from './guards/staff-hr-attendance.guard';
import { HrAttendanceService } from './hr-attendance.service';
import type {
  AssignHrAttendanceSiteStaffBody,
  CreateHrAttendanceDeviceBody,
  CreateHrAttendanceSiteBody,
  GpsPunchBody,
  HrAttendanceStaffQuery,
  ReviewHrAttendancePunchBody,
} from './hr-attendance.types';

@Controller('api/v1/hr')
@UseGuards(StaffOrInternalKeyGuard, HrEmployeeFileEnabledGuard)
export class HrAttendanceController {
  constructor(private readonly attendance: HrAttendanceService) {}

  @Get('attendance/devices')
  @UseGuards(StaffHrAttendanceDeviceGuard)
  listDevices(@Req() req: Request & { staffUser?: StaffJwtPayload }) {
    return this.attendance.listDevices(req.staffUser);
  }

  @Post('attendance/devices')
  @UseGuards(StaffHrAttendanceDeviceGuard)
  createDevice(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Body() body: CreateHrAttendanceDeviceBody,
  ) {
    return this.attendance.createDevice(req.staffUser, body);
  }

  @Post('attendance/device/import.csv')
  @UseGuards(StaffHrAttendanceDeviceGuard)
  importCsv(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Body() body: { csv?: string; device_id?: number },
  ) {
    return this.attendance.importCsv(req.staffUser, String(body.csv ?? ''), body.device_id);
  }

  @Get('attendance/unmapped')
  @UseGuards(StaffHrAttendanceDeviceGuard)
  listUnmapped(@Req() req: Request & { staffUser?: StaffJwtPayload }) {
    return this.attendance.listUnmapped(req.staffUser);
  }

  @Get('attendance/hub-summary')
  @UseGuards(StaffHrAttendanceViewGuard)
  hubSummary(@Req() req: Request & { staffUser?: StaffJwtPayload }) {
    return this.attendance.hubSummary(req.staffUser);
  }

  @Get('staff/:id/attendance')
  @UseGuards(StaffHrAttendanceViewGuard)
  staffAttendance(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id', ParseIntPipe) staffId: number,
    @Query() query: HrAttendanceStaffQuery,
  ) {
    return this.attendance.staffAttendance(req.staffUser, staffId, query);
  }

  @Get('attendance/sites')
  @UseGuards(StaffHrAttendanceDeviceGuard)
  listSites(@Req() req: Request & { staffUser?: StaffJwtPayload }) {
    return this.attendance.listSites(req.staffUser);
  }

  @Post('attendance/sites')
  @UseGuards(StaffHrAttendanceDeviceGuard)
  createSite(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Body() body: CreateHrAttendanceSiteBody,
  ) {
    return this.attendance.createSite(req.staffUser, body);
  }

  @Put('attendance/sites/:id/staff')
  @UseGuards(StaffHrAttendanceDeviceGuard)
  assignSiteStaff(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id', ParseIntPipe) siteId: number,
    @Body() body: AssignHrAttendanceSiteStaffBody,
  ) {
    return this.attendance.assignSiteStaff(req.staffUser, siteId, body);
  }

  @Get('me/attendance/sites')
  @UseGuards(StaffHrAttendanceGpsGuard)
  mySites(@Req() req: Request & { staffUser?: StaffJwtPayload }) {
    return this.attendance.mySites(req.staffUser);
  }

  @Post('attendance/gps/punch')
  @UseGuards(StaffHrAttendanceGpsGuard)
  gpsPunch(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Body() body: GpsPunchBody,
  ) {
    return this.attendance.gpsPunch(req.staffUser, body);
  }

  @Get('attendance/gps/pending-review')
  @UseGuards(StaffHrAttendanceReviewGuard)
  listGpsPending(@Req() req: Request & { staffUser?: StaffJwtPayload }) {
    return this.attendance.listGpsPending(req.staffUser);
  }

  @Post('attendance/punches/:id/review')
  @UseGuards(StaffHrAttendanceReviewGuard)
  reviewPunch(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id', ParseIntPipe) punchId: number,
    @Body() body: ReviewHrAttendancePunchBody,
  ) {
    return this.attendance.reviewPunch(req.staffUser, punchId, body);
  }
}
