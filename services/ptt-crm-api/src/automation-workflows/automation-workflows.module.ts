import { Module } from '@nestjs/common';
import { AiIntelligenceModule } from '../ai-intelligence/ai-intelligence.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { AutomationWorkflowsController } from './automation-workflows.controller';
import { AutomationWorkflowsRepository } from './automation-workflows.repository';
import { AutomationWorkflowsService } from './automation-workflows.service';
import {
  StaffAutomationConfigureGuard,
  StaffAutomationSimulateGuard,
  StaffAutomationViewGuard,
} from './guards/staff-automation-workflows.guard';

@Module({
  imports: [StaffAuthModule, AiIntelligenceModule],
  controllers: [AutomationWorkflowsController],
  providers: [
    AutomationWorkflowsRepository,
    AutomationWorkflowsService,
    StaffAutomationViewGuard,
    StaffAutomationConfigureGuard,
    StaffAutomationSimulateGuard,
  ],
  exports: [AutomationWorkflowsService, AutomationWorkflowsRepository],
})
export class AutomationWorkflowsModule {}
