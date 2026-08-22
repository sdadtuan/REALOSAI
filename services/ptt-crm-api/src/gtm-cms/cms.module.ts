import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { CmsPublicController } from './cms-public.controller';
import { CmsStaffController } from './cms-staff.controller';
import { CmsRepository } from './cms.repository';
import { CmsService } from './cms.service';
import { CmsStorageService } from './cms-storage.service';
import {
  StaffGtmCmsPublishGuard,
  StaffGtmCmsViewGuard,
  StaffGtmCmsWriteGuard,
} from './guards/staff-gtm-cms.guard';

@Module({
  imports: [ConfigModule, StaffAuthModule],
  controllers: [CmsPublicController, CmsStaffController],
  providers: [
    CmsRepository,
    CmsService,
    CmsStorageService,
    StaffGtmCmsViewGuard,
    StaffGtmCmsWriteGuard,
    StaffGtmCmsPublishGuard,
  ],
  exports: [CmsService, CmsRepository],
})
export class GtmCmsModule {}
