import { Injectable } from '@nestjs/common';
import {
  eligibleStaffIdsForLead,
  leadAssignmentPoolKey,
  pickRoundRobinStaffId,
} from './lead-assign-scope.util';
import { IngestRulesSnapshot, LeadIngestRulesRepository } from './lead-ingest-rules.repository';

const DEFAULT_SERVICE_SLUG = 'lead-gen';

export interface LeadAutoAssignInput {
  industrySlug?: string | null;
  serviceSlug?: string | null;
  preferOwnerId?: number | null;
}

export interface LeadAutoAssignResult {
  owner_id: number;
  owner_name: string;
  strategy: string;
  pool_key: string;
}

@Injectable()
export class LeadAutoAssignService {
  constructor(private readonly rulesRepo: LeadIngestRulesRepository) {}

  isAutoAssignEnabled(snapshot: IngestRulesSnapshot | null): boolean {
    if (!snapshot) return false;
    const assignCfg = snapshot.lead_config.assign_config;
    if (assignCfg && typeof assignCfg === 'object') {
      const cfg = assignCfg as Record<string, unknown>;
      if (cfg.auto_assign_enabled === false) return false;
    }
    return true;
  }

  async assignOwner(input: LeadAutoAssignInput): Promise<LeadAutoAssignResult | null> {
    const snapshot = await this.rulesRepo.fetchSnapshot();
    if (!snapshot || !this.isAutoAssignEnabled(snapshot)) return null;

    const preferId = input.preferOwnerId != null ? Number(input.preferOwnerId) : null;
    if (preferId && preferId > 0) {
      const staff = snapshot.staff_rows.find((row) => row.id === preferId && row.active);
      if (staff) {
        return {
          owner_id: staff.id,
          owner_name: staff.name,
          strategy: 'prefer_staff',
          pool_key: '',
        };
      }
    }

    const industrySlug = String(input.industrySlug ?? '').trim();
    const serviceSlug = String(input.serviceSlug ?? DEFAULT_SERVICE_SLUG).trim() || DEFAULT_SERVICE_SLUG;
    const poolKey = leadAssignmentPoolKey(industrySlug, serviceSlug);

    const scopeIds = eligibleStaffIdsForLead(
      snapshot.staff_assign_scope,
      industrySlug,
      serviceSlug,
    );
    if (scopeIds && scopeIds.size === 0) {
      return null;
    }

    let candidates = snapshot.staff_rows.filter((row) => row.active).map((row) => row.id);
    if (scopeIds) {
      candidates = candidates.filter((id) => scopeIds.has(id));
    }
    if (!candidates.length) return null;

    const ownerId = pickRoundRobinStaffId(candidates, poolKey, snapshot.assignment_state);
    const owner = snapshot.staff_rows.find((row) => row.id === ownerId);
    await this.rulesRepo.persistAssignmentState(poolKey, ownerId);

    return {
      owner_id: ownerId,
      owner_name: owner?.name ?? String(ownerId),
      strategy: 'round_robin',
      pool_key: poolKey,
    };
  }
}
