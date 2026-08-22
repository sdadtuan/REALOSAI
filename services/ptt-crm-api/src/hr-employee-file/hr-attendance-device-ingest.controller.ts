import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { HrEmployeeFileEnabledGuard } from './guards/hr-employee-file-enabled.guard';
import { HrAttendanceService } from './hr-attendance.service';
import type { DeviceIngestBody } from './hr-attendance.types';

@Controller('api/v1/hr/attendance/device')
@UseGuards(HrEmployeeFileEnabledGuard)
export class HrAttendanceDeviceIngestController {
  constructor(private readonly attendance: HrAttendanceService) {}

  @Post('ingest')
  ingest(
    @Headers('x-device-key') deviceKey: string | undefined,
    @Body() body: DeviceIngestBody,
  ) {
    return this.attendance.deviceIngest(deviceKey, body);
  }
}
