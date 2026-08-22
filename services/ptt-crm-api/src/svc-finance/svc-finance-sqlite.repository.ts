import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { AppConfigService } from '../config/app-config.service';
import { ensureBillingSchema, tableExists, todayIso } from '../billing/billing-schema.util';

export interface SvcPaymentRow {
  id: number;
  lifecycle_id: number;
  amount_vnd: number;
  received_on: string;
  due_on: string | null;
  status: string;
  notes: string;
  invoice_id: number | null;
  payment_method: string;
  reference_code: string;
  created_at: string;
}

@Injectable()
export class SvcFinanceSqliteRepository implements OnModuleDestroy {
  private db: DatabaseSync | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get database(): DatabaseSync {
    if (!this.db) {
      this.db = new DatabaseSync(this.config.sqlitePath);
      this.db.exec('PRAGMA foreign_keys = ON');
      ensureBillingSchema(this.db);
    }
    return this.db;
  }

  onModuleDestroy(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  lifecycleExists(lifecycleId: number): boolean {
    const row = this.database
      .prepare('SELECT id FROM crm_service_lifecycle WHERE id = ?')
      .get(lifecycleId) as { id: number } | undefined;
    return row != null;
  }

  contractAmountVnd(lifecycleId: number): number {
    const row = this.database
      .prepare(
        `
        SELECT c.amount_vnd
        FROM crm_service_lifecycle lc
        LEFT JOIN crm_contracts c ON c.id = lc.contract_id
        WHERE lc.id = ?
        `,
      )
      .get(lifecycleId) as { amount_vnd: number | null } | undefined;
    return Number(row?.amount_vnd ?? 0);
  }

  private resolvePaymentDueOn(payment: {
    due_on?: string | null;
    status?: string;
    received_on?: string;
  }): string {
    const due = String(payment.due_on ?? '').trim().slice(0, 10);
    if (due) return due;
    if (String(payment.status ?? '') === 'pending') {
      return String(payment.received_on ?? '').trim().slice(0, 10);
    }
    return '';
  }

  private lifecycleInvoiceAr(lifecycleId: number): { ar_pending_vnd: number; ar_overdue_vnd: number } {
    if (!tableExists(this.database, 'crm_invoices')) {
      return { ar_pending_vnd: 0, ar_overdue_vnd: 0 };
    }
    const rows = this.database
      .prepare(
        `SELECT amount_vnd, paid_vnd, due_on, status FROM crm_invoices
         WHERE lifecycle_id = ? AND status IN ('issued', 'partial', 'overdue')`,
      )
      .all(lifecycleId) as Array<{ amount_vnd: number; paid_vnd: number; due_on: string; status: string }>;
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

  private lifecycleArTotals(lifecycleId: number): { ar_pending_vnd: number; ar_overdue_vnd: number } {
    const rows = this.database
      .prepare(
        `SELECT amount_vnd, received_on, due_on, status FROM crm_svc_payments
         WHERE lifecycle_id = ? AND status = 'pending'`,
      )
      .all(lifecycleId) as Array<{
      amount_vnd: number;
      received_on: string;
      due_on: string | null;
      status: string;
    }>;
    const today = new Date().toISOString().slice(0, 10);
    let pending = 0;
    let overdue = 0;
    for (const row of rows) {
      const amount = Number(row.amount_vnd ?? 0);
      pending += amount;
      const due = this.resolvePaymentDueOn(row);
      if (due && due < today) overdue += amount;
    }
    const invoiceAr = this.lifecycleInvoiceAr(lifecycleId);
    return {
      ar_pending_vnd: pending + invoiceAr.ar_pending_vnd,
      ar_overdue_vnd: overdue + invoiceAr.ar_overdue_vnd,
    };
  }

  private syncInvoicePaid(invoiceId: number): void {
    if (!tableExists(this.database, 'crm_invoices') || !invoiceId) return;
    const payRow = this.database
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN status = 'received' THEN amount_vnd ELSE 0 END), 0) AS paid
         FROM crm_svc_payments WHERE invoice_id = ?`,
      )
      .get(invoiceId) as { paid: number };
    const invoice = this.database
      .prepare('SELECT amount_vnd, status FROM crm_invoices WHERE id = ?')
      .get(invoiceId) as { amount_vnd: number; status: string } | undefined;
    if (!invoice) return;
    const paid = Number(payRow?.paid ?? 0);
    const amount = Number(invoice.amount_vnd ?? 0);
    let status = invoice.status;
    if (status !== 'void' && status !== 'draft') {
      if (paid >= amount && amount > 0) status = 'paid';
      else if (paid > 0) status = 'partial';
    }
    this.database
      .prepare('UPDATE crm_invoices SET paid_vnd = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(paid, status, new Date().toISOString().slice(0, 19).replace('T', ' '), invoiceId);
  }

  listPayments(lifecycleId: number): SvcPaymentRow[] {
    return this.database
      .prepare(
        `SELECT * FROM crm_svc_payments WHERE lifecycle_id = ?
         ORDER BY received_on DESC, id DESC`,
      )
      .all(lifecycleId) as unknown as SvcPaymentRow[];
  }

  getSummary(lifecycleId: number, contractAmountVnd: number): Record<string, unknown> {
    const payRow = this.database
      .prepare(
        `
        SELECT
          COALESCE(SUM(CASE WHEN status = 'received' THEN amount_vnd ELSE 0 END), 0) AS received_revenue,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_vnd ELSE 0 END), 0) AS pending_revenue
        FROM crm_svc_payments WHERE lifecycle_id = ?
        `,
      )
      .get(lifecycleId) as { received_revenue: number; pending_revenue: number };

    const deliveryRow = this.database
      .prepare(
        `
        SELECT COALESCE(SUM(amount_vnd), 0) AS total
        FROM crm_svc_expenses
        WHERE lifecycle_id = ?
          AND COALESCE(NULLIF(cost_phase, ''), 'delivery') = 'delivery'
        `,
      )
      .get(lifecycleId) as { total: number };

    const presalesRow = this.database
      .prepare(
        `
        SELECT COALESCE(SUM(amount_vnd), 0) AS total
        FROM crm_svc_expenses
        WHERE lifecycle_id = ? AND cost_phase = 'presales'
        `,
      )
      .get(lifecycleId) as { total: number };

    const received = Number(payRow.received_revenue ?? 0);
    const pending = Number(payRow.pending_revenue ?? 0);
    const deliveryExpenses = Number(deliveryRow.total ?? 0);
    const presalesExpenses = Number(presalesRow.total ?? 0);
    const totalExpenses = deliveryExpenses + presalesExpenses;
    const profit = received - deliveryExpenses;
    const marginPct = received > 0 ? (profit / received) * 100 : 0;
    const outstanding = Math.max(0, contractAmountVnd - received);
    const { ar_pending_vnd, ar_overdue_vnd } = this.lifecycleArTotals(lifecycleId);
    const invoiceAr = this.lifecycleInvoiceAr(lifecycleId);

    return {
      expected_revenue: contractAmountVnd,
      received_revenue: received,
      pending_revenue: pending,
      ar_pending_vnd,
      ar_overdue_vnd,
      invoice_ar_pending_vnd: invoiceAr.ar_pending_vnd,
      invoice_ar_overdue_vnd: invoiceAr.ar_overdue_vnd,
      delivery_expenses: deliveryExpenses,
      presales_expenses: presalesExpenses,
      total_expenses: totalExpenses,
      profit_vnd: profit,
      margin_pct: Math.round(marginPct * 100) / 100,
      outstanding_vnd: outstanding,
      lifecycle_id: lifecycleId,
    };
  }

  createPayment(body: Record<string, unknown>): SvcPaymentRow {
    const lifecycleId = Number(body.lifecycle_id);
    const amountVnd = Number(body.amount_vnd);
    const receivedOn = String(body.received_on ?? '').slice(0, 10);
    const dueOn = body.due_on ? String(body.due_on).slice(0, 10) : null;
    const status = String(body.status ?? 'pending').trim();
    const notes = String(body.notes ?? '').trim();
    const invoiceId = body.invoice_id != null ? Number(body.invoice_id) : null;
    const paymentMethod = String(body.payment_method ?? '').trim();
    const referenceCode = String(body.reference_code ?? '').trim();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const result = this.database
      .prepare(
        `
        INSERT INTO crm_svc_payments (
          lifecycle_id, amount_vnd, received_on, due_on, status, notes,
          invoice_id, payment_method, reference_code, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        lifecycleId,
        amountVnd,
        receivedOn,
        dueOn,
        status,
        notes,
        Number.isFinite(invoiceId) && invoiceId! > 0 ? invoiceId : null,
        paymentMethod,
        referenceCode,
        now,
      );
    const payment = this.getPaymentById(Number(result.lastInsertRowid))!;
    if (payment.invoice_id) this.syncInvoicePaid(payment.invoice_id);
    return payment;
  }

  getPaymentById(id: number): SvcPaymentRow | null {
    const row = this.database
      .prepare('SELECT * FROM crm_svc_payments WHERE id = ?')
      .get(id) as SvcPaymentRow | undefined;
    return row ?? null;
  }

  patchPayment(id: number, body: Record<string, unknown>): SvcPaymentRow | null {
    const existing = this.getPaymentById(id);
    if (!existing) return null;
    const amountVnd = body.amount_vnd != null ? Number(body.amount_vnd) : existing.amount_vnd;
    const receivedOn =
      body.received_on != null ? String(body.received_on).slice(0, 10) : existing.received_on;
    const dueOn = body.due_on != null ? String(body.due_on).slice(0, 10) : existing.due_on;
    const status = body.status != null ? String(body.status).trim() : existing.status;
    const notes = body.notes != null ? String(body.notes).trim() : existing.notes;
    const invoiceId =
      body.invoice_id != null ? Number(body.invoice_id) : existing.invoice_id;
    const paymentMethod =
      body.payment_method != null ? String(body.payment_method).trim() : existing.payment_method;
    const referenceCode =
      body.reference_code != null ? String(body.reference_code).trim() : existing.reference_code;
    this.database
      .prepare(
        `
        UPDATE crm_svc_payments
        SET amount_vnd = ?, received_on = ?, due_on = ?, status = ?, notes = ?,
            invoice_id = ?, payment_method = ?, reference_code = ?
        WHERE id = ?
        `,
      )
      .run(
        amountVnd,
        receivedOn,
        dueOn,
        status,
        notes,
        Number.isFinite(invoiceId) && invoiceId! > 0 ? invoiceId : null,
        paymentMethod,
        referenceCode,
        id,
      );
    const prevInvoiceId = existing.invoice_id;
    const updated = this.getPaymentById(id)!;
    if (updated.invoice_id) this.syncInvoicePaid(updated.invoice_id);
    if (prevInvoiceId && prevInvoiceId !== updated.invoice_id) this.syncInvoicePaid(prevInvoiceId);
    return updated;
  }

  deletePayment(id: number): boolean {
    const result = this.database.prepare('DELETE FROM crm_svc_payments WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
