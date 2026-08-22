import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { SvcFinancePgRepository } from './svc-finance-pg.repository';
import { SvcFinanceSqliteRepository } from './svc-finance-sqlite.repository';

@Injectable()
export class SvcFinanceService {
  constructor(
    private readonly sqlite: SvcFinanceSqliteRepository,
    private readonly pg: SvcFinancePgRepository,
    private readonly config: AppConfigService,
  ) {}

  private get usePg(): boolean {
    return this.config.crmSvcFinancePg;
  }

  async summary(lifecycleId: number) {
    const exists = this.usePg
      ? await this.pg.lifecycleExists(lifecycleId)
      : this.sqlite.lifecycleExists(lifecycleId);
    if (!exists) {
      throw new NotFoundException({ error: 'Không tìm thấy lifecycle' });
    }
    const contractAmount = this.usePg
      ? await this.pg.contractAmountVnd(lifecycleId)
      : this.sqlite.contractAmountVnd(lifecycleId);
    return this.usePg
      ? this.pg.getSummary(lifecycleId, contractAmount)
      : this.sqlite.getSummary(lifecycleId, contractAmount);
  }

  async listPayments(lifecycleId: number) {
    const exists = this.usePg
      ? await this.pg.lifecycleExists(lifecycleId)
      : this.sqlite.lifecycleExists(lifecycleId);
    if (!exists) {
      throw new NotFoundException({ error: 'Không tìm thấy lifecycle' });
    }
    const payments = this.usePg
      ? await this.pg.listPayments(lifecycleId)
      : this.sqlite.listPayments(lifecycleId);
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
    const exists = this.usePg
      ? await this.pg.lifecycleExists(lifecycleId)
      : this.sqlite.lifecycleExists(lifecycleId);
    if (!exists) {
      throw new NotFoundException({ error: 'Không tìm thấy lifecycle' });
    }
    return this.usePg ? this.pg.createPayment(body) : this.sqlite.createPayment(body);
  }

  async patchPayment(paymentId: number, body: Record<string, unknown>) {
    const updated = this.usePg
      ? await this.pg.patchPayment(paymentId, body)
      : this.sqlite.patchPayment(paymentId, body);
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy payment' });
    }
    return updated;
  }

  async deletePayment(paymentId: number) {
    const ok = this.usePg
      ? await this.pg.deletePayment(paymentId)
      : this.sqlite.deletePayment(paymentId);
    if (!ok) {
      throw new NotFoundException({ error: 'Không tìm thấy payment' });
    }
    return { ok: true };
  }
}
