import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import {
  assertTransition,
  scheduleFromStatuses,
} from './content-workflow.util';
import type { CmktCalendarSlotRow } from './content-marketing.types';

@Injectable()
export class ContentCalendarService {
  constructor(
    private readonly config: AppConfigService,
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
  ) {}

  async listCalendar(
    lifecycleId: number,
    query: { from?: string; to?: string },
  ): Promise<{ slots: CmktCalendarSlotRow[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const slots = await this.repo.listCalendarSlots(lifecycleId, {
      from: query.from,
      to: query.to,
    });
    const enriched = await Promise.all(
      slots.map(async (slot) => {
        const item = await this.repo.getItemById(lifecycleId, slot.item_id);
        return { ...slot, item: item ?? undefined };
      }),
    );
    return { slots: enriched };
  }

  async upsertSlot(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<{ slot: CmktCalendarSlotRow; item: import('./content-marketing.types').CmktItemRow }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });

    assertTransition(
      item.status,
      scheduleFromStatuses(this.config.contentMarketingClientGate),
      'schedule',
    );

    const scheduledAt = String(body.scheduled_at ?? '').trim();
    if (!scheduledAt) {
      throw new BadRequestException({ error: 'scheduled_at_required' });
    }

    const slot = await this.repo.upsertCalendarSlot({
      lifecycle_id: lifecycleId,
      item_id: itemId,
      scheduled_at: scheduledAt,
      timezone: body.timezone != null ? String(body.timezone) : undefined,
    });

    const updated = await this.repo.patchItem(lifecycleId, itemId, { status: 'scheduled' });
    await this.repo.insertItemVersion(updated.id, updated.body_json, actorEmail, 'schedule');

    return { slot, item: updated };
  }

  async deleteSlot(lifecycleId: number, itemId: number): Promise<{ ok: boolean }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const deleted = await this.repo.deleteCalendarSlot(lifecycleId, itemId);
    if (!deleted) throw new NotFoundException({ error: 'calendar_slot_not_found', item_id: itemId });
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (item?.status === 'scheduled') {
      const revertStatus = this.config.contentMarketingClientGate ? 'client_approved' : 'approved_internal';
      await this.repo.patchItem(lifecycleId, itemId, { status: revertStatus });
    }
    return { ok: true };
  }
}
