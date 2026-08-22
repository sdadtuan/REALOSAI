import { ConfigModule } from '../config/config.module';
import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { OrdersModule } from '../orders/orders.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicesSqliteRepository } from './invoices-sqlite.repository';
import { StaffInvoicesViewGuard, StaffInvoicesWriteGuard } from './guards/staff-invoices.guard';

@Module({
  imports: [ConfigModule, StaffAuthModule, OrdersModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesSqliteRepository, StaffInvoicesViewGuard, StaffInvoicesWriteGuard],
  exports: [InvoicesService, InvoicesSqliteRepository],
})
export class InvoicesModule {}
