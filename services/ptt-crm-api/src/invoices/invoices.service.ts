import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { OrdersPgRepository } from '../orders/orders-pg.repository';
import { OrdersSqliteRepository } from '../orders/orders-sqlite.repository';
import { InvoicesPgRepository } from './invoices-pg.repository';
import { InvoicesSqliteRepository } from './invoices-sqlite.repository';
import { CreateInvoiceBody, IssueInvoiceBody, PatchInvoiceBody } from './invoices.types';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly sqlite: InvoicesSqliteRepository,
    private readonly pg: InvoicesPgRepository,
    private readonly ordersSqlite: OrdersSqliteRepository,
    private readonly ordersPg: OrdersPgRepository,
    private readonly config: AppConfigService,
  ) {}

  private get usePg(): boolean {
    return this.config.crmInvoicesPg;
  }

  private get useOrdersPg(): boolean {
    return this.config.crmOrdersPg;
  }

  async list(query: {
    customer_id?: string;
    lifecycle_id?: string;
    status?: string;
    overdue?: string;
    limit?: string;
  }) {
    const filters = {
      customerId: query.customer_id ? Number(query.customer_id) : undefined,
      lifecycleId: query.lifecycle_id ? Number(query.lifecycle_id) : undefined,
      status: query.status?.trim() || undefined,
      overdue: query.overdue === '1' || query.overdue === 'true',
      limit: query.limit ? Number(query.limit) : 50,
    };
    const invoices = this.usePg ? await this.pg.list(filters) : this.sqlite.list(filters);
    return { invoices };
  }

  async detail(id: number) {
    const invoice = this.usePg ? await this.pg.getById(id, true) : this.sqlite.getById(id, true);
    if (!invoice) throw new NotFoundException({ error: 'invoice_not_found', id });
    return { invoice };
  }

  async create(body: CreateInvoiceBody) {
    const customerId = Number(body.customer_id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      throw new BadRequestException({ error: 'customer_id_required' });
    }
    const invoice = this.usePg ? await this.pg.create(body) : this.sqlite.create(body);
    return { invoice };
  }

  async createFromOrder(orderId: number, body: IssueInvoiceBody = {}) {
    const order = this.useOrdersPg
      ? await this.ordersPg.getById(orderId, true)
      : this.ordersSqlite.getById(orderId, true);
    if (!order) throw new NotFoundException({ error: 'order_not_found', id: orderId });
    if (order.status === 'cancelled') {
      throw new BadRequestException({ error: 'order_cancelled' });
    }
    let invoice = this.usePg
      ? await this.pg.createFromOrder(order, body.due_on)
      : this.sqlite.createFromOrder(order, body.due_on);
    if (body.issued_on || body.due_on) {
      const issued = this.usePg
        ? await this.pg.issue(invoice.id, body.issued_on, body.due_on ?? invoice.due_on)
        : this.sqlite.issue(invoice.id, body.issued_on, body.due_on ?? invoice.due_on);
      if (issued) invoice = issued;
    }
    const full = this.usePg
      ? await this.pg.getById(invoice.id, true)
      : this.sqlite.getById(invoice.id, true);
    return { invoice: full };
  }

  async patch(id: number, body: PatchInvoiceBody) {
    const invoice = this.usePg ? await this.pg.patch(id, body) : this.sqlite.patch(id, body);
    if (!invoice) throw new NotFoundException({ error: 'invoice_not_found', id });
    return { invoice };
  }

  async issue(id: number, body: IssueInvoiceBody = {}) {
    const invoice = this.usePg
      ? await this.pg.issue(id, body.issued_on, body.due_on)
      : this.sqlite.issue(id, body.issued_on, body.due_on);
    if (!invoice) throw new NotFoundException({ error: 'invoice_not_found', id });
    return { invoice };
  }

  async void(id: number) {
    const invoice = this.usePg ? await this.pg.voidInvoice(id) : this.sqlite.voidInvoice(id);
    if (!invoice) throw new NotFoundException({ error: 'invoice_not_found', id });
    return { invoice };
  }

  async syncPaid(id: number) {
    const invoice = this.usePg ? await this.pg.syncPaidStatus(id) : this.sqlite.syncPaidStatus(id);
    if (!invoice) throw new NotFoundException({ error: 'invoice_not_found', id });
    return { invoice };
  }
}
