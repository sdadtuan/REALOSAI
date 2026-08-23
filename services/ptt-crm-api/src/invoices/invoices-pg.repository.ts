import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { todayIso } from '../billing/billing-schema.util';
import { AppConfigService } from '../config/app-config.service';
import { OrderLineRow } from '../orders/orders.types';
import { mapInvoiceLineRow, mapInvoiceRow } from './invoices-pg.mapper';
import {
  CreateInvoiceBody,
  InvoiceLineRow,
  InvoiceRow,
  PatchInvoiceBody,
} from './invoices.types';

const INVOICE_SELECT = `
  SELECT i.*,
         COALESCE(cu.sqlite_customer_id, cu.id) AS legacy_customer_id,
         COALESCE(o.sqlite_order_id, o.id) AS legacy_order_id,
         COALESCE(l.sqlite_lifecycle_id, l.id) AS legacy_lifecycle_id
  FROM crm_invoices i
  JOIN crm_customers cu ON cu.id = i.customer_id
  LEFT JOIN crm_orders o ON o.id = i.order_id
  LEFT JOIN crm_service_lifecycle l ON l.id = i.lifecycle_id
`;

@Injectable()
export class InvoicesPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  private async resolveInvoicePgId(
    legacyId: number,
  ): Promise<{ pgId: number; legacyId: number } | null> {
    const result = await this.db.query(
      `SELECT id, sqlite_invoice_id FROM crm_invoices
       WHERE sqlite_invoice_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_invoice_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [legacyId],
    );
    const row = result.rows[0] as { id?: unknown; sqlite_invoice_id?: unknown } | undefined;
    if (!row?.id) return null;
    return { pgId: Number(row.id), legacyId: Number(row.sqlite_invoice_id ?? row.id) };
  }

  private async resolveCustomerPgId(legacyId: number): Promise<number | null> {
    const result = await this.db.query(
      `SELECT id FROM crm_customers
       WHERE sqlite_customer_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_customer_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [legacyId],
    );
    const row = result.rows[0] as { id?: unknown } | undefined;
    return row?.id != null ? Number(row.id) : null;
  }

  private async resolveOrderPgId(legacyId: number): Promise<number | null> {
    const result = await this.db.query(
      `SELECT id FROM crm_orders
       WHERE sqlite_order_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_order_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [legacyId],
    );
    const row = result.rows[0] as { id?: unknown } | undefined;
    return row?.id != null ? Number(row.id) : null;
  }

  private async resolveLifecyclePgId(legacyId: number): Promise<number | null> {
    const result = await this.db.query(
      `SELECT id FROM crm_service_lifecycle
       WHERE sqlite_lifecycle_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_lifecycle_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [legacyId],
    );
    const row = result.rows[0] as { id?: unknown } | undefined;
    return row?.id != null ? Number(row.id) : null;
  }

  private async refreshOverdueStatus(invoice: InvoiceRow): Promise<InvoiceRow> {
    const today = todayIso();
    if (
      ['issued', 'partial'].includes(invoice.status) &&
      invoice.due_on &&
      invoice.due_on < today &&
      invoice.amount_vnd > invoice.paid_vnd
    ) {
      const resolved = await this.resolveInvoicePgId(invoice.id);
      if (resolved) {
        await this.db.query(
          `UPDATE crm_invoices SET status = 'overdue', updated_at = NOW()
           WHERE id = $1 AND status IN ('issued', 'partial')`,
          [resolved.pgId],
        );
      }
      return { ...invoice, status: 'overdue' };
    }
    return invoice;
  }

  async list(filters: {
    customerId?: number;
    lifecycleId?: number;
    status?: string;
    overdue?: boolean;
    limit?: number;
  }): Promise<InvoiceRow[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (filters.customerId) {
      clauses.push(`COALESCE(cu.sqlite_customer_id, cu.id) = $${idx++}`);
      params.push(filters.customerId);
    }
    if (filters.lifecycleId) {
      clauses.push(`COALESCE(l.sqlite_lifecycle_id, l.id) = $${idx++}`);
      params.push(filters.lifecycleId);
    }
    if (filters.status) {
      clauses.push(`i.status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.overdue) {
      clauses.push(`i.status IN ('issued', 'partial', 'overdue') AND i.due_on IS NOT NULL AND i.due_on < $${idx++}`);
      params.push(todayIso());
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    params.push(limit);
    const result = await this.db.query(
      `${INVOICE_SELECT} ${where} ORDER BY i.due_on ASC NULLS LAST, i.id DESC LIMIT $${idx}`,
      params,
    );
    const rows: InvoiceRow[] = [];
    for (const row of result.rows) {
      rows.push(await this.refreshOverdueStatus(mapInvoiceRow(row as Record<string, unknown>)));
    }
    return rows;
  }

  async getById(id: number, withLines = false): Promise<InvoiceRow | null> {
    const result = await this.db.query(
      `${INVOICE_SELECT} WHERE i.sqlite_invoice_id = $1 OR i.id = $1
       ORDER BY CASE WHEN i.sqlite_invoice_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [id],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    const invoice = await this.refreshOverdueStatus(mapInvoiceRow(row));
    if (withLines) invoice.lines = await this.listLines(invoice.id);
    return invoice;
  }

  async listLines(invoiceLegacyId: number): Promise<InvoiceLineRow[]> {
    const resolved = await this.resolveInvoicePgId(invoiceLegacyId);
    if (!resolved) return [];
    const result = await this.db.query(
      `SELECT il.*, COALESCE(i.sqlite_invoice_id, i.id) AS legacy_invoice_id
       FROM crm_invoice_lines il
       JOIN crm_invoices i ON i.id = il.invoice_id
       WHERE il.invoice_id = $1
       ORDER BY il.sort_order, il.id`,
      [resolved.pgId],
    );
    return result.rows.map((row) => mapInvoiceLineRow(row as Record<string, unknown>));
  }

  async lifecycleInvoiceAr(lifecycleId: number): Promise<{ ar_pending_vnd: number; ar_overdue_vnd: number }> {
    const lifecyclePgId = await this.resolveLifecyclePgId(lifecycleId);
    if (lifecyclePgId == null) return { ar_pending_vnd: 0, ar_overdue_vnd: 0 };
    const result = await this.db.query(
      `SELECT amount_vnd, paid_vnd, due_on, status FROM crm_invoices
       WHERE lifecycle_id = $1 AND status IN ('issued', 'partial', 'overdue')`,
      [lifecyclePgId],
    );
    const today = todayIso();
    let pending = 0;
    let overdue = 0;
    for (const row of result.rows as Array<Record<string, unknown>>) {
      const open = Math.max(0, Number(row.amount_vnd ?? 0) - Number(row.paid_vnd ?? 0));
      if (open <= 0) continue;
      pending += open;
      const due = String(row.due_on ?? '').slice(0, 10);
      if (due && due < today) overdue += open;
    }
    return { ar_pending_vnd: pending, ar_overdue_vnd: overdue };
  }

  private async recalcTotal(invoicePgId: number): Promise<number> {
    const sumResult = await this.db.query(
      `SELECT COALESCE(SUM(amount_vnd), 0) AS total FROM crm_invoice_lines WHERE invoice_id = $1`,
      [invoicePgId],
    );
    const total = Number((sumResult.rows[0] as { total?: unknown })?.total ?? 0);
    await this.db.query(`UPDATE crm_invoices SET amount_vnd = $1, updated_at = NOW() WHERE id = $2`, [
      total,
      invoicePgId,
    ]);
    const resolved = await this.resolveInvoicePgId(invoicePgId);
    if (resolved) await this.syncPaidStatus(resolved.legacyId);
    return total;
  }

  async syncPaidStatus(invoiceLegacyId: number): Promise<InvoiceRow | null> {
    const resolved = await this.resolveInvoicePgId(invoiceLegacyId);
    if (!resolved) return null;
    const invoice = await this.getById(invoiceLegacyId);
    if (!invoice) return null;
    const payResult = await this.db.query(
      `SELECT COALESCE(SUM(CASE WHEN status = 'received' THEN amount_vnd ELSE 0 END), 0) AS paid
       FROM crm_svc_payments WHERE invoice_id = $1`,
      [resolved.pgId],
    );
    const paid = Number((payResult.rows[0] as { paid?: unknown })?.paid ?? 0);
    let status = invoice.status;
    if (status !== 'void' && status !== 'draft') {
      if (paid >= invoice.amount_vnd && invoice.amount_vnd > 0) status = 'paid';
      else if (paid > 0) status = 'partial';
      else if (status === 'paid' || status === 'partial') status = 'issued';
    }
    await this.db.query(
      `UPDATE crm_invoices SET paid_vnd = $1, status = $2, updated_at = NOW() WHERE id = $3`,
      [paid, status, resolved.pgId],
    );
    return this.getById(invoiceLegacyId, true);
  }

  async create(body: CreateInvoiceBody): Promise<InvoiceRow> {
    const customerPgId = await this.resolveCustomerPgId(Number(body.customer_id));
    if (customerPgId == null) throw new Error('customer_not_found');
    const orderPgId =
      body.order_id != null ? await this.resolveOrderPgId(Number(body.order_id)) : null;
    const lifecyclePgId =
      body.lifecycle_id != null ? await this.resolveLifecyclePgId(Number(body.lifecycle_id)) : null;
    const insert = await this.db.query(
      `INSERT INTO crm_invoices (
         invoice_number, order_id, contract_id, lifecycle_id, customer_id,
         status, issued_on, due_on, amount_vnd, paid_vnd, notes, created_at, updated_at
       ) VALUES ('', $1, $2, $3, $4, 'draft', $5, $6, $7, 0, $8, NOW(), NOW())
       RETURNING id`,
      [
        orderPgId,
        body.contract_id != null ? Number(body.contract_id) : null,
        lifecyclePgId,
        customerPgId,
        body.issued_on ? String(body.issued_on).slice(0, 10) : null,
        body.due_on ? String(body.due_on).slice(0, 10) : null,
        Math.max(0, Number(body.amount_vnd ?? 0)),
        String(body.notes ?? '').slice(0, 4000),
      ],
    );
    const pgId = Number((insert.rows[0] as { id: unknown }).id);
    const number = `INV-${new Date().getFullYear()}-${String(pgId).padStart(5, '0')}`;
    await this.db.query(`UPDATE crm_invoices SET invoice_number = $1 WHERE id = $2`, [number, pgId]);
    for (const line of body.lines ?? []) {
      await this.addLine(pgId, line);
    }
    if ((body.lines ?? []).length === 0 && body.amount_vnd != null) {
      await this.recalcTotal(pgId);
    }
    return (await this.getById(pgId, true))!;
  }

  async createFromOrder(
    order: {
      id: number;
      customer_id: number;
      contract_id: number | null;
      lifecycle_id: number | null;
      total_vnd: number;
      lines?: OrderLineRow[];
    },
    dueOn?: string,
  ): Promise<InvoiceRow> {
    return this.create({
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
  }

  async patch(id: number, body: PatchInvoiceBody): Promise<InvoiceRow | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const resolved = await this.resolveInvoicePgId(id);
    if (!resolved) return null;
    const status = body.status ?? existing.status;
    const issuedOn = body.issued_on != null ? String(body.issued_on).slice(0, 10) : existing.issued_on;
    const dueOn = body.due_on != null ? String(body.due_on).slice(0, 10) : existing.due_on;
    const notes = body.notes != null ? String(body.notes).slice(0, 4000) : existing.notes;
    const contractId = body.contract_id !== undefined ? body.contract_id : existing.contract_id;
    let lifecyclePgId: number | null = null;
    if (body.lifecycle_id !== undefined) {
      lifecyclePgId =
        body.lifecycle_id != null ? await this.resolveLifecyclePgId(Number(body.lifecycle_id)) : null;
    } else if (existing.lifecycle_id != null) {
      lifecyclePgId = await this.resolveLifecyclePgId(existing.lifecycle_id);
    }
    await this.db.query(
      `UPDATE crm_invoices
       SET status = $1, issued_on = $2, due_on = $3, notes = $4,
           contract_id = $5, lifecycle_id = $6, updated_at = NOW()
       WHERE id = $7`,
      [
        status,
        issuedOn || null,
        dueOn || null,
        notes,
        contractId,
        lifecyclePgId,
        resolved.pgId,
      ],
    );
    return this.getById(id, true);
  }

  async issue(id: number, issuedOn?: string, dueOn?: string): Promise<InvoiceRow | null> {
    const existing = await this.getById(id);
    if (!existing || existing.status === 'void') return null;
    const resolved = await this.resolveInvoicePgId(id);
    if (!resolved) return null;
    const issued = String(issuedOn ?? todayIso()).slice(0, 10);
    const due = String(dueOn ?? existing.due_on ?? '').slice(0, 10);
    await this.db.query(
      `UPDATE crm_invoices SET status = 'issued', issued_on = $1, due_on = $2, updated_at = NOW() WHERE id = $3`,
      [issued, due || null, resolved.pgId],
    );
    return this.getById(id, true);
  }

  async voidInvoice(id: number): Promise<InvoiceRow | null> {
    const resolved = await this.resolveInvoicePgId(id);
    if (!resolved) return null;
    await this.db.query(
      `UPDATE crm_invoices SET status = 'void', updated_at = NOW() WHERE id = $1`,
      [resolved.pgId],
    );
    return this.getById(id, true);
  }

  async addLine(
    invoiceLegacyOrPgId: number,
    body: {
      product_slug?: string;
      description?: string;
      quantity?: number;
      unit_price_vnd?: number;
      amount_vnd?: number;
      sort_order?: number;
    },
  ): Promise<InvoiceLineRow> {
    let pgId = invoiceLegacyOrPgId;
    const resolved = await this.resolveInvoicePgId(invoiceLegacyOrPgId);
    if (resolved) pgId = resolved.pgId;
    const qty = Math.max(1, Number(body.quantity ?? 1));
    const unit = Math.max(0, Number(body.unit_price_vnd ?? 0));
    const amount = body.amount_vnd != null ? Math.max(0, Number(body.amount_vnd)) : qty * unit;
    const insert = await this.db.query(
      `INSERT INTO crm_invoice_lines (
         invoice_id, product_slug, description, quantity, unit_price_vnd, amount_vnd, sort_order
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        pgId,
        String(body.product_slug ?? ''),
        String(body.description ?? body.product_slug ?? ''),
        qty,
        unit,
        amount,
        Number(body.sort_order ?? 0),
      ],
    );
    await this.recalcTotal(pgId);
    const lineId = Number((insert.rows[0] as { id: unknown }).id);
    const lineResult = await this.db.query(
      `SELECT il.*, COALESCE(i.sqlite_invoice_id, i.id) AS legacy_invoice_id
       FROM crm_invoice_lines il
       JOIN crm_invoices i ON i.id = il.invoice_id
       WHERE il.id = $1`,
      [lineId],
    );
    return mapInvoiceLineRow(lineResult.rows[0] as Record<string, unknown>);
  }
}
