import { Module } from '@nestjs/common';
import { CustomerTimelineModule } from '../customer-timeline/customer-timeline.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { CustomersController } from './customers.controller';
import { CustomersPgRepository } from './customers-pg.repository';
import { CustomersService } from './customers.service';
import { StaffCustomersViewGuard, StaffCustomersWriteGuard } from './guards/staff-customers.guard';

@Module({
  imports: [StaffAuthModule, CustomerTimelineModule],
  controllers: [CustomersController],
  providers: [
    CustomersService,
    CustomersPgRepository,
    StaffCustomersViewGuard,
    StaffCustomersWriteGuard,
  ],
  exports: [CustomersService],
})
export class CustomersModule {}
