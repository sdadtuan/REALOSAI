import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffUser } from '../staff-auth/staff-jwt.guard';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffOrgConfigureGuard,
  StaffOrgDepartmentsConfigureGuard,
  StaffOrgDepartmentsViewGuard,
  StaffOrgEffectiveCapsGuard,
  StaffOrgRosterEditGuard,
  StaffOrgRosterViewGuard,
} from './guards/staff-org.guard';
import { StaffOrgService } from './staff-org.service';
import type {
  CreateStaffDepartmentBody,
  CreateStaffOrgUserBody,
  CreateStaffTeamBody,
  OffboardStaffOrgUserBody,
  PatchStaffDepartmentBody,
  PatchStaffOrgPositionBody,
  PatchStaffOrgUserBody,
  PatchStaffTeamBody,
  PutStaffUserJobFunctionsBody,
  PutStaffUserClientScopeBody,
  ImportStaffUserClientScopeBody,
} from './staff-org.types';

@Controller('api/v1/staff/org')
export class StaffOrgController {
  constructor(private readonly org: StaffOrgService) {}

  @Get('departments')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgDepartmentsViewGuard)
  listDepartments() {
    return this.org.listDepartments().then((departments) => ({ departments }));
  }

  @Post('departments')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgDepartmentsConfigureGuard)
  createDepartment(
    @Body() body: CreateStaffDepartmentBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    return this.org.createDepartment(body, staffUser?.email ?? '');
  }

  @Patch('departments/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgDepartmentsConfigureGuard)
  patchDepartment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchStaffDepartmentBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    return this.org.patchDepartment(id, body, staffUser?.email ?? '');
  }

  @Get('teams')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgDepartmentsViewGuard)
  listTeams(@Query('department_id') departmentId?: string) {
    const parsed =
      departmentId != null && departmentId.trim() !== '' ? Number(departmentId) : undefined;
    return this.org.listTeams(Number.isFinite(parsed) ? parsed : undefined).then((teams) => ({ teams }));
  }

  @Post('teams')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgDepartmentsConfigureGuard)
  createTeam(@Body() body: CreateStaffTeamBody, @StaffUser() staffUser?: StaffJwtPayload) {
    return this.org.createTeam(body, staffUser?.email ?? '');
  }

  @Patch('teams/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgDepartmentsConfigureGuard)
  patchTeam(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchStaffTeamBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    return this.org.patchTeam(id, body, staffUser?.email ?? '');
  }

  @Get('positions')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgDepartmentsViewGuard)
  listPositions() {
    return this.org.listPositions().then((positions) => ({ positions }));
  }

  @Get('chart')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgDepartmentsViewGuard)
  listOrgChart(@Query('include_inactive') includeInactive?: string) {
    const include = includeInactive === '1' || includeInactive === 'true';
    return this.org.listOrgChart(include).then((nodes) => ({ nodes }));
  }

  @Patch('positions/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgConfigureGuard)
  patchPosition(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchStaffOrgPositionBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    return this.org.patchPosition(id, body, staffUser?.email ?? '');
  }

  @Get('job-functions/catalog')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgRosterViewGuard)
  jobFunctionCatalog() {
    return { functions: this.org.listJobFunctionCatalog() };
  }

  @Get('users/next-internal-code')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgRosterViewGuard)
  nextInternalCode() {
    return this.org.getNextInternalCode();
  }

  @Get('users')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgRosterViewGuard)
  listUsers(
    @Query('q') q?: string,
    @Query('include_inactive') includeInactive?: string,
  ) {
    return this.org
      .listUsers({
        q,
        includeInactive: includeInactive === '1' || includeInactive === 'true',
      })
      .then((users) => ({ users }));
  }

  @Get('users/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgRosterViewGuard)
  getUser(@Param('id') id: string) {
    return this.org.getUser(id);
  }

  @Post('users')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgRosterEditGuard)
  createUser(@Body() body: CreateStaffOrgUserBody, @StaffUser() staffUser?: StaffJwtPayload) {
    return this.org.createUser(body, staffUser?.email ?? '');
  }

  @Patch('users/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgRosterEditGuard)
  patchUser(
    @Param('id') id: string,
    @Body() body: PatchStaffOrgUserBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    return this.org.patchUser(id, body, staffUser?.email ?? '');
  }

  @Post('users/:id/offboard')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgRosterEditGuard)
  offboardUser(
    @Param('id') id: string,
    @Body() body: OffboardStaffOrgUserBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    return this.org.offboardUser(id, body, staffUser?.email ?? '');
  }

  @Get('users/:id/job-functions')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgRosterViewGuard)
  getUserJobFunctions(@Param('id') id: string) {
    return this.org.getUserJobFunctions(id);
  }

  @Put('users/:id/job-functions')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgConfigureGuard)
  putUserJobFunctions(
    @Param('id') id: string,
    @Body() body: PutStaffUserJobFunctionsBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    return this.org.putUserJobFunctions(id, body, staffUser?.email ?? '');
  }

  @Get('users/:id/effective-caps')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgEffectiveCapsGuard)
  getEffectiveCaps(@Param('id') id: string) {
    return this.org.getEffectiveCaps(id);
  }

  @Get('users/:id/client-scope')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgRosterViewGuard)
  getUserClientScope(@Param('id') id: string) {
    return this.org.getUserClientScope(id);
  }

  @Put('users/:id/client-scope')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgConfigureGuard)
  putUserClientScope(
    @Param('id') id: string,
    @Body() body: PutStaffUserClientScopeBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    return this.org.putUserClientScope(id, body, staffUser?.email ?? '');
  }

  @Post('users/client-scope/import')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgConfigureGuard)
  importUserClientScope(
    @Body() body: ImportStaffUserClientScopeBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    return this.org.importUserClientScopeCsv(body, staffUser?.email ?? '');
  }
}
