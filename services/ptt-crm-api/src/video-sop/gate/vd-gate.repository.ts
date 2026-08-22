import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type { GateStatus } from '../rules/vd-stage.guard';

export type VdGateRow = {
  id: number;
  project_id: number;
  gate_no: number;
  status: GateStatus;
  created_at: string;
  updated_at: string;
};

export type VdApprovalRow = {
  id: number;
  gate_id: number;
  actor_email: string;
  action: 'approve' | 'reject' | 'override';
  reason: string;
  created_at: string;
};

type MemoryStore = {
  gates: VdGateRow[];
  approvals: VdApprovalRow[];
  reworks: Array<{ id: number; project_id: number; gate_no: number; reason: string; created_at: string }>;
  nextGateId: number;
  nextApprovalId: number;
  nextReworkId: number;
};

@Injectable()
export class VdGateRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = {
    gates: [],
    approvals: [],
    reworks: [],
    nextGateId: 1,
    nextApprovalId: 1,
    nextReworkId: 1,
  };

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM vd_gates LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private assertWritableOrThrow(): void {
    if (this.config.contentMarketingVideoCinematicEnabled) {
      throw new Error('vd_tables_missing');
    }
  }

  private mapGate(row: Record<string, unknown>): VdGateRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      gate_no: Number(row.gate_no),
      status: String(row.status ?? 'pending') as GateStatus,
      created_at: new Date(String(row.created_at)).toISOString(),
      updated_at: new Date(String(row.updated_at)).toISOString(),
    };
  }

  async getOrCreate(projectId: number, gateNo: number): Promise<VdGateRow> {
    if (await this.ensurePgReady()) {
      const existing = await this.db.query(
        `SELECT id, project_id, gate_no, status, created_at, updated_at
         FROM vd_gates WHERE project_id = $1 AND gate_no = $2`,
        [projectId, gateNo],
      );
      if (existing.rows[0]) {
        return this.mapGate(existing.rows[0] as Record<string, unknown>);
      }
      const res = await this.db.query(
        `INSERT INTO vd_gates (project_id, gate_no, status)
         VALUES ($1, $2, 'pending')
         RETURNING id, project_id, gate_no, status, created_at, updated_at`,
        [projectId, gateNo],
      );
      return this.mapGate(res.rows[0] as Record<string, unknown>);
    }
    this.assertWritableOrThrow();
    let row = this.memory.gates.find((g) => g.project_id === projectId && g.gate_no === gateNo);
    if (!row) {
      const now = new Date().toISOString();
      row = {
        id: this.memory.nextGateId++,
        project_id: projectId,
        gate_no: gateNo,
        status: 'pending',
        created_at: now,
        updated_at: now,
      };
      this.memory.gates.push(row);
    }
    return row;
  }

  async getStatusMap(projectId: number): Promise<Record<number, GateStatus>> {
    const out: Record<number, GateStatus> = {};
    for (const gateNo of [1, 2, 3, 4]) {
      const row = await this.getOrCreate(projectId, gateNo);
      out[gateNo] = row.status;
    }
    return out;
  }

  async updateStatus(projectId: number, gateNo: number, status: GateStatus): Promise<VdGateRow> {
    const row = await this.getOrCreate(projectId, gateNo);
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE vd_gates SET status = $3, updated_at = now()
         WHERE project_id = $1 AND gate_no = $2
         RETURNING id, project_id, gate_no, status, created_at, updated_at`,
        [projectId, gateNo, status],
      );
      return this.mapGate(res.rows[0] as Record<string, unknown>);
    }
    this.assertWritableOrThrow();
    row.status = status;
    row.updated_at = new Date().toISOString();
    return row;
  }

  async insertApproval(input: {
    gate_id: number;
    actor_email: string;
    action: 'approve' | 'reject' | 'override';
    reason: string;
  }): Promise<VdApprovalRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO vd_approvals (gate_id, actor_email, action, reason)
         VALUES ($1, $2, $3, $4)
         RETURNING id, gate_id, actor_email, action, reason, created_at`,
        [input.gate_id, input.actor_email, input.action, input.reason],
      );
      const row = res.rows[0] as Record<string, unknown>;
      return {
        id: Number(row.id),
        gate_id: Number(row.gate_id),
        actor_email: String(row.actor_email ?? ''),
        action: String(row.action) as VdApprovalRow['action'],
        reason: String(row.reason ?? ''),
        created_at: new Date(String(row.created_at)).toISOString(),
      };
    }
    this.assertWritableOrThrow();
    const approval: VdApprovalRow = {
      id: this.memory.nextApprovalId++,
      gate_id: input.gate_id,
      actor_email: input.actor_email,
      action: input.action,
      reason: input.reason,
      created_at: new Date().toISOString(),
    };
    this.memory.approvals.push(approval);
    return approval;
  }

  async insertRework(input: { project_id: number; gate_no: number; reason: string }): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(
        `INSERT INTO vd_rework_items (project_id, gate_no, reason) VALUES ($1, $2, $3)`,
        [input.project_id, input.gate_no, input.reason],
      );
      return;
    }
    this.assertWritableOrThrow();
    this.memory.reworks.push({
      id: this.memory.nextReworkId++,
      project_id: input.project_id,
      gate_no: input.gate_no,
      reason: input.reason,
      created_at: new Date().toISOString(),
    });
  }

  async countReworks(projectId: number): Promise<number> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT COUNT(*)::int AS c FROM vd_rework_items WHERE project_id = $1`,
        [projectId],
      );
      return Number((res.rows[0] as { c?: unknown }).c ?? 0);
    }
    return this.memory.reworks.filter((row) => row.project_id === projectId).length;
  }

  async countOverrides(projectId: number): Promise<number> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT COUNT(*)::int AS c
         FROM vd_approvals a
         INNER JOIN vd_gates g ON g.id = a.gate_id
         WHERE g.project_id = $1 AND a.action = 'override'`,
        [projectId],
      );
      return Number((res.rows[0] as { c?: unknown }).c ?? 0);
    }
    const gateIds = new Set(
      this.memory.gates.filter((g) => g.project_id === projectId).map((g) => g.id),
    );
    return this.memory.approvals.filter(
      (row) => gateIds.has(row.gate_id) && row.action === 'override',
    ).length;
  }

  async countApprovals(projectId: number): Promise<number> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT COUNT(*)::int AS c
         FROM vd_approvals a
         INNER JOIN vd_gates g ON g.id = a.gate_id
         WHERE g.project_id = $1 AND a.action IN ('approve', 'override')`,
        [projectId],
      );
      return Number((res.rows[0] as { c?: unknown }).c ?? 0);
    }
    const gateIds = new Set(
      this.memory.gates.filter((g) => g.project_id === projectId).map((g) => g.id),
    );
    return this.memory.approvals.filter(
      (row) => gateIds.has(row.gate_id) && (row.action === 'approve' || row.action === 'override'),
    ).length;
  }
}
