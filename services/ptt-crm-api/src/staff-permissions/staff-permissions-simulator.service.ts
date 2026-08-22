import { Injectable, NotFoundException } from '@nestjs/common';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { StaffPermissionSetsRepository } from '../staff-permission-sets/staff-permission-sets.repository';
import { StaffJobFunctionsRepository } from './staff-job-functions.repository';
import {
  buildNavPreview,
  capsToStrings,
  diffCapStrings,
} from './staff-nav-preview.util';

export type SimulatePermissionsBody = {
  position_id: number;
  job_functions?: string[];
  set_codes?: string[];
  compare_user_id?: string;
};

@Injectable()
export class StaffPermissionsSimulatorService {
  constructor(
    private readonly staffAuth: StaffAuthService,
    private readonly jobFunctions: StaffJobFunctionsRepository,
    private readonly permissionSets: StaffPermissionSetsRepository,
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
    return [...map.values()].sort((a, b) =>
      `${a.section}:${a.action}`.localeCompare(`${b.section}:${b.action}`, 'vi'),
    );
  }

  private async buildCapsFromInputs(body: SimulatePermissionsBody): Promise<StaffSectionCap[]> {
    const positionId = Number(body.position_id);
    if (!Number.isFinite(positionId) || positionId <= 0) {
      throw new NotFoundException({ error: 'invalid_position_id' });
    }
    const baseCaps = await this.staffAuth.loadCaps(positionId);
    const functions = [...new Set((body.job_functions ?? []).map((c) => c.trim()).filter(Boolean))];
    const functionCaps = await this.jobFunctions.loadCapsForFunctions(functions);
    const setCaps = await this.permissionSets.loadCapsForSetCodes(body.set_codes ?? []);
    return this.mergeCaps(baseCaps, [...functionCaps, ...setCaps]);
  }

  private async loadCompareCaps(userId: string): Promise<StaffSectionCap[]> {
    const ref = userId.trim();
    if (!ref) return [];
    try {
      const me = await this.staffAuth.me({
        sub: ref,
        email: ref,
        display_name: ref,
        position_id: 0,
        token_type: 'access',
        iat: 0,
        exp: 0,
      });
      return me.caps;
    } catch {
      return [];
    }
  }

  async simulate(body: SimulatePermissionsBody) {
    const caps = await this.buildCapsFromInputs(body);
    const capStrings = capsToStrings(caps);
    const menu = buildNavPreview(caps);

    let diff: { added: string[]; removed: string[] } | undefined;
    if (body.compare_user_id?.trim()) {
      const compareCaps = await this.loadCompareCaps(body.compare_user_id);
      diff = diffCapStrings(capsToStrings(compareCaps), capStrings);
    }

    return {
      caps: capStrings,
      menu,
      diff: diff ?? { added: [], removed: [] },
    };
  }
}
