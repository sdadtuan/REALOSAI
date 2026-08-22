import { Injectable, NotFoundException } from '@nestjs/common';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import type { MktAiDraft, MktAiPlanVersionRow } from './marketing-ai-planner.types';
import { summarizePlanVersion, versionToDraft } from './marketing-ai-version.util';

@Injectable()
export class MarketingAiVersionService {
  constructor(private readonly repo: MarketingAiPlannerRepository) {}

  async listVersions(lifecycleId: number, limit = 30): Promise<MktAiPlanVersionRow[]> {
    return this.repo.listPlanVersions(lifecycleId, limit);
  }

  async getVersion(lifecycleId: number, versionId: number): Promise<MktAiPlanVersionRow> {
    const version = await this.repo.getPlanVersion(versionId);
    if (!version || version.lifecycle_id !== lifecycleId) {
      throw new NotFoundException({ error: 'plan_version_not_found', version_id: versionId });
    }
    return version;
  }

  async restoreVersionToDraft(
    lifecycleId: number,
    versionId: number,
    actorEmail: string,
  ): Promise<{ draft: MktAiDraft; version: MktAiPlanVersionRow }> {
    const version = await this.getVersion(lifecycleId, versionId);
    const current = await this.repo.getDraft(lifecycleId);
    const draft = versionToDraft(version, current?.swot_json ?? {});

    await this.repo.upsertDraft(lifecycleId, draft, actorEmail);
    await this.repo.replaceCampaigns(lifecycleId, null, draft.campaigns_json ?? []);

    const assets = Array.isArray((draft.content_json as { assets?: unknown[] })?.assets)
      ? ((draft.content_json as { assets: unknown[] }).assets ?? [])
      : [];
    if (assets.length) {
      await this.repo.replaceContentAssets(lifecycleId, null, assets);
    }

    if (version.brief_json && Object.keys(version.brief_json).length) {
      const briefRow = await this.repo.getBrief(lifecycleId);
      await this.repo.upsertBrief(
        lifecycleId,
        { ...(briefRow?.brief_json ?? {}), ...version.brief_json },
        briefRow?.prefill_sources_json ?? [],
        actorEmail,
      );
    }

    return { draft, version };
  }

  summarizeVersions(versions: MktAiPlanVersionRow[]) {
    return versions.map((v) => summarizePlanVersion(v));
  }
}
