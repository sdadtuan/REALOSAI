import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { OrdersPgRepository } from './orders-pg.repository';
import { OrdersSqliteRepository } from './orders-sqlite.repository';
import { CreateOrderBody, CreateOrderLineBody, PatchOrderBody } from './orders.types';

@Injectable()
export class OrdersService {
  constructor(
    private readonly sqlite: OrdersSqliteRepository,
    private readonly pg: OrdersPgRepository,
    private readonly config: AppConfigService,
  ) {}

  private get usePg(): boolean {
    return this.config.crmOrdersPg;
  }

  async list(query: {
    customer_id?: string;
    lifecycle_id?: string;
    status?: string;
    limit?: string;
  }) {
    const filters = {
      customerId: query.customer_id ? Number(query.customer_id) : undefined,
      lifecycleId: query.lifecycle_id ? Number(query.lifecycle_id) : undefined,
      status: query.status?.trim() || undefined,
      limit: query.limit ? Number(query.limit) : 50,
    };
    const orders = this.usePg ? await this.pg.list(filters) : this.sqlite.list(filters);
    return { orders };
  }

  async detail(id: number) {
    const order = this.usePg ? await this.pg.getById(id, true) : this.sqlite.getById(id, true);
    if (!order) throw new NotFoundException({ error: 'order_not_found', id });
    return { order };
  }

  async create(body: CreateOrderBody) {
    const customerId = Number(body.customer_id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      throw new BadRequestException({ error: 'customer_id_required' });
    }
    const exists = this.usePg
      ? await this.pg.customerExists(customerId)
      : this.sqlite.customerExists(customerId);
    if (!exists) {
      throw new NotFoundException({ error: 'customer_not_found', customer_id: customerId });
    }
    const order = this.usePg ? await this.pg.create(body) : this.sqlite.create(body);
    return { order };
  }

  async convertFromProposal(proposalId: number) {
    if (!Number.isFinite(proposalId) || proposalId <= 0) {
      throw new BadRequestException({ error: 'proposal_id_required' });
    }
    const order = this.usePg
      ? await this.pg.createFromProposal(proposalId)
      : this.sqlite.createFromProposal(proposalId);
    if (!order) throw new NotFoundException({ error: 'proposal_not_found', proposal_id: proposalId });
    return { order };
  }

  async patch(id: number, body: PatchOrderBody) {
    const order = this.usePg ? await this.pg.patch(id, body) : this.sqlite.patch(id, body);
    if (!order) throw new NotFoundException({ error: 'order_not_found', id });
    return { order };
  }

  async confirm(id: number) {
    const order = this.usePg ? await this.pg.setStatus(id, 'confirmed') : this.sqlite.setStatus(id, 'confirmed');
    if (!order) throw new NotFoundException({ error: 'order_not_found', id });
    return { order };
  }

  async cancel(id: number) {
    const order = this.usePg ? await this.pg.setStatus(id, 'cancelled') : this.sqlite.setStatus(id, 'cancelled');
    if (!order) throw new NotFoundException({ error: 'order_not_found', id });
    return { order };
  }

  async addLine(orderId: number, body: CreateOrderLineBody) {
    const order = this.usePg ? await this.pg.getById(orderId) : this.sqlite.getById(orderId);
    if (!order) throw new NotFoundException({ error: 'order_not_found', id: orderId });
    if (order.status === 'cancelled') {
      throw new BadRequestException({ error: 'order_cancelled' });
    }
    const line = this.usePg ? await this.pg.addLine(orderId, body) : this.sqlite.addLine(orderId, body);
    const updated = this.usePg ? await this.pg.getById(orderId, true) : this.sqlite.getById(orderId, true);
    return { order: updated, line };
  }

  async deleteLine(lineId: number) {
    const ok = this.usePg ? await this.pg.deleteLine(lineId) : this.sqlite.deleteLine(lineId);
    if (!ok) throw new NotFoundException({ error: 'order_line_not_found', id: lineId });
    return { ok: true };
  }
}
