import { Injectable } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { AppConfigService } from '../config/app-config.service';
import { RenewalContractCandidate, RenewalTriggerWindow } from './renewal.types';

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

function resolveTriggerWindow(daysUntilEnd: number): RenewalTriggerWindow | null {
  if (daysUntilEnd <= 30) return 30;
  if (daysUntilEnd <= 60) return 60;
  if (daysUntilEnd <= 90) return 90;
  return null;
}

export function contractRefKey(contractId: number, window: RenewalTriggerWindow): string {
  return `${contractId}:T${window}`;
}

@Injectable()
export class RenewalContractContextRepository {
  private db: DatabaseSync | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get database(): DatabaseSync {
    if (!this.db) {
      this.db = new DatabaseSync(this.config.sqlitePath);
      this.db.exec('PRAGMA foreign_keys = ON');
    }
    return this.db;
  }

  listRenewalCandidates(maxDays = 90, limit = 500): RenewalContractCandidate[] {
    const today = parseYmd(todayYmd())!;
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + maxDays);
    const horizonYmd = horizon.toISOString().slice(0, 10);

    let rows: Array<Record<string, unknown>> = [];
    try {
      rows = this.database
        .prepare(
          `SELECT ct.id AS contract_id,
                  TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id,
                  ct.title AS contract_title,
                  ct.ends_on,
                  ct.amount_vnd,
                  ct.title AS client_name,
                  sl.id AS lifecycle_id
           FROM crm_contracts ct
           LEFT JOIN crm_service_lifecycle sl ON sl.contract_id = ct.id
           WHERE ct.status = 'active'
             AND TRIM(COALESCE(ct.agency_client_id, '')) != ''
             AND TRIM(COALESCE(ct.ends_on, '')) != ''
             AND substr(ct.ends_on, 1, 10) >= ?
             AND substr(ct.ends_on, 1, 10) <= ?
           ORDER BY ct.ends_on ASC, ct.id ASC
           LIMIT ?`,
        )
        .all(todayYmd(), horizonYmd, Math.min(Math.max(limit, 1), 1000)) as Array<Record<string, unknown>>;
    } catch {
      return [];
    }

    const out: RenewalContractCandidate[] = [];
    for (const row of rows) {
      const endsOn = String(row.ends_on ?? '').slice(0, 10);
      const endDate = parseYmd(endsOn);
      if (!endDate) continue;
      const daysUntilEnd = daysBetween(today, endDate);
      const triggerWindow = resolveTriggerWindow(daysUntilEnd);
      if (!triggerWindow) continue;

      out.push({
        contract_id: Number(row.contract_id),
        agency_client_id: String(row.agency_client_id ?? '').trim(),
        client_name: String(row.client_name ?? 'Client'),
        contract_title: String(row.contract_title ?? ''),
        ends_on: endsOn,
        amount_vnd: Number(row.amount_vnd ?? 0),
        days_until_end: daysUntilEnd,
        trigger_window: triggerWindow,
        lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
      });
    }
    return out;
  }
}
