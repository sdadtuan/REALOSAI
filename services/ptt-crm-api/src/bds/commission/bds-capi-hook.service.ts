import { Injectable, Logger, Optional } from '@nestjs/common';
import { JobQueueRepository } from '../../webhooks/job-queue.repository';
import { bdsCapiClientId, isBdsCapiEnabled } from '../bds.flags';
import type { TxRow } from '../transactions/bds-tx.types';
import { BdsCommissionRepository } from './bds-commission.repository';
import {
  buildCapiDispatchPayload,
  capiPurchaseValueVnd,
  shouldEnqueueCapiHttp,
} from './bds-capi.util';

type CapiEventName = 'Lead' | 'Schedule' | 'Purchase';

@Injectable()
export class BdsCapiHookService {
  private readonly logger = new Logger(BdsCapiHookService.name);

  constructor(
    private readonly repo: BdsCommissionRepository,
    @Optional() private readonly jobs?: JobQueueRepository | null,
  ) {}

  async onLead(input: { tenantId: string; leadId: number }): Promise<void> {
    await this.emit({
      tenantId: input.tenantId,
      leadId: input.leadId,
      eventName: 'Lead',
      valueVnd: null,
      eventId: `bds:Lead:${input.leadId}`,
    });
  }

  async onSchedule(input: { tenantId: string; leadId: number; visitId: string }): Promise<void> {
    await this.emit({
      tenantId: input.tenantId,
      leadId: input.leadId,
      eventName: 'Schedule',
      valueVnd: null,
      eventId: `bds:Schedule:${input.visitId}`,
    });
  }

  async onPurchase(tx: TxRow): Promise<void> {
    if (!isBdsCapiEnabled()) return;
    await this.emit({
      tenantId: String(tx.tenant_id ?? ''),
      leadId: tx.lead_id,
      transactionId: tx.id,
      eventName: 'Purchase',
      valueVnd: capiPurchaseValueVnd(tx),
      eventId: `bds:Purchase:${tx.id}`,
    });
  }

  private async emit(input: {
    tenantId: string;
    leadId?: number | null;
    transactionId?: string;
    eventName: CapiEventName;
    valueVnd: number | null;
    eventId: string;
  }): Promise<void> {
    if (!isBdsCapiEnabled()) return;
    const clientId = bdsCapiClientId();
    const enqueue = shouldEnqueueCapiHttp({ capiOn: true, clientId });
    await this.repo.insertCapiEvent({
      tenantId: input.tenantId,
      transactionId: input.transactionId ?? null,
      leadId: input.leadId,
      eventName: input.eventName,
      valueVnd: input.valueVnd,
      status: enqueue ? 'logged' : 'skipped',
    });
    if (!enqueue || !this.jobs) return;
    try {
      await this.jobs.enqueueCapiDispatch({
        payload: buildCapiDispatchPayload({
          clientId,
          leadId: input.leadId,
          eventName: input.eventName,
          valueVnd: input.valueVnd,
          eventId: input.eventId,
        }),
        idempotencyKey: input.eventId.replace(/^bds:/, 'bds:capi:'),
        clientId,
      });
    } catch (err) {
      this.logger.warn(`capi enqueue failed ${input.eventId}: ${String(err)}`);
    }
  }
}
