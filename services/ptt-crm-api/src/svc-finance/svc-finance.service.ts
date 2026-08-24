import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SvcFinancePgRepository } from './svc-finance-pg.repository';

@Injectable()
export class SvcFinanceService {
  constructor(private readonly pg: SvcFinancePgRepository) {}

  async summary(lifecycleId: number) {
    const exists = await this.pg.lifecycleExists(lifecycleId);
    if (!exists) {
      throw new NotFoundException({ error: 'Không tìm thấy lifecycle' });
    }
    const contractAmount = await this.pg.contractAmountVnd(lifecycleId);
    return this.pg.getSummary(lifecycleId, contractAmount);
  }

  async listPayments(lifecycleId: number) {
    const exists = await this.pg.lifecycleExists(lifecycleId);
    if (!exists) {
      throw new NotFoundException({ error: 'Không tìm thấy lifecycle' });
    }
    const payments = await this.pg.listPayments(lifecycleId);
    return { payments };
  }

  async createPayment(body: Record<string, unknown>) {
    const lifecycleId = Number(body.lifecycle_id);
    const amountVnd = Number(body.amount_vnd);
    const receivedOn = String(body.received_on ?? '').trim();
    if (!Number.isFinite(lifecycleId) || lifecycleId <= 0) {
      throw new BadRequestException({ error: 'Cần lifecycle_id hợp lệ' });
    }
    if (!Number.isFinite(amountVnd) || amountVnd < 0) {
      throw new BadRequestException({ error: 'Cần amount_vnd hợp lệ' });
    }
    if (!receivedOn) {
      throw new BadRequestException({ error: 'Cần received_on' });
    }
    const exists = await this.pg.lifecycleExists(lifecycleId);
    if (!exists) {
      throw new NotFoundException({ error: 'Không tìm thấy lifecycle' });
    }
    return this.pg.createPayment(body);
  }

  async patchPayment(paymentId: number, body: Record<string, unknown>) {
    const updated = await this.pg.patchPayment(paymentId, body);
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy payment' });
    }
    return updated;
  }

  async deletePayment(paymentId: number) {
    const ok = await this.pg.deletePayment(paymentId);
    if (!ok) {
      throw new NotFoundException({ error: 'Không tìm thấy payment' });
    }
    return { ok: true };
  }
}
