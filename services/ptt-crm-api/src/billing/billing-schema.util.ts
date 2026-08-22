import { DatabaseSync } from 'node:sqlite';

/** RNOS-25 — orders/invoices schema + payment extensions (SQLite). */
export function ensureBillingSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS crm_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_code TEXT NOT NULL DEFAULT '',
      customer_id INTEGER NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
      contract_id INTEGER,
      proposal_id INTEGER,
      lifecycle_id INTEGER,
      lead_id INTEGER,
      status TEXT NOT NULL DEFAULT 'draft',
      order_date TEXT NOT NULL DEFAULT '',
      total_vnd INTEGER NOT NULL DEFAULT 0,
      billing_type TEXT NOT NULL DEFAULT 'one_off',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_crm_orders_customer ON crm_orders (customer_id, status);
    CREATE INDEX IF NOT EXISTS idx_crm_orders_lifecycle ON crm_orders (lifecycle_id);
    CREATE INDEX IF NOT EXISTS idx_crm_orders_contract ON crm_orders (contract_id);

    CREATE TABLE IF NOT EXISTS crm_order_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES crm_orders(id) ON DELETE CASCADE,
      product_slug TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price_vnd INTEGER NOT NULL DEFAULT 0,
      amount_vnd INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_crm_order_lines_order ON crm_order_lines (order_id, sort_order);

    CREATE TABLE IF NOT EXISTS crm_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL DEFAULT '',
      order_id INTEGER,
      contract_id INTEGER,
      lifecycle_id INTEGER,
      customer_id INTEGER NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'draft',
      issued_on TEXT NOT NULL DEFAULT '',
      due_on TEXT NOT NULL DEFAULT '',
      amount_vnd INTEGER NOT NULL DEFAULT 0,
      paid_vnd INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_invoices_number ON crm_invoices (invoice_number);
    CREATE INDEX IF NOT EXISTS idx_crm_invoices_customer ON crm_invoices (customer_id, status);
    CREATE INDEX IF NOT EXISTS idx_crm_invoices_due ON crm_invoices (due_on, status);
    CREATE INDEX IF NOT EXISTS idx_crm_invoices_lifecycle ON crm_invoices (lifecycle_id);

    CREATE TABLE IF NOT EXISTS crm_invoice_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES crm_invoices(id) ON DELETE CASCADE,
      product_slug TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price_vnd INTEGER NOT NULL DEFAULT 0,
      amount_vnd INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_crm_invoice_lines_invoice ON crm_invoice_lines (invoice_id, sort_order);
  `);

  const paymentCols = new Set(
    (db.prepare('PRAGMA table_info(crm_svc_payments)').all() as Array<{ name: string }>).map((c) => c.name),
  );
  if (!paymentCols.has('invoice_id')) {
    db.exec('ALTER TABLE crm_svc_payments ADD COLUMN invoice_id INTEGER');
  }
  if (!paymentCols.has('payment_method')) {
    db.exec("ALTER TABLE crm_svc_payments ADD COLUMN payment_method TEXT NOT NULL DEFAULT ''");
  }
  if (!paymentCols.has('reference_code')) {
    db.exec("ALTER TABLE crm_svc_payments ADD COLUMN reference_code TEXT NOT NULL DEFAULT ''");
  }
}

export function tableExists(db: DatabaseSync, name: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .get(name) as { 1: number } | undefined;
  return row != null;
}

export function tsNow(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
