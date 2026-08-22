import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoicesSqliteRepository } from './invoices-sqlite.repository';
import { OrdersSqliteRepository } from '../orders/orders-sqlite.repository';
import { CreateInvoiceBody, IssueInvoiceBody, PatchInvoiceBody } from './invoices.types';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly repo: InvoicesSqliteRepository,
    private readonly orders: OrdersSqliteRepository,
  ) {}

  list(query: {
    customer_id?: string;
    lifecycle_id?: string;
    status?: string;
    overdue?: string;
    limit?: string;
  }) {
    return {
      invoices: this.repo.list({
        customerId: query.customer_id ? Number(query.customer_id) : undefined,
        lifecycleId: query.lifecycle_id ? Number(query.lifecycle_id) : undefined,
        status: query.status?.trim() || undefined,
        overdue: query.overdue === '1' || query.overdue === 'true',
        limit: query.limit ? Number(query.limit) : 50,
      }),
    };
  }

  detail(id: number) {
    const invoice = this.repo.getById(id, true);
    if (!invoice) throw new NotFoundException({ error: 'invoice_not_found', id });
    return { invoice };
  }

  create(body: CreateInvoiceBody) {
    const customerId = Number(body.customer_id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      throw new BadRequestException({ error: 'customer_id_required' });
    }
    const invoice = this.repo.create(body);
    return { invoice };
  }

  createFromOrder(orderId: number, body: IssueInvoiceBody = {}) {
    const order = this.orders.getById(orderId, true);
    if (!order) throw new NotFoundException({ error: 'order_not_found', id: orderId });
    if (order.status === 'cancelled') {
      throw new BadRequestException({ error: 'order_cancelled' });
    }
    const invoice = this.repo.createFromOrder(order, body.due_on);
    if (body.issued_on || body.due_on) {
      this.repo.issue(invoice.id, body.issued_on, body.due_on ?? invoice.due_on);
    }
    return { invoice: this.repo.getById(invoice.id, true) };
  }

  patch(id: number, body: PatchInvoiceBody) {
    const invoice = this.repo.patch(id, body);
    if (!invoice) throw new NotFoundException({ error: 'invoice_not_found', id });
    return { invoice };
  }

  issue(id: number, body: IssueInvoiceBody = {}) {
    const invoice = this.repo.issue(id, body.issued_on, body.due_on);
    if (!invoice) throw new NotFoundException({ error: 'invoice_not_found', id });
    return { invoice };
  }

  void(id: number) {
    const invoice = this.repo.voidInvoice(id);
    if (!invoice) throw new NotFoundException({ error: 'invoice_not_found', id });
    return { invoice };
  }

  syncPaid(id: number) {
    const invoice = this.repo.syncPaidStatus(id);
    if (!invoice) throw new NotFoundException({ error: 'invoice_not_found', id });
    return { invoice };
  }
}
