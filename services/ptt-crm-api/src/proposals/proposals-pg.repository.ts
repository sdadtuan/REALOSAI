import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import { mapLineRow, mapProposalRow } from './proposals-pg.mapper';
import {
  CreateProposalBody,
  ProposalRow,
  ProposalStatus,
  QuoteLineItemRow,
  QuoteLineInput,
} from './proposals.types';

const PROPOSAL_SELECT = `
  SELECT p.*, COALESCE(c.sqlite_customer_id, c.id) AS legacy_customer_id
  FROM crm_proposals p
  JOIN crm_customers c ON c.id = p.customer_id
`;

@Injectable()
export class ProposalsPgRepository implements OnModuleDestroy {
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

  async resolveProposalPgId(
    legacyId: number,
  ): Promise<{ pgId: number; legacyId: number } | null> {
    const result = await this.db.query(
      `SELECT id, sqlite_proposal_id FROM crm_proposals
       WHERE sqlite_proposal_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_proposal_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [legacyId],
    );
    const row = result.rows[0] as { id?: unknown; sqlite_proposal_id?: unknown } | undefined;
    if (!row?.id) return null;
    const pgId = Number(row.id);
    const resolvedLegacyId = Number(row.sqlite_proposal_id ?? row.id);
    return { pgId, legacyId: resolvedLegacyId };
  }

  private async resolveCustomerPgId(
    legacyId: number,
  ): Promise<{ pgId: number; legacyId: number } | null> {
    const result = await this.db.query(
      `SELECT id, sqlite_customer_id FROM crm_customers
       WHERE sqlite_customer_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_customer_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [legacyId],
    );
    const row = result.rows[0] as { id?: unknown; sqlite_customer_id?: unknown } | undefined;
    if (!row?.id) return null;
    const pgId = Number(row.id);
    const resolvedLegacyId = Number(row.sqlite_customer_id ?? row.id);
    return { pgId, legacyId: resolvedLegacyId };
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

  async listByCustomer(customerId: number): Promise<ProposalRow[]> {
    const resolved = await this.resolveCustomerPgId(customerId);
    if (!resolved) return [];
    const result = await this.db.query(
      `${PROPOSAL_SELECT}
       WHERE p.customer_id = $1
       ORDER BY p.id DESC`,
      [resolved.pgId],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) =>
      mapProposalRow(row, false, resolved.legacyId),
    );
  }

  async listByLeadId(leadId: number): Promise<ProposalRow[]> {
    const result = await this.db.query(
      `${PROPOSAL_SELECT}
       WHERE p.lead_id = $1
       ORDER BY p.id DESC`,
      [leadId],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => mapProposalRow(row, false));
  }

  async getById(proposalId: number): Promise<ProposalRow | null> {
    const result = await this.db.query(
      `${PROPOSAL_SELECT}
       WHERE p.sqlite_proposal_id = $1 OR p.id = $1
       ORDER BY CASE WHEN p.sqlite_proposal_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [proposalId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapProposalRow(row, true) : null;
  }

  async getCustomerName(customerId: number): Promise<string> {
    const resolved = await this.resolveCustomerPgId(customerId);
    if (!resolved) return '';
    const result = await this.db.query(
      `SELECT name, company FROM crm_customers WHERE id = $1 LIMIT 1`,
      [resolved.pgId],
    );
    const row = result.rows[0] as { name?: string; company?: string } | undefined;
    if (!row) return '';
    return String(row.company || row.name || '').trim();
  }

  async listLines(proposalId: number): Promise<QuoteLineItemRow[]> {
    const resolved = await this.resolveProposalPgId(proposalId);
    if (!resolved) return [];
    const result = await this.db.query(
      `SELECT * FROM crm_quote_line_item
       WHERE proposal_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [resolved.pgId],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) =>
      mapLineRow(row, resolved.legacyId),
    );
  }

  async create(body: CreateProposalBody): Promise<{ id: number }> {
    const customerResolved = await this.resolveCustomerPgId(Number(body.customer_id));
    if (!customerResolved) {
      throw new Error('Customer not found');
    }
    const slugs = (body.service_slugs ?? []).map((s) => String(s).trim()).filter(Boolean);
    const ts = catalogTs();
    const leadId = Number(body.lead_id ?? 0);
    const presalesId = Number(body.presales_id ?? 0);
    const insert = await this.db.query(
      `INSERT INTO crm_proposals (
         customer_id, lead_id, presales_id, lifecycle_id, service_slugs, total_vnd, timeline_months,
         notes, ai_output, status, valid_until, price_adjustment_reason, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}', 'draft', $9, '', $10::timestamptz, $10::timestamptz)
       RETURNING id`,
      [
        customerResolved.pgId,
        Number.isFinite(leadId) && leadId > 0 ? leadId : null,
        Number.isFinite(presalesId) && presalesId > 0 ? presalesId : null,
        body.lifecycle_id != null ? Number(body.lifecycle_id) : null,
        JSON.stringify(slugs),
        Math.max(0, Number(body.total_vnd ?? 0)),
        Math.max(1, Number(body.timeline_months ?? 1)),
        String(body.notes ?? '').slice(0, 2000),
        body.valid_until != null ? String(body.valid_until).slice(0, 10) : null,
        ts,
      ],
    );
    const pgId = Number(insert.rows[0]?.id);
    await this.db.query(
      `UPDATE crm_proposals SET sqlite_proposal_id = id
       WHERE id = $1 AND sqlite_proposal_id IS NULL`,
      [pgId],
    );
    const resolved = await this.resolveProposalPgId(pgId);
    return { id: resolved?.legacyId ?? pgId };
  }

  async replaceLines(
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
  ): Promise<QuoteLineItemRow[]> {
    const resolved = await this.resolveProposalPgId(proposalId);
    if (!resolved) return [];
    const { pgId, legacyId } = resolved;
    const ts = catalogTs();

    await this.db.query(`DELETE FROM crm_quote_line_item WHERE proposal_id = $1`, [pgId]);

    const slugs: string[] = [];
    let total = 0;
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      slugs.push(line.service_slug);
      total += line.final_price_vnd;
      const insert = await this.db.query(
        `INSERT INTO crm_quote_line_item (
           proposal_id, dv_code, sku_code, package_tier, service_slug,
           reference_price_min, reference_price_max, final_price_vnd,
           scope_notes, sort_order
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          pgId,
          String(line.dv_code ?? '').toUpperCase(),
          line.sku_code != null ? String(line.sku_code).toUpperCase() : null,
          line.package_tier ?? 'standard',
          line.service_slug,
          line.reference_price_min,
          line.reference_price_max,
          line.final_price_vnd,
          String(line.scope_notes ?? '').slice(0, 2000),
          index,
        ],
      );
      const linePgId = Number(insert.rows[0]?.id);
      await this.db.query(
        `UPDATE crm_quote_line_item SET sqlite_line_id = id
         WHERE id = $1 AND sqlite_line_id IS NULL`,
        [linePgId],
      );
    }

    await this.db.query(
      `UPDATE crm_proposals
       SET service_slugs = $1, total_vnd = $2, price_adjustment_reason = $3, updated_at = $4::timestamptz
       WHERE id = $5`,
      [
        JSON.stringify([...new Set(slugs)]),
        total,
        String(priceAdjustmentReason ?? '').slice(0, 2000),
        ts,
        pgId,
      ],
    );
    return this.listLines(legacyId);
  }

  async patchStatus(
    proposalId: number,
    status: ProposalStatus,
    priceAdjustmentReason?: string,
  ): Promise<ProposalRow | null> {
    const resolved = await this.resolveProposalPgId(proposalId);
    if (!resolved) return null;
    const ts = catalogTs();
    const reason =
      priceAdjustmentReason != null
        ? String(priceAdjustmentReason).slice(0, 2000)
        : undefined;
    if (reason != null) {
      await this.db.query(
        `UPDATE crm_proposals SET status = $1, price_adjustment_reason = $2, updated_at = $3::timestamptz WHERE id = $4`,
        [status, reason, ts, resolved.pgId],
      );
    } else {
      await this.db.query(
        `UPDATE crm_proposals SET status = $1, updated_at = $2::timestamptz WHERE id = $3`,
        [status, ts, resolved.pgId],
      );
    }
    return this.getById(resolved.legacyId);
  }

  async setLineLifecycle(lineId: number, lifecycleId: number): Promise<void> {
    const lineResult = await this.db.query(
      `SELECT id, proposal_id FROM crm_quote_line_item
       WHERE sqlite_line_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_line_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [lineId],
    );
    const lineRow = lineResult.rows[0] as { id?: unknown } | undefined;
    if (!lineRow?.id) return;
    await this.db.query(`UPDATE crm_quote_line_item SET lifecycle_id = $1 WHERE id = $2`, [
      lifecycleId,
      Number(lineRow.id),
    ]);
  }

  async setProposalLifecycle(proposalId: number, lifecycleId: number): Promise<void> {
    const resolved = await this.resolveProposalPgId(proposalId);
    if (!resolved) return;
    const ts = catalogTs();
    await this.db.query(
      `UPDATE crm_proposals SET lifecycle_id = $1, updated_at = $2::timestamptz WHERE id = $3`,
      [lifecycleId, ts, resolved.pgId],
    );
  }

  async setLifecycleSkuCode(lifecycleId: number, skuCode: string): Promise<void> {
    const pgId = await this.resolveLifecyclePgId(lifecycleId);
    if (!pgId) return;
    const ts = catalogTs();
    await this.db.query(
      `UPDATE crm_service_lifecycle SET sku_code = $1, updated_at = $2::timestamptz WHERE id = $3`,
      [String(skuCode).toUpperCase(), ts, pgId],
    );
  }

  async activateLifecycle(lifecycleId: number, stage: string, notes: string): Promise<void> {
    const pgId = await this.resolveLifecyclePgId(lifecycleId);
    if (!pgId) return;
    const ts = catalogTs();
    await this.db.query(
      `UPDATE crm_service_lifecycle
       SET status = 'active', stage = $1, notes = $2, stage_entered_at = $3::timestamptz, updated_at = $3::timestamptz
       WHERE id = $4`,
      [stage, notes.slice(0, 2000), ts, pgId],
    );
  }

  async delete(proposalId: number): Promise<boolean> {
    const resolved = await this.resolveProposalPgId(proposalId);
    if (!resolved) return false;
    const result = await this.db.query(`DELETE FROM crm_proposals WHERE id = $1`, [resolved.pgId]);
    return (result.rowCount ?? 0) > 0;
  }
}
