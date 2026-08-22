# P0 — Tenant + PostgreSQL + Org seed — Implementation Plan

> **Bản triển khai chuẩn (lịch 4 ngày, runbook, rollback, TDD đủ SQL/script):** [`2026-08-22-bds-p0-trien-khai.md`](./2026-08-22-bds-p0-trien-khai.md). File này giữ bản TDD rút gọn; khi lệch, theo bản triển khai.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bật được bounded context `bds/` với tenant, flag 404 khi PACK=0, seed 12 phòng §25, `tenant_id` trên dự án RE (PG), dual-write + gate đếm căn (BDS-01, BDS-20).

**Architecture:** Module Nest `BdsModule` độc lập. Guard `BdsPackGuard` trả 404 nếu `PTT_BDS_PACK≠1`. Tenant sống trên PG. Org seed gọi API/`crm_departments` idempotent theo `code`. Dual-write: khi `PTT_BDS_PG=1`, mỗi insert/update `crm_re_projects` (SQLite) mirror PG; script backfill tạo tenant `PTT-RE-LEGACY`.

**Tech Stack:** NestJS, Jest, `pg`, SQLite hiện có (`re-projects-sqlite.repository.ts`), bash `psql`.

**Roadmap:** [`2026-08-22-bds-coding-roadmap.md`](./2026-08-22-bds-coding-roadmap.md)  
**Spec:** §5.3, §6.1–6.2, §12, §15 P0, §25.2–25.3, §25.7, BR-BDS-34, BDS-01, BDS-20.

## Global Constraints

- `PTT_BDS_PACK` mặc định `0` — POST `/api/v1/bds/tenants` = **404**.
- GET ngoài tenant = 404, không PII.
- Không xóa `re-projects/`. Không đụng `crm_b2b_projects`.
- `DATABASE_URL` script: `postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb`.
- Không commit trừ khi user yêu cầu.
- Test: `cd services/ptt-crm-api && npx jest <file> -v`.

---

## File map P0

```
docs/specs/postgresql-ddl-bds-p0.sql
scripts/apply_pg_ddl_bds_p0.sh
scripts/backfill_bds_legacy_tenant.ts
scripts/bds_count_gate.py

services/ptt-crm-api/src/bds/bds.flags.ts
services/ptt-crm-api/src/bds/bds.flags.spec.ts
services/ptt-crm-api/src/bds/industry-pack.ts
services/ptt-crm-api/src/bds/industry-pack.spec.ts
services/ptt-crm-api/src/bds/bds.module.ts
services/ptt-crm-api/src/bds/guards/bds-pack.guard.ts
services/ptt-crm-api/src/bds/guards/bds-pack.guard.spec.ts
services/ptt-crm-api/src/bds/tenant/bds-tenant.types.ts
services/ptt-crm-api/src/bds/tenant/bds-tenant.repository.ts
services/ptt-crm-api/src/bds/tenant/bds-tenant.repository.spec.ts
services/ptt-crm-api/src/bds/tenant/bds-tenant.service.ts
services/ptt-crm-api/src/bds/tenant/bds-tenant.service.spec.ts
services/ptt-crm-api/src/bds/tenant/bds-tenant.controller.ts
services/ptt-crm-api/src/bds/org/bds-org-seed.ts
services/ptt-crm-api/src/bds/org/bds-org-seed.spec.ts
services/ptt-crm-api/src/bds/inventory/bds-dual-write.util.ts
services/ptt-crm-api/src/bds/inventory/bds-dual-write.util.spec.ts

services/ptt-crm-api/src/config/app-config.service.ts
services/ptt-crm-api/src/app.module.ts
services/ptt-crm-api/src/leads-funnel/lead-flow-kind.util.ts
services/ptt-crm-api/src/leads-funnel/lead-flow-kind.util.spec.ts
```

---

### Task 1: Flags PACK / PG

**Files:**
- Create: `services/ptt-crm-api/src/bds/bds.flags.ts`
- Create: `services/ptt-crm-api/src/bds/bds.flags.spec.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts` (thêm 2 getter, đọc env)

**Interfaces:**
- Consumes: `process.env.PTT_BDS_PACK`, `PTT_BDS_PG`
- Produces: `isBdsPackEnabled(): boolean`, `isBdsPgEnabled(): boolean`, `envFlagOn(name: string): boolean`

- [ ] **Step 1: Write the failing test**

```ts
import { envFlagOn, isBdsPackEnabled, isBdsPgEnabled } from './bds.flags';

describe('bds.flags', () => {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevPg = process.env.PTT_BDS_PG;
  afterEach(() => {
    process.env.PTT_BDS_PACK = prevPack;
    process.env.PTT_BDS_PG = prevPg;
  });

  it('defaults PACK off when unset', () => {
    delete process.env.PTT_BDS_PACK;
    expect(isBdsPackEnabled()).toBe(false);
  });

  it('treats 1/true/yes/on as on', () => {
    process.env.PTT_BDS_PACK = '1';
    expect(isBdsPackEnabled()).toBe(true);
    process.env.PTT_BDS_PG = 'true';
    expect(isBdsPgEnabled()).toBe(true);
  });

  it('envFlagOn is false for 0', () => {
    expect(envFlagOn('0')).toBe(false);
    expect(envFlagOn('off')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/bds/bds.flags.spec.ts -v`  
Expected: FAIL (cannot find module)

- [ ] **Step 3: Write minimal implementation**

```ts
const ON = new Set(['1', 'true', 'yes', 'on']);

export function envFlagOn(raw: string | undefined): boolean {
  return ON.has(String(raw ?? '0').trim().toLowerCase());
}

export function isBdsPackEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_PACK);
}

export function isBdsPgEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_PG);
}
```

Thêm vào `AppConfigService` constructor/fields (cùng pattern content-marketing):

```ts
readonly bdsPackEnabled: boolean;
readonly bdsPgEnabled: boolean;
// trong constructor:
this.bdsPackEnabled = ['1', 'true', 'yes', 'on'].includes(
  (process.env.PTT_BDS_PACK ?? '0').trim().toLowerCase(),
);
this.bdsPgEnabled = ['1', 'true', 'yes', 'on'].includes(
  (process.env.PTT_BDS_PG ?? '0').trim().toLowerCase(),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/bds/bds.flags.spec.ts -v`  
Expected: PASS

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu: `feat(bds): P0 flags PACK and PG`

---

### Task 2: IndustryPack contract + slug `bds`

**Files:**
- Create: `services/ptt-crm-api/src/bds/industry-pack.ts`
- Create: `services/ptt-crm-api/src/bds/industry-pack.spec.ts`

**Interfaces:**
- Consumes: —  
- Produces: `BDS_PACK`, `mapWonToRevenue(tx: { type: string; amountVnd: number }): { kind: 'pipeline' | 'revenue'; amountVnd: number }`

- [ ] **Step 1: Write the failing test**

```ts
import { BDS_PACK, mapWonToRevenue } from './industry-pack';

describe('industry-pack bds', () => {
  it('exposes slug and re_buyer flow', () => {
    expect(BDS_PACK.slug).toBe('bds');
    expect(BDS_PACK.leadFlowKind).toBe('re_buyer');
    expect(BDS_PACK.tenantModes).toEqual(['developer', 'broker', 'hybrid']);
  });

  it('counts deposit as pipeline and contracted as CĐT revenue', () => {
    expect(mapWonToRevenue({ type: 'deposit', amountVnd: 100 })).toEqual({
      kind: 'pipeline',
      amountVnd: 100,
    });
    expect(mapWonToRevenue({ type: 'contracted', amountVnd: 200 })).toEqual({
      kind: 'revenue',
      amountVnd: 200,
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement**

```ts
export type BdsTenantMode = 'developer' | 'broker' | 'hybrid';

export type IndustryPack = {
  slug: 'bds';
  leadFlowKind: 're_buyer';
  tenantModes: BdsTenantMode[];
};

export const BDS_PACK: IndustryPack = {
  slug: 'bds',
  leadFlowKind: 're_buyer',
  tenantModes: ['developer', 'broker', 'hybrid'],
};

export function mapWonToRevenue(tx: { type: string; amountVnd: number }): {
  kind: 'pipeline' | 'revenue';
  amountVnd: number;
} {
  if (tx.type === 'contracted') return { kind: 'revenue', amountVnd: tx.amountVnd };
  return { kind: 'pipeline', amountVnd: tx.amountVnd };
}
```

- [ ] **Step 4: Jest PASS** `src/bds/industry-pack.spec.ts`

- [ ] **Step 5: Commit nếu được yêu cầu** `feat(bds): IndustryPack contract`

---

### Task 3: Guard 404 khi PACK tắt (BDS-01)

**Files:**
- Create: `services/ptt-crm-api/src/bds/guards/bds-pack.guard.ts`
- Create: `services/ptt-crm-api/src/bds/guards/bds-pack.guard.spec.ts`

**Interfaces:**
- Consumes: `isBdsPackEnabled()`
- Produces: `BdsPackGuard` — `canActivate`: true nếu PACK on; throw `NotFoundException` nếu off

- [ ] **Step 1: Failing test**

```ts
import { NotFoundException } from '@nestjs/common';
import { BdsPackGuard } from './bds-pack.guard';

describe('BdsPackGuard', () => {
  const prev = process.env.PTT_BDS_PACK;
  afterEach(() => {
    process.env.PTT_BDS_PACK = prev;
  });

  it('throws NotFoundException when PACK is off (BDS-01)', () => {
    process.env.PTT_BDS_PACK = '0';
    const guard = new BdsPackGuard();
    expect(() => guard.canActivate()).toThrow(NotFoundException);
  });

  it('allows when PACK is on', () => {
    process.env.PTT_BDS_PACK = '1';
    expect(new BdsPackGuard().canActivate()).toBe(true);
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { isBdsPackEnabled } from '../bds.flags';

@Injectable()
export class BdsPackGuard {
  canActivate(): boolean {
    if (!isBdsPackEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
```

- [ ] **Step 4: Jest PASS** `src/bds/guards/bds-pack.guard.spec.ts`

- [ ] **Step 5: Commit nếu được yêu cầu** `feat(bds): pack guard 404`

---

### Task 4: DDL P0

**Files:**
- Create: `docs/specs/postgresql-ddl-bds-p0.sql`
- Create: `scripts/apply_pg_ddl_bds_p0.sh`

**Interfaces:**
- Produces: tables `bds_tenants`; columns `tenant_id` nullable trên `crm_re_projects` **nếu bảng đã tồn tại trên PG**; nếu chưa có bảng RE trên PG — tạo stub `crm_re_projects` tối thiểu (id, name, tenant_id, developer_org_name, legal_gate, one_price, hdmb_min_paid_pct)

- [ ] **Step 1: Write SQL** (không test Jest — verify bằng `psql`)

```sql
-- Pack BĐS P0 — Apply: scripts/apply_pg_ddl_bds_p0.sh
BEGIN;

CREATE TABLE IF NOT EXISTS bds_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CITEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('developer', 'broker', 'hybrid')),
  legal_name TEXT NOT NULL DEFAULT '',
  tax_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'suspended')) DEFAULT 'draft',
  operated_by_ptt BOOLEAN NOT NULL DEFAULT FALSE,
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_re_projects (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',
  developer_name TEXT NOT NULL DEFAULT '',
  tenant_id UUID REFERENCES bds_tenants (id),
  developer_org_name TEXT NOT NULL DEFAULT '',
  legal_gate TEXT NOT NULL DEFAULT 'blocked'
    CHECK (legal_gate IN ('blocked', 'enough_to_sell', 'restricted')),
  one_price BOOLEAN NOT NULL DEFAULT TRUE,
  hdmb_min_paid_pct NUMERIC(5,2) NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES bds_tenants (id);
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS developer_org_name TEXT NOT NULL DEFAULT '';
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS legal_gate TEXT NOT NULL DEFAULT 'blocked';
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS one_price BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS hdmb_min_paid_pct NUMERIC(5,2) NOT NULL DEFAULT 30;

CREATE INDEX IF NOT EXISTS idx_crm_re_projects_tenant ON crm_re_projects (tenant_id);

COMMIT;
```

Nếu PG chưa có `CITEXT`: đầu file `CREATE EXTENSION IF NOT EXISTS citext;`

`scripts/apply_pg_ddl_bds_p0.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/postgresql-ddl-bds-p0.sql"
echo "==> Apply BĐS P0 DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  bds P0 DDL"
```

- [ ] **Step 2: `chmod +x scripts/apply_pg_ddl_bds_p0.sh`**

- [ ] **Step 3: Apply**

Run: `./scripts/apply_pg_ddl_bds_p0.sh`  
Expected: `OK  bds P0 DDL`

- [ ] **Step 4: Verify**

Run: `psql "$DATABASE_URL" -c '\d bds_tenants'`  
Expected: bảng tồn tại với `mode`, `code`

- [ ] **Step 5: Commit nếu được yêu cầu** `feat(bds): P0 DDL tenants and project tenant_id`

---

### Task 5: Tenant repository + service + POST /tenants

**Files:**
- Create: `services/ptt-crm-api/src/bds/tenant/bds-tenant.types.ts`
- Create: `services/ptt-crm-api/src/bds/tenant/bds-tenant.repository.ts`
- Create: `services/ptt-crm-api/src/bds/tenant/bds-tenant.repository.spec.ts`
- Create: `services/ptt-crm-api/src/bds/tenant/bds-tenant.service.ts`
- Create: `services/ptt-crm-api/src/bds/tenant/bds-tenant.service.spec.ts`
- Create: `services/ptt-crm-api/src/bds/tenant/bds-tenant.controller.ts`
- Create: `services/ptt-crm-api/src/bds/bds.module.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts` — `imports: [..., BdsModule]`

**Interfaces:**
- Consumes: `AppConfigService.databaseUrl`, `BdsPackGuard`, `BdsOrgSeedService.seedForTenant` (Task 6 — service gọi seed **sau** insert; P0 Task 5 được phép inject optional stub `seedForTenant: async () => {}` rồi Task 6 thay)
- Produces: `BdsTenantService.create(body)`, `getMe(tenantId)`, `BdsTenantRow`

`bds-tenant.types.ts`:

```ts
export type BdsTenantMode = 'developer' | 'broker' | 'hybrid';
export type BdsTenantStatus = 'draft' | 'active' | 'suspended';

export type BdsTenantRow = {
  id: string;
  code: string;
  name: string;
  mode: BdsTenantMode;
  status: BdsTenantStatus;
  operated_by_ptt: boolean;
};

export type CreateBdsTenantBody = {
  code: string;
  name: string;
  mode: BdsTenantMode;
  operated_by_ptt?: boolean;
};
```

- [ ] **Step 1: Service unit test (mock repo)**

```ts
import { BdsTenantService } from './bds-tenant.service';

describe('BdsTenantService', () => {
  it('rejects empty code', async () => {
    const repo = { insert: jest.fn() };
    const seed = { seedForTenant: jest.fn() };
    const svc = new BdsTenantService(repo as never, seed as never);
    await expect(
      svc.create({ code: '  ', name: 'X', mode: 'developer' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('inserts then seeds org', async () => {
    const row = {
      id: '11111111-1111-1111-1111-111111111111',
      code: 'acme',
      name: 'ACME',
      mode: 'developer' as const,
      status: 'draft' as const,
      operated_by_ptt: false,
    };
    const repo = { insert: jest.fn().mockResolvedValue(row) };
    const seed = { seedForTenant: jest.fn().mockResolvedValue(undefined) };
    const svc = new BdsTenantService(repo as never, seed as never);
    const created = await svc.create({ code: 'acme', name: 'ACME', mode: 'developer' });
    expect(created.code).toBe('acme');
    expect(seed.seedForTenant).toHaveBeenCalledWith(row.id, 'developer');
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement repository** (`Pool` từ `pg`, copy pattern `vd-job.repository.ts`): `insert` SQL vào `bds_tenants`; `getById`; `getByCode`. Service: trim code, 400 nếu rỗng, gọi `insert` + `seedForTenant`. Controller:

```ts
@Controller('api/v1/bds/tenants')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard)
export class BdsTenantController {
  constructor(private readonly tenants: BdsTenantService) {}

  @Post()
  create(@Body() body: CreateBdsTenantBody) {
    return this.tenants.create(body);
  }

  @Get('me')
  me(@Headers('x-bds-tenant') tenantId: string) {
    return this.tenants.getMe(tenantId);
  }
}
```

`BdsModule` providers: flags không cần — guard đọc env. Import `StaffAuthModule` nếu guard staff cần.

- [ ] **Step 4: Jest PASS** `bds-tenant.service.spec.ts`

- [ ] **Step 5: Manual BDS-01**

```bash
# PACK=0
PTT_BDS_PACK=0 curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3000/api/v1/bds/tenants \
  -H 'Content-Type: application/json' -d '{"code":"x","name":"X","mode":"developer"}'
# Expected: 404
```

- [ ] **Step 6: Commit nếu được yêu cầu** `feat(bds): tenant create API behind pack guard`

---

### Task 6: Org seed §25 (12 phòng + vị trí + BR-34)

**Files:**
- Create: `services/ptt-crm-api/src/bds/org/bds-org-seed.ts`
- Create: `services/ptt-crm-api/src/bds/org/bds-org-seed.spec.ts`

**Interfaces:**
- Consumes: `StaffOrgService.createDepartment` / list + insert-if-missing qua SQL idempotent `ON CONFLICT (code)` — **nếu `crm_departments.code` chưa UNIQUE**, seed bằng `SELECT id FROM crm_departments WHERE code=$1` rồi insert khi trống (không giả định UNIQUE).
- Produces: `BDS_DEPARTMENT_SEEDS` (12), `BDS_POSITION_SEEDS`, `REQUIRED_POSITION_CODES`, `assertRequiredRoles(assignedCodes: string[]): string[]` (thiếu), `BdsOrgSeedService.seedForTenant(tenantId, mode)`

Constants (đúng spec §25.2–25.3):

```ts
export const BDS_DEPARTMENT_SEEDS = [
  { code: 'ban_tgd', name: 'Ban Điều hành' },
  { code: 'ban_du_an', name: 'Ban Dự án' },
  { code: 'ban_san_pham', name: 'Ban Sản phẩm – Giỏ hàng' },
  { code: 'ban_kd', name: 'Ban Kinh doanh Inhouse' },
  { code: 'ban_kenh', name: 'Ban Kênh phân phối' },
  { code: 'ban_cskh_presales', name: 'Ban CSKH trước bán' },
  { code: 'ban_mkt', name: 'Ban Marketing' },
  { code: 'ban_phap_che', name: 'Ban Pháp chế' },
  { code: 'ban_tc_collection', name: 'Ban Tài chính – Công nợ' },
  { code: 'ban_tc_hh', name: 'Ban Tài chính – Hoa hồng' },
  { code: 'ban_cskh_after', name: 'Ban CSKH sau bán' },
  { code: 'ban_hr', name: 'Ban Nhân sự' },
] as const;

export const REQUIRED_POSITION_CODES = [
  'pm_du_an',
  'gdkd',
  'truong_pc',
  'truong_collection',
  'truong_sp',
] as const;

export function missingRequiredPositions(assigned: string[]): string[] {
  const set = new Set(assigned);
  return REQUIRED_POSITION_CODES.filter((c) => !set.has(c));
}
```

Vị trí: `tgd`, `gdkd`, `pm_du_an`, `truong_sp`, `cv_gia`, `truong_inhouse`, `tvv_inhouse`, `truong_kenh`, `am_kenh`, `cskh_lead`, `truong_mkt`, `truong_pc`, `cv_hd`, `truong_collection`, `cv_hh`, `truong_after`, `cv_ban_giao`, `hr_bp` — mỗi hàng `{ code, name, department_code }` theo bảng §25.3.

- [ ] **Step 1: Failing test**

```ts
import { missingRequiredPositions, BDS_DEPARTMENT_SEEDS } from './bds-org-seed';

describe('bds-org-seed', () => {
  it('seeds 12 departments', () => {
    expect(BDS_DEPARTMENT_SEEDS).toHaveLength(12);
    expect(BDS_DEPARTMENT_SEEDS.map((d) => d.code)).toContain('ban_phap_che');
  });

  it('BR-34 lists five required positions', () => {
    expect(missingRequiredPositions(['pm_du_an', 'gdkd'])).toEqual([
      'truong_pc',
      'truong_collection',
      'truong_sp',
    ]);
    expect(missingRequiredPositions([
      'pm_du_an',
      'gdkd',
      'truong_pc',
      'truong_collection',
      'truong_sp',
    ])).toEqual([]);
  });
});
```

- [ ] **Step 2: FAIL then implement constants + `missingRequiredPositions`**

- [ ] **Step 3: `BdsOrgSeedService.seedForTenant`** — loop departments: nếu chưa có `code` thì `StaffOrgService.createDepartment`. Tương tự team (`code` = department code) và position (`create` hoặc SQL). `mode=broker`: **không** seed 12 phòng CĐT (return sớm). `developer`/`hybrid`: seed đủ.

Tenant `active` mà `missingRequiredPositions(users mapped)` không rỗng: `BdsTenantService.activate` (nếu có) ném 400 `BR-BDS-34`. P0: `create` để `draft`; document activate ở P8. Thêm `activate(id)` trên service:

```ts
async activate(id: string, assignedPositionCodes: string[]): Promise<BdsTenantRow> {
  const missing = missingRequiredPositions(assignedPositionCodes);
  if (missing.length) {
    throw new BadRequestException({ error: 'br_bds_34', missing });
  }
  return this.repo.setStatus(id, 'active');
}
```

Test activate thiếu vị trí → 400.

- [ ] **Step 4: Jest PASS** `bds-org-seed.spec.ts` + activate test trong service spec

- [ ] **Step 5: Commit nếu được yêu cầu** `feat(bds): org seed 12 departments and BR-34`

---

### Task 7: Dual-write + gate BDS-20

**Files:**
- Create: `services/ptt-crm-api/src/bds/inventory/bds-dual-write.util.ts`
- Create: `services/ptt-crm-api/src/bds/inventory/bds-dual-write.util.spec.ts`
- Create: `scripts/bds_count_gate.py`

**Interfaces:**
- Consumes: `isBdsPgEnabled()`
- Produces: `shouldDualWrite(): boolean`, `assertCountGate(sqliteCount: number, pgCount: number): void` ném nếu lệch

- [ ] **Step 1: Failing test**

```ts
import { assertCountGate, shouldDualWrite } from './bds-dual-write.util';

describe('bds-dual-write', () => {
  it('assertCountGate throws when counts differ (BDS-20)', () => {
    expect(() => assertCountGate(10, 9)).toThrow(/BDS-20/);
  });

  it('assertCountGate passes when equal', () => {
    expect(() => assertCountGate(3, 3)).not.toThrow();
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```ts
import { isBdsPgEnabled } from '../bds.flags';

export function shouldDualWrite(): boolean {
  return isBdsPgEnabled();
}

export function assertCountGate(sqliteCount: number, pgCount: number): void {
  if (sqliteCount !== pgCount) {
    throw new Error(`BDS-20 count mismatch sqlite=${sqliteCount} pg=${pgCount}`);
  }
}
```

`scripts/bds_count_gate.py`: đếm `crm_re_project_products` SQLite (`ptt.db`) vs `SELECT count(*) FROM crm_re_project_products` PG (bảng products thêm ở P1 — **P0 chỉ đếm `crm_re_projects`**):

```python
# P0: count projects only
# sqlite: SELECT COUNT(*) FROM crm_re_projects
# pg:     SELECT COUNT(*) FROM crm_re_projects
# exit 1 if mismatch
```

Khi P1 có products: cùng script thêm đếm căn.

Hook dual-write **tối thiểu P0:** trong `ReProjectsService` create/update project, nếu `shouldDualWrite()` thì `INSERT ... ON CONFLICT (id) DO UPDATE` lên PG (`tenant_id` = legacy hoặc header). Không chuyển đọc UI sang PG ở P0.

- [ ] **Step 4: Jest PASS**

- [ ] **Step 5: Commit nếu được yêu cầu** `feat(bds): dual-write gate BDS-20`

---

### Task 8: Backfill tenant `PTT-RE-LEGACY` + `re_buyer` hook

**Files:**
- Create: `scripts/backfill_bds_legacy_tenant.ts` (hoặc `.py` — một file, chạy `psql` + sqlite3)
- Modify: `services/ptt-crm-api/src/leads-funnel/lead-flow-kind.util.ts`
- Modify: `services/ptt-crm-api/src/leads-funnel/lead-flow-kind.util.spec.ts`

**Interfaces:**
- Produces: tenant code `PTT-RE-LEGACY` mode `hybrid` `operated_by_ptt=true`; mọi `crm_re_projects.tenant_id` PG = tenant đó. `LeadFlowKind` thêm `'re_buyer'`.

- [ ] **Step 1: Failing lead-flow test**

```ts
it('classifies explicit re_buyer', () => {
  expect(
    resolveLeadFlowKind({
      metaJson: { lead_flow_kind: 're_buyer' },
    }),
  ).toBe('re_buyer');
});

it('does not treat agency_client-only meta as re_buyer', () => {
  expect(
    resolveLeadFlowKind({
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      channel: 'meta',
    }),
  ).toBe('spa_operational');
});
```

- [ ] **Step 2: FAIL** (`LeadFlowKind` chưa có `re_buyer`)

- [ ] **Step 3: Sửa util**

```ts
export type LeadFlowKind = 'spa_operational' | 'b2b_prospect' | 're_buyer';
// trong resolveLeadFlowKind, sau explicit spa/b2b:
if (explicit === 're_buyer' || explicit === 're-buyer' || explicit === 'bds') {
  return 're_buyer';
}
// nếu meta.re_project_id hoặc meta.bds_project_id truthy → re_buyer
```

`leadFlowKindLabel`: `re_buyer` → `'Khách mua BĐS'`.  
`statusOptionsForFlowKind('re_buyer')`: `moi`, `da_lien_he`, `hen_gap`, `hold`, `coc`, `lost` (P6 sẽ siết).  
`showPresalesForFlow` / `showContractForFlow`: **false** với `re_buyer`.

Backfill script (Python được, một file):

```python
# 1. INSERT bds_tenants (code=PTT-RE-LEGACY, mode=hybrid, operated_by_ptt=true, status=draft)
#    ON CONFLICT (code) DO NOTHING
# 2. UPDATE crm_re_projects SET tenant_id = that id WHERE tenant_id IS NULL
# 3. Print counts
```

Không bật PACK trên prod trong task này.

- [ ] **Step 4: Jest PASS** `lead-flow-kind.util.spec.ts` (toàn file cũ + 2 case mới)

- [ ] **Step 5: Chạy backfill trên staging PG** — in số dự án gán tenant

- [ ] **Step 6: Commit nếu được yêu cầu** `feat(bds): legacy tenant backfill and re_buyer kind`

---

## P0 Definition of Done

- [ ] `PTT_BDS_PACK=0` → POST `/api/v1/bds/tenants` **404** (BDS-01)
- [ ] `PTT_BDS_PACK=1` → POST tạo tenant `developer` + 12 phòng idempotent
- [ ] `activate` thiếu 5 vị trí → 400 `br_bds_34`
- [ ] `\d bds_tenants` và `crm_re_projects.tenant_id` trên PG
- [ ] `assertCountGate` + script đếm dự án (BDS-20 dự án; căn = P1)
- [ ] `re_buyer` chỉ khi explicit / `re_project_id` — không phá spa/B2B
- [ ] Jest: `src/bds/**/*.spec.ts` + `lead-flow-kind.util.spec.ts` xanh
- [ ] Không đổi hành vi `/api/crm/re-projects` khi PACK=0

---

## Sau P0

Viết plan **P1** và **P1b** (hai file). Không bắt đầu hold (P2).
