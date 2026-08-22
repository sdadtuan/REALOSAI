import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminAuditRepository } from '../admin-audit/admin-audit.repository';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { StaffJobFunctionsRepository } from '../staff-permissions/staff-job-functions.repository';
import {
  buildNavPreview,
  capsToStrings,
  diffCapStrings,
} from '../staff-permissions/staff-nav-preview.util';
import { StaffPermissionSetsRepository } from '../staff-permission-sets/staff-permission-sets.repository';
import { AdminIntelligenceRepository } from './admin-intelligence.repository';
import type { MatrixImpactResult, SimulateMatrixImpactBody } from './admin-intelligence.types';

type ImpactCacheEntry = { result: MatrixImpactResult; expiresAt: number };

@Injectable()
export class PolicyImpactService {
  private cache = new Map<string, ImpactCacheEntry>();

  constructor(
    private readonly repo: AdminIntelligenceRepository,
    private readonly staffAuth: StaffAuthService,
    private readonly jobFunctions: StaffJobFunctionsRepository,
    private readonly permissionSets: StaffPermissionSetsRepository,
    private readonly adminAudit: AdminAuditRepository,
  ) {}

  private mergeCaps(
    base: StaffSectionCap[],
    extra: Array<{ section_id: string; action: string }>,
  ): StaffSectionCap[] {
    const map = new Map<string, StaffSectionCap>();
    for (const cap of base) {
      map.set(`${cap.section}:${cap.action}`, cap);
    }
    for (const cap of extra) {
      map.set(`${cap.section_id}:${cap.action}`, { section: cap.section_id, action: cap.action });
    }
    return [...map.values()];
  }

  private applyPatchToPositionCaps(
    positionCaps: StaffSectionCap[],
    patch: SimulateMatrixImpactBody['patch'],
  ): StaffSectionCap[] {
    const map = new Map<string, StaffSectionCap>();
    for (const cap of positionCaps) {
      map.set(`${cap.section}:${cap.action}`, cap);
    }
    for (const item of patch.removed ?? []) {
      map.delete(`${item.section}:${item.action}`);
    }
    for (const item of patch.added ?? []) {
      map.set(`${item.section}:${item.action}`, { section: item.section, action: item.action });
    }
    return [...map.values()];
  }

  private patchHash(body: SimulateMatrixImpactBody): string {
    return JSON.stringify(body.patch);
  }

  private cacheKey(positionId: number, body: SimulateMatrixImpactBody): string {
    return `${positionId}:${this.patchHash(body)}`;
  }

  async simulateImpact(body: SimulateMatrixImpactBody, actorEmail?: string): Promise<MatrixImpactResult> {
    const started = Date.now();
    const positionId = Number(body.position_id);
    if (!Number.isFinite(positionId) || positionId <= 0) {
      throw new NotFoundException({ error: 'invalid_position_id' });
    }

    const cacheKey = this.cacheKey(positionId, body);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.result, elapsed_ms: Date.now() - started };
    }

    const positionCode = (await this.repo.getPositionCode(positionId)) ?? String(positionId);
    const basePositionCaps = await this.staffAuth.loadCaps(positionId);
    const patchedPositionCaps = this.applyPatchToPositionCaps(basePositionCaps, body.patch);

    const users = await this.repo.listActiveUsersByPosition(positionId);
    const limit = Math.min(Math.max(body.limit ?? 50, 1), 200);

    const removedUnique = new Set<string>();
    for (const item of body.patch.removed ?? []) {
      removedUnique.add(`${item.section}.${item.action}`);
    }

    let affectedCount = 0;
    let piiLossCount = 0;
    const sampleUsers: MatrixImpactResult['sample_users'] = [];

    for (const user of users) {
      const baselineCaps = await this.buildEffectiveCaps(user.id, positionId, user.job_functions, basePositionCaps);
      const whatIfCaps = await this.buildEffectiveCaps(
        user.id,
        positionId,
        user.job_functions,
        patchedPositionCaps,
      );
      const baselineStrings = capsToStrings(baselineCaps);
      const whatIfStrings = capsToStrings(whatIfCaps);
      const delta = diffCapStrings(baselineStrings, whatIfStrings);
      if (!delta.added.length && !delta.removed.length) continue;

      affectedCount += 1;
      const piiRemoved = delta.removed.some((c) => c.includes('pii') || c.endsWith('.view_pii'));
      if (piiRemoved) piiLossCount += 1;

      if (sampleUsers.length < limit) {
        const baselineNav = buildNavPreview(baselineCaps);
        const whatIfNav = buildNavPreview(whatIfCaps);
        const lostLabels = baselineNav
          .filter((item) => item.visible && !whatIfNav.find((w) => w.href === item.href && w.visible))
          .map((item) => item.label);

        sampleUsers.push({
          user_id: user.id,
          email: user.email,
          display_name: user.display_name,
          caps_removed: delta.removed,
          caps_added: delta.added,
          menu_items_lost: lostLabels,
        });
      }
    }

    const result: MatrixImpactResult = {
      position_code: positionCode,
      affected_user_count: affectedCount,
      sample_users: sampleUsers,
      aggregate: {
        caps_removed_unique: [...removedUnique],
        users_with_pii_loss: piiLossCount,
      },
      elapsed_ms: Date.now() - started,
    };

    this.cache.set(cacheKey, { result, expiresAt: Date.now() + 60_000 });

    if (actorEmail) {
      await this.adminAudit.logSyntheticEvent({
        event_type: 'policy_simulate_impact',
        actor_email: actorEmail,
        category: 'policy_intelligence',
        severity: 'info',
        subject_label: positionCode,
        subject_id: String(positionId),
        action: 'simulate_impact',
        summary: `What-if impact ${positionCode}: ${affectedCount} users affected`,
        diff_json: { affected_user_count: affectedCount, patch: body.patch },
      });
    }

    return result;
  }

  private async buildEffectiveCaps(
    userId: string,
    positionId: number,
    jobFunctionCodes: string[],
    positionCaps: StaffSectionCap[],
  ): Promise<StaffSectionCap[]> {
    const functionCaps = await this.jobFunctions.loadCapsForFunctions(jobFunctionCodes);
    const setCaps = await this.permissionSets.loadCapsForUser(userId);
    return this.mergeCaps(positionCaps.length ? positionCaps : await this.staffAuth.loadCaps(positionId), [
      ...functionCaps,
      ...setCaps,
    ]);
  }
}
