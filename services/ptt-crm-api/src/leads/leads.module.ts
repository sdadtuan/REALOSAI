import { forwardRef, Module } from '@nestjs/common';
import { AiScoreAsyncModule } from '../ai-intelligence/ai-score-async.module';
import { LeadMeetingPrepAsyncModule } from '../lead-meeting-prep/lead-meeting-prep-async.module';
import { CrmConfigModule } from '../crm-config/crm-config.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomerTimelineModule } from '../customer-timeline/customer-timeline.module';
import { EventsModule } from '../events/events.module';
import { LeadsFunnelModule } from '../leads-funnel/leads-funnel.module';
import { MetaTrackingModule } from '../meta-tracking/meta-tracking.module';
import { PerformanceModule } from '../performance/performance.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffPermissionsModule } from '../staff-permissions/staff-permissions.module';
import { StaffClientScopeModule } from '../staff-client-scope/staff-client-scope.module';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { B2bProjectsModule } from '../b2b-projects/b2b-projects.module';
import { LeadsIoService } from './leads-io.service';
import { LeadAttributionService } from './lead-attribution.service';
import { LeadsController } from './leads.controller';
import { LeadsRepository } from './leads.repository';
import { LeadsService } from './leads.service';
import { LeadsWriteService } from './leads-write.service';
import { PgLeadsRepository } from './pg-leads.repository';
import { PgLeadsWriteRepository } from './pg-leads-write.repository';
import { SqliteLeadsRepository } from './sqlite-leads.repository';
import { StaffLeadsWriteGuard } from './guards/staff-leads-write.guard';
import { StaffLeadsViewGuard } from './guards/staff-leads-view.guard';
import { WriteEnabledGuard } from './guards/write-enabled.guard';
import { LeadAutoAssignService } from './ingest/lead-auto-assign.service';
import { LeadCreateEnrichmentService } from './ingest/lead-create-enrichment.service';
import { LeadDedupRepository } from './ingest/lead-dedup.repository';
import { LeadIngestRulesRepository } from './ingest/lead-ingest-rules.repository';
import { LeadStatusGateService } from './lead-status-gate.service';
import { LeadSlaCareService } from './lead-sla-care.service';
import { ChotClosedLoopService } from './chot-closed-loop.service';
import { CopilotContextService } from './copilot-context.service';
import { SlaAutoTaskService } from './sla-auto-task.service';
import { CrmLeadsLegacyModule } from '../crm-leads-legacy/crm-leads-legacy.module';

@Module({
  imports: [
    EventsModule,
    AiScoreAsyncModule,
    LeadMeetingPrepAsyncModule,
    StaffAuthModule,
    StaffPermissionsModule,
    StaffClientScopeModule,
    CrmConfigModule,
    CatalogModule,
    forwardRef(() => CrmLeadsLegacyModule),
    forwardRef(() => CustomerTimelineModule),
    MetaTrackingModule,
    forwardRef(() => PerformanceModule),
    forwardRef(() => LeadsFunnelModule),
    AdminAuditModule,
    B2bProjectsModule,
  ],
  controllers: [LeadsController],
  providers: [
    LeadsService,
    LeadsWriteService,
    LeadsIoService,
    LeadAttributionService,
    LeadsRepository,
    SqliteLeadsRepository,
    PgLeadsRepository,
    PgLeadsWriteRepository,
    LeadDedupRepository,
    LeadIngestRulesRepository,
    LeadAutoAssignService,
    LeadCreateEnrichmentService,
    LeadStatusGateService,
    LeadSlaCareService,
    ChotClosedLoopService,
    CopilotContextService,
    SlaAutoTaskService,
    WriteEnabledGuard,
    StaffLeadsWriteGuard,
    StaffLeadsViewGuard,
  ],
  exports: [
    LeadsRepository,
    LeadsWriteService,
    LeadAttributionService,
    LeadIngestRulesRepository,
    StaffLeadsViewGuard,
    StaffLeadsWriteGuard,
    LeadSlaCareService,
    ChotClosedLoopService,
    CopilotContextService,
  ],
})
export class LeadsModule {}
