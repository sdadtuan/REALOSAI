import { Injectable, Logger } from '@nestjs/common';
import { isBdsPackEnabled } from '../bds.flags';
import { isStaffTicketsEnabled } from '../../staff-tickets/staff-ticket.flags';
import { StaffTicketService } from '../../staff-tickets/staff-ticket.service';
import { BdsTxRepository } from '../transactions/bds-tx.repository';
import { BdsHoldRepository } from './bds-hold.repository';
import { BdsHoldService } from './bds-hold.service';
import { OFFBOARD_HOLD_REASON, shouldReleaseHoldOnOffboard } from './bds-offboard.util';

export type BdsOffboardHookResult = {
  holds_released: number;
  holds_kept: number;
  tickets_reassigned: number;
};

@Injectable()
export class BdsOffboardHookService {
  private readonly logger = new Logger(BdsOffboardHookService.name);

  constructor(
    private readonly holds: BdsHoldRepository,
    private readonly txs: BdsTxRepository,
    private readonly holdService: BdsHoldService,
    private readonly tickets: StaffTicketService,
  ) {}

  async onStaffOffboarded(input: {
    crmStaffId: number;
    tenantId?: string;
  }): Promise<BdsOffboardHookResult> {
    const out: BdsOffboardHookResult = {
      holds_released: 0,
      holds_kept: 0,
      tickets_reassigned: 0,
    };
    if (!Number.isFinite(input.crmStaffId) || input.crmStaffId <= 0) return out;

    if (isBdsPackEnabled()) {
      const rows = await this.holds.listOpenByStaff(input.crmStaffId);
      for (const hold of rows) {
        let hasDeposit = false;
        try {
          hasDeposit = await this.txs.hasDepositForHold(hold.id);
        } catch (err) {
          this.logger.warn(
            `offboard deposit lookup ${hold.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
          out.holds_kept += 1;
          continue;
        }
        if (
          !shouldReleaseHoldOnOffboard({
            holdStatus: hold.status,
            txStage: hasDeposit ? 'deposit' : null,
          })
        ) {
          out.holds_kept += 1;
          continue;
        }
        try {
          await this.holdService.cancel(
            hold.id,
            OFFBOARD_HOLD_REASON,
            hold.tenant_id ?? input.tenantId,
          );
          out.holds_released += 1;
        } catch (err) {
          this.logger.warn(
            `offboard cancel ${hold.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
          out.holds_kept += 1;
        }
      }
    }

    if (isStaffTicketsEnabled()) {
      try {
        out.tickets_reassigned = await this.tickets.reassignOpenTicketsOnOffboard(input.crmStaffId);
      } catch (err) {
        this.logger.warn(
          `offboard tickets ${input.crmStaffId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return out;
  }
}
