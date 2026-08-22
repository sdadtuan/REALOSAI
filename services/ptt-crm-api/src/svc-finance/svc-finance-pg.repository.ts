import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

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
export class SvcFinancePgRepository implements OnModuleDestroy {
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

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async resolveLifecycleId(lifecycleId: number): Promise<number | null> {
    const result = await this.db.query(
      `SELECT id FROM crm_service_lifecycle
       WHERE id = $1 OR sqlite_lifecycle_id = $1 LIMIT 1`,
      [lifecycleId],
    );
    const id = result.rows[0]?.id;
    return id != null ? Number(id) : null;
  }

  async lifecycleExists(lifecycleId: number): Promise<boolean> {
    return (await this.resolveLifecycleId(lifecycleId)) != null;
  }

  async contractAmountVnd(lifecycleId: number): Promise<number> {
    const lcId = await this.resolveLifecycleId(lifecycleId);
    if (!lcId) return 0;
    const result = await this.db.query(
      `SELECT c.amount_vnd
       FROM crm_service_lifecycle lc
       LEFT JOIN crm_contracts c ON c.id = lc.contract_id
       WHERE lc.id = $1`,
      [lcId],
    );
    return Number(result.rows[0]?.amount_vnd ?? 0);
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

  private async lifecycleInvoiceAr(
    lifecycleId: number,
  ): Promise<{ ar_pending_vnd: number; ar_overdue_vnd: number }> {
    try {
      const result = await this.db.query(
        `SELECT amount_vnd, paid_vnd, due_on, status FROM crm_invoices
         WHERE lifecycle_id = $1 AND status IN ('issued', 'partial', 'overdue')`,
        [lifecycleId],
      );
      const today = this.todayIso();
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
    } catch {
      return { ar_pending_vnd: 0, ar_overdue_vnd: 0 };
    }
  }

  private async lifecycleArTotals(
    lifecycleId: number,
  ): Promise<{ ar_pending_vnd: number; ar_overdue_vnd: number }> {
    const result = await this.db.query(
      `SELECT amount_vnd, received_on, due_on, status FROM crm_svc_payments
       WHERE lifecycle_id = $1 AND status = 'pending'`,
      [lifecycleId],
    );
    const today = this.todayIso();
    let pending = 0;
    let overdue = 0;
    for (const row of result.rows as Array<Record<string, unknown>>) {
      const amount = Number(row.amount_vnd ?? 0);
      pending += amount;
      const due = this.resolvePaymentDueOn({
        due_on: row.due_on != null ? String(row.due_on) : null,
        status: String(row.status ?? ''),
        received_on: String(row.received_on ?? ''),
      });
      if (due && due < today) overdue += amount;
    }
    const invoiceAr = await this.lifecycleInvoiceAr(lifecycleId);
    return {
      ar_pending_vnd: pending + invoiceAr.ar_pending_vnd,
      ar_overdue_vnd: overdue + invoiceAr.ar_overdue_vnd,
    };
  }

  private async syncInvoicePaid(invoiceId: number): Promise<void> {
    if (!invoiceId) return;
    try {
      const payResult = await this.db.query(
        `SELECT COALESCE(SUM(CASE WHEN status = 'received' THEN amount_vnd ELSE 0 END), 0)::bigint AS paid
         FROM crm_svc_payments WHERE invoice_id = $1`,
        [invoiceId],
      );
      const invoiceResult = await this.db.query(
        `SELECT amount_vnd, status FROM crm_invoices WHERE id = $1`,
        [invoiceId],
      );
      const invoice = invoiceResult.rows[0] as { amount_vnd: number; status: string } | undefined;
      if (!invoice) return;
      const paid = Number(payResult.rows[0]?.paid ?? 0);
      const amount = Number(invoice.amount_vnd ?? 0);
      let status = invoice.status;
      if (status !== 'void' && status !== 'draft') {
        if (paid >= amount && amount > 0) status = 'paid';
        else if (paid > 0) status = 'partial';
      }
      await this.db.query(
        `UPDATE crm_invoices SET paid_vnd = $2, status = $3, updated_at = NOW() WHERE id = $1`,
        [invoiceId, paid, status],
      );
    } catch {
      /* invoices table optional */
    }
  }

  private mapPayment(row: Record<string, unknown>): SvcPaymentRow {
    return {
      id: Number(row.id),
      lifecycle_id: Number(row.lifecycle_id),
      amount_vnd: Number(row.amount_vnd ?? 0),
      received_on: String(row.received_on ?? '').slice(0, 10),
      due_on: row.due_on != null ? String(row.due_on).slice(0, 10) : null,
      status: String(row.status ?? ''),
      notes: String(row.notes ?? ''),
      invoice_id: row.invoice_id != null ? Number(row.invoice_id) : null,
      payment_method: String(row.payment_method ?? ''),
      reference_code: String(row.reference_code ?? ''),
      created_at: String(row.created_at ?? ''),
    };
  }

  async listPayments(lifecycleId: number): Promise<SvcPaymentRow[]> {
    const lcId = await this.resolveLifecycleId(lifecycleId);
    if (!lcId) return [];
    const result = await this.db.query(
      `SELECT * FROM crm_svc_payments WHERE lifecycle_id = $1
       ORDER BY received_on DESC, id DESC`,
      [lcId],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => this.mapPayment(row));
  }

  async getSummary(lifecycleId: number, contractAmountVnd: number): Promise<Record<string, unknown>> {
    const lcId = await this.resolveLifecycleId(lifecycleId);
    if (!lcId) {
      return {
        expected_revenue: contractAmountVnd,
        received_revenue: 0,
        pending_revenue: 0,
        ar_pending_vnd: 0,
        ar_overdue_vnd: 0,
        invoice_ar_pending_vnd: 0,
        invoice_ar_overdue_vnd: 0,
        delivery_expenses: 0,
        presales_expenses: 0,
        total_expenses: 0,
        profit_vnd: 0,
        margin_pct: 0,
        outstanding_vnd: contractAmountVnd,
        lifecycle_id: lifecycleId,
      };
    }

    const payResult = await this.db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'received' THEN amount_vnd ELSE 0 END), 0)::bigint AS received_revenue,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_vnd ELSE 0 END), 0)::bigint AS pending_revenue
       FROM crm_svc_payments WHERE lifecycle_id = $1`,
      [lcId],
    );
    const deliveryResult = await this.db.query(
      `SELECT COALESCE(SUM(amount_vnd), 0)::bigint AS total
       FROM crm_svc_expenses
       WHERE lifecycle_id = $1
         AND COALESCE(NULLIF(cost_phase, ''), 'delivery') = 'delivery'`,
      [lcId],
    );
    const presalesResult = await this.db.query(
      `SELECT COALESCE(SUM(amount_vnd), 0)::bigint AS total
       FROM crm_svc_expenses WHERE lifecycle_id = $1 AND cost_phase = 'presales'`,
      [lcId],
    );

    const received = Number(payResult.rows[0]?.received_revenue ?? 0);
    const pending = Number(payResult.rows[0]?.pending_revenue ?? 0);
    const deliveryExpenses = Number(deliveryResult.rows[0]?.total ?? 0);
    const presalesExpenses = Number(presalesResult.rows[0]?.total ?? 0);
    const totalExpenses = deliveryExpenses + presalesExpenses;
    const profit = received - deliveryExpenses;
    const marginPct = received > 0 ? (profit / received) * 100 : 0;
    const outstanding = Math.max(0, contractAmountVnd - received);
    const { ar_pending_vnd, ar_overdue_vnd } = await this.lifecycleArTotals(lcId);
    const invoiceAr = await this.lifecycleInvoiceAr(lcId);

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
      lifecycle_id: lcId,
    };
  }

  async createPayment(body: Record<string, unknown>): Promise<SvcPaymentRow> {
    const lifecycleId = Number(body.lifecycle_id);
    const lcId = await this.resolveLifecycleId(lifecycleId);
    if (!lcId) throw new Error('Không tìm thấy lifecycle');
    const amountVnd = Number(body.amount_vnd);
    const receivedOn = String(body.received_on ?? '').slice(0, 10);
    const dueOn = body.due_on ? String(body.due_on).slice(0, 10) : null;
    const status = String(body.status ?? 'pending').trim();
    const notes = String(body.notes ?? '').trim();
    const invoiceId = body.invoice_id != null ? Number(body.invoice_id) : null;
    const paymentMethod = String(body.payment_method ?? '').trim();
    const referenceCode = String(body.reference_code ?? '').trim();
    const result = await this.db.query(
      `INSERT INTO crm_svc_payments (
         lifecycle_id, amount_vnd, received_on, due_on, status, notes,
         invoice_id, payment_method, reference_code, created_at, updated_at
       ) VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        lcId,
        amountVnd,
        receivedOn,
        dueOn,
        status,
        notes,
        Number.isFinite(invoiceId) && invoiceId! > 0 ? invoiceId : null,
        paymentMethod,
        referenceCode,
      ],
    );
    const payment = this.mapPayment(result.rows[0] as Record<string, unknown>);
    if (payment.invoice_id) await this.syncInvoicePaid(payment.invoice_id);
    return payment;
  }

  async getPaymentById(id: number): Promise<SvcPaymentRow | null> {
    const result = await this.db.query(`SELECT * FROM crm_svc_payments WHERE id = $1`, [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapPayment(row) : null;
  }

  async patchPayment(id: number, body: Record<string, unknown>): Promise<SvcPaymentRow | null> {
    const existing = await this.getPaymentById(id);
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
    await this.db.query(
      `UPDATE crm_svc_payments
       SET amount_vnd = $2, received_on = $3::date, due_on = $4::date, status = $5, notes = $6,
           invoice_id = $7, payment_method = $8, reference_code = $9, updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        amountVnd,
        receivedOn,
        dueOn,
        status,
        notes,
        Number.isFinite(invoiceId) && invoiceId! > 0 ? invoiceId : null,
        paymentMethod,
        referenceCode,
      ],
    );
    const prevInvoiceId = existing.invoice_id;
    const updated = (await this.getPaymentById(id))!;
    if (updated.invoice_id) await this.syncInvoicePaid(updated.invoice_id);
    if (prevInvoiceId && prevInvoiceId !== updated.invoice_id) await this.syncInvoicePaid(prevInvoiceId);
    return updated;
  }

  async deletePayment(id: number): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM crm_svc_payments WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
