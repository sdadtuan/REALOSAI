import { OrderLineRow, OrderRow, OrderStatus } from './orders.types';

function formatTs(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().replace('T', ' ').slice(0, 19);
  }
  const s = String(value ?? '');
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return s.replace('T', ' ').slice(0, 19);
  }
  return s;
}

function formatDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? '').slice(0, 10);
}

export function mapOrderRow(row: Record<string, unknown>): OrderRow {
  return {
    id: Number(row.sqlite_order_id ?? row.id),
    reference_code: String(row.reference_code ?? ''),
    customer_id: Number(row.legacy_customer_id ?? row.customer_id),
    contract_id: row.contract_id != null ? Number(row.contract_id) : null,
    proposal_id: row.legacy_proposal_id != null ? Number(row.legacy_proposal_id) : null,
    lifecycle_id: row.legacy_lifecycle_id != null ? Number(row.legacy_lifecycle_id) : null,
    lead_id: row.lead_id != null ? Number(row.lead_id) : null,
    status: String(row.status ?? 'draft') as OrderStatus,
    order_date: formatDate(row.order_date),
    total_vnd: Number(row.total_vnd ?? 0),
    billing_type: String(row.billing_type ?? 'one_off'),
    notes: String(row.notes ?? ''),
    created_at: formatTs(row.created_at),
    updated_at: formatTs(row.updated_at),
  };
}

export function mapOrderLineRow(row: Record<string, unknown>): OrderLineRow {
  return {
    id: Number(row.sqlite_line_id ?? row.id),
    order_id: Number(row.legacy_order_id ?? row.order_id),
    product_slug: String(row.product_slug ?? ''),
    description: String(row.description ?? ''),
    quantity: Number(row.quantity ?? 1),
    unit_price_vnd: Number(row.unit_price_vnd ?? 0),
    amount_vnd: Number(row.amount_vnd ?? 0),
    sort_order: Number(row.sort_order ?? 0),
  };
}
