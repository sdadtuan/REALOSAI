# P1 Triển khai — Inventory OS

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tồn kho căn trên PG có `row_version`, `pool`, status `reserved`, import CSV không đè `sold`, khóa/mở khóa qua service — không hold, không tòa/đợt entity (P1b), không UI `/crm/bds`.

**Architecture:** `BdsInventoryService` là **cổng duy nhất** đổi `status` khi `PTT_BDS_PACK=1`. Route mới `/api/v1/bds/...` sau `BdsPackGuard`. Route cũ `/api/crm/re-projects/:id/products` giữ khi PACK=0; khi PACK=1 ủy quyền inventory (PATCH `status` → 409). Dual-write căn SQLite→PG khi `PTT_BDS_PG=1`. Lưới `/stack` P1 suy từ cột text `tower`/`floor` — không tạo `bds_towers` (P1b).

**Tech Stack:** NestJS `ptt-crm-api`, Jest local binary, `pg` Pool, SQLite `crm_re_project_products`, `psql`, Python 3 (`bds_count_gate.py`).

**Spec:** [2026-08-21-bds-industry-pack-design.md](../specs/2026-08-21-bds-industry-pack-design.md) §6.2 products, §7.1, §10.2, §12, §15 P1, BR-BDS-07/14, BDS-16.  
**UC:** BDS-UC-010 import · 011 pool/lock · 012 stack (ma trận text).  
**Roadmap:** [2026-08-22-bds-coding-roadmap.md](./2026-08-22-bds-coding-roadmap.md)  
**P0:** [2026-08-22-bds-p0-trien-khai.md](./2026-08-22-bds-p0-trien-khai.md) — **chặn** nếu DoD P0 đỏ trên **staging local**.  
**P1b:** file riêng — không viết hold/legal/đợt trong plan này.

## Global Constraints

- `PTT_BDS_PACK` mặc định `0` — mọi `POST /api/v1/bds/*` = **404**.
- GET ngoài tenant = 404, không PII (BR-BDS-05).
- Không xóa `re-projects/`. Không đụng `crm_b2b_projects`. Không tạo `bds_holds` / `bds_towers`.
- `hold_id` cột UUID **không** FK (bảng hold = P2). P1 không ghi `hold_id` khác null.
- Căn `sold` không import đè status (BR-BDS-07).
- `row_version` lệch → 409 `{ error: 'unit_locked' }` (BR-BDS-14).
- Unique `(project_id, lower(trim(unit_code)))` khi `unit_code <> ''`.
- `DATABASE_URL` script: `postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb`.
- Test: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand -v` (không `npx jest` — kéo Jest 30).
- Không commit trừ khi user yêu cầu.
- Prod VPS: **không** bật `PTT_BDS_PACK`. Site `ngoinhahomnay.vn` / port 3000 không đụng.

---

## 0. Phạm vi / ngoài phạm vi

**Làm**

- Cột PG: `tenant_id`, `row_version`, `pool`, `hold_id`, status `reserved`
- `BdsInventoryService.transition` / `lock` / `unlock` / `importCsv` / `listUnits` / `stack`
- CSV import atomic: trùng `unit_code` → 409, không ghi dòng conflict
- Dual-write **căn** + `bds_count_gate.py` đếm **cả** dự án và căn
- Hook `ReProjectsService.createProduct` / `updateProduct` khi PACK hoặc PG
- `GET /projects/:id/stack` từ `tower`+`floor` text

**Không làm**

- Hold / TTL / `Idempotency-Key` (P2)
- `bds_towers` / `bds_zones` / `legal_gate` / đợt (P1b)
- CSBH, TX, đại lý, giỏ F1 404 inhouse (P3–P5)
- UI ops-web `/crm/bds` (P8)
- Đọc UI cũ sang PG (vẫn SQLite khi PACK=0)
- F1 visibility / basket

---

## 1. Điều kiện trước (cổng P0)

Chạy **local/staging**, không trên prod `real.gomira.vn`.

| # | Việc | Cách kiểm |
|---|------|-----------|
| 1 | Jest P0 xanh | `./node_modules/.bin/jest src/bds --runInBand` exit 0 |
| 2 | BDS-01 | `PTT_BDS_PACK=0` POST `/api/v1/bds/tenants` → **404** (sau auth). Nếu 401: thiếu/sai internal key — thêm header rồi kỳ vọng 404 |
| 3 | BDS-20 dự án | `python3 scripts/bds_count_gate.py` exit 0 |
| 4 | PG có `bds_tenants` + `crm_re_projects.tenant_id` | `\d crm_re_projects` |
| 5 | `BdsModule` **không** import `ReProjectsModule` | giữ |

Hai tenant staging (spec): `PTT-RE-LEGACY` + một `developer` tạo qua API khi PACK=1 **tạm** trên local.

P0 DoD đỏ → **dừng**, sửa P0, không bắt đầu Task 1.

---

## 2. Lịch (3 ngày)

| Ngày | Task | Kết quả xem được |
|------|------|------------------|
| **N1** | 1–2 | Transition test xanh; DDL products apply |
| **N2** | 3–5 | Dual-write căn; lock 409; import 409/sold-skip |
| **N3** | 6–8 | API `/units` + `/stack`; hook RE; gate đếm căn; DoD |

---

## 3. File map

```
docs/specs/postgresql-ddl-bds-p1.sql
scripts/apply_pg_ddl_bds_p1.sh
scripts/backfill_bds_products.py
scripts/bds_count_gate.py                  # thêm đếm căn

services/ptt-crm-api/src/bds/inventory/bds-inventory.types.ts
services/ptt-crm-api/src/bds/inventory/bds-inventory-transition.util.ts
services/ptt-crm-api/src/bds/inventory/bds-inventory-transition.util.spec.ts
services/ptt-crm-api/src/bds/inventory/bds-unit-csv.util.ts
services/ptt-crm-api/src/bds/inventory/bds-unit-csv.util.spec.ts
services/ptt-crm-api/src/bds/inventory/bds-re-product-pg.repository.ts
services/ptt-crm-api/src/bds/inventory/bds-inventory.service.ts
services/ptt-crm-api/src/bds/inventory/bds-inventory.service.spec.ts
services/ptt-crm-api/src/bds/inventory/bds-inventory.controller.ts

services/ptt-crm-api/src/bds/bds.module.ts
services/ptt-crm-api/src/re-projects/re-projects.service.ts
services/ptt-crm-api/src/re-projects/re-projects.types.ts   # + reserved trên PRODUCT_STATUSES
services/ptt-crm-api/src/re-projects/re-projects-inventory.util.ts  # reserved trong stats
```

---

### Task 1: Máy trạng thái căn

**Files:**
- Create: `services/ptt-crm-api/src/bds/inventory/bds-inventory.types.ts`
- Create: `services/ptt-crm-api/src/bds/inventory/bds-inventory-transition.util.ts`
- Create: `services/ptt-crm-api/src/bds/inventory/bds-inventory-transition.util.spec.ts`
- Modify: `services/ptt-crm-api/src/re-projects/re-projects.types.ts` — thêm `'reserved'` vào `PRODUCT_STATUSES` và `PRODUCT_STATUS_LABELS`

**Interfaces:**
- Consumes: status hiện tại + sự kiện
- Produces: `BdsUnitStatus`, `BdsUnitPool`, `BdsUnitEvent`, `assertUnitTransition(from, event): BdsUnitStatus`, `UNIT_POOLS`

- [ ] **Step 1: Write the failing test**

```ts
import { assertUnitTransition } from './bds-inventory-transition.util';

describe('assertUnitTransition', () => {
  it('hold: available → hold', () => {
    expect(assertUnitTransition('available', 'hold')).toBe('hold');
  });

  it('ttl: hold → available', () => {
    expect(assertUnitTransition('hold', 'ttl')).toBe('available');
  });

  it('reservation_fee: hold → reserved', () => {
    expect(assertUnitTransition('hold', 'reservation_fee')).toBe('reserved');
  });

  it('reservation window miss: reserved → available', () => {
    expect(assertUnitTransition('reserved', 'reservation_expire')).toBe('available');
  });

  it('deposit: reserved → booked', () => {
    expect(assertUnitTransition('reserved', 'deposit')).toBe('booked');
  });

  it('deposit from hold (không giữ chỗ tiền)', () => {
    expect(assertUnitTransition('hold', 'deposit')).toBe('booked');
  });

  it('contract: booked → sold', () => {
    expect(assertUnitTransition('booked', 'contract')).toBe('sold');
  });

  it('cancel booked → available (BDS-14 inventory)', () => {
    expect(assertUnitTransition('booked', 'cancel')).toBe('available');
  });

  it('cdt_lock from available → locked', () => {
    expect(assertUnitTransition('available', 'cdt_lock')).toBe('locked');
  });

  it('unlock: locked → available', () => {
    expect(assertUnitTransition('locked', 'unlock')).toBe('available');
  });

  it('rejects sold → available without reverse_sold', () => {
    expect(() => assertUnitTransition('sold', 'cancel')).toThrow(/sold/);
  });

  it('rejects hold from booked', () => {
    expect(() => assertUnitTransition('booked', 'hold')).toThrow(/illegal_transition/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/inventory/bds-inventory-transition.util.spec.ts --runInBand -v`  
Expected: FAIL `Cannot find module`

- [ ] **Step 3: Write minimal implementation**

`bds-inventory.types.ts`:

```ts
export const BDS_UNIT_STATUSES = [
  'available',
  'hold',
  'reserved',
  'booked',
  'sold',
  'locked',
] as const;
export type BdsUnitStatus = (typeof BDS_UNIT_STATUSES)[number];

export const UNIT_POOLS = ['inhouse', 'channel', 'reserved_vip', 'reserved_staff'] as const;
export type BdsUnitPool = (typeof UNIT_POOLS)[number];

export const BDS_UNIT_EVENTS = [
  'hold',
  'ttl',
  'cancel',
  'reservation_fee',
  'reservation_expire',
  'deposit',
  'contract',
  'cdt_lock',
  'unlock',
  'reverse_sold',
] as const;
export type BdsUnitEvent = (typeof BDS_UNIT_EVENTS)[number];
```

`bds-inventory-transition.util.ts`:

```ts
import type { BdsUnitEvent, BdsUnitStatus } from './bds-inventory.types';

const NEXT: Record<string, BdsUnitStatus> = {
  'available:hold': 'hold',
  'available:cdt_lock': 'locked',
  'hold:ttl': 'available',
  'hold:cancel': 'available',
  'hold:reservation_fee': 'reserved',
  'hold:deposit': 'booked',
  'hold:cdt_lock': 'locked',
  'reserved:reservation_expire': 'available',
  'reserved:cancel': 'available',
  'reserved:deposit': 'booked',
  'reserved:cdt_lock': 'locked',
  'booked:cancel': 'available',
  'booked:contract': 'sold',
  'booked:cdt_lock': 'locked',
  'locked:unlock': 'available',
  'sold:reverse_sold': 'available',
};

export function assertUnitTransition(from: string, event: BdsUnitEvent): BdsUnitStatus {
  if (from === 'sold' && event !== 'reverse_sold') {
    throw new Error('sold');
  }
  const next = NEXT[`${from}:${event}`];
  if (!next) {
    throw new Error(`illegal_transition ${from} ${event}`);
  }
  return next;
}
```

Trong `re-projects.types.ts`:

```ts
export const PRODUCT_STATUSES = [
  'available',
  'hold',
  'reserved',
  'booked',
  'sold',
  'locked',
] as const;

export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  available: 'Còn hàng',
  hold: 'Giữ chỗ',
  reserved: 'Giữ chỗ có tiền',
  booked: 'Đặt cọc',
  sold: 'Đã bán',
  locked: 'Khóa',
};
```

Trong `re-projects-inventory.util.ts` giữ `booked || hold`; thêm `reserved` vào bucket booked (pipeline):

```ts
booked: products.filter((p) =>
  p.status === 'booked' || p.status === 'hold' || p.status === 'reserved',
).length,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/inventory/bds-inventory-transition.util.spec.ts --runInBand -v`  
Expected: PASS 12 tests

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu: `feat(bds): P1 unit status machine with reserved`

---

### Task 2: DDL products PG

**Files:**
- Create: `docs/specs/postgresql-ddl-bds-p1.sql`
- Create: `scripts/apply_pg_ddl_bds_p1.sh`

**Interfaces:**
- Consumes: P0 `crm_re_projects`, `bds_tenants`
- Produces: bảng `crm_re_project_products` trên PG + unique unit_code

- [ ] **Step 1: Write DDL** (không có Jest — verify bằng `psql`)

`docs/specs/postgresql-ddl-bds-p1.sql`:

```sql
-- Pack BĐS P1 — Apply: scripts/apply_pg_ddl_bds_p1.sh
BEGIN;

CREATE TABLE IF NOT EXISTS crm_re_project_products (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES bds_tenants (id),
  unit_code TEXT NOT NULL DEFAULT '',
  tower TEXT NOT NULL DEFAULT '',
  floor TEXT NOT NULL DEFAULT '',
  product_line TEXT NOT NULL DEFAULT '',
  zone TEXT NOT NULL DEFAULT '',
  typology TEXT NOT NULL DEFAULT '',
  is_corner BOOLEAN NOT NULL DEFAULT FALSE,
  sales_staff_id INTEGER,
  product_type TEXT NOT NULL DEFAULT '',
  area_m2 NUMERIC,
  bedrooms INTEGER,
  direction TEXT NOT NULL DEFAULT '',
  view_type TEXT NOT NULL DEFAULT '',
  list_price_vnd BIGINT NOT NULL DEFAULT 0,
  net_price_vnd BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'hold', 'reserved', 'booked', 'sold', 'locked')),
  notes TEXT NOT NULL DEFAULT '',
  price_batch TEXT NOT NULL DEFAULT '',
  hold_lead_id INTEGER,
  hold_at TEXT NOT NULL DEFAULT '',
  hold_id UUID,
  pool TEXT NOT NULL DEFAULT 'inhouse'
    CHECK (pool IN ('inhouse', 'channel', 'reserved_vip', 'reserved_staff')),
  row_version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_re_project_products ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES bds_tenants (id);
ALTER TABLE crm_re_project_products ADD COLUMN IF NOT EXISTS hold_id UUID;
ALTER TABLE crm_re_project_products ADD COLUMN IF NOT EXISTS pool TEXT NOT NULL DEFAULT 'inhouse';
ALTER TABLE crm_re_project_products ADD COLUMN IF NOT EXISTS row_version BIGINT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_crm_re_products_project
  ON crm_re_project_products (project_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_re_products_tenant
  ON crm_re_project_products (tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_re_products_unit
  ON crm_re_project_products (project_id, lower(trim(unit_code)))
  WHERE trim(unit_code) <> '';

COMMIT;
```

`scripts/apply_pg_ddl_bds_p1.sh` — copy `apply_pg_ddl_bds_p0.sh`, đổi file DDL thành `postgresql-ddl-bds-p1.sql`, echo `OK  bds P1 DDL`.

- [ ] **Step 2: Apply local**

Run:

```bash
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
bash scripts/apply_pg_ddl_bds_p1.sh
psql "$DATABASE_URL" -c '\d crm_re_project_products'
```

Expected: cột `row_version`, `pool`, `hold_id`, `tenant_id`; index `uq_crm_re_products_unit`.

- [ ] **Step 3: Commit** — chỉ khi user yêu cầu: `feat(bds): P1 DDL for inventory products`

---

### Task 3: PG repo căn + dual-write + cổng đếm

**Files:**
- Create: `services/ptt-crm-api/src/bds/inventory/bds-re-product-pg.repository.ts`
- Modify: `services/ptt-crm-api/src/bds/inventory/bds-dual-write.util.spec.ts` — thêm case đếm căn (optional, `assertCountGate` đã có)
- Modify: `scripts/bds_count_gate.py` — đếm cả `crm_re_project_products`
- Modify: `services/ptt-crm-api/src/bds/bds.module.ts` — provider + export repo
- Create: `scripts/backfill_bds_products.py`

**Interfaces:**
- Consumes: `shouldDualWrite()`, `AppConfigService.databaseUrl`, project `tenant_id`
- Produces: `BdsReProductPgRepository.upsertFromSqlite(row)`, `getById(id)`, `transitionOptimistic(id, expectedVersion, nextStatus): boolean`, `countAll(): Promise<number>`

- [ ] **Step 1: Write failing service-level test cho optimistic** (repo được mock ở Task 4; ở đây thêm hàm thuần nếu cần). Mở rộng `bds-dual-write.util.spec.ts`:

```ts
import { assertCountGate } from './bds-dual-write.util';

describe('assertCountGate units', () => {
  it('passes when product counts match', () => {
    expect(() => assertCountGate(3, 3)).not.toThrow();
  });

  it('throws BDS-20 when product counts differ', () => {
    expect(() => assertCountGate(3, 2)).toThrow(/BDS-20/);
  });
});
```

(Nếu file spec P0 đã có 2 case tương đương — **không nhân đôi**; chỉ bổ sung comment `// P1: same helper for products`.)

- [ ] **Step 2: Implement repository**

```ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type { BdsUnitPool, BdsUnitStatus } from './bds-inventory.types';

export type SqliteProductMirror = {
  id: number;
  project_id: number;
  unit_code?: string;
  tower?: string;
  floor?: string;
  product_line?: string;
  zone?: string;
  typology?: string;
  is_corner?: number | boolean;
  sales_staff_id?: number | null;
  product_type?: string;
  area_m2?: number | null;
  bedrooms?: number | null;
  direction?: string;
  view_type?: string;
  list_price_vnd?: number;
  net_price_vnd?: number;
  status?: string;
  notes?: string;
  price_batch?: string;
  hold_lead_id?: number | null;
  hold_at?: string;
  pool?: string;
};

const UPSERT_SQL = `
INSERT INTO crm_re_project_products (
  id, project_id, tenant_id, unit_code, tower, floor, product_line, zone, typology,
  is_corner, sales_staff_id, product_type, area_m2, bedrooms, direction, view_type,
  list_price_vnd, net_price_vnd, status, notes, price_batch, hold_lead_id, hold_at, pool, updated_at
) VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24, NOW()
)
ON CONFLICT (id) DO UPDATE SET
  project_id = EXCLUDED.project_id,
  tenant_id = COALESCE(crm_re_project_products.tenant_id, EXCLUDED.tenant_id),
  unit_code = EXCLUDED.unit_code,
  tower = EXCLUDED.tower,
  floor = EXCLUDED.floor,
  product_line = EXCLUDED.product_line,
  zone = EXCLUDED.zone,
  typology = EXCLUDED.typology,
  is_corner = EXCLUDED.is_corner,
  sales_staff_id = EXCLUDED.sales_staff_id,
  product_type = EXCLUDED.product_type,
  area_m2 = EXCLUDED.area_m2,
  bedrooms = EXCLUDED.bedrooms,
  direction = EXCLUDED.direction,
  view_type = EXCLUDED.view_type,
  list_price_vnd = EXCLUDED.list_price_vnd,
  net_price_vnd = EXCLUDED.net_price_vnd,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  price_batch = EXCLUDED.price_batch,
  hold_lead_id = EXCLUDED.hold_lead_id,
  hold_at = EXCLUDED.hold_at,
  pool = EXCLUDED.pool,
  row_version = crm_re_project_products.row_version + 1,
  updated_at = NOW();
`;

@Injectable()
export class BdsReProductPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async resolveProjectTenantId(projectId: number): Promise<string | null> {
    const res = await this.db.query(
      `SELECT tenant_id FROM crm_re_projects WHERE id = $1`,
      [projectId],
    );
    return res.rows[0]?.tenant_id != null ? String(res.rows[0].tenant_id) : null;
  }

  async upsertFromSqlite(row: SqliteProductMirror): Promise<void> {
    const tenantId = await this.resolveProjectTenantId(row.project_id);
    const pool = UNIT_OR_DEFAULT(row.pool);
    await this.db.query(UPSERT_SQL, [
      row.id,
      row.project_id,
      tenantId,
      String(row.unit_code ?? ''),
      String(row.tower ?? ''),
      String(row.floor ?? ''),
      String(row.product_line ?? ''),
      String(row.zone ?? ''),
      String(row.typology ?? ''),
      Boolean(row.is_corner),
      row.sales_staff_id ?? null,
      String(row.product_type ?? ''),
      row.area_m2 ?? null,
      row.bedrooms ?? null,
      String(row.direction ?? ''),
      String(row.view_type ?? ''),
      Number(row.list_price_vnd ?? 0),
      Number(row.net_price_vnd ?? 0),
      String(row.status ?? 'available'),
      String(row.notes ?? ''),
      String(row.price_batch ?? ''),
      row.hold_lead_id ?? null,
      String(row.hold_at ?? ''),
      pool,
    ]);
  }

  async getById(id: number): Promise<Record<string, unknown> | null> {
    const res = await this.db.query(`SELECT * FROM crm_re_project_products WHERE id = $1`, [id]);
    return res.rows[0] ?? null;
  }

  async listByProject(projectId: number): Promise<Record<string, unknown>[]> {
    const res = await this.db.query(
      `SELECT * FROM crm_re_project_products
       WHERE project_id = $1
       ORDER BY tower, floor, unit_code`,
      [projectId],
    );
    return res.rows;
  }

  async findByUnitCode(projectId: number, unitCode: string): Promise<Record<string, unknown> | null> {
    const res = await this.db.query(
      `SELECT * FROM crm_re_project_products
       WHERE project_id = $1 AND lower(trim(unit_code)) = lower(trim($2))
       LIMIT 1`,
      [projectId, unitCode],
    );
    return res.rows[0] ?? null;
  }

  async transitionOptimistic(
    id: number,
    expectedVersion: number,
    nextStatus: BdsUnitStatus,
  ): Promise<boolean> {
    const res = await this.db.query(
      `UPDATE crm_re_project_products
       SET status = $3, row_version = row_version + 1, updated_at = NOW()
       WHERE id = $1 AND row_version = $2`,
      [id, expectedVersion, nextStatus],
    );
    return (res.rowCount ?? 0) === 1;
  }

  async updatePool(id: number, pool: BdsUnitPool, expectedVersion: number): Promise<boolean> {
    const res = await this.db.query(
      `UPDATE crm_re_project_products
       SET pool = $3, row_version = row_version + 1, updated_at = NOW()
       WHERE id = $1 AND row_version = $2`,
      [id, expectedVersion, pool],
    );
    return (res.rowCount ?? 0) === 1;
  }

  async insertImported(row: {
    id: number;
    project_id: number;
    tenant_id: string | null;
    unit_code: string;
    tower: string;
    floor: string;
    zone: string;
    product_line: string;
    pool: BdsUnitPool;
    status: BdsUnitStatus;
    list_price_vnd: number;
    net_price_vnd: number;
    area_m2: number | null;
    bedrooms: number | null;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_re_project_products (
         id, project_id, tenant_id, unit_code, tower, floor, zone, product_line,
         pool, status, list_price_vnd, net_price_vnd, area_m2, bedrooms
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        row.id,
        row.project_id,
        row.tenant_id,
        row.unit_code,
        row.tower,
        row.floor,
        row.zone,
        row.product_line,
        row.pool,
        row.status,
        row.list_price_vnd,
        row.net_price_vnd,
        row.area_m2,
        row.bedrooms,
      ],
    );
  }

  async nextId(): Promise<number> {
    const res = await this.db.query(`SELECT COALESCE(MAX(id), 0) + 1 AS n FROM crm_re_project_products`);
    return Number(res.rows[0].n);
  }

  async countAll(): Promise<number> {
    const res = await this.db.query(`SELECT COUNT(*)::int AS n FROM crm_re_project_products`);
    return Number(res.rows[0].n);
  }
}

function UNIT_OR_DEFAULT(raw?: string): BdsUnitPool {
  const v = String(raw ?? 'inhouse');
  if (v === 'channel' || v === 'reserved_vip' || v === 'reserved_staff' || v === 'inhouse') return v;
  return 'inhouse';
}
```

`BdsModule` providers: thêm `BdsReProductPgRepository`, export nó.

`scripts/bds_count_gate.py` — thay `main`:

```python
def sqlite_count(table: str) -> int:
    con = sqlite3.connect(SQLITE)
    n = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    con.close()
    return int(n)

def pg_count(table: str) -> int:
    out = subprocess.check_output(
        ["psql", DSN, "-tA", "-c", f"SELECT COUNT(*) FROM {table}"],
        text=True,
    )
    return int(out.strip())

def main() -> int:
    ok = 0
    for table in ("crm_re_projects", "crm_re_project_products"):
        try:
            s, p = sqlite_count(table), pg_count(table)
        except Exception as e:
            print(f"{table} skip_or_fail {e}", file=sys.stderr)
            return 1
        print(f"{table} sqlite={s} pg={p}")
        if s != p:
            print("BDS-20 count mismatch", table, file=sys.stderr)
            ok = 1
    return ok
```

`scripts/backfill_bds_products.py`:

```python
#!/usr/bin/env python3
"""Copy crm_re_project_products SQLite → PG. Tenant = crm_re_projects.tenant_id."""
import os, sqlite3, subprocess

SQLITE = os.environ.get("PTT_SQLITE_PATH", "ptt.db")
DSN = os.environ.get("DATABASE_URL", "postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb")

COLS = (
    "id,project_id,unit_code,tower,floor,product_line,zone,typology,is_corner,"
    "sales_staff_id,product_type,area_m2,bedrooms,direction,view_type,"
    "list_price_vnd,net_price_vnd,status,notes,price_batch"
)

def main() -> int:
    con = sqlite3.connect(SQLITE)
    con.row_factory = sqlite3.Row
    try:
        rows = con.execute(f"SELECT {COLS} FROM crm_re_project_products").fetchall()
    except sqlite3.Error:
        print("no sqlite products table")
        return 0
    import csv, tempfile
    fd, path = tempfile.mkstemp(suffix=".csv")
    os.close(fd)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        for r in rows:
            w.writerow([r[c] for c in COLS.split(",")])
    subprocess.check_call(
        [
            "psql", DSN, "-v", "ON_ERROR_STOP=1", "-c",
            f"\\copy crm_re_project_products ({COLS}) FROM '{path}' WITH (FORMAT csv, NULL '')",
        ]
    )
    subprocess.check_call(
        [
            "psql", DSN, "-v", "ON_ERROR_STOP=1", "-c",
            "UPDATE crm_re_project_products u SET tenant_id = p.tenant_id "
            "FROM crm_re_projects p WHERE u.project_id = p.id AND u.tenant_id IS NULL",
        ]
    )
    os.remove(path)
    print(f"backfilled {len(rows)} products")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
```

**Lưu ý implementer:** `\copy` fail nếu id đã tồn tại — khi đó đổi sang `INSERT … ON CONFLICT DO NOTHING` từng dòng qua `psql -c` với escape `quote_literal`. Không dùng `psycopg` nếu image không có.

- [ ] **Step 3: Apply backfill local + gate** (sau khi có ít nhất 1 căn SQLite)

```bash
export PTT_SQLITE_PATH=ptt.db
python3 scripts/backfill_bds_products.py
python3 scripts/bds_count_gate.py
```

Expected: `crm_re_project_products sqlite=N pg=N` exit 0. Nếu SQLite 0 căn: tạo 1 căn qua UI cũ / POST products rồi chạy lại.

- [ ] **Step 4: Commit** — chỉ khi user yêu cầu: `feat(bds): P1 product PG mirror and unit count gate`

---

### Task 4: `BdsInventoryService` — lock + optimistic

**Files:**
- Create: `services/ptt-crm-api/src/bds/inventory/bds-inventory.service.ts`
- Create: `services/ptt-crm-api/src/bds/inventory/bds-inventory.service.spec.ts`
- Modify: `bds.module.ts` — provider + export `BdsInventoryService`

**Interfaces:**
- Consumes: `assertUnitTransition`, `BdsReProductPgRepository.transitionOptimistic`, `getById`
- Produces:
  - `transition(id, event, expectedVersion): UnitView`
  - `lock(id, expectedVersion, reason: string): UnitView`
  - `unlock(id, expectedVersion): UnitView`
  - `setPool(id, pool, expectedVersion): UnitView`

`reason` lock: trim length ≥ 3; lưu `notes` prefix `[lock] ` nếu notes trống — không tạo bảng lý do riêng.

- [ ] **Step 1: Write the failing test**

```ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BdsInventoryService } from './bds-inventory.service';

describe('BdsInventoryService', () => {
  const unit = {
    id: 9,
    project_id: 1,
    status: 'available',
    row_version: 1,
    pool: 'inhouse',
    unit_code: 'A-1201',
  };

  function make(overrides?: Partial<typeof repo>) {
    const repo = {
      getById: jest.fn().mockResolvedValue({ ...unit, ...overrides }),
      transitionOptimistic: jest.fn().mockResolvedValue(true),
      updatePool: jest.fn().mockResolvedValue(true),
    };
    const svc = new BdsInventoryService(repo as never);
    return { svc, repo };
  }

  it('lock available → locked and bumps via repo', async () => {
    const { svc, repo } = make();
    repo.getById.mockResolvedValueOnce(unit).mockResolvedValueOnce({ ...unit, status: 'locked', row_version: 2 });
    const out = await svc.lock(9, 1, 'bảo trì thang');
    expect(repo.transitionOptimistic).toHaveBeenCalledWith(9, 1, 'locked');
    expect(out.status).toBe('locked');
  });

  it('409 when row_version mismatches (BR-BDS-14)', async () => {
    const { svc, repo } = make();
    repo.transitionOptimistic.mockResolvedValue(false);
    await expect(svc.lock(9, 99, 'bảo trì thang')).rejects.toBeInstanceOf(ConflictException);
    try {
      await svc.lock(9, 99, 'bảo trì thang');
    } catch (e) {
      expect((e as ConflictException).getResponse()).toEqual({ error: 'unit_locked' });
    }
  });

  it('404 when unit missing', async () => {
    const { svc, repo } = make();
    repo.getById.mockResolvedValue(null);
    await expect(svc.lock(9, 1, 'abc')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cancel booked → available (BDS-14)', async () => {
    const booked = { ...unit, status: 'booked' };
    const { svc, repo } = make(booked);
    repo.getById.mockResolvedValueOnce(booked).mockResolvedValueOnce({ ...booked, status: 'available', row_version: 2 });
    const out = await svc.transition(9, 'cancel', 1);
    expect(repo.transitionOptimistic).toHaveBeenCalledWith(9, 1, 'available');
    expect(out.status).toBe('available');
  });

  it('rejects lock reason shorter than 3', async () => {
    const { svc } = make();
    await expect(svc.lock(9, 1, 'ab')).rejects.toThrow(/reason/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/inventory/bds-inventory.service.spec.ts --runInBand -v`

- [ ] **Step 3: Implement service**

```ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { assertUnitTransition } from './bds-inventory-transition.util';
import { UNIT_POOLS, type BdsUnitEvent, type BdsUnitPool } from './bds-inventory.types';
import { BdsReProductPgRepository } from './bds-re-product-pg.repository';

@Injectable()
export class BdsInventoryService {
  constructor(private readonly products: BdsReProductPgRepository) {}

  async getOrThrow(id: number): Promise<Record<string, unknown>> {
    const row = await this.products.getById(id);
    if (!row) throw new NotFoundException();
    return row;
  }

  async transition(id: number, event: BdsUnitEvent, expectedVersion: number) {
    const row = await this.getOrThrow(id);
    const next = assertUnitTransition(String(row.status), event);
    const ok = await this.products.transitionOptimistic(id, expectedVersion, next);
    if (!ok) throw new ConflictException({ error: 'unit_locked' });
    return this.getOrThrow(id);
  }

  async lock(id: number, expectedVersion: number, reason: string) {
    if (String(reason ?? '').trim().length < 3) {
      throw new BadRequestException({ error: 'reason' });
    }
    return this.transition(id, 'cdt_lock', expectedVersion);
  }

  async unlock(id: number, expectedVersion: number) {
    return this.transition(id, 'unlock', expectedVersion);
  }

  async setPool(id: number, pool: string, expectedVersion: number) {
    if (!(UNIT_POOLS as readonly string[]).includes(pool)) {
      throw new BadRequestException({ error: 'pool' });
    }
    await this.getOrThrow(id);
    const ok = await this.products.updatePool(id, pool as BdsUnitPool, expectedVersion);
    if (!ok) throw new ConflictException({ error: 'unit_locked' });
    return this.getOrThrow(id);
  }
}
```

`assertUnitTransition` ném `Error('sold')` / `illegal_transition` — service bọc:

```ts
try {
  next = assertUnitTransition(String(row.status), event);
} catch (e) {
  throw new BadRequestException({ error: String((e as Error).message) });
}
```

Thêm vào `transition()` trước `transitionOptimistic`.

- [ ] **Step 4: Run — expect PASS**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/inventory/bds-inventory.service.spec.ts --runInBand -v`

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu: `feat(bds): P1 inventory lock and optimistic version`

---

### Task 5: Import CSV (BDS-07, BDS-16)

**Files:**
- Create: `services/ptt-crm-api/src/bds/inventory/bds-unit-csv.util.ts`
- Create: `services/ptt-crm-api/src/bds/inventory/bds-unit-csv.util.spec.ts`
- Modify: `bds-inventory.service.ts` + `.spec.ts` — `importCsv(projectId, csv)`
- Modify: `bds-inventory.types.ts` — `ImportUnitRow`, `ImportResult`

**Interfaces:**
- Consumes: CSV header bắt buộc `unit_code`
- Produces: `parseUnitCsv(csv): ImportUnitRow[]`, `importCsv` atomic

Quy tắc:

1. Thiếu `unit_code` (trim rỗng) → conflict `{ unit_code: '', error: 'unit_code_required' }`.
2. Trùng `unit_code` **trong file** → conflict `duplicate_unit_code`.
3. Trùng DB và status DB = `sold` → `skipped_sold` (BR-BDS-07), **không** update.
4. Trùng DB và status ≠ `sold` → conflict `duplicate_unit_code` (BDS-16).
5. Có bất kỳ `conflicts` → **không INSERT**, HTTP 409 `{ error: 'import_conflict', conflicts, skipped_sold }`.
6. Không conflict → INSERT các dòng mới (kể cả sau `skipped_sold`). Status import chỉ `available` hoặc `locked`; CSV `sold`/`booked`/`hold` trên căn **mới** → conflict `illegal_import_status`.
7. `pool` mặc định `inhouse`; giá trị lạ → `inhouse`.

- [ ] **Step 1: Write CSV parser test**

```ts
import { parseUnitCsv } from './bds-unit-csv.util';

describe('parseUnitCsv', () => {
  it('reads header and rows', () => {
    const rows = parseUnitCsv('unit_code,tower,floor,pool\nA-01,A,12,inhouse\n');
    expect(rows).toEqual([
      { unit_code: 'A-01', tower: 'A', floor: '12', pool: 'inhouse' },
    ]);
  });

  it('requires unit_code column', () => {
    expect(() => parseUnitCsv('tower,floor\nA,1\n')).toThrow(/unit_code/);
  });
});
```

Parser tối thiểu: split dòng, split `,`, trim, không hỗ trợ quoted-comma v1 (ghi chú trong spec test). BOM strip `^\uFEFF`.

- [ ] **Step 2: Run parser test — FAIL then implement**

```ts
export type ImportUnitRow = {
  unit_code: string;
  tower?: string;
  floor?: string;
  zone?: string;
  product_line?: string;
  pool?: string;
  status?: string;
  list_price_vnd?: string;
  net_price_vnd?: string;
  area_m2?: string;
  bedrooms?: string;
};

export function parseUnitCsv(csv: string): ImportUnitRow[] {
  const text = String(csv ?? '').replace(/^\uFEFF/, '').trim();
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  if (!headers.includes('unit_code')) throw new Error('unit_code');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim();
    });
    return row as ImportUnitRow;
  });
}
```

- [ ] **Step 3: Write import service tests** (thêm vào `bds-inventory.service.spec.ts`)

```ts
describe('importCsv', () => {
  const baseRepo = () => ({
    getById: jest.fn(),
    transitionOptimistic: jest.fn(),
    updatePool: jest.fn(),
    findByUnitCode: jest.fn().mockResolvedValue(null),
    resolveProjectTenantId: jest.fn().mockResolvedValue('t1'),
    nextId: jest.fn().mockResolvedValueOnce(101).mockResolvedValueOnce(102),
    insertImported: jest.fn(),
    listByProject: jest.fn().mockResolvedValue([]),
  });

  it('BDS-16: duplicate in file → 409 and no insert', async () => {
    const repo = baseRepo();
    const svc = new BdsInventoryService(repo as never);
    await expect(
      svc.importCsv(1, 'unit_code\nA-01\nA-01\n'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.insertImported).not.toHaveBeenCalled();
  });

  it('BDS-07: existing sold is skipped, other row imports', async () => {
    const repo = baseRepo();
    repo.findByUnitCode.mockImplementation(async (_pid: number, code: string) => {
      if (code === 'SOLD-1') return { unit_code: 'SOLD-1', status: 'sold' };
      return null;
    });
    const svc = new BdsInventoryService(repo as never);
    const out = await svc.importCsv(1, 'unit_code\nSOLD-1\nNEW-1\n');
    expect(out.skipped_sold).toEqual([{ unit_code: 'SOLD-1', reason: 'sold' }]);
    expect(out.imported).toBe(1);
    expect(repo.insertImported).toHaveBeenCalledTimes(1);
  });

  it('BDS-16: existing available same code → 409 no insert', async () => {
    const repo = baseRepo();
    repo.findByUnitCode.mockResolvedValue({ unit_code: 'A-01', status: 'available' });
    const svc = new BdsInventoryService(repo as never);
    await expect(svc.importCsv(1, 'unit_code\nA-01\n')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.insertImported).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Implement `importCsv` trên service**

```ts
async importCsv(projectId: number, csv: string) {
  const rows = parseUnitCsv(csv);
  const conflicts: Array<{ unit_code: string; error: string }> = [];
  const skipped_sold: Array<{ unit_code: string; reason: 'sold' }> = [];
  const seen = new Set<string>();
  const pending: ImportUnitRow[] = [];

  for (const row of rows) {
    const code = String(row.unit_code ?? '').trim();
    if (!code) {
      conflicts.push({ unit_code: '', error: 'unit_code_required' });
      continue;
    }
    const key = code.toLowerCase();
    if (seen.has(key)) {
      conflicts.push({ unit_code: code, error: 'duplicate_unit_code' });
      continue;
    }
    seen.add(key);
    const existing = await this.products.findByUnitCode(projectId, code);
    if (existing && String(existing.status) === 'sold') {
      skipped_sold.push({ unit_code: code, reason: 'sold' });
      continue;
    }
    if (existing) {
      conflicts.push({ unit_code: code, error: 'duplicate_unit_code' });
      continue;
    }
    const st = String(row.status ?? 'available').trim() || 'available';
    if (st !== 'available' && st !== 'locked') {
      conflicts.push({ unit_code: code, error: 'illegal_import_status' });
      continue;
    }
    pending.push({ ...row, unit_code: code, status: st });
  }

  if (conflicts.length) {
    throw new ConflictException({ error: 'import_conflict', conflicts, skipped_sold });
  }

  const tenantId = await this.products.resolveProjectTenantId(projectId);
  for (const row of pending) {
    const id = await this.products.nextId();
    await this.products.insertImported({
      id,
      project_id: projectId,
      tenant_id: tenantId,
      unit_code: row.unit_code,
      tower: String(row.tower ?? ''),
      floor: String(row.floor ?? ''),
      zone: String(row.zone ?? ''),
      product_line: String(row.product_line ?? ''),
      pool: UNIT_OR_DEFAULT(row.pool),
      status: (row.status as 'available' | 'locked') ?? 'available',
      list_price_vnd: Number(row.list_price_vnd ?? 0) || 0,
      net_price_vnd: Number(row.net_price_vnd ?? 0) || 0,
      area_m2: row.area_m2 ? Number(row.area_m2) : null,
      bedrooms: row.bedrooms ? Number(row.bedrooms) : null,
    });
  }
  return { imported: pending.length, skipped_sold, conflicts: [] };
}
```

`UNIT_OR_DEFAULT` export từ product repo **hoặc** duplicate 4 dòng trong `bds-inventory.types.ts`:

```ts
export function coerceUnitPool(raw?: string): BdsUnitPool {
  const v = String(raw ?? 'inhouse');
  return (UNIT_POOLS as readonly string[]).includes(v) ? (v as BdsUnitPool) : 'inhouse';
}
```

Dùng `coerceUnitPool` ở repo + service — **một** hàm, xóa `UNIT_OR_DEFAULT` local.

- [ ] **Step 5: Run both specs — PASS**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/bds/inventory/bds-unit-csv.util.spec.ts \
  src/bds/inventory/bds-inventory.service.spec.ts --runInBand -v
```

- [ ] **Step 6: Commit** — chỉ khi user yêu cầu: `feat(bds): P1 CSV import skips sold and 409 on duplicate`

---

### Task 6: HTTP `/api/v1/bds` inventory + stack

**Files:**
- Create: `services/ptt-crm-api/src/bds/inventory/bds-inventory.controller.ts`
- Modify: `bds.module.ts` — `controllers: [..., BdsInventoryController]`
- Modify: `bds-inventory.service.ts` — `listUnits`, `stack`
- Modify: `bds-inventory.service.spec.ts` — 1 test `stack` group-by tower/floor

**Interfaces:**
- Guard: `@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard)` — **cùng thứ tự P0** (auth trước pack).
- Routes:

| Method | Path | Body | Status |
|--------|------|------|--------|
| GET | `/api/v1/bds/projects/:id/units` | — | 200 `{ units }` |
| GET | `/api/v1/bds/projects/:id/stack` | — | 200 `{ project_id, towers }` |
| POST | `/api/v1/bds/projects/:id/units/import` | `{ csv: string }` | 200 hoặc 409 |
| POST | `/api/v1/bds/units/:id/lock` | `{ row_version: number, reason: string }` | 200 |
| POST | `/api/v1/bds/units/:id/unlock` | `{ row_version: number }` | 200 |
| PATCH | `/api/v1/bds/units/:id/pool` | `{ row_version: number, pool: string }` | 200 |

PACK=0 → 404 (BdsPackGuard).

- [ ] **Step 1: stack unit test**

```ts
it('stack groups tower then floor', async () => {
  const repo = {
    getById: jest.fn(),
    transitionOptimistic: jest.fn(),
    updatePool: jest.fn(),
    listByProject: jest.fn().mockResolvedValue([
      { id: 1, unit_code: 'A-1201', tower: 'A', floor: '12', status: 'available', pool: 'inhouse', row_version: 1 },
      { id: 2, unit_code: 'A-1202', tower: 'A', floor: '12', status: 'locked', pool: 'channel', row_version: 3 },
      { id: 3, unit_code: 'B-0501', tower: 'B', floor: '5', status: 'available', pool: 'inhouse', row_version: 1 },
    ]),
  };
  const svc = new BdsInventoryService(repo as never);
  const out = await svc.stack(7);
  expect(out.project_id).toBe(7);
  expect(out.towers.map((t) => t.tower)).toEqual(['A', 'B']);
  expect(out.towers[0].floors[0].floor).toBe('12');
  expect(out.towers[0].floors[0].units).toHaveLength(2);
});
```

```ts
async listUnits(projectId: number) {
  return { units: await this.products.listByProject(projectId) };
}

async stack(projectId: number) {
  const units = await this.products.listByProject(projectId);
  const towers = new Map<string, Map<string, Record<string, unknown>[]>>();
  for (const u of units) {
    const tw = String(u.tower ?? '') || '—';
    const fl = String(u.floor ?? '') || '—';
    if (!towers.has(tw)) towers.set(tw, new Map());
    const floors = towers.get(tw)!;
    if (!floors.has(fl)) floors.set(fl, []);
    floors.get(fl)!.push(u);
  }
  return {
    project_id: projectId,
    towers: [...towers.entries()].map(([tower, floors]) => ({
      tower,
      floors: [...floors.entries()].map(([floor, rows]) => ({ floor, units: rows })),
    })),
  };
}
```

- [ ] **Step 2: Controller**

```ts
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsInventoryService } from './bds-inventory.service';

@Controller('api/v1/bds')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard)
export class BdsInventoryController {
  constructor(private readonly inventory: BdsInventoryService) {}

  @Get('projects/:id/units')
  listUnits(@Param('id', ParseIntPipe) id: number) {
    return this.inventory.listUnits(id);
  }

  @Get('projects/:id/stack')
  stack(@Param('id', ParseIntPipe) id: number) {
    return this.inventory.stack(id);
  }

  @Post('projects/:id/units/import')
  importCsv(@Param('id', ParseIntPipe) id: number, @Body() body: { csv?: string }) {
    return this.inventory.importCsv(id, String(body.csv ?? ''));
  }

  @Post('units/:id/lock')
  lock(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { row_version?: number; reason?: string },
  ) {
    return this.inventory.lock(id, Number(body.row_version), String(body.reason ?? ''));
  }

  @Post('units/:id/unlock')
  unlock(@Param('id', ParseIntPipe) id: number, @Body() body: { row_version?: number }) {
    return this.inventory.unlock(id, Number(body.row_version));
  }

  @Patch('units/:id/pool')
  setPool(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { row_version?: number; pool?: string },
  ) {
    return this.inventory.setPool(id, String(body.pool ?? ''), Number(body.row_version));
  }
}
```

- [ ] **Step 3: Jest service (stack + import đã có) PASS; `tsc -p tsconfig.build.json --noEmit` exit 0**

- [ ] **Step 4: Manual PACK=0 / PACK=1** (local, sau restart)

```bash
# PACK=0
curl -s -o /tmp/x -w '%{http_code}\n' -X POST http://127.0.0.1:3000/api/v1/bds/projects/1/units/import \
  -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" -H 'Content-Type: application/json' \
  -d '{"csv":"unit_code\nA-01\n"}'
# → 404

# PACK=1
export PTT_BDS_PACK=1 PTT_BDS_PG=1
# restart api
curl -s -X POST http://127.0.0.1:3000/api/v1/bds/projects/$PID/units/import \
  -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" -H 'Content-Type: application/json' \
  -d '{"csv":"unit_code,tower,floor\nA-01,A,12\nA-01,A,12\n"}'
# → 409 import_conflict

curl -s -X POST http://127.0.0.1:3000/api/v1/bds/units/$UID/lock \
  -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" -H 'Content-Type: application/json' \
  -d '{"row_version":1,"reason":"bao tri"}'
# lần 2 cùng version → 409 unit_locked
```

Local API mặc định vẫn `:3000` trên máy dev. **VPS realosai dùng :3010** — không đổi nnhn `:3000`.

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu: `feat(bds): P1 inventory HTTP units import lock stack`

---

### Task 7: Hook `re-projects` khi PACK / PG

**Files:**
- Modify: `services/ptt-crm-api/src/re-projects/re-projects.service.ts`
- Modify: `services/ptt-crm-api/src/re-projects/re-projects.module.ts` — `@Optional() BdsInventoryService` + `BdsReProductPgRepository` (repo products)

**Không** import `BdsModule` từ vòng `ReProjectsModule` nếu tạo cycle. P0: `ReProjectsModule` đã `imports` gì? Nếu chưa import `BdsModule`, **đăng ký provider trùng là sai**. Cách P0: `BdsModule` exports repo; `ReProjectsModule` `imports: [forwardRef(() => BdsModule)]` **chỉ khi** không cycle. An toàn hơn: giữ `@Optional()` + thêm `BdsReProductPgRepository` vào `exports` (đã có pattern project repo).

`ReProjectsModule` hiện inject `BdsReProjectPgRepository` — đọc file đó, **thêm** `BdsReProductPgRepository` và `BdsInventoryService` cùng kiểu `@Optional()`.

- [ ] **Step 1: Hành vi**

`createProduct`:

1. SQLite `saveProduct` như cũ (PACK=0 nguồn UI).
2. Nếu `shouldDualWrite()` → `productPg.upsertFromSqlite(row)` trong try/catch (lỗi PG **không** đổi HTTP 400 — giống P0 project).
3. Nếu `isBdsPackEnabled()` và `body.status` được gửi trên **update**: `ConflictException({ error: 'status_via_transition' })` **trước** save. Create được phép `available`/`locked` only; status khác → 400.

`updateProduct`:

```ts
if (isBdsPackEnabled() && body.status !== undefined) {
  throw new ConflictException({ error: 'status_via_transition' });
}
const row = this.sqlite.saveProduct(projectId, body, productId);
if (shouldDualWrite() && this.productPg) {
  try { await this.productPg.upsertFromSqlite(row); } catch (err) { console.error(err); }
}
return row;
```

`createProduct` đổi `async` giống `createProject`.

- [ ] **Step 2: Không viết E2E Nest HTTP cho hook** — thêm unit nếu đã có `re-projects.service.spec.ts`; nếu **không** có file spec, bỏ qua (tránh đẻ harness SQLite). Verify tay: PACK=1 PUT product `{ status: 'sold' }` → 409; PACK=0 PUT vẫn 200.

- [ ] **Step 3: `tsc -p tsconfig.build.json --noEmit` exit 0**

- [ ] **Step 4: Commit** — chỉ khi user yêu cầu: `feat(bds): P1 block status patch on RE products when PACK on`

---

### Task 8: DoD + hồi quy

**Files:** không file mới bắt buộc. Sửa `docs/superpowers/plans/2026-08-22-bds-coding-roadmap.md` hàng P1 → trỏ file plan này.

- [ ] **Step 1: Jest gói P1**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds --runInBand
npx tsc -p tsconfig.build.json --noEmit
```

Expected: mọi spec `src/bds/**` xanh; tsc 0.

- [ ] **Step 2: Gate đếm**

```bash
python3 scripts/bds_count_gate.py
```

Expected: hai dòng `crm_re_projects` và `crm_re_project_products` `sqlite=N pg=N`, exit 0.

- [ ] **Step 3: Hồi quy RE cũ**

```bash
# PACK=0
curl -s -o /dev/null -w '%{http_code}\n' "$API/api/crm/re-projects"
# → 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/api/v1/bds/projects/1/units/import" \
  -H "x-ptt-internal-key: $KEY" -H 'Content-Type: application/json' -d '{"csv":"unit_code\nX\n"}'
# → 404
```

- [ ] **Step 4: Cập nhật roadmap**

Trong `2026-08-22-bds-coding-roadmap.md` hàng bảng P1:

```
| **P1** | [bds-p1-inventory-os.md](./2026-08-22-bds-p1-inventory-os.md) | import + row_version + lock | 010–012 |
```

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu: `docs(bds): point roadmap at P1 inventory plan`

---

## 4. Definition of Done P1

- [ ] Jest `bds-inventory-transition`, `bds-unit-csv`, `bds-inventory.service` xanh
- [ ] `tsc --noEmit` build api xanh
- [ ] DDL P1 apply được (idempotent lần 2)
- [ ] BDS-16: import trùng `unit_code` → 409, không insert
- [ ] BDS-07: CSV đụng căn `sold` → skip, không đổi status
- [ ] BR-BDS-14: lock lần 2 cùng `row_version` → 409 `unit_locked`
- [ ] BDS-14 (inventory): `transition(booked, cancel)` → `available`
- [ ] PACK=0: POST `/api/v1/bds/projects/:id/units/import` → 404
- [ ] PACK=1: GET `/stack` 200, nhóm tower/floor
- [ ] PACK=1: PUT `/api/crm/re-projects/:id/products/:pid` kèm `status` → 409 `status_via_transition`
- [ ] `bds_count_gate.py` đếm căn exit 0 trên staging
- [ ] Prod VPS: `PTT_BDS_PACK=0` (không bật)
- [ ] Không `bds_holds`, không UI `/crm/bds`, không `bds_towers`

---

## 5. Rollback

| Tình huống | Cách |
|------------|------|
| API `/bds` lỗi | `PTT_BDS_PACK=0` |
| Dual-write căn lệch | `PTT_BDS_PG=0`; sửa backfill; gate đỏ = không bật PACK |
| Unique unit_code gãy data cũ (nhiều dòng `unit_code=''`) | Index **partial** `WHERE trim(unit_code) <> ''` — không unique dòng trống |
| `reserved` phá UI cũ | Label đã thêm; filter cũ không biết `reserved` vẫn hiện raw — chấp nhận P1; P8 mới skin |

---

## 6. Rủi ro

| Rủi ro | Xử lý |
|--------|--------|
| SQLite và PG **khác id** sau import chỉ PG | Import P1 ghi PG; dual-write từ SQLite dùng **cùng id**. Khi PACK=1+PG, create qua inventory phải `nextId` = max(sqlite, pg)+1 **hoặc** chỉ ghi PG và thôi SQLite (cắt đọc = sau P1). **P1 chọn:** import API chỉ PG; create qua route cũ = SQLite rồi upsert PG cùng id |
| `nextId` race hai import | Chấp nhận P1 (1 admin). P2 dùng sequence |
| Stack không có tower entity | Đúng P1; P1b map `tower` text → `tower_id` |
| VPS 1.6GB OOM nếu nest build | Build trên Mac, rsync `dist/` như P0 |

---

## 7. Sau P1 xanh

1. Viết plan **P1b** (`docs/superpowers/plans/2026-08-22-bds-p1b-project-os.md`) — tòa/khu/đợt/`legal_gate`.
2. **Không** mở P2 hold khi P1 hoặc P1b đỏ.
3. Staging: giữ PACK tắt trên prod; bật PACK+PG chỉ local/staging 2 tenant.

---

*P1 không phải «toàn bộ pack». Thắng: import sạch + khóa căn có version. Hold = P2.*
