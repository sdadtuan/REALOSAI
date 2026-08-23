import { ConfigModule } from '../config/config.module';
import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { OrdersController } from './orders.controller';
import { OrdersPgRepository } from './orders-pg.repository';
import { OrdersService } from './orders.service';
import { OrdersSqliteRepository } from './orders-sqlite.repository';
import { StaffOrdersViewGuard, StaffOrdersWriteGuard } from './guards/staff-orders.guard';

@Module({
  imports: [ConfigModule, StaffAuthModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersSqliteRepository, OrdersPgRepository, StaffOrdersViewGuard, StaffOrdersWriteGuard],
  exports: [OrdersService, OrdersSqliteRepository, OrdersPgRepository],
})
export class OrdersModule {}
