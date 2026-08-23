import { ConfigModule } from '../config/config.module';
import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffOwnerWeeklyConfigureGuard,
  StaffOwnerWeeklyExportGuard,
  StaffOwnerWeeklyViewGuard,
} from './guards/staff-owner-weekly.guard';
import { OwnerWeeklyController } from './owner-weekly.controller';
import { OwnerWeeklyPgRepository } from './owner-weekly-pg.repository';
import { OwnerWeeklySqliteRepository } from './owner-weekly-sqlite.repository';
import { OwnerWeeklyService } from './owner-weekly.service';

@Module({
  imports: [StaffAuthModule, ConfigModule],
  controllers: [OwnerWeeklyController],
  providers: [
    OwnerWeeklyService,
    OwnerWeeklySqliteRepository,
    OwnerWeeklyPgRepository,
    StaffOwnerWeeklyViewGuard,
    StaffOwnerWeeklyExportGuard,
    StaffOwnerWeeklyConfigureGuard,
  ],
})
export class OwnerWeeklyModule {}
