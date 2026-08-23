import {
  PRODUCT_LINE_LABELS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_TYPOLOGY_LABELS,
} from './re-projects.types';

export function enrichProductRow(row: Record<string, unknown>): Record<string, unknown> {
  const d = { ...row };
  const st = String(d.status ?? 'available');
  d.status_label = PRODUCT_STATUS_LABELS[st] ?? st;
  const line = String(d.product_line ?? '');
  const typo = String(d.typology ?? '');
  d.product_line_label = PRODUCT_LINE_LABELS[line] ?? (line || '—');
  d.typology_label = PRODUCT_TYPOLOGY_LABELS[typo] ?? (typo || '—');
  d.sales_staff_name = d.sales_staff_name ?? '';
  d.sales_staff_title = d.sales_staff_title ?? '';
  if (d.is_corner != null) d.is_corner = Boolean(d.is_corner);
  if (d.row_version != null) d.row_version = Number(d.row_version);
  return d;
}

export function mapPgProductRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(enrichProductRow);
}
