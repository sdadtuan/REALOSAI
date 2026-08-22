import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { CMKT_P0_CHANNEL_DEFAULTS } from './content-marketing.constants';
import { buildBrandContextJson, computePlannerSourceHash } from './content-plan-snapshot.util';
import { resolvePiiConsent } from './content-pii-consent.util';
import { ContentMarketingRepository } from './content-marketing.repository';
import type { CmktContextPayload } from './content-marketing.types';

@Injectable()
export class ContentMarketingService {
  constructor(
    private readonly config: AppConfigService,
    @Inject(forwardRef(() => ServiceLifecycleService))
    private readonly lifecycle: ServiceLifecycleService,
    private readonly repo: ContentMarketingRepository,
  ) {}

  assertEnabled(serviceSlug?: string): void {
    if (!this.config.contentMarketingEnabled) {
      throw new NotFoundException({ error: 'content_marketing_disabled' });
    }
    const slugs = this.config.contentMarketingSlugs;
    if (slugs.length && serviceSlug && !slugs.includes(serviceSlug)) {
      throw new ForbiddenException({
        error: 'content_marketing_slug_not_pilot',
        service_slug: serviceSlug,
      });
    }
  }

  private async loadLifecycleRow(id: number): Promise<Record<string, unknown>> {
    const detail = await this.lifecycle.detail(id);
    return detail as Record<string, unknown>;
  }

  async ensureLifecycleEnabled(lifecycleId: number): Promise<Record<string, unknown>> {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    return lc;
  }

  /** Client id only — no enabled/slug check, so cross-tenant lookups cannot leak those codes. */
  async getLifecycleClientId(lifecycleId: number): Promise<string> {
    const lcCtx = await this.lifecycle.context(lifecycleId).catch(() => null);
    return String(lcCtx?.contract?.agency_client_id ?? '').trim();
  }

  async getContext(lifecycleId: number): Promise<CmktContextPayload> {
    const lc = await this.ensureLifecycleEnabled(lifecycleId);
    const serviceSlug = String(lc.service_slug ?? '');

    const [snapshotRow, counts, lcCtx] = await Promise.all([
      this.repo.getActiveSnapshotSummary(lifecycleId),
      this.repo.getContextCounts(lifecycleId),
      this.lifecycle.context(lifecycleId).catch(() => null),
    ]);

    const plannerSource = await this.repo.loadPlannerSource(lifecycleId);
    const currentHash = plannerSource ? computePlannerSourceHash(plannerSource) : null;
    const plannerDrift =
      Boolean(snapshotRow?.source_hash) &&
      Boolean(currentHash) &&
      snapshotRow!.source_hash !== currentHash;

    const emailClientId = String(lcCtx?.contract?.agency_client_id ?? '').trim() || null;

    let brandForConsent: Record<string, unknown> = {};
    if (snapshotRow?.brand_context_json && Object.keys(snapshotRow.brand_context_json).length) {
      brandForConsent = snapshotRow.brand_context_json;
    } else if (plannerSource?.brief_json) {
      brandForConsent = buildBrandContextJson(plannerSource.brief_json);
    }
    const piiConsent =
      resolvePiiConsent(brandForConsent, lcCtx) || this.config.contentMarketingPiiConsentDefault;

    return {
      ok: true,
      lifecycle_id: lifecycleId,
      service_slug: serviceSlug,
      stage: String(lc.stage ?? ''),
      enabled: true,
      snapshot: snapshotRow
        ? {
            id: snapshotRow.id,
            sealed: snapshotRow.sealed,
            pillars_count: snapshotRow.pillars_count,
            ingested_at: snapshotRow.ingested_at.toISOString(),
            marketing_plan_id: snapshotRow.marketing_plan_id,
            source_hash: snapshotRow.source_hash,
            planner_drift: plannerDrift,
          }
        : null,
      counts,
      flags: {
        ai_enabled: this.config.contentMarketingAiEnabled,
        approval_required: this.config.contentMarketingApprovalRequired,
        media_enabled: this.config.contentMarketingMediaEnabled,
        image_gen_enabled: this.config.contentMarketingImageGenEnabled,
        video_gen_enabled: this.config.contentMarketingVideoGenEnabled,
        client_gate: this.config.contentMarketingClientGate,
        portal_summary_enabled: this.config.contentMarketingPortalSummaryEnabled,
        fe_enabled: this.config.contentMarketingFeEnabled,
        weekly_memo_enabled: this.config.contentMarketingWeeklyMemoEnabled,
        external_metrics_enabled: this.config.contentMarketingExternalMetricsEnabled,
        brief_gate_enabled: this.config.contentMarketingBriefGateEnabled,
        pii_consent: piiConsent,
      },
      channel_defaults: [...CMKT_P0_CHANNEL_DEFAULTS],
      email_client_id: emailClientId,
      email_client_linked: Boolean(emailClientId),
    };
  }
}
