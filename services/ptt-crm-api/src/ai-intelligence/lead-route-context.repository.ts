import { Injectable } from '@nestjs/common';
import { CrmLeadsPgRepository } from '../crm-leads-legacy/crm-leads-pg.repository';
import { ReProjectsOpsService } from '../re-projects/re-projects-ops.service';
import { ReProjectStaffRow } from '../re-projects/re-projects.types';
import { LeadScoreContextRepository } from './lead-score-context.repository';
import { AiScoresRepository } from './ai-scores.repository';
import { LeadRouteCandidate, LeadRouteContext } from './lead-route.types';
import { ScoreBand } from './lead-score.types';

function parseMetaString(meta: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const raw = meta[key];
    if (raw == null) continue;
    const s = String(raw).trim();
    if (s) return s;
  }
  return null;
}

function scoreBandFromValue(score: number | null): ScoreBand | null {
  if (score == null) return null;
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

@Injectable()
export class LeadRouteContextRepository {
  constructor(
    private readonly leadsPg: CrmLeadsPgRepository,
    private readonly leadContext: LeadScoreContextRepository,
    private readonly scores: AiScoresRepository,
    private readonly reProjects: ReProjectsOpsService,
  ) {}

  async loadRouteContext(leadId: number): Promise<LeadRouteContext | null> {
    const snapshot = await this.leadsPg.getLeadRoutingSnapshot(leadId);
    if (!snapshot) return null;

    const ctx = await this.leadContext.loadLeadScoreContext(leadId);
    if (!ctx) return null;

    const latestScore = await this.scores.getLatest('lead', String(leadId));
    const productLine =
      parseMetaString(ctx.meta, ['product_line', 're_product_line', 'productLine']) ?? null;
    const zone = parseMetaString(ctx.meta, ['zone', 'scope_zone', 'phan_khu']) ?? null;

    let pool: ReProjectStaffRow[] = [];
    if (snapshot.reProjectId) {
      try {
        const out = await this.reProjects.listStaff(snapshot.reProjectId);
        pool = out.staff.filter((row) => row.assign_enabled && row.active);
      } catch {
        pool = [];
      }
    }

    let candidates: LeadRouteCandidate[] = [];
    if (pool.length) {
      candidates = await this.buildProjectCandidates(pool, snapshot.reProjectId!, productLine, zone);
    } else {
      candidates = await this.buildGlobalCandidates();
    }

    return {
      leadId,
      clientId: ctx.clientId,
      ownerId: snapshot.ownerId,
      reProjectId: snapshot.reProjectId,
      channel: ctx.channel,
      source: ctx.source,
      status: ctx.status,
      productLine,
      zone,
      scoreBand: scoreBandFromValue(latestScore?.score_value ?? null),
      leadScore: latestScore?.score_value ?? null,
      candidates,
    };
  }

  private async buildProjectCandidates(
    pool: ReProjectStaffRow[],
    projectId: number,
    productLine: string | null,
    zone: string | null,
  ): Promise<LeadRouteCandidate[]> {
    const filtered = pool.filter((row) => {
      if (productLine && row.scope_product_lines.length && !row.scope_product_lines.includes(productLine)) {
        return false;
      }
      if (zone && row.scope_zones.length && !row.scope_zones.includes(zone)) {
        return false;
      }
      return true;
    });
    const staffIds = filtered.map((row) => row.staff_id);
    const openCounts = await this.leadsPg.countOpenLeadsByOwners(staffIds, projectId);
    return filtered.map((row) => ({
      staff_id: row.staff_id,
      staff_name: row.staff_name,
      staff_code: row.staff_code,
      role: row.role,
      open_leads: openCounts.get(row.staff_id) ?? 0,
      sort_order: row.sort_order,
    }));
  }

  private async buildGlobalCandidates(): Promise<LeadRouteCandidate[]> {
    const rows = await this.leadsPg.listAssignableStaff(40);
    const openCounts = await this.leadsPg.countOpenLeadsByOwners(
      rows.map((row) => row.staff_id),
      null,
    );
    return rows.map((row) => ({
      staff_id: row.staff_id,
      staff_name: row.staff_name,
      staff_code: row.staff_code,
      role: row.role,
      open_leads: openCounts.get(row.staff_id) ?? 0,
      sort_order: row.sort_order,
    }));
  }
}
