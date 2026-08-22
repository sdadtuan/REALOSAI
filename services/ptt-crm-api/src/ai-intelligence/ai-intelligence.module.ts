import { ConfigModule } from '../config/config.module';
import { Module, forwardRef } from '@nestjs/common';
import { PlaybooksRepository } from '../playbooks/playbooks.repository';
import { CasesModule } from '../cases/cases.module';
import { CskhBoardModule } from '../cskh-board/cskh-board.module';
import { AgencyModule } from '../agency/agency.module';
import { ServiceLifecycleModule } from '../service-lifecycle/service-lifecycle.module';
import { CrmConfigModule } from '../crm-config/crm-config.module';
import { CrmLeadsLegacyModule } from '../crm-leads-legacy/crm-leads-legacy.module';
import { LeadMeetingPrepAsyncModule } from '../lead-meeting-prep/lead-meeting-prep-async.module';
import { CustomerTimelineModule } from '../customer-timeline/customer-timeline.module';
import { EventsModule } from '../events/events.module';
import { LeadsModule } from '../leads/leads.module';
import { B2bProjectsModule } from '../b2b-projects/b2b-projects.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { AiAgentRunsRepository } from './ai-agent-runs.repository';
import { AiAgentRunsService } from './ai-agent-runs.service';
import { AiAuditService } from './ai-audit.service';
import { AiDealScoreService } from './ai-deal-score.service';
import { AiExecutionService } from './ai-execution.service';
import { AiFeedbackAnalyticsService } from './ai-feedback-analytics.service';
import { AiAdoptionAnalyticsService } from './ai-adoption-analytics.service';
import { AiScoreLatencyService } from './ai-score-latency.service';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import { AiIntelligenceController } from './ai-intelligence.controller';
import { AiIntelligenceService } from './ai-intelligence.service';
import { AiLeadScoreService } from './ai-lead-score.service';
import { AiLlmClient } from './ai-llm.client';
import { AiNbaService } from './ai-nba.service';
import { PipelineRiskService } from './pipeline-risk.service';
import { AiForecastService } from './ai-forecast.service';
import { RenewalAgentService } from './renewal-agent.service';
import { UpsellAgentService } from './upsell-agent.service';
import { UpsellContextRepository } from './upsell-context.repository';
import { AiChurnHealthService } from './ai-churn-health.service';
import { ManagerCoachService } from './manager-coach.service';
import { AiNlQueryService } from './ai-nl-query.service';
import { AiTicketSentimentService } from './ai-ticket-sentiment.service';
import { NlQueryContextRepository } from './nl-query-context.repository';
import { TicketsModule } from '../tickets/tickets.module';
import { RevenueForecastRepository } from './revenue-forecast.repository';
import { RenewalContractContextRepository } from './renewal-contract-context.repository';
import { RenewalOpportunitiesRepository } from './renewal-opportunities.repository';
import { ChurnHealthContextRepository } from './churn-health-context.repository';
import { CustomerHealthScoresRepository } from './customer-health-scores.repository';
import { AiInsightsRepository } from './ai-insights.repository';
import { AiPromptsRepository } from './ai-prompts.repository';
import { AiRecommendationService } from './ai-recommendation.service';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { AiScoreFeedbackRepository } from './ai-score-feedback.repository';
import { AiScoreFeedbackService } from './ai-score-feedback.service';
import { AiScoresRepository } from './ai-scores.repository';
import { AiSummarizeRateLimitService } from './ai-summarize-rate-limit.service';
import { AiSummarizeService } from './ai-summarize.service';
import { DealScoreContextRepository } from './deal-score-context.repository';
import { StaffAiAdminGuard } from './guards/staff-ai-admin.guard';
import { StaffAiCopilotGuard } from './guards/staff-ai-copilot.guard';
import { StaffAiDealAccessGuard } from './guards/staff-ai-deal-access.guard';
import { StaffAiLeadAccessGuard } from './guards/staff-ai-lead-access.guard';
import { StaffAiScoreOverrideGuard } from './guards/staff-ai-score-override.guard';
import { StaffAiScoresBatchGuard } from './guards/staff-ai-scores-batch.guard';
import { StaffAiForecastCommitGuard } from './guards/staff-ai-forecast-commit.guard';
import { StaffAiForecastViewGuard } from './guards/staff-ai-forecast-view.guard';
import { StaffAiRenewalViewGuard } from './guards/staff-ai-renewal-view.guard';
import { StaffAiRenewalWriteGuard } from './guards/staff-ai-renewal-write.guard';
import { StaffAiChurnHealthViewGuard } from './guards/staff-ai-churn-health-view.guard';
import { StaffAiCoachViewGuard } from './guards/staff-ai-coach-view.guard';
import { StaffAiNlQueryGuard } from './guards/staff-ai-nl-query.guard';
import { StaffCasesViewGuard } from '../cases/guards/staff-cases.guard';
import { MetaAlertsModule } from '../meta-alerts/meta-alerts.module';
import { ReProjectsModule } from '../re-projects/re-projects.module';
import { AnomalyDigestService } from './anomaly-digest.service';
import { CplAnomalyService } from './cpl-anomaly.service';
import { BudgetRecommendService } from './budget-recommend.service';
import { AiLeadRouteService } from './ai-lead-route.service';
import { LeadRouteContextRepository } from './lead-route-context.repository';
import { LeadScoreContextRepository } from './lead-score-context.repository';
import { AgentRegistry } from './orchestrator/agent.registry';
import { OrchestratorRepository } from './orchestrator/orchestrator.repository';
import { OrchestratorEngine } from './orchestrator/orchestrator.engine';
import { OrchestratorCronService } from './orchestrator/orchestrator-cron.service';
import { OrchestratorService } from './orchestrator/orchestrator.service';
import { StaffAiOrchestratorGuard } from './guards/staff-ai-orchestrator.guard';
import { StaffAiOrchestratorViewGuard } from './guards/staff-ai-orchestrator-view.guard';
import { AiToolApiKeyGuard } from './ai-tools/ai-tool-api-key.guard';
import { AiToolKeysRepository } from './ai-tools/ai-tool-keys.repository';
import { AiToolsController } from './ai-tools/ai-tools.controller';
import { AiToolsService } from './ai-tools/ai-tools.service';
import { ToolRegistry } from './ai-tools/tool.registry';
import { PortalModule } from '../portal/portal.module';
import { CoachDigestDeliveryService } from './coach-digest-delivery.service';
import { StaffAiInsightsViewGuard } from './guards/staff-ai-insights-view.guard';
import { MetaIntelligenceModule } from '../meta-intelligence/meta-intelligence.module';
import { StaffClientScopeModule } from '../staff-client-scope/staff-client-scope.module';

@Module({
  imports: [
    StaffAuthModule,
    ConfigModule,
    forwardRef(() => CustomerTimelineModule),
    EventsModule,
    forwardRef(() => LeadsModule),
    B2bProjectsModule,
    CrmConfigModule,
    CasesModule,
    forwardRef(() => CskhBoardModule),
    TicketsModule,
    MetaAlertsModule,
    ReProjectsModule,
    forwardRef(() => AgencyModule),
    forwardRef(() => ServiceLifecycleModule),
    forwardRef(() => CrmLeadsLegacyModule),
    forwardRef(() => PortalModule),
    MetaIntelligenceModule,
    StaffClientScopeModule,
    LeadMeetingPrepAsyncModule,
  ],
  controllers: [AiIntelligenceController, AiToolsController],
  providers: [
    AiIntelligenceConfigService,
    AiAgentRunsRepository,
    AgentRegistry,
    OrchestratorRepository,
    OrchestratorEngine,
    OrchestratorService,
    OrchestratorCronService,
    AiToolKeysRepository,
    AiToolsService,
    AiToolApiKeyGuard,
    ToolRegistry,
    AiAuditService,
    AiAgentRunsService,
    AiScoresRepository,
    AiScoreFeedbackRepository,
    AiScoreFeedbackService,
    LeadScoreContextRepository,
    DealScoreContextRepository,
    AiLeadScoreService,
    AiDealScoreService,
    AiNbaService,
    PipelineRiskService,
    AiForecastService,
    RenewalAgentService,
    UpsellAgentService,
    UpsellContextRepository,
    AiChurnHealthService,
    ManagerCoachService,
    CoachDigestDeliveryService,
    AiNlQueryService,
    AiTicketSentimentService,
    AnomalyDigestService,
    CplAnomalyService,
    BudgetRecommendService,
    AiLeadRouteService,
    LeadRouteContextRepository,
    NlQueryContextRepository,
    RevenueForecastRepository,
    RenewalContractContextRepository,
    RenewalOpportunitiesRepository,
    ChurnHealthContextRepository,
    CustomerHealthScoresRepository,
    AiInsightsRepository,
    PlaybooksRepository,
    AiSummarizeService,
    AiRecommendationService,
    AiFeedbackAnalyticsService,
    AiAdoptionAnalyticsService,
    AiScoreLatencyService,
    AiRecommendationsRepository,
    AiLlmClient,
    AiPromptsRepository,
    AiSummarizeRateLimitService,
    AiExecutionService,
    AiIntelligenceService,
    StaffAiCopilotGuard,
    StaffAiAdminGuard,
    StaffAiLeadAccessGuard,
    StaffAiDealAccessGuard,
    StaffAiScoreOverrideGuard,
    StaffAiScoresBatchGuard,
    StaffAiForecastCommitGuard,
    StaffAiForecastViewGuard,
    StaffAiRenewalViewGuard,
    StaffAiRenewalWriteGuard,
    StaffAiChurnHealthViewGuard,
    StaffAiCoachViewGuard,
    StaffAiNlQueryGuard,
    StaffAiOrchestratorGuard,
    StaffAiOrchestratorViewGuard,
    StaffAiInsightsViewGuard,
    StaffCasesViewGuard,
  ],
  exports: [
    AiIntelligenceConfigService,
    AiAgentRunsRepository,
    AgentRegistry,
    OrchestratorRepository,
    OrchestratorEngine,
    OrchestratorService,
    OrchestratorCronService,
    AiToolKeysRepository,
    AiToolsService,
    AiToolApiKeyGuard,
    ToolRegistry,
    AiAuditService,
    AiAgentRunsService,
    AiScoresRepository,
    AiScoreFeedbackRepository,
    AiScoreFeedbackService,
    LeadScoreContextRepository,
    DealScoreContextRepository,
    AiLeadScoreService,
    AiDealScoreService,
    AiNbaService,
    PipelineRiskService,
    AiForecastService,
    RenewalAgentService,
    UpsellAgentService,
    UpsellContextRepository,
    AiChurnHealthService,
    ManagerCoachService,
    CoachDigestDeliveryService,
    AiNlQueryService,
    AiTicketSentimentService,
    AnomalyDigestService,
    CplAnomalyService,
    BudgetRecommendService,
    AiLeadRouteService,
    LeadRouteContextRepository,
    NlQueryContextRepository,
    RevenueForecastRepository,
    RenewalContractContextRepository,
    RenewalOpportunitiesRepository,
    ChurnHealthContextRepository,
    CustomerHealthScoresRepository,
    AiInsightsRepository,
    AiSummarizeService,
    AiLlmClient,
    AiRecommendationService,
    AiFeedbackAnalyticsService,
    AiAdoptionAnalyticsService,
    AiScoreLatencyService,
    AiRecommendationsRepository,
    AiExecutionService,
    AiIntelligenceService,
    StaffAiCopilotGuard,
    StaffAiAdminGuard,
    StaffAiLeadAccessGuard,
    StaffAiDealAccessGuard,
    StaffAiScoreOverrideGuard,
    StaffAiScoresBatchGuard,
    StaffAiForecastCommitGuard,
    StaffAiForecastViewGuard,
    StaffAiRenewalViewGuard,
    StaffAiRenewalWriteGuard,
    StaffAiChurnHealthViewGuard,
    StaffAiCoachViewGuard,
    StaffAiNlQueryGuard,
    StaffAiOrchestratorGuard,
    StaffAiOrchestratorViewGuard,
  ],
})
export class AiIntelligenceModule {}
