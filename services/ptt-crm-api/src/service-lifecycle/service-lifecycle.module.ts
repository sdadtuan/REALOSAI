import { Module, forwardRef } from '@nestjs/common';
import { AgencyModule } from '../agency/agency.module';
import { CampaignWritesModule } from '../campaign-writes/campaign-writes.module';
import { CreativesModule } from '../creatives/creatives.module';
import { IntakeModule } from '../intake/intake.module';
import { LeadsModule } from '../leads/leads.module';
import { OpsModule } from '../ops/ops.module';
import { SopModule } from '../sop/sop.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { SvcFinanceModule } from '../svc-finance/svc-finance.module';
import { TemporalModule } from '../temporal/temporal.module';
import { LaunchQaModule } from '../launch-qa/launch-qa.module';
import { MarketingAiPlaybookModule } from '../marketing-ai-planner/marketing-ai-playbook.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import {
  StaffServiceLifecycleViewGuard,
  StaffServiceLifecycleWriteGuard,
} from './guards/staff-service-lifecycle.guard';
import { LaunchQaAutoStartService } from './launch-qa-auto-start.service';
import { LaunchQaPgRepository } from './launch-qa-pg.repository';
import { LifecycleConsultService } from './lifecycle-consult.service';
import { LifecycleLaunchQaService } from './lifecycle-launch-qa.service';
import { LifecycleFinanceConfirmRepository } from './lifecycle-finance-confirm.repository';
import { LifecycleOnboardingService } from './lifecycle-onboarding.service';
import { LifecycleTasksPgRepository } from './lifecycle-tasks-pg.repository';
import { LifecycleTasksRepository } from './lifecycle-tasks.repository';
import { ServiceLifecycleController } from './service-lifecycle.controller';
import { ServiceLifecyclePgRepository } from './service-lifecycle-pg.repository';
import { ServiceLifecycleSqliteRepository } from './service-lifecycle-sqlite.repository';
import { ServiceLifecycleService } from './service-lifecycle.service';

@Module({
  imports: [
    StaffAuthModule,
    forwardRef(() => LeadsModule),
    forwardRef(() => AgencyModule),
    SvcFinanceModule,
    IntakeModule,
    SopModule,
    CreativesModule,
    CampaignWritesModule,
    TemporalModule,
    WorkflowsModule,
    LaunchQaModule,
    MarketingAiPlaybookModule,
    forwardRef(() => OpsModule),
  ],
  controllers: [ServiceLifecycleController],
  providers: [
    ServiceLifecycleService,
    ServiceLifecycleSqliteRepository,
    ServiceLifecyclePgRepository,
    LifecycleTasksRepository,
    LifecycleTasksPgRepository,
    LifecycleConsultService,
    LifecycleLaunchQaService,
    LifecycleOnboardingService,
    LifecycleFinanceConfirmRepository,
    LaunchQaPgRepository,
    LaunchQaAutoStartService,
    StaffServiceLifecycleViewGuard,
    StaffServiceLifecycleWriteGuard,
  ],
  exports: [ServiceLifecycleService, LifecycleTasksRepository],
})
export class ServiceLifecycleModule {}
