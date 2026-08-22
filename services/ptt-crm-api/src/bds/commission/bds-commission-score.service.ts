import { Injectable } from '@nestjs/common';
import { BdsAgencyRepository } from '../agencies/bds-agency.repository';
import { BdsTxRepository } from '../transactions/bds-tx.repository';
import { BdsCommissionRepository } from './bds-commission.repository';
import { clampTierMove, pickTierByScore } from './bds-commission.util';

export type RecalcTarget = {
  agencyId: string;
  target_gmv: number;
  target_units: number;
};

@Injectable()
export class BdsCommissionScoreService {
  constructor(
    private readonly repo: BdsCommissionRepository,
    private readonly agencies: BdsAgencyRepository,
    private readonly txs: BdsTxRepository,
  ) {}

  async recalc(
    periodMonth: string,
    tenantId?: string,
    opts?: { targets?: RecalcTarget[] },
  ): Promise<{ processed: number }> {
    const tid = String(tenantId ?? '').trim() || null;
    const agencies = (await this.agencies.listAgencies(tid)).filter((a) => a.status === 'active');
    const tiers = await this.agencies.listTiers(tid);
    const targetMap = new Map(
      (opts?.targets ?? []).map((t) => [t.agencyId, t]),
    );

    const { from, to } = monthRangeUtc(periodMonth);
    let processed = 0;

    for (const agency of agencies) {
      if (agency.tier_override) continue;

      const target = targetMap.get(agency.id);
      const { gmv, units } = await this.txs.sumContractedForAgencyInPeriod(agency.id, from, to);

      const targetGmv = target?.target_gmv ?? 0;
      const targetUnits = target?.target_units ?? 0;
      const gmvScore =
        targetGmv > 0 ? Math.min(100, Math.floor((gmv / targetGmv) * 100)) : 0;
      const unitsScore =
        targetUnits > 0 ? Math.min(100, Math.floor((units / targetUnits) * 100)) : 0;
      const total = 0.35 * gmvScore + 0.25 * unitsScore;

      const desired = pickTierByScore(tiers, total);
      const currentTierId = agency.tier_id;
      const nextTierId =
        desired && total > 0
          ? clampTierMove(tiers, currentTierId, desired.id)
          : currentTierId;

      await this.repo.insertScore({
        tenant_id: agency.tenant_id,
        agency_id: agency.id,
        period_month: periodMonth,
        gmv_score: gmvScore,
        units_score: unitsScore,
        total_score: total,
        from_tier_id: currentTierId,
        to_tier_id: nextTierId ?? null,
      });

      if (nextTierId && nextTierId !== currentTierId) {
        await this.agencies.setAgencyTierFromRecalc(agency.id, nextTierId);
      }
      processed += 1;
    }

    return { processed };
  }
}

function monthRangeUtc(periodMonth: string): { from: Date; to: Date } {
  const parts = periodMonth.slice(0, 10).split('-').map(Number);
  const y = parts[0];
  const m = parts[1] - 1;
  const from = new Date(Date.UTC(y, m, 1));
  const to = new Date(Date.UTC(y, m + 1, 1));
  return { from, to };
}
