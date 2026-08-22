import { Injectable, NotFoundException } from '@nestjs/common';
import { StaffPermissionsRepository } from '../staff-permissions/staff-permissions.repository';
import { AdminIntelligenceRepository } from './admin-intelligence.repository';
import type { CreateEnvDiffBody, EnvDiffMatrixRow, EnvDiffResult } from './admin-intelligence.types';

type MatrixPayload = Record<string, Record<string, string[]>>;

function extractMatrix(payload: Record<string, unknown>): MatrixPayload {
  const grants = payload.grants as MatrixPayload | undefined;
  if (grants && typeof grants === 'object') return grants;
  const positions = payload.positions as Array<{ code: string; grants: MatrixPayload[string] }> | undefined;
  if (Array.isArray(positions)) {
    const out: MatrixPayload = {};
    for (const p of positions) {
      if (p?.code) out[p.code] = p.grants ?? {};
    }
    return out;
  }
  return {};
}

function capStrings(grants: Record<string, string[]>): string[] {
  const out: string[] = [];
  for (const [section, actions] of Object.entries(grants ?? {})) {
    for (const action of actions ?? []) {
      out.push(`${section}.${action}`);
    }
  }
  return out.sort();
}

function diffMatrix(left: MatrixPayload, right: MatrixPayload): EnvDiffMatrixRow[] {
  const codes = new Set([...Object.keys(left), ...Object.keys(right)]);
  const rows: EnvDiffMatrixRow[] = [];
  for (const code of [...codes].sort()) {
    const leftCaps = new Set(capStrings(left[code] ?? {}));
    const rightCaps = new Set(capStrings(right[code] ?? {}));
    const added = [...rightCaps].filter((c) => !leftCaps.has(c));
    const removed = [...leftCaps].filter((c) => !rightCaps.has(c));
    if (added.length || removed.length) {
      rows.push({ position_code: code, added, removed });
    }
  }
  return rows;
}

function classifySeverity(rows: EnvDiffMatrixRow[]): EnvDiffResult['severity'] {
  const criticalPatterns = ['configure', 'delete'];
  for (const row of rows) {
    for (const cap of [...row.added, ...row.removed]) {
      if (criticalPatterns.some((p) => cap.endsWith(`.${p}`))) return 'critical';
    }
  }
  return rows.length > 5 ? 'warning' : 'info';
}

@Injectable()
export class EnvironmentDiffService {
  constructor(
    private readonly repo: AdminIntelligenceRepository,
    private readonly permissionsRepo: StaffPermissionsRepository,
  ) {}

  async listSnapshots() {
    const snapshots = await this.repo.listSnapshots();
    return { snapshots };
  }

  async buildLiveMatrixPayload(): Promise<Record<string, unknown>> {
    const positions = await this.permissionsRepo.listPositions();
    const grants: MatrixPayload = {};
    for (const pos of positions) {
      const caps = await this.permissionsRepo.loadCaps(pos.id);
      const map: Record<string, string[]> = {};
      for (const cap of caps) {
        if (!map[cap.section_id]) map[cap.section_id] = [];
        map[cap.section_id].push(cap.action);
      }
      grants[pos.code] = map;
    }
    return { grants, generated_at: new Date().toISOString() };
  }

  async createDiff(body: CreateEnvDiffBody, actorEmail: string): Promise<EnvDiffResult> {
    let leftPayload: Record<string, unknown>;
    let rightPayload: Record<string, unknown>;
    const leftLabel = body.left_label ?? 'staging';
    const rightLabel = body.right_label ?? 'prod';

    if (body.upload_json) {
      rightPayload = body.upload_json;
      leftPayload = await this.buildLiveMatrixPayload();
    } else {
      if (body.left_snapshot_id != null) {
        const payload = await this.repo.getSnapshotPayload(body.left_snapshot_id);
        if (!payload) throw new NotFoundException({ error: 'left_snapshot_not_found' });
        leftPayload = payload;
      } else {
        leftPayload = await this.buildLiveMatrixPayload();
      }
      if (body.right_snapshot_id != null) {
        const payload = await this.repo.getSnapshotPayload(body.right_snapshot_id);
        if (!payload) throw new NotFoundException({ error: 'right_snapshot_not_found' });
        rightPayload = payload;
      } else {
        rightPayload = await this.buildLiveMatrixPayload();
      }
    }

    const matrixDiff = diffMatrix(extractMatrix(leftPayload), extractMatrix(rightPayload));
    const summary = {
      added: matrixDiff.reduce((n, r) => n + r.added.length, 0),
      removed: matrixDiff.reduce((n, r) => n + r.removed.length, 0),
      changed: matrixDiff.length,
    };
    const severity = classifySeverity(matrixDiff);

    const resultBody: Omit<EnvDiffResult, 'id' | 'created_at'> = {
      summary,
      matrix_diff: matrixDiff,
      severity,
      left_label: leftLabel,
      right_label: rightLabel,
    };

    return this.repo.saveEnvDiff({
      left_snapshot_id: body.left_snapshot_id ?? null,
      right_snapshot_id: body.right_snapshot_id ?? null,
      left_label: leftLabel,
      right_label: rightLabel,
      result_json: resultBody as unknown as Record<string, unknown>,
      severity,
      created_by: actorEmail,
    });
  }

  async getDiff(id: string): Promise<EnvDiffResult> {
    const diff = await this.repo.getEnvDiff(id);
    if (!diff) throw new NotFoundException({ error: 'diff_not_found', id });
    return diff;
  }
}
