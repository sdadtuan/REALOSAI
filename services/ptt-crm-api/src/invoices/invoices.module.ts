import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { OrdersModule } from '../orders/orders.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesPgRepository } from './invoices-pg.repository';
import { InvoicesService } from './invoices.service';
import { StaffInvoicesViewGuard, StaffInvoicesWriteGuard } from './guards/staff-invoices.guard';

@Module({
  imports: [StaffAuthModule, OrdersModule],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoicesPgRepository,
    StaffInvoicesViewGuard,
    StaffInvoicesWriteGuard,
  ],
  exports: [InvoicesService, InvoicesPgRepository],
})
export class InvoicesModule {}
