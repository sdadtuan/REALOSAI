import { ConfigModule } from '../config/config.module';
import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffSvcFinanceViewGuard,
  StaffSvcFinanceWriteGuard,
} from './guards/staff-svc-finance.guard';
import { SvcFinanceController } from './svc-finance.controller';
import { SvcFinancePgRepository } from './svc-finance-pg.repository';
import { SvcFinanceSqliteRepository } from './svc-finance-sqlite.repository';
import { SvcFinanceService } from './svc-finance.service';

@Module({
  imports: [ConfigModule, StaffAuthModule],
  controllers: [SvcFinanceController],
  providers: [
    SvcFinanceService,
    SvcFinanceSqliteRepository,
    SvcFinancePgRepository,
    StaffSvcFinanceViewGuard,
    StaffSvcFinanceWriteGuard,
  ],
  exports: [SvcFinanceService],
})
export class SvcFinanceModule {}
