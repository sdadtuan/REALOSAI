import { Module, forwardRef } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { LeadsModule } from '../leads/leads.module';
import { LeadsFunnelModule } from '../leads-funnel/leads-funnel.module';
import { SopModule } from '../sop/sop.module';
import { B2bProjectsModule } from '../b2b-projects/b2b-projects.module';
import {
  AgencyContractsController,
  ContractsApprovalController,
  LeadsContractController,
} from './leads-contract.controller';
import { LeadsContractService } from './leads-contract.service';
import { LeadsContractPgRepository } from './leads-contract-pg.repository';
import { ServiceDeliveryNestGuard } from './guards/service-delivery-nest.guard';

@Module({
  imports: [
    StaffAuthModule,
    SopModule,
    B2bProjectsModule,
    forwardRef(() => LeadsModule),
    forwardRef(() => LeadsFunnelModule),
  ],
  controllers: [LeadsContractController, ContractsApprovalController, AgencyContractsController],
  providers: [
    LeadsContractService,
    LeadsContractPgRepository,
    ServiceDeliveryNestGuard,
  ],
  exports: [LeadsContractService, LeadsContractPgRepository],
})
export class LeadsContractModule {}
