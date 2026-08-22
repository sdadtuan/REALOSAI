import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import {
  CreateProposalBody,
  ProposalRow,
  ProposalStatus,
  QuoteLineItemRow,
  QuoteLineInput,
} from './proposals.types';

@Injectable()
export class ProposalsSqliteRepository implements OnModuleDestroy {
  private db: DatabaseSync | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get database(): DatabaseSync {
    if (!this.db) {
      this.db = new DatabaseSync(this.config.sqlitePath);
      this.db.exec('PRAGMA foreign_keys = ON');
      this.ensureSchema();
    }
    return this.db;
  }

  onModuleDestroy(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private ensureSchema(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS crm_proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
        lifecycle_id INTEGER REFERENCES crm_service_lifecycle(id) ON DELETE SET NULL,
        service_slugs TEXT NOT NULL DEFAULT '[]',
        total_vnd INTEGER NOT NULL DEFAULT 0,
        timeline_months INTEGER NOT NULL DEFAULT 1,
        notes TEXT NOT NULL DEFAULT '',
        ai_output TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft',
        valid_until TEXT NULL,
        price_adjustment_reason TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_crm_proposals_customer ON crm_proposals (customer_id);

      CREATE TABLE IF NOT EXISTS crm_quote_line_item (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        proposal_id INTEGER NOT NULL REFERENCES crm_proposals(id) ON DELETE CASCADE,
        dv_code TEXT NOT NULL,
        package_tier TEXT NOT NULL,
        service_slug TEXT NOT NULL DEFAULT '',
        reference_price_min INTEGER NOT NULL DEFAULT 0,
        reference_price_max INTEGER NOT NULL DEFAULT 0,
        final_price_vnd INTEGER NOT NULL DEFAULT 0,
        scope_notes TEXT NOT NULL DEFAULT '',
        lifecycle_id INTEGER REFERENCES crm_service_lifecycle(id) ON DELETE SET NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_crm_quote_line_proposal ON crm_quote_line_item (proposal_id);
    `);
    this.ensureColumn('crm_proposals', 'status', "TEXT NOT NULL DEFAULT 'draft'");
    this.ensureColumn('crm_proposals', 'valid_until', 'TEXT NULL');
    this.ensureColumn('crm_proposals', 'price_adjustment_reason', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn('crm_proposals', 'lead_id', 'INTEGER NULL');
    this.ensureColumn('crm_proposals', 'presales_id', 'INTEGER NULL');
    this.ensureColumn('crm_quote_line_item', 'sku_code', 'TEXT NULL');
  }

  private ensureColumn(table: string, column: string, ddl: string): void {
    const cols = this.database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      this.database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
  }

  listByCustomer(customerId: number): ProposalRow[] {
    const rows = this.database
      .prepare('SELECT * FROM crm_proposals WHERE customer_id = ? ORDER BY id DESC')
      .all(customerId) as unknown as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapProposalRow(r, false));
  }

  listByLeadId(leadId: number): ProposalRow[] {
    const rows = this.database
      .prepare('SELECT * FROM crm_proposals WHERE lead_id = ? ORDER BY id DESC')
      .all(leadId) as unknown as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapProposalRow(r, false));
  }

  getById(proposalId: number): ProposalRow | null {
    const row = this.database
      .prepare('SELECT * FROM crm_proposals WHERE id = ?')
      .get(proposalId) as unknown as Record<string, unknown> | undefined;
    return row ? this.mapProposalRow(row, true) : null;
  }

  getCustomerName(customerId: number): string {
    const row = this.database
      .prepare('SELECT name, company FROM crm_customers WHERE id = ? LIMIT 1')
      .get(customerId) as { name?: string; company?: string } | undefined;
    if (!row) return '';
    return String(row.company || row.name || '').trim();
  }

  listLines(proposalId: number): QuoteLineItemRow[] {
    const rows = this.database
      .prepare(
        `SELECT * FROM crm_quote_line_item WHERE proposal_id = ? ORDER BY sort_order ASC, id ASC`,
      )
      .all(proposalId) as unknown as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapLineRow(r));
  }

  create(body: CreateProposalBody): { id: number } {
    const slugs = (body.service_slugs ?? []).map((s) => String(s).trim()).filter(Boolean);
    const ts = catalogTs();
    const leadId = Number(body.lead_id ?? 0);
    const presalesId = Number(body.presales_id ?? 0);
    const result = this.database
      .prepare(
        `INSERT INTO crm_proposals (
           customer_id, lead_id, presales_id, lifecycle_id, service_slugs, total_vnd, timeline_months,
           notes, ai_output, status, valid_until, price_adjustment_reason, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, '', ?, ?)`,
      )
      .run(
        Number(body.customer_id),
        Number.isFinite(leadId) && leadId > 0 ? leadId : null,
        Number.isFinite(presalesId) && presalesId > 0 ? presalesId : null,
        body.lifecycle_id != null ? Number(body.lifecycle_id) : null,
        JSON.stringify(slugs),
        Math.max(0, Number(body.total_vnd ?? 0)),
        Math.max(1, Number(body.timeline_months ?? 1)),
        String(body.notes ?? '').slice(0, 2000),
        '{}',
        body.valid_until != null ? String(body.valid_until).slice(0, 10) : null,
        ts,
        ts,
      );
    return { id: Number(result.lastInsertRowid) };
  }

  replaceLines(
    proposalId: number,
    lines: Array<
      QuoteLineInput & {
        sku_code?: string | null;
        service_slug: string;
        reference_price_min: number;
        reference_price_max: number;
        final_price_vnd: number;
      }
    >,
    priceAdjustmentReason?: string,
  ): QuoteLineItemRow[] {
    const ts = catalogTs();
    this.database.prepare('DELETE FROM crm_quote_line_item WHERE proposal_id = ?').run(proposalId);
    const slugs: string[] = [];
    let total = 0;
    lines.forEach((line, index) => {
      slugs.push(line.service_slug);
      total += line.final_price_vnd;
      this.database
        .prepare(
          `INSERT INTO crm_quote_line_item (
             proposal_id, dv_code, sku_code, package_tier, service_slug,
             reference_price_min, reference_price_max, final_price_vnd,
             scope_notes, sort_order
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          proposalId,
          String(line.dv_code ?? '').toUpperCase(),
          line.sku_code != null ? String(line.sku_code).toUpperCase() : null,
          line.package_tier ?? 'standard',
          line.service_slug,
          line.reference_price_min,
          line.reference_price_max,
          line.final_price_vnd,
          String(line.scope_notes ?? '').slice(0, 2000),
          index,
        );
    });
    this.database
      .prepare(
        `UPDATE crm_proposals
         SET service_slugs = ?, total_vnd = ?, price_adjustment_reason = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        JSON.stringify([...new Set(slugs)]),
        total,
        String(priceAdjustmentReason ?? '').slice(0, 2000),
        ts,
        proposalId,
      );
    return this.listLines(proposalId);
  }

  patchStatus(
    proposalId: number,
    status: ProposalStatus,
    priceAdjustmentReason?: string,
  ): ProposalRow | null {
    const ts = catalogTs();
    const reason =
      priceAdjustmentReason != null
        ? String(priceAdjustmentReason).slice(0, 2000)
        : undefined;
    if (reason != null) {
      this.database
        .prepare(
          `UPDATE crm_proposals SET status = ?, price_adjustment_reason = ?, updated_at = ? WHERE id = ?`,
        )
        .run(status, reason, ts, proposalId);
    } else {
      this.database
        .prepare(`UPDATE crm_proposals SET status = ?, updated_at = ? WHERE id = ?`)
        .run(status, ts, proposalId);
    }
    return this.getById(proposalId);
  }

  setLineLifecycle(lineId: number, lifecycleId: number): void {
    this.database
      .prepare(`UPDATE crm_quote_line_item SET lifecycle_id = ? WHERE id = ?`)
      .run(lifecycleId, lineId);
  }

  setProposalLifecycle(proposalId: number, lifecycleId: number): void {
    const ts = catalogTs();
    this.database
      .prepare(`UPDATE crm_proposals SET lifecycle_id = ?, updated_at = ? WHERE id = ?`)
      .run(lifecycleId, ts, proposalId);
  }

  setLifecycleSkuCode(lifecycleId: number, skuCode: string): void {
    this.database
      .prepare(`UPDATE crm_service_lifecycle SET sku_code = ?, updated_at = ? WHERE id = ?`)
      .run(String(skuCode).toUpperCase(), catalogTs(), lifecycleId);
  }

  activateLifecycle(lifecycleId: number, stage: string, notes: string): void {
    const ts = catalogTs();
    this.database
      .prepare(
        `UPDATE crm_service_lifecycle
         SET status = 'active', stage = ?, notes = ?, stage_entered_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(stage, notes.slice(0, 2000), ts, ts, lifecycleId);
  }

  delete(proposalId: number): boolean {
    const result = this.database.prepare('DELETE FROM crm_proposals WHERE id = ?').run(proposalId);
    return Number(result.changes) > 0;
  }

  private mapLineRow(row: Record<string, unknown>): QuoteLineItemRow {
    return {
      id: Number(row.id),
      proposal_id: Number(row.proposal_id),
      dv_code: String(row.dv_code ?? ''),
      sku_code: row.sku_code != null ? String(row.sku_code) : null,
      package_tier: String(row.package_tier ?? ''),
      service_slug: String(row.service_slug ?? ''),
      reference_price_min: Number(row.reference_price_min ?? 0),
      reference_price_max: Number(row.reference_price_max ?? 0),
      final_price_vnd: Number(row.final_price_vnd ?? 0),
      scope_notes: String(row.scope_notes ?? ''),
      lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
      sort_order: Number(row.sort_order ?? 0),
    };
  }

  private mapProposalRow(row: Record<string, unknown>, parseAi: boolean): ProposalRow {
    let serviceSlugs: string[] = [];
    try {
      serviceSlugs = JSON.parse(String(row.service_slugs ?? '[]'));
    } catch {
      serviceSlugs = [];
    }
    let aiOutput: Record<string, unknown> = {};
    const rawAi = String(row.ai_output ?? '{}');
    if (parseAi) {
      try {
        aiOutput = JSON.parse(rawAi) as Record<string, unknown>;
      } catch {
        aiOutput = {};
      }
    } else {
      try {
        aiOutput = JSON.parse(rawAi) as Record<string, unknown>;
      } catch {
        aiOutput = {};
      }
    }
    const generated = Object.values(aiOutput).some((v) => Boolean(v));
    const status = String(row.status ?? 'draft') as ProposalStatus;
    return {
      id: Number(row.id),
      customer_id: Number(row.customer_id),
      lead_id: row.lead_id != null ? Number(row.lead_id) : null,
      presales_id: row.presales_id != null ? Number(row.presales_id) : null,
      lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
      service_slugs: serviceSlugs,
      total_vnd: Number(row.total_vnd ?? 0),
      timeline_months: Number(row.timeline_months ?? 1),
      notes: String(row.notes ?? ''),
      ai_output: aiOutput,
      generated,
      status: ['draft', 'sent', 'accepted', 'rejected'].includes(status) ? status : 'draft',
      valid_until: row.valid_until != null ? String(row.valid_until) : null,
      price_adjustment_reason: String(row.price_adjustment_reason ?? ''),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }
}
