import { DatabaseSync } from 'node:sqlite';
import { ensureBillingSchema } from '../billing/billing-schema.util';
import { OrdersSqliteRepositoryCore } from '../orders/orders-sqlite.repository';
import { InvoicesSqliteRepositoryCore } from '../invoices/invoices-sqlite.repository';

describe('billing schema RNOS-25', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(`
      CREATE TABLE crm_customers (id INTEGER PRIMARY KEY, name TEXT);
      INSERT INTO crm_customers (id, name) VALUES (1, 'Demo');
      CREATE TABLE crm_svc_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lifecycle_id INTEGER NOT NULL,
        amount_vnd INTEGER NOT NULL DEFAULT 0,
        received_on TEXT NOT NULL DEFAULT '',
        due_on TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT ''
      );
    `);
    ensureBillingSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates order and invoice with lines', () => {
    const orders = new OrdersSqliteRepositoryCore(db);
    const order = orders.create({
      customer_id: 1,
      lines: [{ product_slug: 'quang-cao-facebook', unit_price_vnd: 1_000_000, quantity: 1 }],
    });
    expect(order.reference_code).toMatch(/^SO-/);
    expect(order.total_vnd).toBe(1_000_000);

    const invoices = new InvoicesSqliteRepositoryCore(db);
    const invoice = invoices.createFromOrder(orders.getById(order.id, true)!, '2026-08-01');
    expect(invoice.invoice_number).toMatch(/^INV-/);
    invoices.issue(invoice.id, '2026-07-27', '2026-08-01');
    const issued = invoices.getById(invoice.id)!;
    expect(issued.status).toBe('issued');
  });
});
