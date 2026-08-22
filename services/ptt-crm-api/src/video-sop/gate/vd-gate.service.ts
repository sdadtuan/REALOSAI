import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { assertBriefComplete } from '../project/vd-brief.service';
import { VdBibleRepository } from '../bible/vd-bible.repository';
import {
  assertFeasibilityPass,
  evaluateFeasibility,
  type VdShotDraft,
} from '../rules/vd-feasibility.rules';
import { assertStageTransition, type GateStatus } from '../rules/vd-stage.guard';
import { VdProjectRepository } from '../project/vd-project.repository';
import { VdShotRepository } from '../script/vd-shot.repository';
import { assertCinematicEnabled } from '../video-sop-flags';
import { VdGateRepository } from './vd-gate.repository';
import { VdJobRepository } from '../jobs/vd-job.repository';
import { evaluateGate4Auto } from '../rules/vd-qc-auto';

export type VdGateChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
};

export type VdGateView = {
  project_id: number;
  gate_no: number;
  status: GateStatus;
  stage: string;
  checklist: VdGateChecklistItem[];
};

function projectFromBrief(brief: Record<string, unknown> | null): {
  duration_sec: number;
  platform: string;
} {
  const duration =
    brief && typeof brief.duration_sec === 'number' && Number.isFinite(brief.duration_sec)
      ? brief.duration_sec
      : 30;
  const platform =
    brief && typeof brief.platform === 'string' && brief.platform.trim()
      ? brief.platform
      : 'reels';
  return { duration_sec: duration, platform };
}

function shotDraftFromRow(shot: {
  duration_ms: number;
  text_in_frame: boolean;
  contains_human: boolean;
  aspect: string;
  camera: string;
  action: string;
  logo_in_ai_frame: boolean;
  seed: number | null;
  status: string;
}): VdShotDraft {
  return {
    duration_ms: shot.duration_ms,
    text_in_frame: shot.text_in_frame,
    contains_human: shot.contains_human,
    aspect: shot.aspect,
    camera: shot.camera,
    action: shot.action,
    logo_in_ai_frame: shot.logo_in_ai_frame,
    seed: shot.seed,
    status: shot.status,
  };
}

@Injectable()
export class VdGateService {
  constructor(
    private readonly config: AppConfigService,
    private readonly projects: VdProjectRepository,
    private readonly gates: VdGateRepository,
    private readonly shots: VdShotRepository,
    private readonly bibles: VdBibleRepository,
    private readonly jobs: VdJobRepository,
  ) {}

  private async requireProject(id: number) {
    const row = await this.projects.getById(id);
    if (!row) throw new Error('vd_project_not_found');
    return row;
  }

  private async latestShots(projectId: number) {
    return this.shots.listByProjectId(projectId);
  }

  private async gateContext(projectId: number) {
    const map = await this.gates.getStatusMap(projectId);
    return {
      gate1: map[1],
      gate2: map[2],
      gate3: map[3],
      gate4: map[4],
    };
  }

  async isShotlistImmutable(projectId: number): Promise<boolean> {
    const map = await this.gates.getStatusMap(projectId);
    return map[1] === 'approved';
  }

  async getGate(projectId: number, gateNo: number): Promise<VdGateView> {
    const project = await this.requireProject(projectId);
    if (gateNo !== 1 && gateNo !== 2 && gateNo !== 3 && gateNo !== 4) {
      throw new Error('invalid_body');
    }
    const row = await this.gates.getOrCreate(projectId, gateNo);
    const checklist =
      gateNo === 1
        ? await this.buildGate1Checklist(projectId)
        : gateNo === 2
          ? await this.buildGate2Checklist(projectId)
          : gateNo === 3
            ? await this.buildGate3Checklist(projectId)
            : await this.buildGate4Checklist(projectId);
    return {
      project_id: projectId,
      gate_no: gateNo,
      status: row.status,
      stage: project.stage,
      checklist,
    };
  }

  private async buildGate1Checklist(projectId: number): Promise<VdGateChecklistItem[]> {
    const brief = (await this.projects.getBrief(projectId)) ?? {};
    let briefOk = true;
    try {
      assertBriefComplete(brief);
    } catch {
      briefOk = false;
    }
    const shotRows = await this.latestShots(projectId);
    const drafts = shotRows.map((row) => shotDraftFromRow(row));
    const feasibility = evaluateFeasibility(projectFromBrief(brief), drafts);
    const feasibilityOk = feasibility.every((row) => row.ok);
    return [
      { id: 'brief_complete', label: 'Brief 8 nhóm đủ', ok: briefOk },
      { id: 'feasibility_pass', label: 'Feasibility FR-R01…10 pass', ok: feasibilityOk },
      { id: 'shots_min_1', label: 'Có ít nhất 1 shot', ok: shotRows.length >= 1 },
    ];
  }

  private async buildGate2Checklist(projectId: number): Promise<VdGateChecklistItem[]> {
    const style = await this.bibles.getStyle(projectId);
    const chars = await this.bibles.getCharacters(projectId);
    const bibleOk =
      (style.palette.length > 0 || style.lens.trim().length > 0) &&
      chars.items.length >= 0;
    const shotRows = await this.latestShots(projectId);
    const allApproved =
      shotRows.length > 0 && shotRows.every((row) => row.status === 'keyframe_approved');
    return [
      { id: 'bible_exists', label: 'Style bible đã lưu', ok: bibleOk },
      {
        id: 'all_keyframe_approved',
        label: 'Mọi shot keyframe_approved',
        ok: allApproved,
      },
    ];
  }

  private async buildGate3Checklist(projectId: number): Promise<VdGateChecklistItem[]> {
    const shotRows = await this.latestShots(projectId);
    const hasSelected = shotRows.some((row) => row.status === 'clip_selected');
    return [
      {
        id: 'clip_selected',
        label: 'Có ít nhất 1 shot clip_selected',
        ok: hasSelected,
      },
    ];
  }

  async markShotlistReady(projectId: number) {
    assertCinematicEnabled(this.config);
    const project = await this.requireProject(projectId);
    if (project.stage !== 'scripting') {
      throw new Error('stage_guard');
    }
    const brief = (await this.projects.getBrief(projectId)) ?? {};
    const shotRows = await this.latestShots(projectId);
    if (shotRows.length === 0) {
      throw new Error('invalid_body');
    }
    const drafts = shotRows.map((row) => shotDraftFromRow(row));
    assertFeasibilityPass(projectFromBrief(brief), drafts);
    assertStageTransition(project.stage, 'shotlist_ready');
    await this.projects.updateStage(projectId, 'shotlist_ready');
    return this.projects.getById(projectId);
  }

  async advanceStage(projectId: number, target: string) {
    assertCinematicEnabled(this.config);
    const project = await this.requireProject(projectId);
    const ctx = await this.gateContext(projectId);
    assertStageTransition(project.stage as never, target as never, ctx);
    await this.projects.updateStage(projectId, target as never);
    return this.projects.getById(projectId);
  }

  private assertOverrideReason(reason: unknown, override: boolean): void {
    if (!override) return;
    const text = typeof reason === 'string' ? reason.trim() : '';
    if (text.length < 10) {
      throw new Error('override_reason');
    }
  }

  private async buildGate4Checklist(projectId: number): Promise<VdGateChecklistItem[]> {
    const auto = await this.loadGate4Auto(projectId);
    return [
      { id: 'has_video', label: 'Có video track', ok: !auto.reasons.includes('missing_video') },
      { id: 'has_audio', label: 'Có audio track', ok: !auto.reasons.includes('missing_audio') },
      {
        id: 'duration_min',
        label: 'Duration ≥ 12s',
        ok: !auto.reasons.includes('duration_too_short'),
      },
    ];
  }

  private async loadGate4Auto(projectId: number) {
    const jobs = await this.jobs.listByProjectId(projectId);
    const latest = jobs
      .filter((row) => row.job_type === 'cine_compose')
      .sort((a, b) => b.id - a.id)[0];
    const probe = latest?.output_json?.gate4_probe;
    if (probe && typeof probe === 'object' && !Array.isArray(probe)) {
      return evaluateGate4Auto(probe as never);
    }
    return evaluateGate4Auto({
      hasVideo: false,
      hasAudio: false,
      durationSec: 0,
      lufs: null,
    });
  }

  async approve(
    projectId: number,
    gateNo: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ) {
    assertCinematicEnabled(this.config);
    if (gateNo !== 1 && gateNo !== 2 && gateNo !== 3 && gateNo !== 4) {
      throw new Error('invalid_body');
    }
    const override = body.override === true;
    this.assertOverrideReason(body.override_reason, override);
    const view = await this.getGate(projectId, gateNo);
    const gate4Auto = gateNo === 4 ? await this.loadGate4Auto(projectId) : null;
    if (gateNo === 4 && !override && gate4Auto?.blocked) {
      throw new Error('gate4_blocked');
    }
    if (!override && view.checklist.some((item) => !item.ok)) {
      if (gateNo === 3) throw new Error('gate3_incomplete');
      if (gateNo === 4) throw new Error('gate4_blocked');
      throw new Error('gate_checklist_failed');
    }
    const project = await this.requireProject(projectId);
    const ctx = await this.gateContext(projectId);

    if (gateNo === 1) {
      if (project.stage !== 'shotlist_ready' && project.stage !== 'scripting') {
        throw new Error('stage_guard');
      }
      if (project.stage === 'scripting') {
        await this.markShotlistReady(projectId);
      }
      const refreshed = await this.requireProject(projectId);
      assertStageTransition(refreshed.stage as never, 'keyframing', {
        ...ctx,
        gate1: 'approved',
      });
      const gate = await this.gates.updateStatus(projectId, 1, 'approved');
      await this.gates.insertApproval({
        gate_id: gate.id,
        actor_email: actorEmail,
        action: override ? 'override' : 'approve',
        reason: typeof body.override_reason === 'string' ? body.override_reason : '',
      });
      await this.projects.updateStage(projectId, 'keyframing');
    } else if (gateNo === 2) {
      if (project.stage !== 'keyframing') {
        throw new Error('stage_guard');
      }
      assertStageTransition('keyframing', 'animating', { ...ctx, gate2: 'approved' });
      const gate = await this.gates.updateStatus(projectId, 2, 'approved');
      await this.gates.insertApproval({
        gate_id: gate.id,
        actor_email: actorEmail,
        action: override ? 'override' : 'approve',
        reason: typeof body.override_reason === 'string' ? body.override_reason : '',
      });
      await this.projects.updateStage(projectId, 'animating');
    } else if (gateNo === 3) {
      if (project.stage !== 'animating') {
        throw new Error('stage_guard');
      }
      assertStageTransition('animating', 'post_production', { ...ctx, gate3: 'approved' });
      const gate = await this.gates.updateStatus(projectId, 3, 'approved');
      await this.gates.insertApproval({
        gate_id: gate.id,
        actor_email: actorEmail,
        action: override ? 'override' : 'approve',
        reason: typeof body.override_reason === 'string' ? body.override_reason : '',
      });
      await this.projects.updateStage(projectId, 'post_production');
    } else {
      if (project.stage !== 'post_production') {
        throw new Error('stage_guard');
      }
      assertStageTransition('post_production', 'delivered', { ...ctx, gate4: 'approved' });
      const gate = await this.gates.updateStatus(projectId, 4, 'approved');
      await this.gates.insertApproval({
        gate_id: gate.id,
        actor_email: actorEmail,
        action: override ? 'override' : 'approve',
        reason: typeof body.override_reason === 'string' ? body.override_reason : '',
      });
      await this.projects.updateStage(projectId, 'delivered');
    }
    return this.getGate(projectId, gateNo);
  }

  async reject(
    projectId: number,
    gateNo: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ) {
    assertCinematicEnabled(this.config);
    if (gateNo !== 1 && gateNo !== 2 && gateNo !== 3 && gateNo !== 4) {
      throw new Error('invalid_body');
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      throw new Error('invalid_body');
    }
    const gate = await this.gates.updateStatus(projectId, gateNo, 'rejected');
    await this.gates.insertApproval({
      gate_id: gate.id,
      actor_email: actorEmail,
      action: 'reject',
      reason,
    });
    await this.gates.insertRework({ project_id: projectId, gate_no: gateNo, reason });
    return this.getGate(projectId, gateNo);
  }
}
