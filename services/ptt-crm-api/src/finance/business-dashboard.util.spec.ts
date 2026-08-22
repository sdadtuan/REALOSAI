import { DatabaseSync } from 'node:sqlite';
import {
  buildExecutiveWeekBuckets,
  getAttributionDrillPaths,
  getExecutiveWeeklyTrends,
  resolveExecutiveAnchorYmd,
} from './business-dashboard.util';

function memoryDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE crm_leads (
      id INTEGER PRIMARY KEY,
      full_name TEXT NOT NULL DEFAULT '',
      utm_campaign TEXT NOT NULL DEFAULT '',
      meta_json TEXT NOT NULL DEFAULT '{}',
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE crm_svc_payments (
      id INTEGER PRIMARY KEY,
      amount_vnd INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'received',
      received_on TEXT NOT NULL
    );
  `);
  return db;
}

describe('business-dashboard.util', () => {
  it('resolveExecutiveAnchorYmd caps at month end', () => {
    expect(resolveExecutiveAnchorYmd(2026, 7, '2026-07-26')).toBe('2026-07-26');
    expect(resolveExecutiveAnchorYmd(2026, 6, '2026-07-26')).toBe('2026-06-30');
  });

  it('buildExecutiveWeekBuckets returns 12 weekly labels', () => {
    const buckets = buildExecutiveWeekBuckets('2026-07-26', 12);
    expect(buckets).toHaveLength(12);
    expect(buckets[0]?.start <= buckets[0]?.end).toBe(true);
    expect(buckets[11]?.end).toBe('2026-07-26');
  });

  it('getExecutiveWeeklyTrends aggregates revenue and leads', () => {
    const db = memoryDb();
    db.prepare("INSERT INTO crm_svc_payments (amount_vnd, status, received_on) VALUES (100000, 'received', '2026-07-25')").run();
    db.prepare("INSERT INTO crm_svc_payments (amount_vnd, status, received_on) VALUES (50000, 'received', '2026-07-20')").run();
    db.prepare(
      "INSERT INTO crm_leads (full_name, utm_campaign, created_at) VALUES ('Lead A', 'camp-a', '2026-07-24 10:00:00')",
    ).run();

    const out = getExecutiveWeeklyTrends(db, 2026, 7, 12);
    expect(out.weeks).toBe(12);
    expect(Array.isArray(out.labels)).toBe(true);
    expect((out.revenue_vnd as number[]).some((v) => v > 0)).toBe(true);
    expect((out.leads as number[]).some((v) => v > 0)).toBe(true);
    db.close();
  });

  it('getAttributionDrillPaths returns hub and lead hrefs', () => {
    const db = memoryDb();
    db.prepare(
      "INSERT INTO crm_leads (id, full_name, utm_campaign, created_at) VALUES (42, 'Lead X', 'meta-summer', '2026-07-10 09:00:00')",
    ).run();
    db.prepare(
      "INSERT INTO crm_leads (id, full_name, utm_campaign, created_at) VALUES (43, 'Lead Y', 'meta-summer', '2026-07-12 09:00:00')",
    ).run();

    const out = getAttributionDrillPaths(db, 2026, 7, 5);
    expect(out.count).toBe(1);
    const row = (out.rows as Array<Record<string, unknown>>)[0];
    expect(row?.lead_count).toBe(2);
    expect(row?.hub_href).toBe('/crm/hub?campaign_id=meta-summer');
    expect(row?.lead_href).toBe('/crm/leads/43');
    db.close();
  });
});
