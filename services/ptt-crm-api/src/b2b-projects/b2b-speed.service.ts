import { Injectable } from '@nestjs/common';
import { B2bProjectsRepository } from './b2b-projects.repository';
import { B2bSpeedRepository } from './b2b-speed.repository';
import {
  aggregateSpeedMetrics,
  isSpeedSampleInBusinessHours,
  speedSecondsBetween,
} from './b2b-speed.util';
import { B2bSlaRepository } from './b2b-sla.repository';

@Injectable()
export class B2bSpeedService {
  constructor(
    private readonly repo: B2bSpeedRepository,
    private readonly projectsRepo: B2bProjectsRepository,
    private readonly slaRepo: B2bSlaRepository,
  ) {}

  async getSpeedReport(input: { projectId: string; days?: number }) {
    const days = Math.min(Math.max(input.days ?? 7, 1), 90);
    if (!input.projectId.trim()) {
      return {
        project_id: '',
        days,
        p50_seconds: 0,
        p95_seconds: 0,
        hot_p95_seconds: 0,
        n: 0,
        by_staff: [],
      };
    }
    const project = await this.projectsRepo.getProject(input.projectId);
    const hours = this.slaRepo.resolveBusinessHours(project);
    const rows = await this.repo.loadSpeedRows({ projectId: input.projectId, days });

    const durations: number[] = [];
    const hotDurations: number[] = [];
    const byStaff = new Map<number, number[]>();

    for (const row of rows) {
      const receivedAt = new Date(row.received_at);
      const firstTouchAt = row.first_touch_at ? new Date(row.first_touch_at) : null;
      if (!firstTouchAt || Number.isNaN(receivedAt.getTime()) || Number.isNaN(firstTouchAt.getTime())) {
        continue;
      }
      if (!isSpeedSampleInBusinessHours(receivedAt, hours)) continue;
      const sec = speedSecondsBetween(receivedAt, firstTouchAt);
      durations.push(sec);
      if ((row.score ?? 0) >= 70) hotDurations.push(sec);
      if (row.owner_id != null) {
        const list = byStaff.get(row.owner_id) ?? [];
        list.push(sec);
        byStaff.set(row.owner_id, list);
      }
    }

    const summary = aggregateSpeedMetrics({
      durationsSec: durations,
      hotDurationsSec: hotDurations,
    });

    const by_staff = [...byStaff.entries()]
      .map(([staff_id, secs]) => ({
        staff_id,
        n: secs.length,
        p50_seconds: aggregateSpeedMetrics({ durationsSec: secs, hotDurationsSec: [] }).p50_seconds,
      }))
      .sort((a, b) => b.n - a.n);

    return {
      project_id: input.projectId,
      days,
      ...summary,
      by_staff,
    };
  }
}
