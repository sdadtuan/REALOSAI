import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { StaffUser } from '../staff-auth/staff-jwt.guard';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffPermissionSetsConfigureGuard,
  StaffPermissionSetsRosterEditGuard,
  StaffPermissionSetsRosterViewGuard,
} from './guards/staff-permission-sets.guard';
import { StaffPermissionSetsService } from './staff-permission-sets.service';
import type {
  CreateStaffPermissionSetBody,
  PatchStaffPermissionSetBody,
  PutStaffPermissionSetGrantsBody,
  PutStaffUserPermissionSetsBody,
} from './staff-permission-sets.types';

@Controller('api/v1/staff/permission-sets')
export class StaffPermissionSetsController {
  constructor(private readonly sets: StaffPermissionSetsService) {}

  @Get()
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionSetsConfigureGuard)
  listSets() {
    return this.sets.listSets();
  }

  @Post()
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionSetsConfigureGuard)
  createSet(@Body() body: CreateStaffPermissionSetBody) {
    return this.sets.createSet(body);
  }

  @Get('users/:userId')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionSetsRosterViewGuard)
  getUserSets(@Param('userId') userId: string) {
    return this.sets.getUserSets(userId);
  }

  @Put('users/:userId')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionSetsRosterEditGuard)
  putUserSets(
    @Param('userId') userId: string,
    @Body() body: PutStaffUserPermissionSetsBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    const actorEmail = staffUser?.email ?? '';
    return this.sets.replaceUserSets(userId, body, actorEmail);
  }

  @Get(':code')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionSetsConfigureGuard)
  getSet(@Param('code') code: string) {
    return this.sets.getSet(code);
  }

  @Patch(':code')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionSetsConfigureGuard)
  patchSet(@Param('code') code: string, @Body() body: PatchStaffPermissionSetBody) {
    return this.sets.patchSet(code, body);
  }

  @Put(':code/grants')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionSetsConfigureGuard)
  putGrants(@Param('code') code: string, @Body() body: PutStaffPermissionSetGrantsBody) {
    return this.sets.replaceGrants(code, body);
  }
}
