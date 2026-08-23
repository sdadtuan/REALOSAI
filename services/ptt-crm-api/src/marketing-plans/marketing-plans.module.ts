import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffMarketingPlansViewGuard,
  StaffMarketingPlansWriteGuard,
} from './guards/staff-marketing-plans.guard';
import { MarketingPlansController } from './marketing-plans.controller';
import { MarketingPlansPgRepository } from './marketing-plans-pg.repository';
import { MarketingPlansSqliteRepository } from './marketing-plans-sqlite.repository';
import { MarketingPlansService } from './marketing-plans.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [MarketingPlansController],
  providers: [
    MarketingPlansService,
    MarketingPlansSqliteRepository,
    MarketingPlansPgRepository,
    StaffMarketingPlansViewGuard,
    StaffMarketingPlansWriteGuard,
  ],
  exports: [MarketingPlansService, MarketingPlansSqliteRepository, MarketingPlansPgRepository],
})
export class MarketingPlansModule {}
