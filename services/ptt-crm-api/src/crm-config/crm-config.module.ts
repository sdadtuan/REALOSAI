import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { CrmConfigController } from './crm-config.controller';
import { CrmConfigSqliteRepository } from './crm-config-sqlite.repository';
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
    CrmConfigSqliteRepository,
    StaffCrmConfigViewGuard,
    StaffCrmConfigConfigureGuard,
  ],
  exports: [CrmConfigService],
})
export class CrmConfigModule {}
