import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  definitionsPayload,
  getUiDefinition,
} from './intake-definitions.util';
import { IntakePgRepository } from './intake-pg.repository';
import { CreateIntakeSessionBody, PatchIntakeSessionBody } from './intake.types';
import { LeadMeetingPrepEnqueueService } from '../lead-meeting-prep/lead-meeting-prep-enqueue.service';
import { IntakeB2bVisibilityService, IntakeStaffActor } from './intake-b2b-visibility.service';

@Injectable()
export class IntakeService {
  constructor(
    private readonly pg: IntakePgRepository,
    private readonly lmpEnqueue: LeadMeetingPrepEnqueueService,
    private readonly b2bVisibility: IntakeB2bVisibilityService,
  ) {}

  getDefinitions() {
    return definitionsPayload();
  }

  getDefinition(slug: string) {
    return getUiDefinition(slug);
  }

  getStats(amId?: number, byAm?: boolean) {
    return this.pg.getIntakeStats(amId, byAm);
  }

  async resolveEntry(
    leadId?: number,
    mode?: string,
    form?: string,
    actor?: IntakeStaffActor | null,
  ) {
    if (!leadId || !Number.isFinite(leadId)) {
      throw new BadRequestException({ ok: false, error: 'Cần lead_id' });
    }
    await this.b2bVisibility.assertLeadVisible(leadId, actor);
    const result = await this.pg.resolveIntakeEntry(leadId, mode, form);
    if (!result.ok) {
      throw new NotFoundException(result);
    }
    return result;
  }

  async listSessions(
    leadId?: number,
    lifecycleId?: number,
    actor?: IntakeStaffActor | null,
  ) {
    if (!lifecycleId && !leadId) {
      throw new BadRequestException({ error: 'Cần lifecycle_id hoặc lead_id' });
    }
    if (leadId) {
      await this.b2bVisibility.assertLeadVisible(leadId, actor);
    }
    const sessions = await this.pg.listSessions({ leadId, lifecycleId });
    return { sessions };
  }

  async getSession(id: number, actor?: IntakeStaffActor | null) {
    const session = await this.pg.getSession(id);
    if (!session) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    if (session.lead_id) {
      await this.b2bVisibility.assertLeadVisible(session.lead_id, actor);
    }
    return session;
  }

  async createSession(body: CreateIntakeSessionBody, actor?: IntakeStaffActor | null) {
    if (body.lead_id) {
      await this.b2bVisibility.assertLeadVisible(body.lead_id, actor);
    }
    try {
      return await this.pg.createSession(body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException({ error: msg });
    }
  }

  async updateSession(id: number, body: PatchIntakeSessionBody, actor?: IntakeStaffActor | null) {
    const existing = await this.pg.getSession(id);
    if (!existing) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    if (existing.lead_id) {
      await this.b2bVisibility.assertLeadVisible(existing.lead_id, actor);
    }
    const updated = await this.pg.updateSession(id, body);
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    return updated;
  }

  async completeSession(
    id: number,
    actorId: number | null,
    actor?: IntakeStaffActor | null,
  ) {
    const existing = await this.pg.getSession(id);
    if (!existing) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    if (existing.lead_id) {
      await this.b2bVisibility.assertLeadVisible(existing.lead_id, actor);
    }
    try {
      const updated = await this.pg.completeSession(id, actorId);
      if (!updated) {
        throw new NotFoundException({ error: 'Không tìm thấy phiên' });
      }
      if (String(updated.decision ?? '').trim() === 'go' && updated.lead_id) {
        void this.lmpEnqueue.enqueueAfterIntakeGo(updated.lead_id);
      }
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('quyết định')) {
        throw new BadRequestException({ error: msg });
      }
      throw err;
    }
  }

  async reopenSession(id: number, actor?: IntakeStaffActor | null) {
    const existing = await this.pg.getSession(id);
    if (!existing) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    if (existing.lead_id) {
      await this.b2bVisibility.assertLeadVisible(existing.lead_id, actor);
    }
    const updated = await this.pg.reopenSession(id);
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    return updated;
  }

  async deleteSession(id: number, actor?: IntakeStaffActor | null) {
    const existing = await this.pg.getSession(id);
    if (!existing) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    if (existing.lead_id) {
      await this.b2bVisibility.assertLeadVisible(existing.lead_id, actor);
    }
    try {
      const deleted = await this.pg.deleteSession(id);
      if (!deleted) {
        throw new NotFoundException({ error: 'Không tìm thấy phiên' });
      }
      return { ok: true, deleted_id: id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('nháp')) {
        throw new BadRequestException({ error: msg });
      }
      throw err;
    }
  }

  async generateAiSummary(id: number, actor?: IntakeStaffActor | null) {
    const session = await this.pg.getSession(id);
    if (!session) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    if (session.lead_id) {
      await this.b2bVisibility.assertLeadVisible(session.lead_id, actor);
    }
    const hasKey = Boolean(String(process.env.ANTHROPIC_API_KEY ?? '').trim());
    if (!hasKey) {
      return {
        ...session,
        ai_summary: `[stub] Intake #${id} — configure ANTHROPIC_API_KEY for AI summary`,
        stub: true,
      };
    }
    const updated = await this.pg.saveAiSummaryStub(id);
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy phiên' });
    }
    return updated;
  }
}
