import { Module, forwardRef } from '@nestjs/common';
import { AiIntelligenceModule } from '../ai-intelligence/ai-intelligence.module';
import { CrmLeadsLegacyModule } from '../crm-leads-legacy/crm-leads-legacy.module';
import { LeadsFunnelModule } from '../leads-funnel/leads-funnel.module';
import { LeadsModule } from '../leads/leads.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { CskhBoardController } from './cskh-board.controller';
import { CskhBoardRepository } from './cskh-board.repository';
import { CskhBoardService } from './cskh-board.service';
import { SlaAlertService } from './sla-alert.service';

@Module({
  imports: [
    StaffAuthModule,
    forwardRef(() => CrmLeadsLegacyModule),
    forwardRef(() => LeadsModule),
    forwardRef(() => LeadsFunnelModule),
    forwardRef(() => AiIntelligenceModule),
  ],
  controllers: [CskhBoardController],
  providers: [CskhBoardRepository, CskhBoardService, SlaAlertService],
  exports: [CskhBoardService],
})
export class CskhBoardModule {}
