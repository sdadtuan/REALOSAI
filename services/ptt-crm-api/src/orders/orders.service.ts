import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrdersSqliteRepository } from './orders-sqlite.repository';
import { CreateOrderBody, CreateOrderLineBody, PatchOrderBody } from './orders.types';

@Injectable()
export class OrdersService {
  constructor(private readonly repo: OrdersSqliteRepository) {}

  list(query: { customer_id?: string; lifecycle_id?: string; status?: string; limit?: string }) {
    return {
      orders: this.repo.list({
        customerId: query.customer_id ? Number(query.customer_id) : undefined,
        lifecycleId: query.lifecycle_id ? Number(query.lifecycle_id) : undefined,
        status: query.status?.trim() || undefined,
        limit: query.limit ? Number(query.limit) : 50,
      }),
    };
  }

  detail(id: number) {
    const order = this.repo.getById(id, true);
    if (!order) throw new NotFoundException({ error: 'order_not_found', id });
    return { order };
  }

  create(body: CreateOrderBody) {
    const customerId = Number(body.customer_id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      throw new BadRequestException({ error: 'customer_id_required' });
    }
    if (!this.repo.customerExists(customerId)) {
      throw new NotFoundException({ error: 'customer_not_found', customer_id: customerId });
    }
    const order = this.repo.create(body);
    return { order };
  }

  convertFromProposal(proposalId: number) {
    if (!Number.isFinite(proposalId) || proposalId <= 0) {
      throw new BadRequestException({ error: 'proposal_id_required' });
    }
    const order = this.repo.createFromProposal(proposalId);
    if (!order) throw new NotFoundException({ error: 'proposal_not_found', proposal_id: proposalId });
    return { order };
  }

  patch(id: number, body: PatchOrderBody) {
    const order = this.repo.patch(id, body);
    if (!order) throw new NotFoundException({ error: 'order_not_found', id });
    return { order };
  }

  confirm(id: number) {
    const order = this.repo.setStatus(id, 'confirmed');
    if (!order) throw new NotFoundException({ error: 'order_not_found', id });
    return { order };
  }

  cancel(id: number) {
    const order = this.repo.setStatus(id, 'cancelled');
    if (!order) throw new NotFoundException({ error: 'order_not_found', id });
    return { order };
  }

  addLine(orderId: number, body: CreateOrderLineBody) {
    const order = this.repo.getById(orderId);
    if (!order) throw new NotFoundException({ error: 'order_not_found', id: orderId });
    if (order.status === 'cancelled') {
      throw new BadRequestException({ error: 'order_cancelled' });
    }
    const line = this.repo.addLine(orderId, body);
    return { order: this.repo.getById(orderId, true), line };
  }

  deleteLine(lineId: number) {
    const ok = this.repo.deleteLine(lineId);
    if (!ok) throw new NotFoundException({ error: 'order_line_not_found', id: lineId });
    return { ok: true };
  }
}
