import { Module } from '@nestjs/common';
import { AgencyModule } from './agency/agency.module';
import { ZaloLeadsModule } from './zalo-leads/zalo-leads.module';
import { CasesModule } from './cases/cases.module';
import { CatalogModule } from './catalog/catalog.module';
import { TicketsModule } from './tickets/tickets.module';
import { CrmConfigModule } from './crm-config/crm-config.module';
import { CrmBoardModule } from './crm-board/crm-board.module';
import { CskhBoardModule } from './cskh-board/cskh-board.module';
import { GdkdEnterpriseModule } from './gdkd-enterprise/gdkd-enterprise.module';
import { CrmLeadsLegacyModule } from './crm-leads-legacy/crm-leads-legacy.module';
import { CrmStaffModule } from './crm-staff/crm-staff.module';
import { KpiModule } from './kpi/kpi.module';
import { SalesModule } from './sales/sales.module';
import { CustomersModule } from './customers/customers.module';
import { IntakeModule } from './intake/intake.module';
import { MetaTrackingModule } from './meta-tracking/meta-tracking.module';
import { MetaAlertsModule } from './meta-alerts/meta-alerts.module';
import { AiIntelligenceModule } from './ai-intelligence/ai-intelligence.module';
import { AutomationWorkflowsModule } from './automation-workflows/automation-workflows.module';
import { PlaybooksModule } from './playbooks/playbooks.module';
import { CrmSearchModule } from './crm-search/crm-search.module';
import { CustomerTimelineModule } from './customer-timeline/customer-timeline.module';
import { MetaIntelligenceModule } from './meta-intelligence/meta-intelligence.module';
import { MetaCreativeRegistryModule } from './meta-creative-registry/meta-creative-registry.module';
import { MetaComplianceModule } from './meta-compliance/meta-compliance.module';
import { MetaAdsOpsModule } from './meta-ads-ops/meta-ads-ops.module';
import { ZaloAdsOpsModule } from './zalo-ads-ops/zalo-ads-ops.module';
import { MetricsModule } from './metrics/metrics.module';
import { MarketingAiPlannerModule } from './marketing-ai-planner/marketing-ai-planner.module';
import { ContentMarketingModule } from './content-marketing/content-marketing.module';
import { VideoSopModule } from './video-sop/video-sop.module';
import { OpsModule } from './ops/ops.module';
import { SpcModule } from './spc/spc.module';
import { MarketingPlansModule } from './marketing-plans/marketing-plans.module';
import { ServiceLifecycleModule } from './service-lifecycle/service-lifecycle.module';
import { SvcFinanceModule } from './svc-finance/svc-finance.module';
import { SopModule } from './sop/sop.module';
import { CampaignWritesModule } from './campaign-writes/campaign-writes.module';
import { ChannelReportSchedulesModule } from './channel-report-schedules/channel-report-schedules.module';
import { ConfigModule } from './config/config.module';
import { CreativesModule } from './creatives/creatives.module';
import { FinanceModule } from './finance/finance.module';
import { HealthModule } from './health/health.module';
import { LaunchQaModule } from './launch-qa/launch-qa.module';
import { CrmCreativesModule } from './crm-creatives/crm-creatives.module';
import { CrmCampaignWritesModule } from './crm-campaign-writes/crm-campaign-writes.module';
import { DealRoomModule } from './deal-room/deal-room.module';
import { LeadMeetingPrepModule } from './lead-meeting-prep/lead-meeting-prep.module';
import { MarketResearchModule } from './market-research/market-research.module';
import { LeadsFunnelModule } from './leads-funnel/leads-funnel.module';
import { LeadsContractModule } from './leads-contract/leads-contract.module';
import { LeadsModule } from './leads/leads.module';
import { ObservabilityModule } from './observability/observability.module';
import { PerformanceModule } from './performance/performance.module';
import { PortalEmailModule } from './portal-email/portal-email.module';
import { PortalResearchModule } from './portal-research/portal-research.module';
import { PortalSeoModule } from './portal-seo/portal-seo.module';
import { PortalAiModule } from './portal-ai/portal-ai.module';
import { PortalMktAiModule } from './portal-mkt-ai/portal-mkt-ai.module';
import { PortalContentMarketingModule } from './portal-content-marketing/portal-content-marketing.module';
import { PortalOpsModule } from './portal-ops/portal-ops.module';
import { PortalModule } from './portal/portal.module';
import { OwnerWeeklyModule } from './owner-weekly/owner-weekly.module';
import { PayrollModule } from './payroll/payroll.module';
import { ProposalsModule } from './proposals/proposals.module';
import { OrdersModule } from './orders/orders.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ReProjectsModule } from './re-projects/re-projects.module';
import { BdsModule } from './bds/bds.module';
import { StaffChatModule } from './staff-chat/staff-chat.module';
import { B2bProjectsModule } from './b2b-projects/b2b-projects.module';
import { EmailGateAModule } from './email-gate-a/email-gate-a.module';
import { EmailMarketingModule } from './email-marketing/email-marketing.module';
import { SeoAdminModule } from './seo-admin/seo-admin.module';
import { SeoGateAModule } from './seo-gate-a/seo-gate-a.module';
import { SeoBiModule } from './seo-bi/seo-bi.module';
import { SeoCmsModule } from './seo-cms/seo-cms.module';
import { SeoCronModule } from './seo-cron/seo-cron.module';
import { SeoAeoModule } from './seo-aeo/seo-aeo.module';
import { SeoAuthorityModule } from './seo-authority/seo-authority.module';
import { SeoAutomationsModule } from './seo-automations/seo-automations.module';
import { SeoContentModule } from './seo-content/seo-content.module';
import { SeoExperimentsModule } from './seo-experiments/seo-experiments.module';
import { SeoFreshnessModule } from './seo-freshness/seo-freshness.module';
import { SeoGovernanceModule } from './seo-governance/seo-governance.module';
import { SeoRanksModule } from './seo-ranks/seo-ranks.module';
import { SeoReportsModule } from './seo-reports/seo-reports.module';
import { SeoStrategyModule } from './seo-strategy/seo-strategy.module';
import { SeoTechnicalModule } from './seo-technical/seo-technical.module';
import { StaffAuthModule } from './staff-auth/staff-auth.module';
import { StaffPermissionsModule } from './staff-permissions/staff-permissions.module';
import { StaffClientScopeModule } from './staff-client-scope/staff-client-scope.module';
import { StaffBreakGlassModule } from './staff-break-glass/staff-break-glass.module';
import { PolicyModule } from './policy/policy.module';
import { HrLeaveModule } from './hr-leave/hr-leave.module';
import { HrEmployeeFileModule } from './hr-employee-file/hr-employee-file.module';
import { StaffNotificationsModule } from './staff-notifications/staff-notifications.module';
import { StaffOrgModule } from './staff-org/staff-org.module';
import { AdminAuditModule } from './admin-audit/admin-audit.module';
import { AdminGovernanceModule } from './admin-governance/admin-governance.module';
import { AdminIntelligenceModule } from './admin-intelligence/admin-intelligence.module';
import { StaffPermissionSetsModule } from './staff-permission-sets/staff-permission-sets.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { TemporalModule } from './temporal/temporal.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { GtmModule } from './gtm/gtm.module';
import { GtmCmsModule } from './gtm-cms/cms.module';

@Module({
  imports: [
    ConfigModule,
    ObservabilityModule,
    HealthModule,
    LeadsModule,
    LeadsFunnelModule,
    DealRoomModule,
    LeadMeetingPrepModule,
    MarketResearchModule,
    GtmModule,
    GtmCmsModule,
    LeadsContractModule,
    CatalogModule,
    CrmConfigModule,
    CrmLeadsLegacyModule,
    CustomersModule,
    IntakeModule,
    CasesModule,
    TicketsModule,
    SalesModule,
    KpiModule,
    CrmStaffModule,
    ProposalsModule,
    OrdersModule,
    InvoicesModule,
    PayrollModule,
    HrLeaveModule,
    HrEmployeeFileModule,
    StaffNotificationsModule,
    FinanceModule,
    OwnerWeeklyModule,
    ReProjectsModule,
    BdsModule,
    StaffChatModule,
    B2bProjectsModule,
    MarketingPlansModule,
    MarketingAiPlannerModule,
    ContentMarketingModule,
    VideoSopModule,
    OpsModule,
    SpcModule,
    ServiceLifecycleModule,
    LaunchQaModule,
    CrmCreativesModule,
    CrmCampaignWritesModule,
    SvcFinanceModule,
    CrmBoardModule,
    CskhBoardModule,
    GdkdEnterpriseModule,
    SopModule,
    AgencyModule,
    ZaloLeadsModule,
    PortalModule,
    StaffAuthModule,
    StaffPermissionsModule,
    StaffPermissionSetsModule,
    StaffBreakGlassModule,
    PolicyModule,
    StaffClientScopeModule,
    StaffOrgModule,
    AdminAuditModule,
    AdminGovernanceModule,
    AdminIntelligenceModule,
    WebhooksModule,
    PortalResearchModule,
    PortalSeoModule,
    PortalAiModule,
    PortalMktAiModule,
    PortalContentMarketingModule,
    PortalOpsModule,
    PortalEmailModule,
    SeoAdminModule,
    SeoContentModule,
    SeoTechnicalModule,
    SeoReportsModule,
    SeoGovernanceModule,
    SeoStrategyModule,
    SeoAeoModule,
    SeoAuthorityModule,
    SeoRanksModule,
    SeoAutomationsModule,
    SeoFreshnessModule,
    SeoExperimentsModule,
    SeoBiModule,
    SeoCronModule,
    SeoCmsModule,
    SeoGateAModule,
    EmailMarketingModule,
    EmailGateAModule,
    PerformanceModule,
    MetaTrackingModule,
    MetaAlertsModule,
    AiIntelligenceModule,
    AutomationWorkflowsModule,
    CrmSearchModule,
    PlaybooksModule,
    CustomerTimelineModule,
    MetaIntelligenceModule,
    MetaCreativeRegistryModule,
    MetaComplianceModule,
    MetaAdsOpsModule,
    ZaloAdsOpsModule,
    MetricsModule,
    CreativesModule,
    CampaignWritesModule,
    ChannelReportSchedulesModule,
    TemporalModule,
    WorkflowsModule,
  ],
})
export class AppModule {}
