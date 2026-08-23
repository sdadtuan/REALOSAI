import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { ChurnHealthSignals } from './churn-health.types';
import { computeTicketSpike } from './churn-health.engine';

function parseYmd(raw: string): Date | null {
  const text = String(raw ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const d = new Date(`${text}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

function emptySignals(): ChurnHealthSignals {
  return {
    contract_days_until_end: null,
    contract_amount_vnd: 0,
    lifecycle_id: null,
    tickets_open: 0,
    tickets_last_7d: 0,
    tickets_prev_7d: 0,
    ticket_spike: false,
    negative_tickets_open: 0,
    payment_overdue_vnd: 0,
    payment_overdue_count: 0,
  };
}

@Injectable()
export class ChurnHealthContextRepository implements OnModuleDestroy {
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

  async buildSignalsForClients(clientIds: string[]): Promise<Map<string, ChurnHealthSignals>> {
    const wanted = new Set(clientIds.map((id) => String(id ?? '').trim()).filter(Boolean));
    const out = new Map<string, ChurnHealthSignals>();
    for (const id of wanted) {
      out.set(id, emptySignals());
    }
    if (wanted.size === 0) return out;

    await this.mergeContractSignals(out, wanted);
    await this.mergeTicketSignals(out, wanted);
    await this.mergePaymentSignals(out, wanted);
    return out;
  }

  private async mergeContractSignals(
    out: Map<string, ChurnHealthSignals>,
    wanted: Set<string>,
  ): Promise<void> {
    const today = parseYmd(todayYmd());
    if (!today) return;

    let rows: Array<Record<string, unknown>> = [];
    try {
      const result = await this.db.query(
        `SELECT TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id,
                substr(ct.ends_on::text, 1, 10) AS ends_on,
                ct.amount_vnd,
                sl.id AS lifecycle_id
         FROM crm_contracts ct
         LEFT JOIN crm_service_lifecycle sl ON sl.contract_id = ct.id
         WHERE ct.status = 'active'
           AND TRIM(COALESCE(ct.agency_client_id, '')) != ''
           AND TRIM(COALESCE(ct.ends_on::text, '')) != ''`,
      );
      rows = result.rows as Array<Record<string, unknown>>;
    } catch {
      return;
    }

    for (const row of rows) {
      const clientId = String(row.agency_client_id ?? '').trim();
      if (!wanted.has(clientId)) continue;
      const endsOn = String(row.ends_on ?? '').slice(0, 10);
      const endDate = parseYmd(endsOn);
      if (!endDate) continue;
      const daysUntilEnd = daysBetween(today, endDate);
      const current = out.get(clientId) ?? emptySignals();
      if (current.contract_days_until_end == null || daysUntilEnd < current.contract_days_until_end) {
        current.contract_days_until_end = daysUntilEnd;
      }
      current.contract_amount_vnd = Math.max(current.contract_amount_vnd, Number(row.amount_vnd ?? 0));
      if (row.lifecycle_id != null) {
        current.lifecycle_id = Number(row.lifecycle_id);
      }
      out.set(clientId, current);
    }
  }

  private async mergeTicketSignals(
    out: Map<string, ChurnHealthSignals>,
    wanted: Set<string>,
  ): Promise<void> {
    let rows: Array<Record<string, unknown>> = [];
    try {
      const result = await this.db.query(
        `SELECT TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id,
                SUM(CASE WHEN t.status NOT IN ('da_xu_ly', 'dong') THEN 1 ELSE 0 END)::bigint AS tickets_open,
                SUM(CASE WHEN t.created_at::date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END)::bigint AS tickets_last_7d,
                SUM(CASE WHEN t.created_at::date >= CURRENT_DATE - INTERVAL '14 days'
                          AND t.created_at::date < CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END)::bigint AS tickets_prev_7d,
                SUM(CASE WHEN t.status NOT IN ('da_xu_ly', 'dong')
                          AND (
                            t.sentiment_label = 'negative'
                            OR t.priority = 'cao'
                            OR t.ticket_type = 'phan_anh'
                          ) THEN 1 ELSE 0 END)::bigint AS negative_open
         FROM crm_contracts ct
         INNER JOIN crm_tickets t ON t.customer_id = ct.customer_id
         WHERE TRIM(COALESCE(ct.agency_client_id, '')) != ''
         GROUP BY agency_client_id`,
      );
      rows = result.rows as Array<Record<string, unknown>>;
    } catch {
      return;
    }

    for (const row of rows) {
      const clientId = String(row.agency_client_id ?? '').trim();
      if (!wanted.has(clientId)) continue;
      const current = out.get(clientId) ?? emptySignals();
      const last7d = Number(row.tickets_last_7d ?? 0);
      const prev7d = Number(row.tickets_prev_7d ?? 0);
      current.tickets_open = Number(row.tickets_open ?? 0);
      current.tickets_last_7d = last7d;
      current.tickets_prev_7d = prev7d;
      current.ticket_spike = computeTicketSpike(last7d, prev7d);
      current.negative_tickets_open = Number(row.negative_open ?? 0);
      out.set(clientId, current);
    }
  }

  private async mergePaymentSignals(
    out: Map<string, ChurnHealthSignals>,
    wanted: Set<string>,
  ): Promise<void> {
    let rows: Array<Record<string, unknown>> = [];
    try {
      const result = await this.db.query(
        `SELECT TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id,
                SUM(CASE WHEN p.due_on IS NOT NULL
                          AND p.due_on::date < CURRENT_DATE
                          AND COALESCE(p.status, '') != 'received'
                         THEN p.amount_vnd ELSE 0 END)::bigint AS overdue_vnd,
                SUM(CASE WHEN p.due_on IS NOT NULL
                          AND p.due_on::date < CURRENT_DATE
                          AND COALESCE(p.status, '') != 'received'
                         THEN 1 ELSE 0 END)::bigint AS overdue_count
         FROM crm_contracts ct
         INNER JOIN crm_service_lifecycle sl ON sl.contract_id = ct.id
         INNER JOIN crm_svc_payments p ON p.lifecycle_id = sl.id
         WHERE TRIM(COALESCE(ct.agency_client_id, '')) != ''
         GROUP BY agency_client_id`,
      );
      rows = result.rows as Array<Record<string, unknown>>;
    } catch {
      return;
    }

    for (const row of rows) {
      const clientId = String(row.agency_client_id ?? '').trim();
      if (!wanted.has(clientId)) continue;
      const current = out.get(clientId) ?? emptySignals();
      current.payment_overdue_vnd = Number(row.overdue_vnd ?? 0);
      current.payment_overdue_count = Number(row.overdue_count ?? 0);
      out.set(clientId, current);
    }
  }
}
