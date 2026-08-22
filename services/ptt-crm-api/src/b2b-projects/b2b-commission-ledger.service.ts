import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { computeCommissionAmounts } from './b2b-commission-ledger.util';
import { B2bCommissionLedgerRepository } from './b2b-commission-ledger.repository';

@Injectable()
export class B2bCommissionLedgerService {
  constructor(
    private readonly repo: B2bCommissionLedgerRepository,
    private readonly config: AppConfigService,
  ) {}

  async postOnContractActive(input: {
    leadId: number;
    contractId: number;
    amountVnd: number;
  }): Promise<{ posted: boolean; ledger_id?: string }> {
    if (!this.config.b2bProjectOs) {
      return { posted: false };
    }

    const split = await this.repo.loadSplit(input.leadId);
    if (!split || (split.first_touch_pct <= 0 && split.closer_pct <= 0)) {
      return { posted: false };
    }

    const amounts = computeCommissionAmounts({
      amountVnd: input.amountVnd,
      firstTouchPct: split.first_touch_pct,
      closerPct: split.closer_pct,
    });

    const row = await this.repo.insertPosted({
      leadId: input.leadId,
      contractId: input.contractId,
      firstTouchStaffId: split.first_touch_staff_id,
      closerStaffId: split.closer_staff_id,
      firstTouchAmt: amounts.first_touch_amt,
      closerAmt: amounts.closer_amt,
    });

    return row ? { posted: true, ledger_id: row.id } : { posted: false };
  }
}
