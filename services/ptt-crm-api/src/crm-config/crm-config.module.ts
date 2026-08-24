import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { CrmConfigController } from './crm-config.controller';
import { CrmConfigPgRepository } from './crm-config-pg.repository';
import { CrmConfigService } from './crm-config.service';
import {
  StaffCrmConfigConfigureGuard,
  StaffCrmConfigViewGuard,
} from './guards/staff-crm-config.guard';

@Module({
  imports: [StaffAuthModule],
  controllers: [CrmConfigController],
  providers: [
    CrmConfigService,
    CrmConfigPgRepository,
    StaffCrmConfigViewGuard,
    StaffCrmConfigConfigureGuard,
  ],
  exports: [CrmConfigService],
})
export class CrmConfigModule {}
