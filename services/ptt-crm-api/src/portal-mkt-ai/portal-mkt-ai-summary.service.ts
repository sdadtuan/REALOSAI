import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { computeQualityScore } from '../marketing-ai-planner/marketing-ai-quality.util';
import { emptyDraft } from '../marketing-ai-planner/marketing-ai-brief.util';
import type { MktAiDraft } from '../marketing-ai-planner/marketing-ai-planner.types';
import { MarketingAiPlaybookService } from '../marketing-ai-planner/marketing-ai-playbook.service';
import { MarketingAiPlannerRepository } from '../marketing-ai-planner/marketing-ai-planner.repository';
import { PortalJwtPayload } from '../portal/portal-jwt.util';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import {
  buildMktAiPortalSummary,
} from './portal-mkt-ai-summary.util';
import type {
  MktAiPortalLinkedLifecycle,
  MktAiPortalSummary,
} from './portal-mkt-ai-summary.types';

@Injectable()
export class PortalMktAiSummaryService {
  constructor(
    private readonly config: AppConfigService,
    private readonly lifecycle: ServiceLifecycleService,
    private readonly repo: MarketingAiPlannerRepository,
    private readonly playbooks: MarketingAiPlaybookService,
  ) {}

  private opsWebBaseUrl(): string {
    return (process.env.PTT_OPS_WEB_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
  }

  private isEnabled(): boolean {
    return (
      this.config.mktAiPortalSummaryEnabled &&
      this.config.mktAiPlannerEnabled
    );
  }

  private assertClient(user: PortalJwtPayload): string {
    const clientId = String(user.client_id ?? '').trim();
    if (!clientId) {
      throw new ForbiddenException({ error: 'missing_client_id' });
    }
    return clientId;
  }

  private assertPlannerSlug(serviceSlug: string): void {
    const slugs = this.config.mktAiPlannerSlugs;
    if (slugs.length && serviceSlug && !slugs.includes(serviceSlug)) {
      throw new ForbiddenException({
        error: 'mkt_ai_planner_slug_not_pilot',
        service_slug: serviceSlug,
      });
    }
  }

  private async assertPortalLifecycleAccess(
    user: PortalJwtPayload,
    lifecycleId: number,
  ): Promise<{ serviceSlug: string; stage: string }> {
    const clientId = this.assertClient(user);
    let ctx;
    try {
      ctx = await this.lifecycle.context(lifecycleId);
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw new NotFoundException({ error: 'lifecycle_not_found', lifecycle_id: lifecycleId });
      }
      throw err;
    }
    const agencyClientId = String(ctx.contract.agency_client_id ?? '').trim();
    if (!agencyClientId || agencyClientId !== clientId) {
      throw new ForbiddenException({ error: 'lifecycle_client_mismatch' });
    }
    const serviceSlug = String(ctx.service_slug ?? '').trim();
    this.assertPlannerSlug(serviceSlug);
    return { serviceSlug, stage: String(ctx.stage ?? '') };
  }

  async linkedLifecycle(user: PortalJwtPayload): Promise<MktAiPortalLinkedLifecycle> {
    if (!this.isEnabled()) {
      return {
        ok: true,
        enabled: false,
        lifecycle_id: null,
        service_slug: null,
        stage: null,
      };
    }
    const clientId = this.assertClient(user);
    const row = await this.lifecycle.findPrimaryLifecycleByAgencyClientId(clientId);
    if (!row) {
      return {
        ok: true,
        enabled: true,
        lifecycle_id: null,
        service_slug: null,
        stage: null,
      };
    }
    try {
      this.assertPlannerSlug(row.service_slug);
    } catch {
      return {
        ok: true,
        enabled: true,
        lifecycle_id: null,
        service_slug: null,
        stage: null,
      };
    }
    return {
      ok: true,
      enabled: true,
      lifecycle_id: row.lifecycle_id,
      service_slug: row.service_slug,
      stage: row.stage,
    };
  }

  async planSummary(user: PortalJwtPayload, lifecycleId: number): Promise<MktAiPortalSummary> {
    if (!this.isEnabled()) {
      return {
        ok: true,
        enabled: false,
        lifecycle_id: lifecycleId,
        service_slug: '',
        brand_name: null,
        quality_score: null,
        playbook_label: null,
        strategy_excerpt: '',
        campaign_count: 0,
        last_updated_at: new Date().toISOString(),
        staff_planner_url: buildMktAiPortalSummary({
          lifecycleId,
          serviceSlug: '',
          brief: null,
          draft: null,
          qualityScore: null,
          playbookLabel: null,
          lastUpdatedAt: new Date().toISOString(),
          opsWebBaseUrl: this.opsWebBaseUrl(),
        }).staff_planner_url,
      };
    }

    const { serviceSlug } = await this.assertPortalLifecycleAccess(user, lifecycleId);
    const briefRow = await this.repo.getBrief(lifecycleId);
    const draft: MktAiDraft = (await this.repo.getDraft(lifecycleId)) ?? (emptyDraft() as MktAiDraft);
    const jobs = await this.repo.listJobs(lifecycleId);
    const quality = computeQualityScore(briefRow?.brief_json ?? null, draft, {
      planDepthEnabled: this.config.mktAiPlanDepthEnabled,
    });
    const playbookCtx =
      this.playbooks.isEnabled() && briefRow
        ? this.playbooks.buildContextFromDraft({
            brief: briefRow.brief_json,
            draft: draft ?? ({} as never),
            serviceSlug,
            qualityScore: quality.score,
          })
        : null;

    const lastJob = jobs[0];
    const lastUpdatedAt = lastJob?.created_at ?? new Date().toISOString();

    const mapped = buildMktAiPortalSummary({
      lifecycleId,
      serviceSlug,
      brief: briefRow?.brief_json ?? null,
      draft,
      qualityScore: quality.score,
      playbookLabel: playbookCtx?.playbook.label_vi ?? null,
      lastUpdatedAt,
      opsWebBaseUrl: this.opsWebBaseUrl(),
    });

    return {
      ok: true,
      enabled: true,
      ...mapped,
    };
  }
}
