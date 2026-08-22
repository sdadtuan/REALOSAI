import { Module, forwardRef } from '@nestjs/common';
import { AiIntelligenceModule } from '../ai-intelligence/ai-intelligence.module';
import { OpsModule } from '../ops/ops.module';
import { PerformanceModule } from '../performance/performance.module';
import { StaffNotificationsModule } from '../staff-notifications/staff-notifications.module';
import { ServiceLifecycleModule } from '../service-lifecycle/service-lifecycle.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffMarketingAiPlannerApproveGuard,
  StaffMarketingAiPlannerExportGuard,
  StaffMarketingAiPlannerGenerateGuard,
  StaffMarketingAiPlannerViewGuard,
} from './guards/staff-marketing-ai-planner.guard';
import { MarketingAiVersionService } from './marketing-ai-version.service';
import { MarketingAiApprovalService } from './marketing-ai-approval.service';
import { MarketingAiBudgetService } from './marketing-ai-budget.service';
import { MarketingAiExportService } from './marketing-ai-export.service';
import { MarketingAiDashboardService } from './marketing-ai-dashboard.service';
import { MarketingAiKpiAlertService } from './marketing-ai-kpi-alert.service';
import { MarketingAiKpiClosedLoopService } from './marketing-ai-kpi-closed-loop.service';
import { MarketingAiWeeklyMemoService } from './marketing-ai-weekly-memo.service';
import { MarketingAiMultiAgentService } from './marketing-ai-multi-agent.service';
import { MarketingAiJobWorkerService } from './marketing-ai-job-worker.service';
import { MarketingAiSectionCommentService } from './marketing-ai-section-comment.service';
import { MarketingAiStrategyScenarioService } from './marketing-ai-strategy-scenario.service';
import { MarketingAiOptimizeService } from './marketing-ai-optimize.service';
import { MarketingAiPlaybookModule } from './marketing-ai-playbook.module';
import { MarketingAiPlaybookService } from './marketing-ai-playbook.service';
import { MarketingAiBriefUploadService } from './marketing-ai-brief-upload.service';
import { MarketingAiOrchestratorService } from './marketing-ai-orchestrator.service';
import { MarketingAiRagService } from './marketing-ai-rag.service';
import { MarketingAiPlannerController } from './marketing-ai-planner.controller';
import { MarketingAiKpiAlertController } from './marketing-ai-kpi-alert.controller';
import { MarketingAiPlaybookAdminController } from './marketing-ai-playbook-admin.controller';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import { MarketingAiPlannerService } from './marketing-ai-planner.service';

@Module({
  imports: [
    StaffAuthModule,
    StaffNotificationsModule,
    PerformanceModule,
    forwardRef(() => ServiceLifecycleModule),
    forwardRef(() => OpsModule),
    AiIntelligenceModule,
    MarketingAiPlaybookModule,
  ],
  controllers: [MarketingAiPlannerController, MarketingAiKpiAlertController, MarketingAiPlaybookAdminController],
  providers: [
    MarketingAiPlannerRepository,
    MarketingAiOrchestratorService,
    MarketingAiBriefUploadService,
    MarketingAiRagService,
    MarketingAiBudgetService,
    MarketingAiApprovalService,
    MarketingAiVersionService,
    MarketingAiExportService,
    MarketingAiDashboardService,
    MarketingAiOptimizeService,
    MarketingAiKpiAlertService,
    MarketingAiKpiClosedLoopService,
    MarketingAiWeeklyMemoService,
    MarketingAiMultiAgentService,
    MarketingAiJobWorkerService,
    MarketingAiStrategyScenarioService,
    MarketingAiSectionCommentService,
    MarketingAiPlannerService,
    StaffMarketingAiPlannerViewGuard,
    StaffMarketingAiPlannerGenerateGuard,
    StaffMarketingAiPlannerExportGuard,
    StaffMarketingAiPlannerApproveGuard,
  ],
  exports: [MarketingAiPlannerService, MarketingAiPlannerRepository, MarketingAiPlaybookModule],
})
export class MarketingAiPlannerModule {}
