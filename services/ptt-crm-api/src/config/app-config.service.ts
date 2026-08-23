import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { isSqliteDisabled } from '../common/sqlite-guard.util';
import { parseCinematicDailyCap } from '../video-sop/video-sop-flags';

export type LeadsReadSource = 'sqlite' | 'pg';
export type LeadsCreateIdMode = 'staging' | 'prod';
export type PortalAuthMode = 'nest-jwt' | 'keycloak' | 'dual';
export type StaffAuthMode = 'nest' | 'keycloak' | 'dual';

export interface PortalStubUser {
  email: string;
  password: string;
  clientId: string;
  role: 'viewer' | 'approver';
}

export interface StaffStubUser {
  email: string;
  password: string;
  staffId: string;
  positionId: number;
  displayName: string;
}

@Injectable()
export class AppConfigService {
  readonly port: number;
  readonly sqlitePath: string;
  readonly sqliteDisabled: boolean;
  readonly databaseUrl: string;
  readonly leadsReadSource: LeadsReadSource;
  readonly internalKey: string | null;
  readonly authDisabled: boolean;
  readonly leadsWriteEnabled: boolean;
  readonly leadsCreateIdMode: LeadsCreateIdMode;
  readonly portalJwtSecret: string;
  readonly portalJwtTtlSec: number;
  readonly portalRefreshTtlSec: number;
  readonly portalEmailNotifyEnabled: boolean;
  readonly portalEmailWebhookUrl: string | null;
  readonly portalNotifyWebhookUrl: string | null;
  readonly coachDigestEmailEnabled: boolean;
  readonly coachDigestRecipients: string[];
  readonly portalClientNotifyEnabled: boolean;
  readonly portalPublicUrl: string;
  readonly portalResetTtlMin: number;
  readonly portalStubUsers: PortalStubUser[];
  readonly portalCorsOrigins: string[];
  readonly opsCorsOrigins: string[];
  readonly portalAuthMode: PortalAuthMode;
  readonly portalAllowStubUsers: boolean;
  readonly staffJwtSecret: string;
  readonly staffJwtTtlSec: number;
  readonly staffRefreshTtlSec: number;
  readonly staffStubUsers: StaffStubUser[];
  readonly staffAllowStubUsers: boolean;
  readonly staffAuthMode: StaffAuthMode;
  readonly staffKeycloakIssuer: string | null;
  /** Server-side OIDC fetch base (token/JWKS); defaults to issuer when unset. */
  readonly staffKeycloakFetchIssuer: string | null;
  readonly staffKeycloakAudience: string;
  readonly staffKeycloakClientId: string;
  readonly staffMfaRequiredPositionCodes: string[];
  readonly staffScopePilotEnabled: boolean;
  readonly staffPolicyOpaEnabled: boolean;
  readonly adminMatrixApprovalRequired: boolean;
  readonly flaskMonolithUrl: string;
  readonly jobsEnabled: boolean;
  readonly webhookEnqueueEnabled: boolean;
  readonly webhooksNestEnabled: boolean;
  readonly webhooksNestMetaEnabled: boolean;
  readonly webhooksNestZaloEnabled: boolean;
  readonly webhooksNestGoogleEnabled: boolean;
  readonly webhooksNestEmailEnabled: boolean;
  readonly webhooksFlaskFallback: boolean;
  readonly emailSendEnabled: boolean;
  readonly keycloakIssuer: string | null;
  readonly keycloakAudience: string;
  readonly keycloakClientIdClaim: string;
  readonly temporalAddress: string | null;
  readonly temporalNamespace: string;
  readonly temporalTaskQueue: string;
  readonly crmLeadsFunnelNest: boolean;
  readonly crmLeadsFunnelPg: boolean;
  readonly crmIntakePg: boolean;
  readonly crmContractPg: boolean;
  readonly crmStaffPg: boolean;
  readonly crmPayrollPg: boolean;
  readonly crmKpiPg: boolean;
  readonly crmLeadsLegacyPg: boolean;
  readonly crmServiceLifecyclePg: boolean;
  readonly crmFinancePg: boolean;
  readonly crmSvcFinancePg: boolean;
  readonly crmSopPg: boolean;
  readonly crmCustomersPg: boolean;
  readonly crmCasesPg: boolean;
  readonly crmTicketsPg: boolean;
  readonly crmProposalsPg: boolean;
  readonly crmMarketingPlansPg: boolean;
  readonly crmConfigPg: boolean;
  readonly presalesOnLead: boolean;
  readonly b2bProjectOs: boolean;
  readonly b2bCpaas: string;
  readonly b2bSse: boolean;
  readonly b2bPush: boolean;
  readonly b2bAdsCapi: boolean;
  readonly stringeeApiKeySid: string;
  readonly stringeeApiKeySecret: string;
  readonly stringeeFromNumber: string;
  readonly dealRoomEnabled: boolean;
  readonly dealRoomPackPdf: boolean;
  readonly dealRoomGateStrict: boolean;
  readonly dealRoomPortalTeaser: boolean;
  readonly dealRoomTeaserTtlDays: number;
  readonly leadMeetingPrepEnabled: boolean;
  readonly marketResearchEnabled: boolean;
  readonly hrEmployeeFileEnabled: boolean;
  readonly maxTavilyCreditsPerResearch: number;
  readonly researchDeepProvider: string;
  readonly researchDeepTimeoutSec: number;
  readonly researchSparktoroEnabled: boolean;
  readonly sparktoroApiKey: string;
  readonly researchQualtricsEnabled: boolean;
  readonly qualtricsApiKey: string;
  readonly qualtricsDatacenter: string;
  readonly researchTalkwalkerEnabled: boolean;
  readonly talkwalkerAccessToken: string;
  readonly talkwalkerProjectId: string;
  readonly researchRagEnabled: boolean;
  readonly researchRagOpenaiEmbedEnabled: boolean;
  readonly researchRagPgvectorEnabled: boolean;
  readonly lmpPilotOnly: boolean;
  readonly lmpPilotClientIds: string[];
  readonly presalesBatchUpgradeEnabled: boolean;
  readonly crmServiceDeliveryNest: boolean;
  readonly sopAutoStartOnLaunch: boolean;
  readonly sopOverdueEscalate: boolean;
  readonly launchQaAutoStartOnDeliver: boolean;
  readonly financeGateStrict: boolean;
  readonly onboardAutoAdvanceLifecycle: boolean;
  readonly portalPushEnabled: boolean;
  readonly portalVapidPublicKey: string | null;
  readonly portalVapidPrivateKey: string | null;
  readonly portalVapidSubject: string;
  readonly portalPushTestInProd: boolean;
  readonly mobileNativePushEnabled: boolean;
  readonly fcmServerKey: string | null;
  readonly mobileMinVersion: string;
  readonly mobileForceUpdate: boolean;
  readonly mktAiPlannerEnabled: boolean;
  readonly mktAiRagEnabled: boolean;
  readonly mktAiApprovalRequired: boolean;
  readonly mktAiApproverNotifyUserIds: string[];
  readonly mktAiModel: string;
  readonly mktAiPlannerSlugs: string[];
  readonly mktAiKpiAlertEnabled: boolean;
  readonly mktAiKpiAlertCplPct: number;
  readonly mktAiKpiAlertRoasPct: number;
  readonly mktAiKpiAlertCooldownDays: number;
  readonly mktAiPlaybooksEnabled: boolean;
  readonly mktAiLaunchQaQualityGate: boolean;
  readonly mktAiGovernanceBanner: boolean;
  readonly mktAiMultiAgentEnabled: boolean;
  readonly mktAiPlanDepthEnabled: boolean;
  readonly mktAiBriefUploadEnabled: boolean;
  readonly mktAiMultiAgentAsync: boolean;
  readonly mktAiScenarioCompare: boolean;
  readonly mktAiSectionComments: boolean;
  readonly mktAiExportPptx: boolean;
  readonly mktAiPortalSummaryEnabled: boolean;
  readonly mktAiKpiClosedLoopEnabled: boolean;
  readonly mktAiWeeklyMemoCron: string;
  readonly mktAiPilotOnlyEnabled: boolean;
  readonly mktAiPilotServiceSlugs: string[];
  readonly mktAiAutoCustomerEmailEnabled: boolean;
  readonly contentMarketingEnabled: boolean;
  readonly bdsPackEnabled: boolean;
  readonly bdsPgEnabled: boolean;
  readonly bdsProjectOsEnabled: boolean;
  readonly bdsHoldTtlEnabled: boolean;
  readonly bdsPolicyEnabled: boolean;
  readonly bdsTxEnabled: boolean;
  readonly bdsAgencyEnabled: boolean;
  readonly bdsCollectionEnabled: boolean;
  readonly bdsBuyerEnabled: boolean;
  readonly bdsCommissionEnabled: boolean;
  readonly bdsCapiEnabled: boolean;
  readonly bdsUiEnabled: boolean;
  readonly bdsAftersalesEnabled: boolean;
  readonly bdsLaunchEnabled: boolean;
  readonly staffChatEnabled: boolean;
  readonly staffTicketsEnabled: boolean;
  readonly contentMarketingFeEnabled: boolean;
  readonly contentMarketingAiEnabled: boolean;
  readonly contentMarketingApprovalRequired: boolean;
  readonly contentMarketingMediaEnabled: boolean;
  readonly contentMarketingImageGenEnabled: boolean;
  readonly contentMarketingMediaDailyCap: number;
  readonly contentMarketingMediaAsync: boolean;
  readonly contentMarketingImageProvider: string;
  readonly contentMarketingImageModel: string;
  readonly contentMarketingCdnBase: string;
  readonly contentMarketingS3Bucket: string;
  readonly replicateApiToken: string;
  readonly awsAccessKeyId: string;
  readonly awsSecretAccessKey: string;
  readonly awsRegion: string;
  readonly contentMarketingClientGate: boolean;
  readonly contentMarketingVideoGenEnabled: boolean;
  readonly contentMarketingVideoSocialEnabled: boolean;
  readonly contentMarketingVideoSocialDailyCap: number;
  readonly contentMarketingVideoCinematicEnabled: boolean;
  readonly contentMarketingVideoCinematicDailyCap: number;
  readonly contentMarketingVideoOneShot: boolean;
  readonly contentMarketingVideoMusic: boolean;
  readonly contentMarketingFfmpegBin: string;
  readonly contentMarketingPortalSummaryEnabled: boolean;
  readonly contentMarketingVideoProvider: string;
  readonly contentMarketingTtsProvider: string;
  readonly contentMarketingTtsVoice: string;
  readonly contentMarketingStockProvider: string;
  readonly contentMarketingStockApiKey: string;
  readonly contentMarketingSlugs: string[];
  readonly contentMarketingWeeklyMemoEnabled: boolean;
  readonly contentMarketingWeeklyMemoCron: string;
  readonly contentMarketingExternalMetricsEnabled: boolean;
  readonly contentMarketingBriefGateEnabled: boolean;
  readonly contentMarketingPiiConsentDefault: boolean;
  readonly opsDvEnabled: boolean;
  readonly opsWeeklySpawnEnabled: boolean;
  readonly opsSpawnOnDeliverEnabled: boolean;
  readonly opsHubPilotDv: Set<string>;
  readonly opsRouteMapPath: string;
  readonly opsAgentEnabled: boolean;
  readonly opsPortalSummaryEnabled: boolean;
  readonly gtmIpSalt: string;
  readonly gtmSalesUserIds: string[];
  readonly gtmCorsOrigins: string[];
  readonly cmsS3Bucket: string;
  readonly cmsS3Region: string;
  readonly cmsS3AccessKey: string;
  readonly cmsS3SecretKey: string;
  readonly cmsPublicBase: string;
  readonly cmsRevalidateUrl: string | null;
  readonly cmsRevalidateSecret: string | null;

  constructor() {
    this.applyRuntimeEnvOverrides();
    this.port = Number(process.env.PORT ?? process.env.CRM_API_PORT ?? 3000);
    this.sqlitePath = this.resolveSqlitePath();
    this.sqliteDisabled = isSqliteDisabled();
    this.databaseUrl = (
      process.env.DATABASE_URL ??
      process.env.PTT_DATABASE_URL ??
      'postgresql://ptt:ptt_dev@127.0.0.1:5432/ptt_agency'
    ).trim();
    this.leadsReadSource = this.resolveLeadsReadSource();
    this.internalKey = (process.env.PTT_CRM_INTERNAL_KEY ?? '').trim() || null;
    this.authDisabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CRM_API_AUTH_DISABLED ?? '0').trim().toLowerCase(),
    );
    this.leadsWriteEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_LEADS_WRITE_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.leadsCreateIdMode = this.resolveLeadsCreateIdMode();
    this.portalJwtSecret = (
      process.env.PTT_PORTAL_JWT_SECRET ??
      process.env.PTT_CRM_INTERNAL_KEY ??
      'dev-portal-jwt-change-me'
    ).trim();
    this.portalJwtTtlSec = Math.max(
      300,
      Number(process.env.PTT_PORTAL_JWT_TTL_SEC ?? 28800) || 28800,
    );
    this.portalRefreshTtlSec = Math.max(
      3600,
      Number(process.env.PTT_PORTAL_REFRESH_TTL_SEC ?? 2592000) || 2592000,
    );
    this.portalEmailNotifyEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_PORTAL_EMAIL_NOTIFY ?? '0').trim().toLowerCase(),
    );
    this.portalEmailWebhookUrl = (process.env.PTT_PORTAL_EMAIL_WEBHOOK_URL ?? '').trim() || null;
    this.portalNotifyWebhookUrl =
      (process.env.PTT_PORTAL_NOTIFY_WEBHOOK ?? process.env.PTT_PORTAL_EMAIL_WEBHOOK_URL ?? '').trim() ||
      null;
    this.coachDigestEmailEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_COACH_DIGEST_EMAIL_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.coachDigestRecipients = (process.env.PTT_COACH_DIGEST_RECIPIENTS ?? '')
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);
    this.portalClientNotifyEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_PORTAL_CLIENT_NOTIFY ?? '1').trim().toLowerCase(),
    );
    this.portalPublicUrl = (
      process.env.PTT_PORTAL_PUBLIC_URL ??
      process.env.NEXT_PUBLIC_PORTAL_URL ??
      'https://portal.pttads.vn'
    )
      .trim()
      .replace(/\/$/, '');
    this.portalResetTtlMin = Math.max(
      15,
      Math.min(24 * 60, Number(process.env.PTT_PORTAL_RESET_TTL_MIN ?? 60) || 60),
    );
    this.portalStubUsers = this.parsePortalStubUsers();
    this.portalCorsOrigins = this.parsePortalCorsOrigins();
    this.opsCorsOrigins = this.parseOpsCorsOrigins();
    this.portalAuthMode = this.resolvePortalAuthMode();
    this.portalAllowStubUsers = this.resolvePortalAllowStubUsers();
    this.staffJwtSecret = (
      process.env.PTT_STAFF_JWT_SECRET ??
      process.env.PTT_CRM_INTERNAL_KEY ??
      'dev-staff-jwt-change-me'
    ).trim();
    this.staffJwtTtlSec = Math.max(
      300,
      Number(process.env.PTT_STAFF_JWT_TTL_SEC ?? 28800) || 28800,
    );
    this.staffRefreshTtlSec = Math.max(
      3600,
      Number(process.env.PTT_STAFF_REFRESH_TTL_SEC ?? 604800) || 604800,
    );
    this.staffStubUsers = this.parseStaffStubUsers();
    this.staffAllowStubUsers = this.resolveStaffAllowStubUsers();
    this.staffAuthMode = this.resolveStaffAuthMode();
    this.staffKeycloakIssuer = (process.env.PTT_STAFF_KEYCLOAK_ISSUER ?? '').trim() || null;
    this.staffKeycloakFetchIssuer =
      (process.env.PTT_STAFF_KEYCLOAK_FETCH_ISSUER ?? '').trim() ||
      this.staffKeycloakIssuer;
    this.staffKeycloakAudience = (
      process.env.PTT_STAFF_KEYCLOAK_AUDIENCE ?? 'ptt-ops-web'
    ).trim();
    this.staffKeycloakClientId = (
      process.env.PTT_STAFF_KEYCLOAK_CLIENT_ID ?? 'ptt-ops-web'
    ).trim();
    this.staffMfaRequiredPositionCodes = (process.env.STAFF_MFA_REQUIRED_POSITIONS ?? 'gdkd,super-admin')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.staffScopePilotEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.STAFF_SCOPE_PILOT ?? '0').trim().toLowerCase(),
    );
    this.staffPolicyOpaEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.STAFF_POLICY_OPA ?? '0').trim().toLowerCase(),
    );
    this.adminMatrixApprovalRequired = ['1', 'true', 'yes', 'on'].includes(
      (process.env.ADMIN_MATRIX_APPROVAL_REQUIRED ?? '0').trim().toLowerCase(),
    );
    this.flaskMonolithUrl = (process.env.PTT_FLASK_MONOLITH_URL ?? '').trim();
    this.jobsEnabled = this.resolveJobsEnabled();
    this.webhookEnqueueEnabled = this.resolveWebhookEnqueueEnabled();
    this.webhooksNestEnabled = this.resolveWebhooksNestEnabled();
    this.webhooksNestMetaEnabled = this.resolveWebhooksNestMetaEnabled();
    this.webhooksNestZaloEnabled = this.resolveWebhooksNestZaloEnabled();
    this.webhooksNestGoogleEnabled = this.resolveWebhooksNestGoogleEnabled();
    this.webhooksNestEmailEnabled = this.resolveWebhooksNestEmailEnabled();
    this.webhooksFlaskFallback = this.resolveWebhooksFlaskFallback();
    this.emailSendEnabled = this.resolveEmailSendEnabled();
    this.keycloakIssuer = (process.env.PTT_KEYCLOAK_ISSUER ?? '').trim() || null;
    this.keycloakAudience = (process.env.PTT_KEYCLOAK_AUDIENCE ?? 'ptt-portal').trim();
    this.keycloakClientIdClaim = (process.env.PTT_KEYCLOAK_CLIENT_ID_CLAIM ?? 'client_id').trim();
    this.temporalAddress = (process.env.PTT_TEMPORAL_ADDRESS ?? '').trim() || null;
    this.temporalNamespace = (process.env.PTT_TEMPORAL_NAMESPACE ?? 'default').trim();
    this.temporalTaskQueue = (process.env.PTT_TEMPORAL_TASK_QUEUE ?? 'ptt-agency').trim();
    this.crmLeadsFunnelNest = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CRM_LEADS_FUNNEL_NEST ?? '1').trim().toLowerCase(),
    );
    this.crmLeadsFunnelPg = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CRM_LEADS_FUNNEL_PG ?? '1').trim().toLowerCase(),
    );
    this.crmIntakePg = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CRM_INTAKE_PG ?? process.env.PTT_CRM_LEADS_FUNNEL_PG ?? '1').trim().toLowerCase(),
    );
    this.crmContractPg = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CRM_CONTRACT_PG ?? process.env.PTT_CRM_LEADS_FUNNEL_PG ?? '1').trim().toLowerCase(),
    );
    this.crmStaffPg = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CRM_STAFF_PG ?? process.env.PTT_CRM_LEADS_FUNNEL_PG ?? '1').trim().toLowerCase(),
    );
    this.crmPayrollPg =
      isSqliteDisabled() ||
      ['1', 'true', 'yes', 'on'].includes(
        (process.env.PTT_CRM_PAYROLL_PG ?? '0').trim().toLowerCase(),
      );
    this.crmKpiPg = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CRM_KPI_PG ?? process.env.PTT_CRM_LEADS_FUNNEL_PG ?? '1').trim().toLowerCase(),
    );
    this.crmLeadsLegacyPg = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CRM_LEADS_LEGACY_PG ?? process.env.PTT_CRM_LEADS_FUNNEL_PG ?? '1').trim().toLowerCase(),
    );
    this.crmServiceLifecyclePg = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CRM_SERVICE_LIFECYCLE_PG ?? process.env.PTT_CRM_LEADS_FUNNEL_PG ?? '1').trim().toLowerCase(),
    );
    this.crmFinancePg = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CRM_FINANCE_PG ?? process.env.PTT_CRM_LEADS_FUNNEL_PG ?? '1').trim().toLowerCase(),
    );
    this.crmSvcFinancePg = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CRM_SVC_FINANCE_PG ?? process.env.PTT_CRM_FINANCE_PG ?? process.env.PTT_CRM_LEADS_FUNNEL_PG ?? '1')
        .trim()
        .toLowerCase(),
    );
    this.crmSopPg = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CRM_SOP_PG ?? process.env.PTT_CRM_LEADS_FUNNEL_PG ?? '1').trim().toLowerCase(),
    );
    this.crmCustomersPg = this.resolveCrmModulePg('PTT_CRM_CUSTOMERS_PG');
    this.crmCasesPg = this.resolveCrmModulePg('PTT_CRM_CASES_PG');
    this.crmTicketsPg = this.resolveCrmModulePg('PTT_CRM_TICKETS_PG');
    this.crmProposalsPg = this.resolveCrmModulePg('PTT_CRM_PROPOSALS_PG');
    this.crmMarketingPlansPg = this.resolveCrmModulePg('PTT_CRM_MARKETING_PLANS_PG');
    this.crmConfigPg = this.resolveCrmModulePg('PTT_CRM_CONFIG_PG');
    this.presalesOnLead = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_PRESALES_ON_LEAD ?? '1').trim().toLowerCase(),
    );
    this.b2bProjectOs = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_B2B_PROJECT_OS ?? '0').trim().toLowerCase(),
    );
    this.b2bCpaas = (process.env.PTT_B2B_CPAAS ?? 'mock').trim().toLowerCase();
    this.b2bSse = !['0', 'false', 'no', 'off'].includes(
      (process.env.PTT_B2B_SSE ?? '1').trim().toLowerCase(),
    );
    this.b2bPush = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_B2B_PUSH ?? '0').trim().toLowerCase(),
    );
    this.b2bAdsCapi = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_B2B_ADS_CAPI ?? '0').trim().toLowerCase(),
    );
    this.stringeeApiKeySid = (process.env.PTT_STRINGEE_API_KEY_SID ?? '').trim();
    this.stringeeApiKeySecret = (process.env.PTT_STRINGEE_API_KEY_SECRET ?? '').trim();
    this.stringeeFromNumber = (process.env.PTT_STRINGEE_FROM_NUMBER ?? '').trim();
    this.dealRoomEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_DEAL_ROOM_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.dealRoomPackPdf = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_DEAL_ROOM_PACK_PDF ?? '0').trim().toLowerCase(),
    );
    this.dealRoomGateStrict = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_DEAL_ROOM_GATE_STRICT ?? '0').trim().toLowerCase(),
    );
    this.dealRoomPortalTeaser = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_DEAL_ROOM_PORTAL_TEASER ?? '0').trim().toLowerCase(),
    );
    this.dealRoomTeaserTtlDays = Math.max(
      1,
      Number((process.env.PTT_DEAL_ROOM_TEASER_TTL_DAYS ?? '14').trim()) || 14,
    );
    this.leadMeetingPrepEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_LEAD_MEETING_PREP_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.marketResearchEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MARKET_RESEARCH_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.hrEmployeeFileEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_HR_EMPLOYEE_FILE ?? '0').trim().toLowerCase(),
    );
    this.maxTavilyCreditsPerResearch = Math.max(
      1,
      Number((process.env.MAX_TAVILY_CREDITS_PER_RESEARCH ?? '12').trim()) || 12,
    );
    this.researchDeepProvider = (process.env.RESEARCH_DEEP_PROVIDER ?? 'openai').trim().toLowerCase();
    this.researchDeepTimeoutSec = Math.max(
      60,
      Number((process.env.RESEARCH_DEEP_TIMEOUT_SEC ?? '900').trim()) || 900,
    );
    this.researchSparktoroEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.RESEARCH_SPARKTORO_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.sparktoroApiKey = (process.env.SPARKTORO_API_KEY ?? '').trim();
    this.researchQualtricsEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.RESEARCH_QUALTRICS_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.qualtricsApiKey = (process.env.QUALTRICS_API_KEY ?? '').trim();
    this.qualtricsDatacenter = (process.env.QUALTRICS_DATACENTER ?? '').trim();
    this.researchTalkwalkerEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.RESEARCH_TALKWALKER_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.talkwalkerAccessToken = (process.env.TALKWALKER_ACCESS_TOKEN ?? '').trim();
    this.talkwalkerProjectId = (process.env.TALKWALKER_PROJECT_ID ?? '').trim();
    this.researchRagEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.RESEARCH_RAG_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.researchRagOpenaiEmbedEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.RESEARCH_RAG_OPENAI_EMBED_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.researchRagPgvectorEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.RESEARCH_RAG_PGVECTOR_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.lmpPilotOnly = !['0', 'false', 'no', 'off'].includes(
      (process.env.PTT_LMP_PILOT_ONLY ?? '1').trim().toLowerCase(),
    );
    this.lmpPilotClientIds = (process.env.PTT_LMP_PILOT_CLIENT_IDS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    this.presalesBatchUpgradeEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_PRESALES_BATCH_UPGRADE ?? '0').trim().toLowerCase(),
    );
    this.crmServiceDeliveryNest = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CRM_SERVICE_DELIVERY_NEST ?? '0').trim().toLowerCase(),
    );
    this.sopAutoStartOnLaunch = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_SOP_AUTO_START_ON_LAUNCH ?? '0').trim().toLowerCase(),
    );
    this.sopOverdueEscalate = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_SOP_OVERDUE_ESCALATE ?? '0').trim().toLowerCase(),
    );
    this.launchQaAutoStartOnDeliver = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_LAUNCH_QA_AUTO_START_ON_DELIVER ?? '0').trim().toLowerCase(),
    );
    this.financeGateStrict = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_FINANCE_GATE_STRICT ?? '0').trim().toLowerCase(),
    );
    this.onboardAutoAdvanceLifecycle = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_ONBOARD_AUTO_ADVANCE_LIFECYCLE ?? '0').trim().toLowerCase(),
    );

    this.portalPushEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_PORTAL_PUSH_ENABLED ?? '1').trim().toLowerCase(),
    );
    this.portalVapidPublicKey = (process.env.PTT_PORTAL_VAPID_PUBLIC_KEY ?? '').trim() || null;
    this.portalVapidPrivateKey = (process.env.PTT_PORTAL_VAPID_PRIVATE_KEY ?? '').trim() || null;
    this.portalVapidSubject =
      (process.env.PTT_PORTAL_VAPID_SUBJECT ?? 'mailto:portal-push@pttads.vn').trim() ||
      'mailto:portal-push@pttads.vn';
    this.portalPushTestInProd = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_PORTAL_PUSH_TEST_IN_PROD ?? '0').trim().toLowerCase(),
    );

    this.mobileNativePushEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MOBILE_NATIVE_PUSH_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.fcmServerKey = (process.env.PTT_FCM_SERVER_KEY ?? '').trim() || null;
    this.mobileMinVersion = (process.env.PTT_MOBILE_MIN_VERSION ?? '0.1.0').trim() || '0.1.0';
    this.mobileForceUpdate = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MOBILE_FORCE_UPDATE ?? '0').trim().toLowerCase(),
    );

    this.mktAiPlannerEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_PLANNER_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.mktAiRagEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_RAG_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.mktAiApprovalRequired = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_APPROVAL_REQUIRED ?? '0').trim().toLowerCase(),
    );
    this.mktAiApproverNotifyUserIds = (process.env.PTT_MKT_AI_APPROVER_NOTIFY_USER_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.mktAiModel = (process.env.PTT_MKT_AI_MODEL ?? '').trim();
    this.mktAiPlannerSlugs = (process.env.PTT_MKT_AI_PLANNER_SLUGS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.mktAiKpiAlertEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_KPI_ALERT_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.mktAiKpiAlertCplPct = Math.max(
      1,
      Number(process.env.PTT_MKT_AI_KPI_ALERT_CPL_PCT ?? 15) || 15,
    );
    this.mktAiKpiAlertRoasPct = Math.max(
      1,
      Number(process.env.PTT_MKT_AI_KPI_ALERT_ROAS_PCT ?? 20) || 20,
    );
    this.mktAiKpiAlertCooldownDays = Math.max(
      1,
      Number(process.env.PTT_MKT_AI_KPI_ALERT_COOLDOWN_DAYS ?? 7) || 7,
    );
    this.mktAiPlaybooksEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_PLAYBOOKS_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.mktAiLaunchQaQualityGate = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_LAUNCH_QA_QUALITY_GATE ?? '0').trim().toLowerCase(),
    );
    this.mktAiGovernanceBanner = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_GOVERNANCE_BANNER ?? '0').trim().toLowerCase(),
    );
    this.mktAiMultiAgentEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_MULTI_AGENT_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.mktAiPlanDepthEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_PLAN_DEPTH_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.mktAiBriefUploadEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_BRIEF_UPLOAD_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.mktAiMultiAgentAsync = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_MULTI_AGENT_ASYNC ?? '0').trim().toLowerCase(),
    );
    this.mktAiScenarioCompare = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_SCENARIO_COMPARE ?? '0').trim().toLowerCase(),
    );
    this.mktAiSectionComments = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_SECTION_COMMENTS ?? '0').trim().toLowerCase(),
    );
    this.mktAiExportPptx = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_EXPORT_PPTX ?? '0').trim().toLowerCase(),
    );
    this.mktAiPortalSummaryEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_PORTAL_SUMMARY ?? '0').trim().toLowerCase(),
    );
    this.mktAiKpiClosedLoopEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_KPI_CLOSED_LOOP ?? '0').trim().toLowerCase(),
    );
    this.mktAiWeeklyMemoCron = (process.env.PTT_MKT_AI_WEEKLY_MEMO_CRON ?? '0 9 * * 1').trim();
    this.mktAiPilotOnlyEnabled = !['0', 'false', 'no', 'off'].includes(
      (process.env.PTT_MKT_AI_PILOT_ONLY ?? '1').trim().toLowerCase(),
    );
    this.mktAiPilotServiceSlugs = (process.env.PTT_MKT_AI_PILOT_SLUGS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!this.mktAiPilotServiceSlugs.length) {
      this.mktAiPilotServiceSlugs = [
        'tiep-thi-noi-dung',
        'quang-cao-facebook',
        'quang-cao-google',
        'lead-gen',
        'thue-tai-khoan-quang-cao',
        'dich-vu-seo-tong-the',
        'dich-vu-seo-local',
        'dich-vu-seo-audit',
        'dich-vu-aeo',
        'email-sms-zalo-marketing',
        'meta-lead-gen',
        'bds-lead-gen',
        'seo-retainer',
      ];
    }
    this.mktAiAutoCustomerEmailEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_MKT_AI_AUTO_CUSTOMER_EMAIL ?? '0').trim().toLowerCase(),
    );
    this.contentMarketingEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CONTENT_MARKETING_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.bdsPackEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_BDS_PACK ?? '0').trim().toLowerCase(),
    );
    this.bdsPgEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_BDS_PG ?? '0').trim().toLowerCase(),
    );
    this.bdsProjectOsEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_BDS_PROJECT_OS ?? '0').trim().toLowerCase(),
    );
    this.bdsHoldTtlEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_BDS_HOLD_TTL ?? '0').trim().toLowerCase(),
    );
    this.bdsPolicyEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_BDS_POLICY ?? '0').trim().toLowerCase(),
    );
    this.bdsTxEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_BDS_TX ?? '0').trim().toLowerCase(),
    );
    this.bdsAgencyEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_BDS_AGENCY ?? '0').trim().toLowerCase(),
    );
    this.bdsCollectionEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_BDS_COLLECTION ?? '0').trim().toLowerCase(),
    );
    this.bdsBuyerEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_BDS_BUYER ?? '0').trim().toLowerCase(),
    );
    this.bdsCommissionEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_BDS_COMMISSION ?? '0').trim().toLowerCase(),
    );
    this.bdsCapiEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_BDS_CAPI ?? '0').trim().toLowerCase(),
    );
    this.bdsUiEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_BDS_UI ?? '0').trim().toLowerCase(),
    );
    this.bdsAftersalesEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_BDS_AFTERSALES ?? '0').trim().toLowerCase(),
    );
    this.bdsLaunchEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_BDS_LAUNCH ?? '0').trim().toLowerCase(),
    );
    this.staffChatEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_STAFF_CHAT ?? '0').trim().toLowerCase(),
    );
    this.staffTicketsEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_STAFF_TICKETS ?? '0').trim().toLowerCase(),
    );
    this.contentMarketingFeEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CONTENT_MARKETING_FE ?? '0').trim().toLowerCase(),
    );
    this.contentMarketingAiEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CONTENT_MARKETING_AI_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.contentMarketingApprovalRequired = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CONTENT_MARKETING_APPROVAL_REQUIRED ?? '0').trim().toLowerCase(),
    );
    this.contentMarketingMediaEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CONTENT_MARKETING_MEDIA_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.contentMarketingImageGenEnabled = ['1', 'true', 'yes', 'on'].includes(
      (
        process.env.PTT_CMKT_IMAGE_GEN ??
        process.env.PTT_CONTENT_MARKETING_IMAGE_GEN ??
        '0'
      )
        .trim()
        .toLowerCase(),
    );
    const capRaw = Number(process.env.PTT_CMKT_MEDIA_DAILY_CAP_PER_LIFECYCLE ?? 20);
    this.contentMarketingMediaDailyCap = Number.isFinite(capRaw) && capRaw > 0 ? Math.floor(capRaw) : 20;
    this.contentMarketingMediaAsync = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CMKT_MEDIA_ASYNC ?? '0').trim().toLowerCase(),
    );
    this.contentMarketingImageProvider = (
      process.env.PTT_CMKT_IMAGE_PROVIDER ?? 'stub'
    ).trim() || 'stub';
    this.contentMarketingImageModel = (
      process.env.PTT_CMKT_IMAGE_MODEL ?? 'black-forest-labs/flux-schnell'
    ).trim();
    this.contentMarketingCdnBase = (
      process.env.PTT_CMKT_CDN_BASE ?? 'https://cdn.pttads.vn/cmkt'
    ).trim();
    this.contentMarketingS3Bucket = (process.env.PTT_CMKT_S3_BUCKET ?? '').trim();
    this.replicateApiToken = (process.env.REPLICATE_API_TOKEN ?? '').trim();
    this.awsAccessKeyId = (process.env.AWS_ACCESS_KEY_ID ?? '').trim();
    this.awsSecretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY ?? '').trim();
    this.awsRegion = (process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'ap-southeast-1').trim();
    this.contentMarketingClientGate = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CONTENT_MARKETING_CLIENT_GATE ?? '0').trim().toLowerCase(),
    );
    this.contentMarketingVideoGenEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CMKT_VIDEO_GEN ?? '0').trim().toLowerCase(),
    );
    const videoSocialRaw = process.env.PTT_CMKT_VIDEO_SOCIAL?.trim();
    this.contentMarketingVideoSocialEnabled = ['1', 'true', 'yes', 'on'].includes(
      (videoSocialRaw ?? process.env.PTT_CMKT_VIDEO_GEN ?? '0').trim().toLowerCase(),
    );
    const socialCapRaw = Number(process.env.PTT_CMKT_VIDEO_SOCIAL_DAILY_CAP ?? 3);
    this.contentMarketingVideoSocialDailyCap =
      Number.isFinite(socialCapRaw) && socialCapRaw > 0 ? Math.floor(socialCapRaw) : 3;
    this.contentMarketingVideoCinematicEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CMKT_VIDEO_CINEMATIC ?? '0').trim().toLowerCase(),
    );
    this.contentMarketingVideoCinematicDailyCap = parseCinematicDailyCap(
      process.env.PTT_CMKT_VIDEO_CINEMATIC_DAILY_CAP,
    );
    this.contentMarketingVideoOneShot = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CMKT_VIDEO_ONE_SHOT ?? '1').trim().toLowerCase(),
    );
    this.contentMarketingVideoMusic = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CMKT_VIDEO_MUSIC ?? '1').trim().toLowerCase(),
    );
    this.contentMarketingFfmpegBin = (process.env.PTT_CMKT_FFMPEG_BIN ?? 'ffmpeg').trim() || 'ffmpeg';
    this.contentMarketingPortalSummaryEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CMKT_PORTAL_SUMMARY ?? '0').trim().toLowerCase(),
    );
    this.contentMarketingVideoProvider = (process.env.PTT_CMKT_VIDEO_PROVIDER ?? 'ffmpeg').trim() || 'ffmpeg';
    this.contentMarketingTtsProvider = (process.env.PTT_CMKT_TTS_PROVIDER ?? 'stub').trim() || 'stub';
    this.contentMarketingTtsVoice = (process.env.PTT_CMKT_TTS_VOICE ?? 'alloy').trim() || 'alloy';
    this.contentMarketingStockProvider = (process.env.PTT_CMKT_STOCK_PROVIDER ?? 'stub').trim() || 'stub';
    this.contentMarketingStockApiKey = (process.env.PTT_CMKT_STOCK_API_KEY ?? '').trim();
    this.contentMarketingSlugs = (process.env.PTT_CONTENT_MARKETING_SLUGS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.contentMarketingWeeklyMemoEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CMKT_WEEKLY_MEMO ?? '1').trim().toLowerCase(),
    );
    this.contentMarketingWeeklyMemoCron = (
      process.env.PTT_CMKT_WEEKLY_MEMO_CRON ?? '0 8 * * 1'
    ).trim();
    this.contentMarketingExternalMetricsEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CMKT_EXTERNAL_METRICS ?? '1').trim().toLowerCase(),
    );
    this.contentMarketingBriefGateEnabled = !['0', 'false', 'no', 'off'].includes(
      (process.env.PTT_CMKT_BRIEF_GATE ?? '1').trim().toLowerCase(),
    );
    this.contentMarketingPiiConsentDefault = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_CMKT_PII_CONSENT_DEFAULT ?? '0').trim().toLowerCase(),
    );
    this.opsDvEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_OPS_DV_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.opsWeeklySpawnEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_OPS_WEEKLY_SPAWN ?? '0').trim().toLowerCase(),
    );
    this.opsSpawnOnDeliverEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_OPS_SPAWN_ON_DELIVER ?? '0').trim().toLowerCase(),
    );
    this.opsHubPilotDv = new Set(
      (process.env.PTT_OPS_HUB_PILOT_DV ?? 'DV02,DV05,DV04,DV20')
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    );
    this.opsRouteMapPath =
      process.env.PTT_OPS_ROUTE_MAP_PATH?.trim() ||
      path.join(process.cwd(), 'docs/specs/ops-dv01-dv21-route-map.json');
    this.opsAgentEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_OPS_AGENT_ENABLED ?? '0').trim().toLowerCase(),
    );
    this.opsPortalSummaryEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_OPS_PORTAL_SUMMARY ?? '0').trim().toLowerCase(),
    );
    this.gtmIpSalt = (process.env.GTM_IP_SALT ?? '').trim();
    this.gtmSalesUserIds = (process.env.GTM_SALES_USER_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.gtmCorsOrigins = this.parseGtmCorsOrigins();
    this.cmsS3Bucket = (process.env.GTM_CMS_S3_BUCKET ?? '').trim();
    this.cmsS3Region = (process.env.GTM_CMS_S3_REGION ?? process.env.AWS_REGION ?? 'ap-southeast-1').trim();
    this.cmsS3AccessKey = (process.env.GTM_CMS_S3_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID ?? '').trim();
    this.cmsS3SecretKey = (process.env.GTM_CMS_S3_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? '').trim();
    this.cmsPublicBase = (
      process.env.GTM_CMS_PUBLIC_BASE ?? 'https://cdn.pttcrm.com'
    )
      .trim()
      .replace(/\/$/, '');
    this.cmsRevalidateUrl = (process.env.CMS_REVALIDATE_URL ?? '').trim() || null;
    this.cmsRevalidateSecret = (process.env.CMS_REVALIDATE_SECRET ?? '').trim() || null;
  }

  private parsePortalCorsOrigins(): string[] {
    const raw = (process.env.PTT_PORTAL_CORS_ORIGINS ?? 'http://127.0.0.1:3100,http://localhost:3100')
      .trim();
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private parseOpsCorsOrigins(): string[] {
    const raw = (
      process.env.PTT_OPS_CORS_ORIGINS ?? 'http://127.0.0.1:3200,http://localhost:3200'
    ).trim();
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private parseGtmCorsOrigins(): string[] {
    const raw = (
      process.env.GTM_CORS_ORIGINS ??
      'https://pttcrm.com,https://www.pttcrm.com,http://localhost:3300'
    ).trim();
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private resolveLeadsCreateIdMode(): LeadsCreateIdMode {
    const raw = (process.env.PTT_LEADS_CREATE_ID_MODE ?? 'staging').trim().toLowerCase();
    return raw === 'prod' ? 'prod' : 'staging';
  }

  private parsePortalStubUsers(): PortalStubUser[] {
    const raw = (process.env.PTT_PORTAL_STUB_USERS ?? '').trim();
    if (!raw) {
      return [];
    }
    const out: PortalStubUser[] = [];
    for (const part of raw.split(',')) {
      const seg = part.trim();
      if (!seg) continue;
      const [email, password, clientId, role] = seg.split(':').map((s) => s.trim());
      if (!email || !password || !clientId) continue;
      out.push({
        email: email.toLowerCase(),
        password,
        clientId,
        role: role === 'approver' ? 'approver' : 'viewer',
      });
    }
    return out;
  }

  private resolveSqlitePath(): string {
    const fromEnv = (process.env.PTT_SQLITE_PATH ?? '').trim();
    if (fromEnv) {
      return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
    }
    return path.resolve(__dirname, '..', '..', '..', 'ptt.db');
  }

  private resolveLeadsReadSource(): LeadsReadSource {
    if (isSqliteDisabled()) return 'pg';
    const explicit = (process.env.PTT_LEADS_READ_SOURCE ?? '').trim().toLowerCase();
    if (explicit === 'sqlite' || explicit === 'pg') {
      return explicit;
    }
    return 'pg';
  }

  private resolvePortalAuthMode(): PortalAuthMode {
    const raw = (process.env.PTT_PORTAL_AUTH_MODE ?? 'nest-jwt').trim().toLowerCase();
    if (raw === 'keycloak' || raw === 'dual') {
      return raw;
    }
    return 'nest-jwt';
  }

  private resolvePortalAllowStubUsers(): boolean {
    const explicit = (process.env.PTT_PORTAL_ALLOW_STUB ?? '').trim().toLowerCase();
    if (explicit) {
      return ['1', 'true', 'yes', 'on'].includes(explicit);
    }
    const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
    return nodeEnv !== 'production';
  }

  private parseStaffStubUsers(): StaffStubUser[] {
    const raw = (process.env.PTT_STAFF_STUB_USERS ?? '').trim();
    if (!raw) {
      return [];
    }
    const out: StaffStubUser[] = [];
    for (const part of raw.split(',')) {
      const seg = part.trim();
      if (!seg) continue;
      const [email, password, staffId, positionIdRaw, displayName] = seg
        .split(':')
        .map((s) => s.trim());
      if (!email || !password || !staffId) continue;
      const positionId = Number(positionIdRaw || 1);
      out.push({
        email: email.toLowerCase(),
        password,
        staffId,
        positionId: Number.isFinite(positionId) ? positionId : 1,
        displayName: displayName || email,
      });
    }
    return out;
  }

  private resolveStaffAllowStubUsers(): boolean {
    const explicit = (process.env.PTT_STAFF_ALLOW_STUB ?? '').trim().toLowerCase();
    if (explicit) {
      return ['1', 'true', 'yes', 'on'].includes(explicit);
    }
    const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
    return nodeEnv !== 'production';
  }

  private resolveStaffAuthMode(): StaffAuthMode {
    const raw = (process.env.STAFF_AUTH_MODE ?? 'nest').trim().toLowerCase();
    if (raw === 'keycloak' || raw === 'dual') {
      return raw;
    }
    return 'nest';
  }

  /** VPS/deploy-owned overrides when root .env is not writable by deploy user. */
  private applyRuntimeEnvOverrides(): void {
    // Jest on VPS would otherwise inherit deploy/runtime.env (flag=true) and fail default-off specs.
    if (process.env.JEST_WORKER_ID) {
      return;
    }
    const candidates = [
      path.resolve(process.cwd(), '..', '..', 'deploy', 'runtime.env'),
      path.resolve(__dirname, '..', '..', '..', '..', 'deploy', 'runtime.env'),
    ];
    const overridePath = candidates.find((p) => fs.existsSync(p));
    if (!overridePath) {
      return;
    }
    try {
      const raw = fs.readFileSync(overridePath, 'utf8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim();
        if (key) process.env[key] = val;
      }
    } catch {
      /* ignore unreadable override file */
    }
  }

  staffSsoConfigured(): boolean {
    return Boolean(this.staffKeycloakIssuer);
  }

  staffNestLoginAllowed(): boolean {
    if (this.staffAuthMode === 'keycloak') {
      return false;
    }
    return true;
  }

  private resolveJobsEnabled(): boolean {
    if (['1', 'true', 'yes', 'on'].includes((process.env.PTT_JOBS_DISABLED ?? '0').trim().toLowerCase())) {
      return false;
    }
    return ['1', 'true', 'yes', 'on'].includes((process.env.PTT_JOBS_ENABLED ?? '1').trim().toLowerCase());
  }

  private resolveWebhookEnqueueEnabled(): boolean {
    return ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_WEBHOOK_V1_ENQUEUE ?? '1').trim().toLowerCase(),
    );
  }

  private resolveWebhooksNestEnabled(): boolean {
    return ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_WEBHOOKS_NEST_ENABLED ?? '1').trim().toLowerCase(),
    );
  }

  private resolveWebhooksNestMetaEnabled(): boolean {
    return ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_WEBHOOKS_NEST_META ?? '1').trim().toLowerCase(),
    );
  }

  private resolveWebhooksNestZaloEnabled(): boolean {
    return ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_WEBHOOKS_NEST_ZALO ?? '1').trim().toLowerCase(),
    );
  }

  private resolveWebhooksNestGoogleEnabled(): boolean {
    return ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_WEBHOOKS_NEST_GOOGLE ?? '1').trim().toLowerCase(),
    );
  }

  private resolveWebhooksNestEmailEnabled(): boolean {
    return ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_WEBHOOKS_NEST_EMAIL ?? '1').trim().toLowerCase(),
    );
  }

  private resolveEmailSendEnabled(): boolean {
    return ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_EMAIL_SEND_ENABLED ?? '1').trim().toLowerCase(),
    );
  }

  private resolveWebhooksFlaskFallback(): boolean {
    return ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_WEBHOOKS_FLASK_FALLBACK ?? '0').trim().toLowerCase(),
    );
  }

  sqliteAvailable(): boolean {
    if (this.sqliteDisabled) return false;
    try {
      return fs.existsSync(this.sqlitePath);
    } catch {
      return false;
    }
  }

  private resolveCrmModulePg(envKey: string): boolean {
    if (isSqliteDisabled()) return true;
    return ['1', 'true', 'yes', 'on'].includes(
      (process.env[envKey] ?? '0').trim().toLowerCase(),
    );
  }
}
