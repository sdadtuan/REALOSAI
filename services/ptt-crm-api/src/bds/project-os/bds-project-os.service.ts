import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException, Optional, forwardRef } from '@nestjs/common';
import { isStaffTicketsEnabled } from '../../staff-tickets/staff-ticket.flags';
import { StaffTicketService } from '../../staff-tickets/staff-ticket.service';
import { BdsCollectionService } from '../collection/bds-collection.service';
import {
  assertOpenPhaseAllowed,
  computeLegalGate,
  type LegalGate,
} from './bds-legal-gate.util';
import {
  BdsProjectOsRepository,
  type LayoutInput,
  type LayoutRow,
  type LegalDocRow,
  type LegalDocUpsert,
  type MilestoneInput,
  type MilestoneRow,
  type PhaseInput,
  type PhaseRow,
  type PlanKind,
  type RevisionRow,
  type TowerInput,
  type TowerRow,
  type ZoneInput,
  type ZoneRow,
} from './bds-project-os.repository';

const PLAN_KINDS: readonly PlanKind[] = ['business', 'marketing', 'sales'];

const OVERRIDE_MS = 15 * 24 * 60 * 60 * 1000;

function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === '23505');
}

function trimCode(code: unknown): string {
  return String(code ?? '').trim();
}

@Injectable()
export class BdsProjectOsService {
  private readonly logger = new Logger(BdsProjectOsService.name);

  constructor(
    private readonly repo: BdsProjectOsRepository,
    @Optional() private readonly tickets?: StaffTicketService | null,
    @Optional()
    @Inject(forwardRef(() => BdsCollectionService))
    private readonly collection?: BdsCollectionService | null,
  ) {}

  private optionalTenant(tenantId?: string): string | undefined {
    const t = String(tenantId ?? '').trim();
    return t || undefined;
  }

  private async assertProjectTenant(projectId: number, tenantId?: string): Promise<void> {
    const t = this.optionalTenant(tenantId);
    if (!t) return;
    const projectTenant = await this.repo.resolveProjectTenantId(projectId);
    if (!projectTenant || projectTenant !== t) {
      throw new NotFoundException();
    }
  }

  async listLegalDocs(projectId: number, tenantId?: string): Promise<LegalDocRow[]> {
    await this.assertProjectTenant(projectId, tenantId);
    return this.repo.listLegalDocs(projectId);
  }

  async upsertLegalDoc(projectId: number, doc: LegalDocUpsert, tenantId?: string): Promise<LegalDocRow> {
    await this.assertProjectTenant(projectId, tenantId);
    const stamped = await this.stampProjectTenant(projectId, doc);
    const row = await this.repo.upsertLegalDoc(projectId, stamped);
    await this.refreshLegalGate(projectId);
    if (
      isStaffTicketsEnabled() &&
      String(doc.doc_type ?? '').includes('so_xd') &&
      String(row.status) === 'valid'
    ) {
      try {
        const tenant_id = await this.repo.resolveProjectTenantId(projectId);
        if (tenant_id) {
          await this.tickets?.createHandoffTicket(tenant_id, {
            queue_code: 'legal_gate_phase',
            title: `Cổng pháp lý đợt · dự án ${projectId}`,
            body: String(doc.doc_type),
            entity_type: 'project',
            entity_id: String(projectId),
            requester_dept_code: 'ban_pm',
            project_id: projectId,
          });
          await this.collection?.tryHdmbGateTicketsForProject(projectId, tenant_id);
        }
      } catch (err) {
        this.logger.warn(`legal_gate_phase project=${projectId}: ${String(err)}`);
      }
    }
    return row;
  }

  async refreshLegalGate(projectId: number, now = new Date()): Promise<LegalGate> {
    const docs = await this.repo.listLegalDocs(projectId);
    const current = await this.repo.getProjectGate(projectId);
    const overrideUntil = current?.legal_gate_override_until
      ? new Date(current.legal_gate_override_until)
      : null;
    const gate = computeLegalGate(docs, now, overrideUntil);
    await this.repo.setProjectGate(projectId, gate);
    return gate;
  }

  async openLegalGate(
    projectId: number,
    body: { override?: boolean; reason?: string } = {},
    now = new Date(),
    tenantId?: string,
  ): Promise<{ legal_gate: LegalGate; override_until?: Date | null }> {
    await this.assertProjectTenant(projectId, tenantId);
    const docs = await this.repo.listLegalDocs(projectId);
    const current = await this.repo.getProjectGate(projectId);
    const storedUntil = current?.legal_gate_override_until
      ? new Date(current.legal_gate_override_until)
      : null;
    const computed = computeLegalGate(docs, now, storedUntil);

    if (computed === 'enough_to_sell') {
      await this.repo.setProjectGate(projectId, 'enough_to_sell');
      return { legal_gate: 'enough_to_sell' };
    }

    const reason = String(body.reason ?? '').trim();
    if (body.override === true && reason.length >= 10) {
      const until = new Date(now.getTime() + OVERRIDE_MS);
      await this.repo.setProjectGate(projectId, 'enough_to_sell', until, reason);
      return { legal_gate: 'enough_to_sell', override_until: until };
    }

    throw new BadRequestException({ error: 'legal_gate' });
  }

  assertOpenPhaseAllowed(legalGate: string): void {
    assertOpenPhaseAllowed(legalGate);
  }

  async createTower(projectId: number, input: TowerInput, tenantId?: string): Promise<TowerRow> {
    await this.assertProjectTenant(projectId, tenantId);
    return this.createCoded('createTower', projectId, input);
  }

  async createZone(projectId: number, input: ZoneInput, tenantId?: string): Promise<ZoneRow> {
    await this.assertProjectTenant(projectId, tenantId);
    return this.createCoded('createZone', projectId, input);
  }

  async createLayout(projectId: number, input: LayoutInput, tenantId?: string): Promise<LayoutRow> {
    await this.assertProjectTenant(projectId, tenantId);
    return this.createCoded('createLayout', projectId, input);
  }

  async createPhase(projectId: number, input: PhaseInput, tenantId?: string): Promise<PhaseRow> {
    await this.assertProjectTenant(projectId, tenantId);
    return this.createCoded('createPhase', projectId, input);
  }

  async createMilestone(
    projectId: number,
    input: MilestoneInput,
    tenantId?: string,
  ): Promise<MilestoneRow> {
    await this.assertProjectTenant(projectId, tenantId);
    return this.createCoded('createMilestone', projectId, input);
  }

  async createRevision(
    projectId: number,
    input: { kind: string; body_json?: unknown; tenant_id?: string | null },
    tenantId?: string,
  ): Promise<RevisionRow> {
    await this.assertProjectTenant(projectId, tenantId);
    const kind = String(input.kind ?? '').trim();
    if (!(PLAN_KINDS as readonly string[]).includes(kind)) throw new BadRequestException();
    const version = (await this.repo.maxRevisionVersion(projectId, kind)) + 1;
    const stamped = await this.stampProjectTenant(projectId, input);
    return this.repo.createRevision(projectId, {
      kind,
      body_json: stamped.body_json ?? {},
      version,
      status: 'draft',
      tenant_id: stamped.tenant_id,
    });
  }

  async approveRevision(id: string, reviewedBy: string, tenantId?: string): Promise<RevisionRow> {
    const revision = await this.repo.getRevision(id);
    if (!revision) throw new NotFoundException();
    await this.assertProjectTenant(revision.project_id, tenantId);
    const row = await this.repo.approveRevision(id, String(reviewedBy ?? ''), new Date());
    if (!row) throw new NotFoundException();
    return row;
  }

  async latestApprovedKinds(projectId: number): Promise<PlanKind[]> {
    const latest = await this.repo.latestRevisionsByKind(projectId);
    return latest.filter((row) => row.status === 'approved').map((row) => row.kind);
  }

  async listRevisions(projectId: number, tenantId?: string): Promise<RevisionRow[]> {
    await this.assertProjectTenant(projectId, tenantId);
    return this.repo.listRevisions(projectId);
  }

  async listMilestones(projectId: number, tenantId?: string): Promise<MilestoneRow[]> {
    await this.assertProjectTenant(projectId, tenantId);
    return this.repo.listMilestones(projectId);
  }

  async markMilestoneReached(
    id: string,
    actualDate: string,
    tenantId?: string,
  ): Promise<MilestoneRow> {
    const milestone = await this.repo.getMilestone(id);
    if (!milestone) throw new NotFoundException();
    await this.assertProjectTenant(milestone.project_id, tenantId);
    const row = await this.repo.markMilestoneReached(id, actualDate);
    if (!row) throw new NotFoundException();
    if (isStaffTicketsEnabled()) {
      try {
        const tenant_id = await this.repo.resolveProjectTenantId(milestone.project_id);
        if (tenant_id) {
          await this.tickets?.createHandoffTicket(tenant_id, {
            queue_code: 'milestone_unlock',
            title: `Mốc ${row.code} · dự án ${milestone.project_id}`,
            body: actualDate,
            entity_type: 'milestone',
            entity_id: id,
            requester_dept_code: 'ban_pm',
            project_id: milestone.project_id,
          });
        }
      } catch (err) {
        this.logger.warn(`milestone_unlock ${id}: ${String(err)}`);
      }
    }
    return row;
  }

  async listTowers(projectId: number, tenantId?: string): Promise<TowerRow[]> {
    await this.assertProjectTenant(projectId, tenantId);
    return this.repo.listTowers(projectId);
  }

  async listZones(projectId: number, tenantId?: string): Promise<ZoneRow[]> {
    await this.assertProjectTenant(projectId, tenantId);
    return this.repo.listZones(projectId);
  }

  async listLayouts(projectId: number, tenantId?: string): Promise<LayoutRow[]> {
    await this.assertProjectTenant(projectId, tenantId);
    return this.repo.listLayouts(projectId);
  }

  async listPhases(projectId: number, tenantId?: string): Promise<PhaseRow[]> {
    await this.assertProjectTenant(projectId, tenantId);
    return this.repo.listPhases(projectId);
  }

  async getPhase(phaseId: string, tenantId?: string): Promise<PhaseRow> {
    const phase = await this.repo.getPhase(phaseId);
    if (!phase) throw new NotFoundException();
    await this.assertProjectTenant(phase.project_id, tenantId);
    return phase;
  }

  async openPhase(phaseId: string, tenantId?: string): Promise<PhaseRow> {
    const phase = await this.repo.getPhase(phaseId);
    if (!phase) throw new NotFoundException();
    await this.assertProjectTenant(phase.project_id, tenantId);
    await this.refreshLegalGate(phase.project_id);
    const gate = await this.repo.getProjectGate(phase.project_id);
    assertOpenPhaseAllowed(gate?.legal_gate ?? 'blocked');
    return this.repo.activatePhase(phaseId, phase.project_id);
  }

  async closePhase(phaseId: string, tenantId?: string): Promise<PhaseRow> {
    const phase = await this.repo.getPhase(phaseId);
    if (!phase) throw new NotFoundException();
    await this.assertProjectTenant(phase.project_id, tenantId);
    const row = await this.repo.closePhase(phaseId);
    if (!row) throw new NotFoundException();
    return row;
  }

  private async stampProjectTenant<T extends { tenant_id?: string | null }>(
    projectId: number,
    input: T,
  ): Promise<T> {
    const { tenant_id: _ignored, ...rest } = input;
    const tenant_id = await this.repo.resolveProjectTenantId(projectId);
    return { ...(rest as T), tenant_id };
  }

  private async createCoded<T>(
    method: 'createTower' | 'createZone' | 'createLayout' | 'createPhase' | 'createMilestone',
    projectId: number,
    input: { code: string; tenant_id?: string | null },
  ): Promise<T> {
    const code = trimCode(input.code);
    if (!code) throw new BadRequestException();
    const stamped = await this.stampProjectTenant(projectId, { ...input, code });
    try {
      return (await this.repo[method](projectId, stamped)) as T;
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException();
      throw err;
    }
  }
}
