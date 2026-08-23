import { ConfigModule } from '../config/config.module';
import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { CrmConfigModule } from '../crm-config/crm-config.module';
import {
  StaffSalesFunnelViewGuard,
  StaffSalesMarketWriteGuard,
  StaffSalesPartnerWriteGuard,
  StaffSalesTrainingWriteGuard,
  StaffSalesViewGuard,
  StaffSalesWriteGuard,
} from './guards/staff-sales.guard';
import { SalesController } from './sales.controller';
import { SalesPgRepository } from './sales-pg.repository';
import { SalesSqliteRepository } from './sales-sqlite.repository';
import { SalesService } from './sales.service';

@Module({
  imports: [StaffAuthModule, CrmConfigModule, ConfigModule],
  controllers: [SalesController],
  providers: [
    SalesService,
    SalesSqliteRepository,
    SalesPgRepository,
    StaffSalesViewGuard,
    StaffSalesFunnelViewGuard,
    StaffSalesWriteGuard,
    StaffSalesPartnerWriteGuard,
    StaffSalesTrainingWriteGuard,
    StaffSalesMarketWriteGuard,
  ],
  exports: [SalesService],
})
export class SalesModule {}
