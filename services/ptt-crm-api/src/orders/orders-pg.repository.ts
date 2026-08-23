import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { todayIso, tsNow } from '../billing/billing-schema.util';
import { AppConfigService } from '../config/app-config.service';
import { mapOrderLineRow, mapOrderRow } from './orders-pg.mapper';
import {
  CreateOrderBody,
  CreateOrderLineBody,
  OrderLineRow,
  OrderRow,
  OrderStatus,
  PatchOrderBody,
} from './orders.types';

const ORDER_SELECT = `
  SELECT o.*,
         COALESCE(cu.sqlite_customer_id, cu.id) AS legacy_customer_id,
         COALESCE(p.sqlite_proposal_id, p.id) AS legacy_proposal_id,
         COALESCE(l.sqlite_lifecycle_id, l.id) AS legacy_lifecycle_id
  FROM crm_orders o
  JOIN crm_customers cu ON cu.id = o.customer_id
  LEFT JOIN crm_proposals p ON p.id = o.proposal_id
  LEFT JOIN crm_service_lifecycle l ON l.id = o.lifecycle_id
`;

@Injectable()
export class OrdersPgRepository implements OnModuleDestroy {
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

  private async resolveOrderPgId(
    legacyId: number,
  ): Promise<{ pgId: number; legacyId: number } | null> {
    const result = await this.db.query(
      `SELECT id, sqlite_order_id FROM crm_orders
       WHERE sqlite_order_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_order_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [legacyId],
    );
    const row = result.rows[0] as { id?: unknown; sqlite_order_id?: unknown } | undefined;
    if (!row?.id) return null;
    return { pgId: Number(row.id), legacyId: Number(row.sqlite_order_id ?? row.id) };
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

  private async resolveProposalPgId(legacyId: number): Promise<number | null> {
    const result = await this.db.query(
      `SELECT id FROM crm_proposals
       WHERE sqlite_proposal_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_proposal_id = $1 THEN 0 ELSE 1 END
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

  async list(filters: {
    customerId?: number;
    lifecycleId?: number;
    status?: string;
    limit?: number;
  }): Promise<OrderRow[]> {
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
      clauses.push(`o.status = $${idx++}`);
      params.push(filters.status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    params.push(limit);
    const result = await this.db.query(
      `${ORDER_SELECT} ${where} ORDER BY o.id DESC LIMIT $${idx}`,
      params,
    );
    return result.rows.map((row) => mapOrderRow(row as Record<string, unknown>));
  }

  async getById(id: number, withLines = false): Promise<OrderRow | null> {
    const result = await this.db.query(
      `${ORDER_SELECT} WHERE o.sqlite_order_id = $1 OR o.id = $1
       ORDER BY CASE WHEN o.sqlite_order_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [id],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    const order = mapOrderRow(row);
    if (withLines) order.lines = await this.listLines(order.id);
    return order;
  }

  async listLines(orderLegacyId: number): Promise<OrderLineRow[]> {
    const resolved = await this.resolveOrderPgId(orderLegacyId);
    if (!resolved) return [];
    const result = await this.db.query(
      `SELECT ol.*, COALESCE(o.sqlite_order_id, o.id) AS legacy_order_id
       FROM crm_order_lines ol
       JOIN crm_orders o ON o.id = ol.order_id
       WHERE ol.order_id = $1
       ORDER BY ol.sort_order, ol.id`,
      [resolved.pgId],
    );
    return result.rows.map((row) => mapOrderLineRow(row as Record<string, unknown>));
  }

  async customerExists(customerId: number): Promise<boolean> {
    const pgId = await this.resolveCustomerPgId(customerId);
    return pgId != null;
  }

  private async recalcTotal(orderPgId: number): Promise<number> {
    const sumResult = await this.db.query(
      `SELECT COALESCE(SUM(amount_vnd), 0) AS total FROM crm_order_lines WHERE order_id = $1`,
      [orderPgId],
    );
    const total = Number((sumResult.rows[0] as { total?: unknown })?.total ?? 0);
    await this.db.query(`UPDATE crm_orders SET total_vnd = $1, updated_at = NOW() WHERE id = $2`, [
      total,
      orderPgId,
    ]);
    return total;
  }

  async create(body: CreateOrderBody): Promise<OrderRow> {
    const customerPgId = await this.resolveCustomerPgId(Number(body.customer_id));
    if (customerPgId == null) throw new Error('customer_not_found');
    const proposalPgId =
      body.proposal_id != null ? await this.resolveProposalPgId(Number(body.proposal_id)) : null;
    const lifecyclePgId =
      body.lifecycle_id != null ? await this.resolveLifecyclePgId(Number(body.lifecycle_id)) : null;
    const orderDate = String(body.order_date ?? todayIso()).slice(0, 10);
    const insert = await this.db.query(
      `INSERT INTO crm_orders (
         reference_code, customer_id, contract_id, proposal_id, lifecycle_id, lead_id,
         status, order_date, total_vnd, billing_type, notes, created_at, updated_at
       ) VALUES ('', $1, $2, $3, $4, $5, 'draft', $6, 0, $7, $8, NOW(), NOW())
       RETURNING id`,
      [
        customerPgId,
        body.contract_id != null ? Number(body.contract_id) : null,
        proposalPgId,
        lifecyclePgId,
        body.lead_id != null ? Number(body.lead_id) : null,
        orderDate,
        String(body.billing_type ?? 'one_off'),
        String(body.notes ?? '').slice(0, 4000),
      ],
    );
    const pgId = Number((insert.rows[0] as { id: unknown }).id);
    const ref = `SO-${new Date().getFullYear()}-${String(pgId).padStart(5, '0')}`;
    await this.db.query(`UPDATE crm_orders SET reference_code = $1 WHERE id = $2`, [ref, pgId]);
    for (const line of body.lines ?? []) {
      await this.addLine(Number(pgId), line, pgId);
    }
    if ((body.lines ?? []).length === 0) {
      await this.recalcTotal(pgId);
    }
    return (await this.getById(pgId, true))!;
  }

  async createFromProposal(proposalId: number): Promise<OrderRow | null> {
    const propResult = await this.db.query(
      `SELECT p.*, COALESCE(c.sqlite_customer_id, c.id) AS legacy_customer_id,
              COALESCE(lc.sqlite_lifecycle_id, lc.id) AS legacy_lifecycle_id
       FROM crm_proposals p
       JOIN crm_customers c ON c.id = p.customer_id
       LEFT JOIN crm_service_lifecycle lc ON lc.id = p.lifecycle_id
       WHERE p.sqlite_proposal_id = $1 OR p.id = $1
       ORDER BY CASE WHEN p.sqlite_proposal_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [proposalId],
    );
    const proposal = propResult.rows[0] as Record<string, unknown> | undefined;
    if (!proposal) return null;
    let serviceSlugs: string[] = [];
    try {
      serviceSlugs = JSON.parse(String(proposal.service_slugs ?? '[]')) as string[];
    } catch {
      serviceSlugs = [];
    }
    const total = Number(proposal.total_vnd ?? 0);
    const perLine = serviceSlugs.length ? Math.round(total / serviceSlugs.length) : total;
    const legacyProposalId = Number(proposal.sqlite_proposal_id ?? proposal.id);
    const order = await this.create({
      customer_id: Number(proposal.legacy_customer_id),
      proposal_id: legacyProposalId,
      lifecycle_id:
        proposal.legacy_lifecycle_id != null ? Number(proposal.legacy_lifecycle_id) : null,
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
      await this.addLine(order.id, {
        description: 'Proposal total',
        quantity: 1,
        unit_price_vnd: total,
        amount_vnd: total,
      });
    }
    return this.getById(order.id, true);
  }

  async patch(id: number, body: PatchOrderBody): Promise<OrderRow | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const resolved = await this.resolveOrderPgId(id);
    if (!resolved) return null;
    const status = body.status ?? existing.status;
    const orderDate = body.order_date != null ? String(body.order_date).slice(0, 10) : existing.order_date;
    const billingType = body.billing_type ?? existing.billing_type;
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
      `UPDATE crm_orders
       SET status = $1, order_date = $2, billing_type = $3, notes = $4,
           contract_id = $5, lifecycle_id = $6, updated_at = NOW()
       WHERE id = $7`,
      [status, orderDate, billingType, notes, contractId, lifecyclePgId, resolved.pgId],
    );
    return this.getById(id, true);
  }

  async setStatus(id: number, status: OrderStatus): Promise<OrderRow | null> {
    return this.patch(id, { status });
  }

  async addLine(
    orderLegacyId: number,
    body: CreateOrderLineBody,
    orderPgIdHint?: number,
  ): Promise<OrderLineRow> {
    const resolved = orderPgIdHint
      ? { pgId: orderPgIdHint, legacyId: orderLegacyId }
      : await this.resolveOrderPgId(orderLegacyId);
    if (!resolved) throw new Error('order_not_found');
    const qty = Math.max(1, Number(body.quantity ?? 1));
    const unit = Math.max(0, Number(body.unit_price_vnd ?? 0));
    const amount = body.amount_vnd != null ? Math.max(0, Number(body.amount_vnd)) : qty * unit;
    const insert = await this.db.query(
      `INSERT INTO crm_order_lines (
         order_id, product_slug, description, quantity, unit_price_vnd, amount_vnd, sort_order
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        resolved.pgId,
        String(body.product_slug ?? ''),
        String(body.description ?? body.product_slug ?? ''),
        qty,
        unit,
        amount,
        Number(body.sort_order ?? 0),
      ],
    );
    await this.recalcTotal(resolved.pgId);
    const lineId = Number((insert.rows[0] as { id: unknown }).id);
    const lineResult = await this.db.query(
      `SELECT ol.*, COALESCE(o.sqlite_order_id, o.id) AS legacy_order_id
       FROM crm_order_lines ol
       JOIN crm_orders o ON o.id = ol.order_id
       WHERE ol.id = $1`,
      [lineId],
    );
    return mapOrderLineRow(lineResult.rows[0] as Record<string, unknown>);
  }

  async deleteLine(lineId: number): Promise<boolean> {
    const rowResult = await this.db.query(
      `SELECT order_id FROM crm_order_lines WHERE sqlite_line_id = $1 OR id = $1 LIMIT 1`,
      [lineId],
    );
    const row = rowResult.rows[0] as { order_id?: unknown } | undefined;
    if (!row?.order_id) return false;
    const orderPgId = Number(row.order_id);
    const del = await this.db.query(
      `DELETE FROM crm_order_lines WHERE sqlite_line_id = $1 OR id = $1`,
      [lineId],
    );
    if ((del.rowCount ?? 0) > 0) await this.recalcTotal(orderPgId);
    return (del.rowCount ?? 0) > 0;
  }
}
