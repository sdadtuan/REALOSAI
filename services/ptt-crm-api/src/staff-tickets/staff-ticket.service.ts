import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { StaffTicketRepository } from './staff-ticket.repository';
import type {
  CloseRequires,
  CreateTicketBody,
  ListTicketsFilter,
  QueueRow,
  TicketRow,
} from './staff-ticket.types';
import { QUEUE_SEEDS } from './staff-ticket.types';
import { canTransition, isRestrictedQueue } from './staff-ticket.util';

type TenantLookup = {
  getMe(tenantId: string): Promise<{ mode: string; id?: string }>;
};

@Injectable()
export class StaffTicketService {
  private readonly logger = new Logger(StaffTicketService.name);

  constructor(
    private readonly repo: StaffTicketRepository,
    @Optional() private readonly tenants?: TenantLookup | null,
  ) {}

  private requireTenant(tenantId?: string): string {
    const t = String(tenantId ?? '').trim();
    if (!t) throw new NotFoundException();
    return t;
  }

  private async assertDeveloper(tenantId: string): Promise<void> {
    if (!this.tenants) return;
    try {
      const me = await this.tenants.getMe(tenantId);
      if (String(me.mode) === 'broker') throw new NotFoundException();
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.warn(`assertDeveloper getMe ${tenantId}: ${String(err)}`);
    }
  }

  private assertTenantMatch(ticket: TicketRow, tenantId: string): void {
    if (String(ticket.tenant_id) !== tenantId) throw new NotFoundException();
  }

  private maskTicket(ticket: TicketRow, viewerDept: string | null, viewerStaffId: number): TicketRow {
    if (
      isRestrictedQueue(ticket.queue_code) &&
      ticket.assignee_dept_code &&
      viewerDept !== ticket.assignee_dept_code &&
      ticket.assignee_staff_id !== viewerStaffId &&
      ticket.requester_staff_id !== viewerStaffId
    ) {
      return { ...ticket, body: '', hidden: true };
    }
    return { ...ticket, hidden: false };
  }

  async ensureSeeded(tenantId: string): Promise<void> {
    const tid = this.requireTenant(tenantId);
    if (this.tenants) {
      try {
        await this.tenants.getMe(tid);
      } catch (err) {
        this.logger.warn(`ensureSeeded getMe ${tid}: ${String(err)}`);
      }
    }
    for (const seed of QUEUE_SEEDS) {
      try {
        await this.repo.upsertQueue({ ...seed, tenant_id: tid });
      } catch (err) {
        this.logger.warn(`ensureSeeded queue ${seed.code}: ${String(err)}`);
      }
    }
  }

  async listQueues(tenantId: string): Promise<QueueRow[]> {
    const tid = this.requireTenant(tenantId);
    await this.assertDeveloper(tid);
    await this.ensureSeeded(tid);
    return this.repo.listQueues(tid);
  }

  async listTickets(
    staffId: number,
    tenantId: string,
    filter: ListTicketsFilter = {},
  ): Promise<TicketRow[]> {
    const tid = this.requireTenant(tenantId);
    await this.assertDeveloper(tid);
    await this.ensureSeeded(tid);
    const deptCode = await this.repo.getStaffDepartmentCode(staffId);
    const rows = await this.repo.listTickets(tid, {
      inbox: filter.inbox,
      staffId,
      deptCode,
      queue: filter.queue,
      overdue: filter.overdue,
      projectId: filter.projectId,
    });
    return rows.map((row) => this.maskTicket(row, deptCode, staffId));
  }

  async getTicket(id: string, staffId: number, tenantId: string): Promise<TicketRow> {
    const tid = this.requireTenant(tenantId);
    await this.assertDeveloper(tid);
    const ticket = await this.repo.getById(id);
    if (!ticket) throw new NotFoundException();
    this.assertTenantMatch(ticket, tid);
    const deptCode = await this.repo.getStaffDepartmentCode(staffId);
    return this.maskTicket(ticket, deptCode, staffId);
  }

  async createTicket(
    staffId: number,
    tenantId: string,
    body: CreateTicketBody,
  ): Promise<TicketRow> {
    const tid = this.requireTenant(tenantId);
    await this.assertDeveloper(tid);
    await this.ensureSeeded(tid);

    const idemKey = String(body.idempotency_key ?? '').trim();
    if (idemKey) {
      const existing = await this.repo.getByIdempotencyKey(tid, idemKey);
      if (existing) return existing;
    }

    const title = String(body.title ?? '').trim();
    if (!title) throw new BadRequestException({ error: 'title' });

    const queue = await this.repo.getQueue(tid, body.queue_code);
    if (!queue) throw new BadRequestException({ error: 'queue' });

    const requesterDept =
      (await this.repo.getStaffDepartmentCode(staffId)) ?? body.entity_type ?? null;

    let assigneeDept: string | null;
    if (body.kind === 'dept') {
      assigneeDept = requesterDept;
    } else {
      assigneeDept = queue.assignee_dept_code ?? requesterDept;
      if (assigneeDept && requesterDept && assigneeDept === requesterDept) {
        throw new BadRequestException({ error: 'assignee_dept' });
      }
    }

    const slaDue =
      queue.sla_minutes != null
        ? new Date(Date.now() + queue.sla_minutes * 60 * 1000)
        : null;

    const number = await this.repo.nextNumber(tid);
    const ticket = await this.repo.insertTicket({
      tenant_id: tid,
      number,
      kind: body.kind,
      queue_code: body.queue_code,
      title,
      body: String(body.body ?? ''),
      priority: body.priority ?? 'p2',
      requester_staff_id: staffId,
      requester_dept_code: requesterDept,
      assignee_dept_code: assigneeDept,
      project_id: body.project_id ?? null,
      entity_type: body.entity_type ?? null,
      entity_id: body.entity_id ?? null,
      room_id: body.room_id ?? null,
      sla_due_at: slaDue,
      created_by: staffId,
      idempotency_key: idemKey || null,
    });

    await this.repo.addWatcher(ticket.id, staffId);
    await this.repo.insertEvent(ticket.id, 'created', staffId, { kind: body.kind });

    return ticket;
  }

  async patchTicket(
    id: string,
    staffId: number,
    tenantId: string,
    patch: { title?: string; body?: string; priority?: TicketRow['priority'] },
  ): Promise<TicketRow> {
    const tid = this.requireTenant(tenantId);
    await this.assertDeveloper(tid);
    const ticket = await this.repo.getById(id);
    if (!ticket) throw new NotFoundException();
    this.assertTenantMatch(ticket, tid);

    const updated = await this.repo.updateTicket(id, {
      title: patch.title?.trim() || undefined,
      body: patch.body,
      priority: patch.priority,
    });
    if (!updated) throw new NotFoundException();
    await this.repo.insertEvent(id, 'patched', staffId, patch);
    const deptCode = await this.repo.getStaffDepartmentCode(staffId);
    return this.maskTicket(updated, deptCode, staffId);
  }

  async assign(
    id: string,
    actorStaffId: number,
    body: { staff_id?: number },
    tenantId: string,
    opts: { canAssign?: boolean } = {},
  ): Promise<TicketRow> {
    const tid = this.requireTenant(tenantId);
    await this.assertDeveloper(tid);
    const ticket = await this.repo.getById(id);
    if (!ticket) throw new NotFoundException();
    this.assertTenantMatch(ticket, tid);

    const actorDept = await this.repo.getStaffDepartmentCode(actorStaffId);
    const assigneeDept = ticket.assignee_dept_code;
    if (!assigneeDept) throw new BadRequestException({ error: 'assignee_dept' });

    if (actorDept !== assigneeDept && !opts.canAssign) {
      throw new NotFoundException();
    }

    const targetStaffId = body.staff_id ?? actorStaffId;
    const targetDept = await this.repo.getStaffDepartmentCode(targetStaffId);
    if (targetDept !== assigneeDept) {
      throw new BadRequestException({ error: 'assignee_dept' });
    }

    const updated = await this.repo.updateTicket(id, {
      assignee_staff_id: targetStaffId,
      status: ticket.status === 'open' ? 'in_progress' : ticket.status,
    });
    if (!updated) throw new NotFoundException();
    await this.repo.insertEvent(id, 'assigned', actorStaffId, {
      assignee_staff_id: targetStaffId,
    });
    await this.repo.addWatcher(id, targetStaffId);
    const deptCode = await this.repo.getStaffDepartmentCode(actorStaffId);
    return this.maskTicket(updated, deptCode, actorStaffId);
  }

  async transition(
    id: string,
    staffId: number,
    body: { to: TicketRow['status']; reason?: string; comment?: string },
    tenantId: string,
    opts: { system?: boolean } = {},
  ): Promise<TicketRow> {
    const tid = this.requireTenant(tenantId);
    await this.assertDeveloper(tid);
    const ticket = await this.repo.getById(id);
    if (!ticket) throw new NotFoundException();
    this.assertTenantMatch(ticket, tid);

    const to = body.to;
    if (!canTransition(ticket.status, to)) {
      throw new ConflictException({ error: 'status' });
    }

    if (to === 'blocked') {
      const reason = String(body.reason ?? '').trim();
      if (!reason) throw new BadRequestException({ error: 'reason' });
    }

    if (to === 'done') {
      const queue = await this.repo.getQueue(tid, ticket.queue_code);
      await this.assertCloseRequires(ticket, queue, body.comment, opts.system === true);
    }

    if (body.comment?.trim()) {
      await this.repo.insertComment(id, staffId, body.comment.trim());
    }

    const patch: Parameters<StaffTicketRepository['updateTicket']>[1] = { status: to };
    if (to === 'blocked') patch.blocked_reason = String(body.reason ?? '').trim();
    if (to === 'waiting') patch.waiting_on = String(body.reason ?? body.comment ?? '').trim();
    if (to === 'done') patch.completed_at = new Date();
    if (to === 'cancelled') patch.cancelled_reason = String(body.reason ?? '').trim();

    const updated = await this.repo.updateTicket(id, patch);
    if (!updated) throw new NotFoundException();
    await this.repo.insertEvent(id, 'transition', staffId, { from: ticket.status, to });
    const deptCode = await this.repo.getStaffDepartmentCode(staffId);
    return this.maskTicket(updated, deptCode, staffId);
  }

  private async assertCloseRequires(
    ticket: TicketRow,
    queue: QueueRow | null,
    comment?: string,
    system?: boolean,
  ): Promise<void> {
    const req: CloseRequires = queue?.close_requires ?? { type: 'none' };
    switch (req.type) {
      case 'installments_exist': {
        const entityId = ticket.entity_id ?? '';
        const count = entityId ? await this.repo.countInstallments(entityId) : 0;
        if (count < 1) throw new BadRequestException({ error: 'artifact' });
        break;
      }
      case 'system_only':
        if (!system) throw new BadRequestException({ error: 'system_only' });
        break;
      case 'comment_min': {
        const commentLen = String(comment ?? '').trim().length;
        const storedLen = await this.repo.latestCommentLen(ticket.id);
        if (commentLen + storedLen < req.min) {
          throw new BadRequestException({ error: 'artifact' });
        }
        break;
      }
      default:
        break;
    }
  }

  async watch(id: string, staffId: number, tenantId: string): Promise<void> {
    const tid = this.requireTenant(tenantId);
    await this.assertDeveloper(tid);
    const ticket = await this.repo.getById(id);
    if (!ticket) throw new NotFoundException();
    this.assertTenantMatch(ticket, tid);
    await this.repo.addWatcher(id, staffId);
    await this.repo.insertEvent(id, 'watch', staffId, {});
  }

  async createHandoffTicket(
    tenantId: string,
    input: {
      queue_code: string;
      title: string;
      body: string;
      entity_type: string;
      entity_id: string;
      requester_staff_id?: number | null;
      requester_dept_code?: string | null;
    },
  ): Promise<TicketRow | null> {
    const tid = this.requireTenant(tenantId);
    await this.ensureSeeded(tid);

    const existing = await this.repo.getOpenByEntity(
      tid,
      input.entity_type,
      input.entity_id,
      input.queue_code,
    );
    if (existing) return existing;

    const queue = await this.repo.getQueue(tid, input.queue_code);
    if (!queue) {
      this.logger.warn(`createHandoffTicket missing queue ${input.queue_code}`);
      return null;
    }

    const requesterStaffId = input.requester_staff_id ?? 0;
    const requesterDept = input.requester_dept_code ?? null;
    const slaDue =
      queue.sla_minutes != null
        ? new Date(Date.now() + queue.sla_minutes * 60 * 1000)
        : null;

    const number = await this.repo.nextNumber(tid);
    const ticket = await this.repo.insertTicket({
      tenant_id: tid,
      number,
      kind: 'cross',
      queue_code: input.queue_code,
      title: input.title,
      body: input.body,
      requester_staff_id: requesterStaffId,
      requester_dept_code: requesterDept,
      assignee_dept_code: queue.assignee_dept_code,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      sla_due_at: slaDue,
      created_by: null,
    });

    await this.repo.insertEvent(ticket.id, 'handoff', null, {
      entity_type: input.entity_type,
      entity_id: input.entity_id,
    });
    return ticket;
  }

  async markSlaBreaches(now: Date): Promise<number> {
    const rows = await this.repo.markSlaBreachedDue(now);
    for (const row of rows) {
      await this.repo.insertEvent(row.id, 'sla_breach', null, {});
    }
    return rows.length;
  }
}
