import { Injectable } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
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
export class ChurnHealthContextRepository {
  private db: DatabaseSync | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get database(): DatabaseSync {
    if (!this.db) {
      this.db = new DatabaseSync(this.config.sqlitePath);
      this.db.exec('PRAGMA foreign_keys = ON');
    }
    return this.db;
  }

  buildSignalsForClients(clientIds: string[]): Map<string, ChurnHealthSignals> {
    const wanted = new Set(clientIds.map((id) => String(id ?? '').trim()).filter(Boolean));
    const out = new Map<string, ChurnHealthSignals>();
    for (const id of wanted) {
      out.set(id, emptySignals());
    }
    if (wanted.size === 0) return out;

    this.mergeContractSignals(out, wanted);
    this.mergeTicketSignals(out, wanted);
    this.mergePaymentSignals(out, wanted);
    return out;
  }

  private mergeContractSignals(out: Map<string, ChurnHealthSignals>, wanted: Set<string>): void {
    const today = parseYmd(todayYmd());
    if (!today) return;

    let rows: Array<Record<string, unknown>> = [];
    try {
      rows = this.database
        .prepare(
          `SELECT TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id,
                  substr(ct.ends_on, 1, 10) AS ends_on,
                  ct.amount_vnd,
                  sl.id AS lifecycle_id
           FROM crm_contracts ct
           LEFT JOIN crm_service_lifecycle sl ON sl.contract_id = ct.id
           WHERE ct.status = 'active'
             AND TRIM(COALESCE(ct.agency_client_id, '')) != ''
             AND TRIM(COALESCE(ct.ends_on, '')) != ''`,
        )
        .all() as Array<Record<string, unknown>>;
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

  private mergeTicketSignals(out: Map<string, ChurnHealthSignals>, wanted: Set<string>): void {
    let rows: Array<Record<string, unknown>> = [];
    try {
      rows = this.database
        .prepare(
          `SELECT TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id,
                  SUM(CASE WHEN t.status NOT IN ('da_xu_ly', 'dong') THEN 1 ELSE 0 END) AS tickets_open,
                  SUM(CASE WHEN substr(t.created_at, 1, 10) >= date('now', '-7 days') THEN 1 ELSE 0 END) AS tickets_last_7d,
                  SUM(CASE WHEN substr(t.created_at, 1, 10) >= date('now', '-14 days')
                            AND substr(t.created_at, 1, 10) < date('now', '-7 days') THEN 1 ELSE 0 END) AS tickets_prev_7d,
                  SUM(CASE WHEN t.status NOT IN ('da_xu_ly', 'dong')
                            AND (
                              t.sentiment_label = 'negative'
                              OR t.priority = 'cao'
                              OR t.ticket_type = 'phan_anh'
                            ) THEN 1 ELSE 0 END) AS negative_open
           FROM crm_contracts ct
           INNER JOIN crm_tickets t ON t.customer_id = ct.customer_id
           WHERE TRIM(COALESCE(ct.agency_client_id, '')) != ''
           GROUP BY agency_client_id`,
        )
        .all() as Array<Record<string, unknown>>;
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

  private mergePaymentSignals(out: Map<string, ChurnHealthSignals>, wanted: Set<string>): void {
    let rows: Array<Record<string, unknown>> = [];
    try {
      rows = this.database
        .prepare(
          `SELECT TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id,
                  SUM(CASE WHEN TRIM(COALESCE(p.due_on, '')) != ''
                            AND substr(p.due_on, 1, 10) < date('now')
                            AND COALESCE(p.status, '') != 'received'
                           THEN p.amount_vnd ELSE 0 END) AS overdue_vnd,
                  SUM(CASE WHEN TRIM(COALESCE(p.due_on, '')) != ''
                            AND substr(p.due_on, 1, 10) < date('now')
                            AND COALESCE(p.status, '') != 'received'
                           THEN 1 ELSE 0 END) AS overdue_count
           FROM crm_contracts ct
           INNER JOIN crm_service_lifecycle sl ON sl.contract_id = ct.id
           INNER JOIN crm_svc_payments p ON p.lifecycle_id = sl.id
           WHERE TRIM(COALESCE(ct.agency_client_id, '')) != ''
           GROUP BY agency_client_id`,
        )
        .all() as Array<Record<string, unknown>>;
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
