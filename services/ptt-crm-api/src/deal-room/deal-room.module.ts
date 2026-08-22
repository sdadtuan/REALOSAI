import { forwardRef, Module } from '@nestjs/common';
import { CrmLeadsLegacyModule } from '../crm-leads-legacy/crm-leads-legacy.module';
import { LeadsModule } from '../leads/leads.module';
import { LeadsFunnelModule } from '../leads-funnel/leads-funnel.module';
import { LeadMeetingPrepModule } from '../lead-meeting-prep/lead-meeting-prep.module';
import { OpsModule } from '../ops/ops.module';
import { ProposalsModule } from '../proposals/proposals.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { DealRoomController } from './deal-room.controller';
import { DealRoomService } from './deal-room.service';
import { DealRoomTeaserRepository } from './deal-room-teaser.repository';
import { DealRoomEnabledGuard } from './guards/deal-room-enabled.guard';
import { PortalDealTeaserController } from './portal-deal-teaser.controller';

@Module({
  imports: [
    StaffAuthModule,
    forwardRef(() => LeadsModule),
    forwardRef(() => LeadsFunnelModule),
    forwardRef(() => CrmLeadsLegacyModule),
    forwardRef(() => ProposalsModule),
    LeadMeetingPrepModule,
    OpsModule,
  ],
  controllers: [DealRoomController, PortalDealTeaserController],
  providers: [DealRoomService, DealRoomTeaserRepository, DealRoomEnabledGuard],
  exports: [DealRoomService],
})
export class DealRoomModule {}
