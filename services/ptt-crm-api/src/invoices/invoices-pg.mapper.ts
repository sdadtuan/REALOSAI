import { InvoiceLineRow, InvoiceRow, InvoiceStatus } from './invoices.types';

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
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function mapInvoiceRow(row: Record<string, unknown>): InvoiceRow {
  return {
    id: Number(row.sqlite_invoice_id ?? row.id),
    invoice_number: String(row.invoice_number ?? ''),
    order_id: row.legacy_order_id != null ? Number(row.legacy_order_id) : null,
    contract_id: row.contract_id != null ? Number(row.contract_id) : null,
    lifecycle_id: row.legacy_lifecycle_id != null ? Number(row.legacy_lifecycle_id) : null,
    customer_id: Number(row.legacy_customer_id ?? row.customer_id),
    status: String(row.status ?? 'draft') as InvoiceStatus,
    issued_on: formatDate(row.issued_on),
    due_on: formatDate(row.due_on),
    amount_vnd: Number(row.amount_vnd ?? 0),
    paid_vnd: Number(row.paid_vnd ?? 0),
    notes: String(row.notes ?? ''),
    created_at: formatTs(row.created_at),
    updated_at: formatTs(row.updated_at),
  };
}

export function mapInvoiceLineRow(row: Record<string, unknown>): InvoiceLineRow {
  return {
    id: Number(row.sqlite_line_id ?? row.id),
    invoice_id: Number(row.legacy_invoice_id ?? row.invoice_id),
    product_slug: String(row.product_slug ?? ''),
    description: String(row.description ?? ''),
    quantity: Number(row.quantity ?? 1),
    unit_price_vnd: Number(row.unit_price_vnd ?? 0),
    amount_vnd: Number(row.amount_vnd ?? 0),
    sort_order: Number(row.sort_order ?? 0),
  };
}
