import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { VdCostRepository } from '../cost/vd-cost.repository';
import { VdGateRepository } from '../gate/vd-gate.repository';
import { VdProjectRepository } from '../project/vd-project.repository';
import { VdTakeRepository } from '../render/vd-take.repository';
import { VdShotRepository } from '../script/vd-shot.repository';
import { assertCinematicEnabled } from '../video-sop-flags';
import { VdBenchmarkRepository } from './vd-benchmark.repository';
import {
  buildMetricRows,
  computeCreditRatio,
  computeLeadDays,
  computeRate,
  computeTakesPerShot,
  VD_PRODUCTION_METRICS,
  type VdProductionMetric,
  type VdProductionMetricRow,
} from './vd-report-metrics';

export type VdProductionReport = {
  lifecycle_id: number;
  project_count: number;
  metrics: VdProductionMetricRow[];
};

@Injectable()
export class VdReportService {
  constructor(
    private readonly config: AppConfigService,
    private readonly projects: VdProjectRepository,
    private readonly shots: VdShotRepository,
    private readonly takes: VdTakeRepository,
    private readonly costs: VdCostRepository,
    private readonly gates: VdGateRepository,
    private readonly benchmarks: VdBenchmarkRepository,
  ) {}

  async computeProjectMetrics(projectId: number): Promise<Record<VdProductionMetric, number>> {
    const project = await this.projects.getById(projectId);
    const shotRows = project ? await this.shots.listByProjectId(projectId) : [];
    const takeRows = await this.takes.listByProjectId(projectId);
    const kfApproved = shotRows.filter((row) => row.status === 'keyframe_approved').length;
    const clipSelected = shotRows.filter((row) => row.status === 'clip_selected').length;
    const estimated = await this.costs.sumByKind(projectId, 'estimated');
    const actual = await this.costs.sumByKind(projectId, 'actual');
    const reworks = await this.gates.countReworks(projectId);
    const overrides = await this.gates.countOverrides(projectId);
    const approvals = await this.gates.countApprovals(projectId);
    const deliveredAt =
      project && (project.stage === 'delivered' || project.stage === 'archived')
        ? project.updated_at
        : null;

    return {
      kf_pass_rate: computeRate(kfApproved, shotRows.length),
      clip_pass_rate: computeRate(clipSelected, shotRows.length),
      takes_per_shot: computeTakesPerShot(takeRows.length, shotRows.length),
      credit_ratio: computeCreditRatio(actual, estimated),
      client_rounds: reworks,
      lead_days: project ? computeLeadDays(project.created_at, deliveredAt) : 0,
      override_rate: computeRate(overrides, approvals),
    };
  }

  private averageMetrics(
    rows: Record<VdProductionMetric, number>[],
  ): Record<VdProductionMetric, number> {
    if (rows.length === 0) {
      return {
        kf_pass_rate: 0,
        clip_pass_rate: 0,
        takes_per_shot: 0,
        credit_ratio: 0,
        client_rounds: 0,
        lead_days: 0,
        override_rate: 0,
      };
    }
    const sums = rows.reduce(
      (acc, row) => {
        for (const metric of VD_PRODUCTION_METRICS) {
          acc[metric] += row[metric];
        }
        return acc;
      },
      {
        kf_pass_rate: 0,
        clip_pass_rate: 0,
        takes_per_shot: 0,
        credit_ratio: 0,
        client_rounds: 0,
        lead_days: 0,
        override_rate: 0,
      } as Record<VdProductionMetric, number>,
    );
    const out = {} as Record<VdProductionMetric, number>;
    for (const metric of VD_PRODUCTION_METRICS) {
      out[metric] =
        metric === 'client_rounds'
          ? sums[metric] / rows.length
          : sums[metric] / rows.length;
    }
    return out;
  }

  async getProductionReport(lifecycleId: number): Promise<VdProductionReport> {
    assertCinematicEnabled(this.config);
    const projectRows = await this.projects.listByLifecycle(lifecycleId);
    const perProject: Record<VdProductionMetric, number>[] = [];
    for (const project of projectRows) {
      const metrics = await this.computeProjectMetrics(project.id);
      perProject.push(metrics);
      for (const metric of VD_PRODUCTION_METRICS) {
        await this.benchmarks.insert({
          project_id: project.id,
          metric,
          value: metrics[metric],
        });
      }
    }
    const averaged = this.averageMetrics(perProject);
    return {
      lifecycle_id: lifecycleId,
      project_count: projectRows.length,
      metrics: buildMetricRows(averaged),
    };
  }
}
