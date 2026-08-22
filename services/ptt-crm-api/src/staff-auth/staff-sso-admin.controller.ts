import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import {
  PutStaffKeycloakGroupMapBody,
  StaffKeycloakGroupMapRow,
  StaffKeycloakGroupsRepository,
} from './staff-keycloak-groups.repository';
import { StaffAuthService } from './staff-auth.service';
import { StaffJwtGuard, StaffUser } from './staff-jwt.guard';
import { StaffJwtPayload } from './staff-jwt.util';

@Controller('api/v1/staff/admin/sso/groups')
@UseGuards(StaffJwtGuard)
export class StaffSsoAdminController {
  constructor(
    private readonly groups: StaffKeycloakGroupsRepository,
    private readonly auth: StaffAuthService,
  ) {}

  @Get()
  async list(@StaffUser() user: StaffJwtPayload): Promise<{ groups: StaffKeycloakGroupMapRow[] }> {
    await this.auth.assertConfigureSso(user);
    const groups = await this.groups.listAll();
    return { groups };
  }

  @Put(':group')
  async upsert(
    @Param('group') group: string,
    @Body() body: PutStaffKeycloakGroupMapBody,
    @StaffUser() user: StaffJwtPayload,
  ): Promise<{ group: StaffKeycloakGroupMapRow }> {
    await this.auth.assertConfigureSso(user);
    const saved = await this.groups.upsert(group, body, user.email);
    return { group: saved };
  }
}
