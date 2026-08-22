import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { AppConfigService } from '../config/app-config.service';
import { ensureBillingSchema, tableExists, todayIso, tsNow } from '../billing/billing-schema.util';
import {
  CreateInvoiceBody,
  InvoiceLineRow,
  InvoiceRow,
  InvoiceStatus,
  PatchInvoiceBody,
} from './invoices.types';
import { OrderLineRow } from '../orders/orders.types';

function mapInvoice(row: Record<string, unknown>): InvoiceRow {
  return {
    id: Number(row.id),
    invoice_number: String(row.invoice_number ?? ''),
    order_id: row.order_id != null ? Number(row.order_id) : null,
    contract_id: row.contract_id != null ? Number(row.contract_id) : null,
    lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
    customer_id: Number(row.customer_id),
    status: String(row.status ?? 'draft') as InvoiceStatus,
    issued_on: String(row.issued_on ?? ''),
    due_on: String(row.due_on ?? ''),
    amount_vnd: Number(row.amount_vnd ?? 0),
    paid_vnd: Number(row.paid_vnd ?? 0),
    notes: String(row.notes ?? ''),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

function mapLine(row: Record<string, unknown>): InvoiceLineRow {
  return {
    id: Number(row.id),
    invoice_id: Number(row.invoice_id),
    product_slug: String(row.product_slug ?? ''),
    description: String(row.description ?? ''),
    quantity: Number(row.quantity ?? 1),
    unit_price_vnd: Number(row.unit_price_vnd ?? 0),
    amount_vnd: Number(row.amount_vnd ?? 0),
    sort_order: Number(row.sort_order ?? 0),
  };
}

export class InvoicesSqliteRepositoryCore {
  constructor(private readonly db: DatabaseSync) {
    ensureBillingSchema(db);
  }

  list(filters: {
    customerId?: number;
    lifecycleId?: number;
    status?: string;
    overdue?: boolean;
    limit?: number;
  }): InvoiceRow[] {
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
    if (filters.overdue) {
      clauses.push("status IN ('issued', 'partial', 'overdue') AND due_on != '' AND due_on < ?");
      params.push(todayIso());
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const rows = this.db
      .prepare(`SELECT * FROM crm_invoices ${where} ORDER BY due_on ASC, id DESC LIMIT ?`)
      .all(...params, limit) as Array<Record<string, unknown>>;
    return rows.map((row) => this.refreshOverdueStatus(mapInvoice(row)));
  }

  getById(id: number, withLines = false): InvoiceRow | null {
    const row = this.db.prepare('SELECT * FROM crm_invoices WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    const invoice = this.refreshOverdueStatus(mapInvoice(row));
    if (withLines) invoice.lines = this.listLines(id);
    return invoice;
  }

  listLines(invoiceId: number): InvoiceLineRow[] {
    const rows = this.db
      .prepare('SELECT * FROM crm_invoice_lines WHERE invoice_id = ? ORDER BY sort_order, id')
      .all(invoiceId) as Array<Record<string, unknown>>;
    return rows.map(mapLine);
  }

  lifecycleInvoiceAr(lifecycleId: number): { ar_pending_vnd: number; ar_overdue_vnd: number } {
    if (!tableExists(this.db, 'crm_invoices')) return { ar_pending_vnd: 0, ar_overdue_vnd: 0 };
    const rows = this.db
      .prepare(
        `SELECT amount_vnd, paid_vnd, due_on, status FROM crm_invoices
         WHERE lifecycle_id = ? AND status IN ('issued', 'partial', 'overdue')`,
      )
      .all(lifecycleId) as Array<{
      amount_vnd: number;
      paid_vnd: number;
      due_on: string;
      status: string;
    }>;
    const today = todayIso();
    let pending = 0;
    let overdue = 0;
    for (const row of rows) {
      const open = Math.max(0, Number(row.amount_vnd ?? 0) - Number(row.paid_vnd ?? 0));
      if (open <= 0) continue;
      pending += open;
      const due = String(row.due_on ?? '').slice(0, 10);
      if (due && due < today) overdue += open;
    }
    return { ar_pending_vnd: pending, ar_overdue_vnd: overdue };
  }

  refreshOverdueStatus(invoice: InvoiceRow): InvoiceRow {
    const today = todayIso();
    if (
      ['issued', 'partial'].includes(invoice.status) &&
      invoice.due_on &&
      invoice.due_on < today &&
      invoice.amount_vnd > invoice.paid_vnd
    ) {
      this.db
        .prepare("UPDATE crm_invoices SET status = 'overdue', updated_at = ? WHERE id = ? AND status IN ('issued', 'partial')")
        .run(tsNow(), invoice.id);
      return { ...invoice, status: 'overdue' };
    }
    return invoice;
  }

  private recalcTotal(invoiceId: number): number {
    const row = this.db
      .prepare('SELECT COALESCE(SUM(amount_vnd), 0) AS total FROM crm_invoice_lines WHERE invoice_id = ?')
      .get(invoiceId) as { total: number };
    const total = Number(row.total ?? 0);
    this.db.prepare('UPDATE crm_invoices SET amount_vnd = ?, updated_at = ? WHERE id = ?').run(total, tsNow(), invoiceId);
    this.syncPaidStatus(invoiceId);
    return total;
  }

  syncPaidStatus(invoiceId: number): InvoiceRow | null {
    const invoice = this.getById(invoiceId);
    if (!invoice) return null;
    const payRow = this.db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN status = 'received' THEN amount_vnd ELSE 0 END), 0) AS paid
         FROM crm_svc_payments WHERE invoice_id = ?`,
      )
      .get(invoiceId) as { paid: number };
    const paid = Number(payRow?.paid ?? 0);
    let status = invoice.status;
    if (status !== 'void' && status !== 'draft') {
      if (paid >= invoice.amount_vnd && invoice.amount_vnd > 0) status = 'paid';
      else if (paid > 0) status = 'partial';
      else if (status === 'paid' || status === 'partial') status = 'issued';
    }
    this.db
      .prepare('UPDATE crm_invoices SET paid_vnd = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(paid, status, tsNow(), invoiceId);
    return this.getById(invoiceId, true);
  }

  create(body: CreateInvoiceBody): InvoiceRow {
    const ts = tsNow();
    const result = this.db
      .prepare(
        `INSERT INTO crm_invoices (
           invoice_number, order_id, contract_id, lifecycle_id, customer_id,
           status, issued_on, due_on, amount_vnd, paid_vnd, notes, created_at, updated_at
         ) VALUES ('', ?, ?, ?, ?, 'draft', ?, ?, ?, 0, ?, ?, ?)`,
      )
      .run(
        body.order_id != null ? Number(body.order_id) : null,
        body.contract_id != null ? Number(body.contract_id) : null,
        body.lifecycle_id != null ? Number(body.lifecycle_id) : null,
        Number(body.customer_id),
        String(body.issued_on ?? '').slice(0, 10),
        String(body.due_on ?? '').slice(0, 10),
        Math.max(0, Number(body.amount_vnd ?? 0)),
        String(body.notes ?? '').slice(0, 4000),
        ts,
        ts,
      );
    const id = Number(result.lastInsertRowid);
    const number = `INV-${new Date().getFullYear()}-${String(id).padStart(5, '0')}`;
    this.db.prepare('UPDATE crm_invoices SET invoice_number = ? WHERE id = ?').run(number, id);
    for (const line of body.lines ?? []) {
      this.addLine(id, line);
    }
    if ((body.lines ?? []).length === 0 && body.amount_vnd != null) {
      this.recalcTotal(id);
    }
    return this.getById(id, true)!;
  }

  createFromOrder(order: {
    id: number;
    customer_id: number;
    contract_id: number | null;
    lifecycle_id: number | null;
    total_vnd: number;
    lines?: OrderLineRow[];
  }, dueOn?: string): InvoiceRow {
    const invoice = this.create({
      customer_id: order.customer_id,
      order_id: order.id,
      contract_id: order.contract_id,
      lifecycle_id: order.lifecycle_id,
      due_on: dueOn ?? '',
      amount_vnd: order.total_vnd,
      lines: (order.lines ?? []).map((line, idx) => ({
        product_slug: line.product_slug,
        description: line.description,
        quantity: line.quantity,
        unit_price_vnd: line.unit_price_vnd,
        amount_vnd: line.amount_vnd,
        sort_order: idx,
      })),
    });
    return invoice;
  }

  patch(id: number, body: PatchInvoiceBody): InvoiceRow | null {
    const existing = this.getById(id);
    if (!existing) return null;
    const status = body.status ?? existing.status;
    const issuedOn = body.issued_on != null ? String(body.issued_on).slice(0, 10) : existing.issued_on;
    const dueOn = body.due_on != null ? String(body.due_on).slice(0, 10) : existing.due_on;
    const notes = body.notes != null ? String(body.notes).slice(0, 4000) : existing.notes;
    const contractId = body.contract_id !== undefined ? body.contract_id : existing.contract_id;
    const lifecycleId = body.lifecycle_id !== undefined ? body.lifecycle_id : existing.lifecycle_id;
    this.db
      .prepare(
        `UPDATE crm_invoices
         SET status = ?, issued_on = ?, due_on = ?, notes = ?,
             contract_id = ?, lifecycle_id = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(status, issuedOn, dueOn, notes, contractId, lifecycleId, tsNow(), id);
    return this.getById(id, true);
  }

  issue(id: number, issuedOn?: string, dueOn?: string): InvoiceRow | null {
    const existing = this.getById(id);
    if (!existing || existing.status === 'void') return null;
    const issued = String(issuedOn ?? todayIso()).slice(0, 10);
    const due = String(dueOn ?? existing.due_on ?? '').slice(0, 10);
    this.db
      .prepare("UPDATE crm_invoices SET status = 'issued', issued_on = ?, due_on = ?, updated_at = ? WHERE id = ?")
      .run(issued, due, tsNow(), id);
    return this.getById(id, true);
  }

  voidInvoice(id: number): InvoiceRow | null {
    const existing = this.getById(id);
    if (!existing) return null;
    this.db
      .prepare("UPDATE crm_invoices SET status = 'void', updated_at = ? WHERE id = ?")
      .run(tsNow(), id);
    return this.getById(id, true);
  }

  addLine(invoiceId: number, body: {
    product_slug?: string;
    description?: string;
    quantity?: number;
    unit_price_vnd?: number;
    amount_vnd?: number;
    sort_order?: number;
  }): InvoiceLineRow {
    const qty = Math.max(1, Number(body.quantity ?? 1));
    const unit = Math.max(0, Number(body.unit_price_vnd ?? 0));
    const amount = body.amount_vnd != null ? Math.max(0, Number(body.amount_vnd)) : qty * unit;
    const result = this.db
      .prepare(
        `INSERT INTO crm_invoice_lines (
           invoice_id, product_slug, description, quantity, unit_price_vnd, amount_vnd, sort_order
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        invoiceId,
        String(body.product_slug ?? ''),
        String(body.description ?? body.product_slug ?? ''),
        qty,
        unit,
        amount,
        Number(body.sort_order ?? 0),
      );
    this.recalcTotal(invoiceId);
    const lineId = Number(result.lastInsertRowid);
    return mapLine(
      this.db.prepare('SELECT * FROM crm_invoice_lines WHERE id = ?').get(lineId) as Record<string, unknown>,
    );
  }
}

@Injectable()
export class InvoicesSqliteRepository implements OnModuleDestroy {
  private db: DatabaseSync | null = null;
  private core: InvoicesSqliteRepositoryCore | null = null;

  constructor(private readonly config: AppConfigService) {}

  private repo(): InvoicesSqliteRepositoryCore {
    if (!this.core) {
      this.db = new DatabaseSync(this.config.sqlitePath);
      this.db.exec('PRAGMA foreign_keys = ON');
      this.core = new InvoicesSqliteRepositoryCore(this.db);
    }
    return this.core;
  }

  onModuleDestroy(): void {
    this.db?.close();
    this.db = null;
    this.core = null;
  }

  list(...args: Parameters<InvoicesSqliteRepositoryCore['list']>) {
    return this.repo().list(...args);
  }
  getById(...args: Parameters<InvoicesSqliteRepositoryCore['getById']>) {
    return this.repo().getById(...args);
  }
  listLines(...args: Parameters<InvoicesSqliteRepositoryCore['listLines']>) {
    return this.repo().listLines(...args);
  }
  lifecycleInvoiceAr(...args: Parameters<InvoicesSqliteRepositoryCore['lifecycleInvoiceAr']>) {
    return this.repo().lifecycleInvoiceAr(...args);
  }
  syncPaidStatus(...args: Parameters<InvoicesSqliteRepositoryCore['syncPaidStatus']>) {
    return this.repo().syncPaidStatus(...args);
  }
  create(...args: Parameters<InvoicesSqliteRepositoryCore['create']>) {
    return this.repo().create(...args);
  }
  createFromOrder(...args: Parameters<InvoicesSqliteRepositoryCore['createFromOrder']>) {
    return this.repo().createFromOrder(...args);
  }
  patch(...args: Parameters<InvoicesSqliteRepositoryCore['patch']>) {
    return this.repo().patch(...args);
  }
  issue(...args: Parameters<InvoicesSqliteRepositoryCore['issue']>) {
    return this.repo().issue(...args);
  }
  voidInvoice(...args: Parameters<InvoicesSqliteRepositoryCore['voidInvoice']>) {
    return this.repo().voidInvoice(...args);
  }
  addLine(...args: Parameters<InvoicesSqliteRepositoryCore['addLine']>) {
    return this.repo().addLine(...args);
  }
}
