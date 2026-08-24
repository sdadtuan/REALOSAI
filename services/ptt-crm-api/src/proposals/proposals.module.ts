import { Module, forwardRef } from '@nestjs/common';
import { LeadsFunnelModule } from '../leads-funnel/leads-funnel.module';
import { OpsModule } from '../ops/ops.module';
import { SpcModule } from '../spc/spc.module';
import { ServiceLifecycleModule } from '../service-lifecycle/service-lifecycle.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffProposalsViewGuard,
  StaffProposalsWriteGuard,
} from './guards/staff-proposals.guard';
import { ProposalsController } from './proposals.controller';
import { ProposalsPgRepository } from './proposals-pg.repository';
import { ProposalsService } from './proposals.service';

@Module({
  imports: [
    StaffAuthModule,
    SpcModule,
    forwardRef(() => OpsModule),
    forwardRef(() => ServiceLifecycleModule),
    forwardRef(() => LeadsFunnelModule),
  ],
  controllers: [ProposalsController],
  providers: [
    ProposalsService,
    ProposalsPgRepository,
    StaffProposalsViewGuard,
    StaffProposalsWriteGuard,
  ],
  exports: [ProposalsService, ProposalsPgRepository],
})
export class ProposalsModule {}
