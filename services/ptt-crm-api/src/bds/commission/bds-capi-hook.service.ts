import { Injectable } from '@nestjs/common';
import { isBdsCapiEnabled } from '../bds.flags';
import type { TxRow } from '../transactions/bds-tx.types';
import { BdsCommissionRepository } from './bds-commission.repository';

@Injectable()
export class BdsCapiHookService {
  constructor(private readonly repo: BdsCommissionRepository) {}

  async onPurchase(tx: TxRow): Promise<void> {
    if (!isBdsCapiEnabled()) return;
    await this.repo.insertCapiEvent({
      tenantId: tx.tenant_id,
      transactionId: tx.id,
      leadId: tx.lead_id,
      eventName: 'Purchase',
      valueVnd: tx.net_price_vnd,
      status: 'logged',
    });
  }
}
