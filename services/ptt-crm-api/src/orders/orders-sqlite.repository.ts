import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { AppConfigService } from '../config/app-config.service';
import { ensureBillingSchema, tableExists, todayIso, tsNow } from '../billing/billing-schema.util';
import {
  CreateOrderBody,
  CreateOrderLineBody,
  OrderLineRow,
  OrderRow,
  OrderStatus,
  PatchOrderBody,
} from './orders.types';

function mapOrder(row: Record<string, unknown>): OrderRow {
  return {
    id: Number(row.id),
    reference_code: String(row.reference_code ?? ''),
    customer_id: Number(row.customer_id),
    contract_id: row.contract_id != null ? Number(row.contract_id) : null,
    proposal_id: row.proposal_id != null ? Number(row.proposal_id) : null,
    lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
    lead_id: row.lead_id != null ? Number(row.lead_id) : null,
    status: String(row.status ?? 'draft') as OrderStatus,
    order_date: String(row.order_date ?? ''),
    total_vnd: Number(row.total_vnd ?? 0),
    billing_type: String(row.billing_type ?? 'one_off'),
    notes: String(row.notes ?? ''),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

function mapLine(row: Record<string, unknown>): OrderLineRow {
  return {
    id: Number(row.id),
    order_id: Number(row.order_id),
    product_slug: String(row.product_slug ?? ''),
    description: String(row.description ?? ''),
    quantity: Number(row.quantity ?? 1),
    unit_price_vnd: Number(row.unit_price_vnd ?? 0),
    amount_vnd: Number(row.amount_vnd ?? 0),
    sort_order: Number(row.sort_order ?? 0),
  };
}

export class OrdersSqliteRepositoryCore {
  constructor(private readonly db: DatabaseSync) {
    ensureBillingSchema(db);
  }

  list(filters: {
    customerId?: number;
    lifecycleId?: number;
    status?: string;
    limit?: number;
  }): OrderRow[] {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (filters.customerId) {
      clauses.push('customer_id = ?');
      params.push(filters.customerId);
    }
    if (filters.lifecycleId) {
      clauses.push('lifecycle_id = ?');
      params.push(filters.lifecycleId);
    }
    if (filters.status) {
      clauses.push('status = ?');
      params.push(filters.status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const rows = this.db
      .prepare(`SELECT * FROM crm_orders ${where} ORDER BY id DESC LIMIT ?`)
      .all(...params, limit) as Array<Record<string, unknown>>;
    return rows.map(mapOrder);
  }

  getById(id: number, withLines = false): OrderRow | null {
    const row = this.db.prepare('SELECT * FROM crm_orders WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    const order = mapOrder(row);
    if (withLines) order.lines = this.listLines(id);
    return order;
  }

  listLines(orderId: number): OrderLineRow[] {
    const rows = this.db
      .prepare('SELECT * FROM crm_order_lines WHERE order_id = ? ORDER BY sort_order, id')
      .all(orderId) as Array<Record<string, unknown>>;
    return rows.map(mapLine);
  }

  customerExists(customerId: number): boolean {
    const row = this.db.prepare('SELECT id FROM crm_customers WHERE id = ?').get(customerId) as
      | { id: number }
      | undefined;
    return row != null;
  }

  proposalExists(proposalId: number): boolean {
    if (!tableExists(this.db, 'crm_proposals')) return false;
    const row = this.db.prepare('SELECT id FROM crm_proposals WHERE id = ?').get(proposalId) as
      | { id: number }
      | undefined;
    return row != null;
  }

  getProposal(proposalId: number): Record<string, unknown> | null {
    if (!tableExists(this.db, 'crm_proposals')) return null;
    const row = this.db.prepare('SELECT * FROM crm_proposals WHERE id = ?').get(proposalId) as
      | Record<string, unknown>
      | undefined;
    return row ?? null;
  }

  private recalcTotal(orderId: number): number {
    const row = this.db
      .prepare('SELECT COALESCE(SUM(amount_vnd), 0) AS total FROM crm_order_lines WHERE order_id = ?')
      .get(orderId) as { total: number };
    const total = Number(row.total ?? 0);
    this.db.prepare('UPDATE crm_orders SET total_vnd = ?, updated_at = ? WHERE id = ?').run(total, tsNow(), orderId);
    return total;
  }

  create(body: CreateOrderBody): OrderRow {
    const ts = tsNow();
    const orderDate = String(body.order_date ?? todayIso()).slice(0, 10);
    const result = this.db
      .prepare(
        `INSERT INTO crm_orders (
           reference_code, customer_id, contract_id, proposal_id, lifecycle_id, lead_id,
           status, order_date, total_vnd, billing_type, notes, created_at, updated_at
         ) VALUES ('', ?, ?, ?, ?, ?, 'draft', ?, 0, ?, ?, ?, ?)`,
      )
      .run(
        Number(body.customer_id),
        body.contract_id != null ? Number(body.contract_id) : null,
        body.proposal_id != null ? Number(body.proposal_id) : null,
        body.lifecycle_id != null ? Number(body.lifecycle_id) : null,
        body.lead_id != null ? Number(body.lead_id) : null,
        orderDate,
        String(body.billing_type ?? 'one_off'),
        String(body.notes ?? '').slice(0, 4000),
        ts,
        ts,
      );
    const id = Number(result.lastInsertRowid);
    const ref = `SO-${new Date().getFullYear()}-${String(id).padStart(5, '0')}`;
    this.db.prepare('UPDATE crm_orders SET reference_code = ? WHERE id = ?').run(ref, id);
    for (const line of body.lines ?? []) {
      this.addLine(id, line);
    }
    if ((body.lines ?? []).length === 0) {
      this.recalcTotal(id);
    }
    return this.getById(id, true)!;
  }

  createFromProposal(proposalId: number): OrderRow | null {
    const proposal = this.getProposal(proposalId);
    if (!proposal) return null;
    let serviceSlugs: string[] = [];
    try {
      serviceSlugs = JSON.parse(String(proposal.service_slugs ?? '[]')) as string[];
    } catch {
      serviceSlugs = [];
    }
    const total = Number(proposal.total_vnd ?? 0);
    const perLine = serviceSlugs.length ? Math.round(total / serviceSlugs.length) : total;
    const order = this.create({
      customer_id: Number(proposal.customer_id),
      proposal_id: proposalId,
      lifecycle_id: proposal.lifecycle_id != null ? Number(proposal.lifecycle_id) : null,
      billing_type: 'one_off',
      notes: String(proposal.notes ?? ''),
      lines: serviceSlugs.map((slug, idx) => ({
        product_slug: slug,
        description: slug,
        quantity: 1,
        unit_price_vnd: perLine,
        amount_vnd: perLine,
        sort_order: idx,
      })),
    });
    if (serviceSlugs.length === 0 && total > 0) {
      this.addLine(order.id, {
        description: 'Proposal total',
        quantity: 1,
        unit_price_vnd: total,
        amount_vnd: total,
      });
    }
    return this.getById(order.id, true);
  }

  patch(id: number, body: PatchOrderBody): OrderRow | null {
    const existing = this.getById(id);
    if (!existing) return null;
    const status = body.status ?? existing.status;
    const orderDate = body.order_date != null ? String(body.order_date).slice(0, 10) : existing.order_date;
    const billingType = body.billing_type ?? existing.billing_type;
    const notes = body.notes != null ? String(body.notes).slice(0, 4000) : existing.notes;
    const contractId = body.contract_id !== undefined ? body.contract_id : existing.contract_id;
    const lifecycleId = body.lifecycle_id !== undefined ? body.lifecycle_id : existing.lifecycle_id;
    this.db
      .prepare(
        `UPDATE crm_orders
         SET status = ?, order_date = ?, billing_type = ?, notes = ?,
             contract_id = ?, lifecycle_id = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(status, orderDate, billingType, notes, contractId, lifecycleId, tsNow(), id);
    return this.getById(id, true);
  }

  setStatus(id: number, status: OrderStatus): OrderRow | null {
    return this.patch(id, { status });
  }

  addLine(orderId: number, body: CreateOrderLineBody): OrderLineRow {
    const qty = Math.max(1, Number(body.quantity ?? 1));
    const unit = Math.max(0, Number(body.unit_price_vnd ?? 0));
    const amount = body.amount_vnd != null ? Math.max(0, Number(body.amount_vnd)) : qty * unit;
    const result = this.db
      .prepare(
        `INSERT INTO crm_order_lines (
           order_id, product_slug, description, quantity, unit_price_vnd, amount_vnd, sort_order
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        orderId,
        String(body.product_slug ?? ''),
        String(body.description ?? body.product_slug ?? ''),
        qty,
        unit,
        amount,
        Number(body.sort_order ?? 0),
      );
    this.recalcTotal(orderId);
    const lineId = Number(result.lastInsertRowid);
    return mapLine(
      this.db.prepare('SELECT * FROM crm_order_lines WHERE id = ?').get(lineId) as Record<string, unknown>,
    );
  }

  deleteLine(lineId: number): boolean {
    const row = this.db.prepare('SELECT order_id FROM crm_order_lines WHERE id = ?').get(lineId) as
      | { order_id: number }
      | undefined;
    if (!row) return false;
    const result = this.db.prepare('DELETE FROM crm_order_lines WHERE id = ?').run(lineId);
    if (result.changes > 0) this.recalcTotal(Number(row.order_id));
    return result.changes > 0;
  }
}

@Injectable()
export class OrdersSqliteRepository implements OnModuleDestroy {
  private db: DatabaseSync | null = null;
  private core: OrdersSqliteRepositoryCore | null = null;

  constructor(private readonly config: AppConfigService) {}

  private repo(): OrdersSqliteRepositoryCore {
    if (!this.core) {
      this.db = new DatabaseSync(this.config.sqlitePath);
      this.db.exec('PRAGMA foreign_keys = ON');
      this.core = new OrdersSqliteRepositoryCore(this.db);
    }
    return this.core;
  }

  onModuleDestroy(): void {
    this.db?.close();
    this.db = null;
    this.core = null;
  }

  list(...args: Parameters<OrdersSqliteRepositoryCore['list']>) {
    return this.repo().list(...args);
  }
  getById(...args: Parameters<OrdersSqliteRepositoryCore['getById']>) {
    return this.repo().getById(...args);
  }
  listLines(...args: Parameters<OrdersSqliteRepositoryCore['listLines']>) {
    return this.repo().listLines(...args);
  }
  customerExists(...args: Parameters<OrdersSqliteRepositoryCore['customerExists']>) {
    return this.repo().customerExists(...args);
  }
  create(...args: Parameters<OrdersSqliteRepositoryCore['create']>) {
    return this.repo().create(...args);
  }
  createFromProposal(...args: Parameters<OrdersSqliteRepositoryCore['createFromProposal']>) {
    return this.repo().createFromProposal(...args);
  }
  patch(...args: Parameters<OrdersSqliteRepositoryCore['patch']>) {
    return this.repo().patch(...args);
  }
  setStatus(...args: Parameters<OrdersSqliteRepositoryCore['setStatus']>) {
    return this.repo().setStatus(...args);
  }
  addLine(...args: Parameters<OrdersSqliteRepositoryCore['addLine']>) {
    return this.repo().addLine(...args);
  }
  deleteLine(...args: Parameters<OrdersSqliteRepositoryCore['deleteLine']>) {
    return this.repo().deleteLine(...args);
  }
}
