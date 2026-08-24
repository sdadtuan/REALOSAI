import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { OrdersController } from './orders.controller';
import { OrdersPgRepository } from './orders-pg.repository';
import { OrdersService } from './orders.service';
import { StaffOrdersViewGuard, StaffOrdersWriteGuard } from './guards/staff-orders.guard';

@Module({
  imports: [StaffAuthModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersPgRepository, StaffOrdersViewGuard, StaffOrdersWriteGuard],
  exports: [OrdersService, OrdersPgRepository],
})
export class OrdersModule {}
