import type { VdProjectStage } from './rules/vd-stage.guard';

export type { VdProjectStage };

export type VdProjectStatus = 'active' | 'on_hold' | 'cancelled';

export type VdProjectRow = {
  id: number;
  lifecycle_id: number;
  client_id: string | null;
  cmkt_item_id: number | null;
  title: string;
  stage: VdProjectStage;
  status: VdProjectStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CreateFromContentItemInput = {
  lifecycleId: number;
  itemId: number;
  title: string;
  scriptMarkdown: string;
  email: string;
  clientId?: string | null;
};

export type InsertVdProjectInput = {
  lifecycle_id: number;
  client_id: string | null;
  cmkt_item_id: number | null;
  title: string;
  stage: VdProjectStage;
  status: VdProjectStatus;
  created_by: string;
};

export interface VdProjectRepository {
  findByCmktItemId(itemId: number): Promise<VdProjectRow | null>;
  countCreatedToday(lifecycleId: number): Promise<number>;
  withTransaction<T>(fn: () => Promise<T>): Promise<T>;
  insertProject(input: InsertVdProjectInput): Promise<VdProjectRow>;
  insertBrief(projectId: number, bodyJson: Record<string, unknown>): Promise<void>;
  getBrief(projectId: number): Promise<Record<string, unknown> | null>;
  upsertBrief(projectId: number, bodyJson: Record<string, unknown>): Promise<void>;
  updateStage(projectId: number, stage: VdProjectStage): Promise<void>;
  insertScript(projectId: number, version: number, markdown: string): Promise<void>;
  insertAudit(
    projectId: number,
    actorEmail: string,
    action: string,
    payload?: Record<string, unknown>,
  ): Promise<void>;
  listByLifecycle(lifecycleId: number): Promise<VdProjectRow[]>;
  getById(id: number): Promise<VdProjectRow | null>;
}
