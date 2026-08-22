# P0 Triển khai — Tenant + PostgreSQL + Org seed

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa P0 lên staging: API tenant sau flag, 12 phòng CĐT, `tenant_id` trên dự án RE (PG), dual-write + cổng đếm (BDS-01, BDS-20) — không đổi UI `/crm/re-projects` khi PACK=0.

**Architecture:** `BdsModule` mới. `BdsPackGuard` (`CanActivate`) → 404 nếu `PTT_BDS_PACK≠1`. Tenant + cột RE trên PG `rnosaidb`. Seed phòng/vị trí idempotent qua `StaffOrgService` + SQL `crm_positions` (API **không** có create position). Dual-write chỉ khi `PTT_BDS_PG=1`, hook `ReProjectsService.createProject` / `updateProject`.

**Tech Stack:** NestJS `ptt-crm-api`, Jest, `pg` Pool, SQLite `re-projects-sqlite.repository.ts`, `psql`, Python 3 stdlib (`sqlite3` + `psycopg` hoặc `subprocess psql`).

**Spec:** [2026-08-21-bds-industry-pack-design.md](../specs/2026-08-21-bds-industry-pack-design.md) §6.1–6.2, §12, §15 P0, §25.2–25.7, BR-BDS-34.  
**Roadmap:** [2026-08-22-bds-coding-roadmap.md](./2026-08-22-bds-coding-roadmap.md)  
**TDD chi tiết cũ (gộp vào file này):** [2026-08-22-bds-p0-tenant-pg-org.md](./2026-08-22-bds-p0-tenant-pg-org.md)

## Global Constraints

- `PTT_BDS_PACK` mặc định `0` — POST `/api/v1/bds/tenants` = **404** (BDS-01).
- GET ngoài tenant = 404, không PII (BR-BDS-05).
- Không xóa `re-projects/`. Không đụng `crm_b2b_projects`.
- `StaffOrgService` **không** có `createPosition` — seed vị trí bằng SQL `INSERT … SELECT` khi `code` chưa có.
- `DATABASE_URL` script: `postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb`.
- Không commit trừ khi user yêu cầu.
- Test: `cd services/ptt-crm-api && npx jest <file> --runInBand -v`.
- Prod: **không** bật `PTT_BDS_PACK` trong P0.

---

## 0. Phạm vi / ngoài phạm vi

**Làm**

- Flag `PTT_BDS_PACK`, `PTT_BDS_PG`
- `bds_tenants` + POST/GET `/api/v1/bds/tenants`
- Seed 12 phòng + 18 vị trí + team đồng code; `activate` kiểm BR-34
- `crm_re_projects.tenant_id` (PG) + backfill `PTT-RE-LEGACY`
- Dual-write **dự án** SQLite → PG; cổng đếm **dự án** (căn = P1)
- `LeadFlowKind` + `re_buyer` (explicit / `re_project_id`) — không ép lead ads

**Không làm (P1+)**

- Hold, CSBH, TX, đại lý, collection, UI `/crm/bds`, chat, ticket
- Cột `tenant_id` trên `crm_re_project_products` (P1)
- Đổi đọc UI sang PG
- 5 user thật trên tenant (HR gán tay sau seed vị trí)

---

## 1. Điều kiện trước

| # | Việc | Cách kiểm |
|---|------|-----------|
| 1 | PG `rnosaidb` lên | `psql "$DATABASE_URL" -c 'SELECT 1'` |
| 2 | `crm_departments`, `crm_positions`, `staff_teams` đã có (staff-org) | `\d crm_departments` |
| 3 | SQLite RE có bảng `crm_re_projects` | repo `crm_re_projects.py` / `re-projects-sqlite` |
| 4 | Jest chạy được | `npx jest src/leads-funnel/lead-flow-kind.util.spec.ts --runInBand` xanh **trước** sửa |
| 5 | `StaffOrInternalKeyGuard` export từ `StaffAuthModule` | `staff-auth.module.ts` `exports` |

---

## 2. Lịch triển khai (4 ngày làm việc)

| Ngày | Task | Kết quả xem được |
|------|------|------------------|
| **N1** | 1–3 | Flag + pack + guard; Jest guard xanh |
| **N2** | 4–5 | DDL apply; POST tenant 404/201 |
| **N3** | 6–7 | 12 phòng seed; dual-write + gate đếm |
| **N4** | 8 + DoD | Backfill legacy; `re_buyer`; checklist P0; **không** bật PACK prod |

Hai tenant staging (spec chặn P1): (1) `PTT-RE-LEGACY` backfill, (2) tenant `developer` tạo mới qua API.

---

## 3. File map

```
docs/specs/postgresql-ddl-bds-p0.sql
scripts/apply_pg_ddl_bds_p0.sh
scripts/backfill_bds_legacy_tenant.py
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
services/ptt-crm-api/src/bds/tenant/bds-tenant.service.ts
services/ptt-crm-api/src/bds/tenant/bds-tenant.service.spec.ts
services/ptt-crm-api/src/bds/tenant/bds-tenant.controller.ts
services/ptt-crm-api/src/bds/org/bds-org-seed.ts
services/ptt-crm-api/src/bds/org/bds-org-seed.spec.ts
services/ptt-crm-api/src/bds/inventory/bds-dual-write.util.ts
services/ptt-crm-api/src/bds/inventory/bds-dual-write.util.spec.ts
services/ptt-crm-api/src/bds/inventory/bds-re-project-pg.repository.ts

services/ptt-crm-api/src/config/app-config.service.ts
services/ptt-crm-api/src/app.module.ts          # import BdsModule
services/ptt-crm-api/src/re-projects/re-projects.service.ts
services/ptt-crm-api/src/re-projects/re-projects.module.ts
services/ptt-crm-api/src/leads-funnel/lead-flow-kind.util.ts
services/ptt-crm-api/src/leads-funnel/lead-flow-kind.util.spec.ts
```

---

### Task 1: Flags

**Files:**
- Create: `services/ptt-crm-api/src/bds/bds.flags.ts`
- Create: `services/ptt-crm-api/src/bds/bds.flags.spec.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts` — thêm `bdsPackEnabled`, `bdsPgEnabled` cạnh các flag `contentMarketing*`

**Interfaces:**
- Consumes: `process.env.PTT_BDS_PACK`, `PTT_BDS_PG`
- Produces: `envFlagOn(raw?: string): boolean`, `isBdsPackEnabled(): boolean`, `isBdsPgEnabled(): boolean`

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

  it('envFlagOn is false for 0 and off', () => {
    expect(envFlagOn('0')).toBe(false);
    expect(envFlagOn('off')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/bds/bds.flags.spec.ts --runInBand -v`  
Expected: FAIL `Cannot find module './bds.flags'`

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

Trong `AppConfigService` (khai báo field + gán constructor, cùng kiểu dòng ~606):

```ts
readonly bdsPackEnabled: boolean;
readonly bdsPgEnabled: boolean;
// constructor:
this.bdsPackEnabled = ['1', 'true', 'yes', 'on'].includes(
  (process.env.PTT_BDS_PACK ?? '0').trim().toLowerCase(),
);
this.bdsPgEnabled = ['1', 'true', 'yes', 'on'].includes(
  (process.env.PTT_BDS_PG ?? '0').trim().toLowerCase(),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/bds/bds.flags.spec.ts --runInBand -v`  
Expected: PASS 3 tests

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu: `feat(bds): P0 flags PACK and PG`

---

### Task 2: IndustryPack `bds`

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

- [ ] **Step 2: Run — expect FAIL**

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
  if (tx.type === 'contracted') {
    return { kind: 'revenue', amountVnd: tx.amountVnd };
  }
  return { kind: 'pipeline', amountVnd: tx.amountVnd };
}
```

- [ ] **Step 4: Jest PASS** `src/bds/industry-pack.spec.ts`

- [ ] **Step 5: Commit nếu được yêu cầu** `feat(bds): IndustryPack contract`

---

### Task 3: Guard 404 — BDS-01

**Files:**
- Create: `services/ptt-crm-api/src/bds/guards/bds-pack.guard.ts`
- Create: `services/ptt-crm-api/src/bds/guards/bds-pack.guard.spec.ts`

**Interfaces:**
- Consumes: `isBdsPackEnabled()`
- Produces: `BdsPackGuard implements CanActivate`

- [ ] **Step 1: Write the failing test**

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
    expect(() => new BdsPackGuard().canActivate()).toThrow(NotFoundException);
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
import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isBdsPackEnabled } from '../bds.flags';

@Injectable()
export class BdsPackGuard implements CanActivate {
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

### Task 4: DDL + apply

**Files:**
- Create: `docs/specs/postgresql-ddl-bds-p0.sql`
- Create: `scripts/apply_pg_ddl_bds_p0.sh`

**Interfaces:**
- Produces: `bds_tenants`; `crm_re_projects` stub hoặc ALTER thêm `tenant_id`, `developer_org_name`, `legal_gate`, `one_price`, `hdmb_min_paid_pct`

- [ ] **Step 1: Write SQL**

```sql
-- Pack BĐS P0 — Apply: scripts/apply_pg_ddl_bds_p0.sh
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

CREATE TABLE IF NOT EXISTS bds_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CITEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('developer', 'broker', 'hybrid')),
  legal_name TEXT NOT NULL DEFAULT '',
  tax_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'suspended')),
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

Run: `psql "${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}" -c '\d bds_tenants'`  
Expected: cột `code`, `mode`, `status`

- [ ] **Step 5: Commit nếu được yêu cầu** `feat(bds): P0 DDL tenants and project tenant_id`

---

### Task 5: Tenant API + module

**Files:**
- Create: `services/ptt-crm-api/src/bds/tenant/bds-tenant.types.ts`
- Create: `services/ptt-crm-api/src/bds/tenant/bds-tenant.repository.ts`
- Create: `services/ptt-crm-api/src/bds/tenant/bds-tenant.service.ts`
- Create: `services/ptt-crm-api/src/bds/tenant/bds-tenant.service.spec.ts`
- Create: `services/ptt-crm-api/src/bds/tenant/bds-tenant.controller.ts`
- Create: `services/ptt-crm-api/src/bds/bds.module.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts` — `import { BdsModule } from './bds/bds.module'` và thêm `BdsModule` vào `imports` (sau `ReProjectsModule`)

**Interfaces:**
- Consumes: `AppConfigService.databaseUrl`, `BdsPackGuard`, `BdsOrgSeedService.seedForTenant(tenantId, mode)` (Task 6; P0 inject class rỗng `seedForTenant = async () => {}` rồi thay)
- Produces: `create`, `getMe`, `activate`, `BdsTenantRow`

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

- [ ] **Step 1: Write the failing service test**

```ts
import { BdsTenantService } from './bds-tenant.service';

describe('BdsTenantService', () => {
  it('rejects empty code', async () => {
    const repo = { insert: jest.fn(), setStatus: jest.fn() };
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
    const repo = { insert: jest.fn().mockResolvedValue(row), setStatus: jest.fn() };
    const seed = { seedForTenant: jest.fn().mockResolvedValue(undefined) };
    const svc = new BdsTenantService(repo as never, seed as never);
    await svc.create({ code: 'acme', name: 'ACME', mode: 'developer' });
    expect(seed.seedForTenant).toHaveBeenCalledWith(row.id, 'developer');
  });

  it('activate without required positions returns 400 br_bds_34', async () => {
    const repo = { insert: jest.fn(), setStatus: jest.fn() };
    const seed = { seedForTenant: jest.fn() };
    const svc = new BdsTenantService(repo as never, seed as never);
    await expect(svc.activate('tid', ['gdkd'])).rejects.toMatchObject({
      response: { error: 'br_bds_34' },
    });
    expect(repo.setStatus).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement repository + service + controller + module**

Repository (`Pool` như `vd-job.repository.ts`): `insert`, `getById`, `getByCode`, `setStatus`.

Service: `BadRequestException` nếu `code` trim rỗng hoặc `mode` không thuộc 3 giá trị; `create` → insert `draft` → `seedForTenant`; `getMe` thiếu/không thấy id → `NotFoundException`; `activate` dùng `missingRequiredPositions`.

Controller:

```ts
import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsTenantService } from './bds-tenant.service';
import type { CreateBdsTenantBody } from './bds-tenant.types';

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

  @Post(':id/activate')
  activate(
    @Param('id') id: string,
    @Body() body: { assigned_position_codes: string[] },
  ) {
    return this.tenants.activate(id, body.assigned_position_codes ?? []);
  }
}
```

`BdsModule`:

```ts
import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffOrgModule } from '../staff-org/staff-org.module';
import { BdsPackGuard } from './guards/bds-pack.guard';
import { BdsOrgSeedService } from './org/bds-org-seed';
import { BdsTenantController } from './tenant/bds-tenant.controller';
import { BdsTenantRepository } from './tenant/bds-tenant.repository';
import { BdsTenantService } from './tenant/bds-tenant.service';

@Module({
  imports: [StaffAuthModule, StaffOrgModule],
  controllers: [BdsTenantController],
  providers: [BdsPackGuard, BdsTenantRepository, BdsTenantService, BdsOrgSeedService],
  exports: [BdsTenantService],
})
export class BdsModule {}
```

Task 5 có thể tạo `BdsOrgSeedService` stub (`seedForTenant` no-op) nếu Task 6 chưa làm — Task 6 thay thân hàm.

- [ ] **Step 4: Jest PASS** `bds-tenant.service.spec.ts`

- [ ] **Step 5: Manual BDS-01** (API đã boot, PACK=0)

```bash
curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3000/api/v1/bds/tenants \
  -H 'Content-Type: application/json' \
  -d '{"code":"x","name":"X","mode":"developer"}'
```

Expected: `404`

- [ ] **Step 6: Commit nếu được yêu cầu** `feat(bds): tenant create API behind pack guard`

---

### Task 6: Org seed §25 + BR-34

**Files:**
- Create: `services/ptt-crm-api/src/bds/org/bds-org-seed.ts`
- Create: `services/ptt-crm-api/src/bds/org/bds-org-seed.spec.ts`

**Interfaces:**
- Consumes: `StaffOrgService.createDepartment`, `createTeam`, `listDepartments`; SQL `crm_positions` (không có createPosition)
- Produces: `BDS_DEPARTMENT_SEEDS` (12), `BDS_POSITION_SEEDS` (18), `REQUIRED_POSITION_CODES`, `missingRequiredPositions`, `seedForTenant(tenantId, mode)`

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

export const BDS_POSITION_SEEDS = [
  { code: 'tgd', name: 'Tổng giám đốc', department_code: 'ban_tgd' },
  { code: 'gdkd', name: 'Giám đốc khối KD', department_code: 'ban_kd' },
  { code: 'pm_du_an', name: 'Giám đốc / PM dự án', department_code: 'ban_du_an' },
  { code: 'truong_sp', name: 'Trưởng sản phẩm', department_code: 'ban_san_pham' },
  { code: 'cv_gia', name: 'Chuyên viên bảng giá', department_code: 'ban_san_pham' },
  { code: 'truong_inhouse', name: 'Trưởng gallery / Inhouse', department_code: 'ban_kd' },
  { code: 'tvv_inhouse', name: 'TVV tự doanh', department_code: 'ban_kd' },
  { code: 'truong_kenh', name: 'Trưởng ban kênh', department_code: 'ban_kenh' },
  { code: 'am_kenh', name: 'AM đại lý', department_code: 'ban_kenh' },
  { code: 'cskh_lead', name: 'CSKH trước bán', department_code: 'ban_cskh_presales' },
  { code: 'truong_mkt', name: 'Trưởng MKT', department_code: 'ban_mkt' },
  { code: 'truong_pc', name: 'Trưởng pháp chế', department_code: 'ban_phap_che' },
  { code: 'cv_hd', name: 'CV hợp đồng', department_code: 'ban_phap_che' },
  { code: 'truong_collection', name: 'Trưởng công nợ', department_code: 'ban_tc_collection' },
  { code: 'cv_hh', name: 'CV hoa hồng', department_code: 'ban_tc_hh' },
  { code: 'truong_after', name: 'Trưởng CSKH sau bán', department_code: 'ban_cskh_after' },
  { code: 'cv_ban_giao', name: 'CV bàn giao', department_code: 'ban_cskh_after' },
  { code: 'hr_bp', name: 'HR BP', department_code: 'ban_hr' },
] as const;

export const REQUIRED_POSITION_CODES = [
  'pm_du_an',
  'gdkd',
  'truong_pc',
  'truong_collection',
  'truong_sp',
] as const;

export function missingRequiredPositions(assigned: string[]): string[] {
  const have = new Set(assigned);
  return REQUIRED_POSITION_CODES.filter((c) => !have.has(c));
}
```

`seedForTenant`:

1. Nếu `mode === 'broker'` → return (không seed 12 phòng CĐT).
2. `listDepartments()`; với mỗi seed: nếu chưa có `code` → `createDepartment({ code, name }, 'bds-org-seed')`.
3. `createTeam({ code, name, department_id }, 'bds-org-seed')` nếu team code chưa có.
4. Position SQL (Pool của StaffOrg hoặc inject `AppConfigService.databaseUrl`):

```sql
INSERT INTO crm_positions (code, name, department_id, parent_id, active, updated_at)
SELECT $1, $2, d.id, NULL, TRUE, NOW()
FROM crm_departments d
WHERE d.code = $3
  AND NOT EXISTS (SELECT 1 FROM crm_positions p WHERE p.code = $1)
```

Actor email seed: `bds-org-seed`. Idempotent: chạy 2 lần không nhân bản.

- [ ] **Step 1: Write the failing test**

```ts
import {
  BDS_DEPARTMENT_SEEDS,
  BDS_POSITION_SEEDS,
  missingRequiredPositions,
} from './bds-org-seed';

describe('bds-org-seed', () => {
  it('seeds 12 departments and 18 positions', () => {
    expect(BDS_DEPARTMENT_SEEDS).toHaveLength(12);
    expect(BDS_POSITION_SEEDS).toHaveLength(18);
  });

  it('BR-34 lists five required positions', () => {
    expect(missingRequiredPositions(['pm_du_an', 'gdkd'])).toEqual([
      'truong_pc',
      'truong_collection',
      'truong_sp',
    ]);
    expect(
      missingRequiredPositions([
        'pm_du_an',
        'gdkd',
        'truong_pc',
        'truong_collection',
        'truong_sp',
      ]),
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: FAIL then implement constants**

- [ ] **Step 3: Implement `BdsOrgSeedService` + nối Task 5**

- [ ] **Step 4: Jest PASS** `bds-org-seed.spec.ts` + `bds-tenant.service.spec.ts`

- [ ] **Step 5: Commit nếu được yêu cầu** `feat(bds): org seed 12 departments and BR-34`

---

### Task 7: Dual-write dự án + cổng BDS-20

**Files:**
- Create: `services/ptt-crm-api/src/bds/inventory/bds-dual-write.util.ts`
- Create: `services/ptt-crm-api/src/bds/inventory/bds-dual-write.util.spec.ts`
- Create: `services/ptt-crm-api/src/bds/inventory/bds-re-project-pg.repository.ts`
- Create: `scripts/bds_count_gate.py`
- Modify: `services/ptt-crm-api/src/re-projects/re-projects.service.ts` — sau `sqlite.createProject` / `updateProject`
- Modify: `services/ptt-crm-api/src/re-projects/re-projects.module.ts` — import `BdsModule` hoặc cung cấp `BdsReProjectPgRepository` (tránh vòng: repository PG **không** import `ReProjectsModule`; `ReProjectsModule` import provider mỏng)

**Interfaces:**
- Consumes: `isBdsPgEnabled()`, `AppConfigService.databaseUrl`
- Produces: `shouldDualWrite()`, `assertCountGate(sqliteCount, pgCount)`, `upsertProject(row)`

Tránh circular: `BdsReProjectPgRepository` sống trong `bds/`; `ReProjectsService` optional inject (`@Optional()`). Nếu circular: gọi `upsert` qua dynamic `ModuleRef` hoặc hàm thuần + Pool trong repository, service RE `new BdsReProjectPgRepository(config)` trong method — chấp nhận P0: inject `@Optional() pgRepo: BdsReProjectPgRepository | null`.

`createProject` hiện tại (`re-projects.service.ts` ~51–53):

```ts
createProject(body: CreateReProjectBody) {
  try {
    return this.sqlite.createProject(body);
```

Đổi thành: `const row = this.sqlite.createProject(body);` rồi nếu `shouldDualWrite()` thì `await this.pgRepo.upsertFromSqlite(row)` (nếu create đồng bộ, fire-and-forget không được — phải `await` hoặc chuyển `createProject` thành `async`; **P0: đổi `createProject` thành async** và controller Nest chấp nhận Promise).

- [ ] **Step 1: Write the failing test**

```ts
import { assertCountGate, shouldDualWrite } from './bds-dual-write.util';

describe('bds-dual-write', () => {
  const prev = process.env.PTT_BDS_PG;
  afterEach(() => {
    process.env.PTT_BDS_PG = prev;
  });

  it('shouldDualWrite follows PTT_BDS_PG', () => {
    process.env.PTT_BDS_PG = '0';
    expect(shouldDualWrite()).toBe(false);
    process.env.PTT_BDS_PG = '1';
    expect(shouldDualWrite()).toBe(true);
  });

  it('assertCountGate throws when counts differ (BDS-20)', () => {
    expect(() => assertCountGate(10, 9)).toThrow(/BDS-20/);
  });

  it('assertCountGate passes when equal', () => {
    expect(() => assertCountGate(3, 3)).not.toThrow();
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement util + PG upsert + hook + script**

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

`upsertFromSqlite` SQL:

```sql
INSERT INTO crm_re_projects (id, code, name, status, developer_name, tenant_id, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, NOW())
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  developer_name = EXCLUDED.developer_name,
  updated_at = NOW();
```

`$6` = `process.env.PTT_BDS_LEGACY_TENANT_ID` hoặc id tenant `PTT-RE-LEGACY` cache (backfill Task 8 phải chạy trước dual-write trên data cũ).

`scripts/bds_count_gate.py` (P0 đếm **dự án**):

```python
#!/usr/bin/env python3
import os, sqlite3, subprocess, sys

SQLITE = os.environ.get("PTT_SQLITE_PATH", "ptt.db")
DSN = os.environ.get("DATABASE_URL", "postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb")

def sqlite_count() -> int:
    con = sqlite3.connect(SQLITE)
    n = con.execute("SELECT COUNT(*) FROM crm_re_projects").fetchone()[0]
    con.close()
    return int(n)

def pg_count() -> int:
    out = subprocess.check_output(
        ["psql", DSN, "-tA", "-c", "SELECT COUNT(*) FROM crm_re_projects"],
        text=True,
    )
    return int(out.strip())

def main() -> int:
    s, p = sqlite_count(), pg_count()
    print(f"sqlite={s} pg={p}")
    if s != p:
        print("BDS-20 count mismatch", file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Jest PASS** `bds-dual-write.util.spec.ts`

- [ ] **Step 5: `python3 scripts/bds_count_gate.py`** — sau backfill Task 8 phải exit 0. Trước backfill có thể lệch: **chạy gate sau Task 8**.

- [ ] **Step 6: Commit nếu được yêu cầu** `feat(bds): project dual-write and BDS-20 gate`

---

### Task 8: Backfill `PTT-RE-LEGACY` + `re_buyer`

**Files:**
- Create: `scripts/backfill_bds_legacy_tenant.py`
- Modify: `services/ptt-crm-api/src/leads-funnel/lead-flow-kind.util.ts`
- Modify: `services/ptt-crm-api/src/leads-funnel/lead-flow-kind.util.spec.ts`

**Interfaces:**
- Produces: tenant `code=PTT-RE-LEGACY`, `mode=hybrid`, `operated_by_ptt=true`, `status=draft`; `UPDATE crm_re_projects SET tenant_id=… WHERE tenant_id IS NULL`. `LeadFlowKind` gồm `re_buyer`.

- [ ] **Step 1: Write the failing lead-flow tests** (thêm vào file spec hiện có)

```ts
  it('classifies explicit re_buyer', () => {
    expect(
      resolveLeadFlowKind({
        metaJson: { lead_flow_kind: 're_buyer' },
      }),
    ).toBe('re_buyer');
  });

  it('classifies re_project_id as re_buyer', () => {
    expect(
      resolveLeadFlowKind({
        metaJson: { re_project_id: 12 },
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

- [ ] **Step 2: Run existing spec — 2 test mới FAIL**

- [ ] **Step 3: Sửa `lead-flow-kind.util.ts`**

```ts
export type LeadFlowKind = 'spa_operational' | 'b2b_prospect' | 're_buyer';
```

Trong `resolveLeadFlowKind`, **sau** parse meta, **trước** spa/b2b explicit:

```ts
  if (explicit === 're_buyer' || explicit === 're-buyer' || explicit === 'bds') {
    return 're_buyer';
  }
  if (meta.re_project_id != null && String(meta.re_project_id).trim() !== '') {
    return 're_buyer';
  }
```

```ts
export function leadFlowKindLabel(kind: LeadFlowKind): string {
  if (kind === 're_buyer') return 'Khách mua BĐS';
  return kind === 'spa_operational' ? 'CSKH vận hành' : 'B2B Sales';
}

const RE_BUYER_STATUSES = [
  'moi',
  'da_lien_he',
  'hen_gap',
  'hold',
  'coc',
  'lost',
  'pending_cleanup',
] as const;

export function statusOptionsForFlowKind(kind: LeadFlowKind): readonly string[] {
  if (kind === 're_buyer') return RE_BUYER_STATUSES;
  return kind === 'spa_operational' ? SPA_OPERATIONAL_STATUSES : B2B_PROSPECT_STATUSES;
}

export function showPresalesForFlow(kind: LeadFlowKind): boolean {
  return kind === 'b2b_prospect';
}

export function showContractForFlow(kind: LeadFlowKind): boolean {
  return kind === 'b2b_prospect';
}
```

`scripts/backfill_bds_legacy_tenant.py`:

```python
#!/usr/bin/env python3
import os, subprocess

DSN = os.environ.get("DATABASE_URL", "postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb")

SQL = """
INSERT INTO bds_tenants (code, name, mode, status, operated_by_ptt)
VALUES ('PTT-RE-LEGACY', 'PTT RE Legacy', 'hybrid', 'draft', TRUE)
ON CONFLICT (code) DO NOTHING;

UPDATE crm_re_projects p
SET tenant_id = t.id
FROM bds_tenants t
WHERE t.code = 'PTT-RE-LEGACY'
  AND p.tenant_id IS NULL;

SELECT t.id, t.code,
       (SELECT COUNT(*) FROM crm_re_projects x WHERE x.tenant_id = t.id) AS projects
FROM bds_tenants t WHERE t.code = 'PTT-RE-LEGACY';
"""

print(subprocess.check_output(["psql", DSN, "-v", "ON_ERROR_STOP=1", "-c", SQL], text=True))
```

- [ ] **Step 4: Jest PASS** toàn `lead-flow-kind.util.spec.ts`

- [ ] **Step 5: Chạy backfill rồi gate**

```bash
python3 scripts/backfill_bds_legacy_tenant.py
PTT_SQLITE_PATH=/path/to/ptt.db python3 scripts/bds_count_gate.py
```

Expected: in `id` + `projects`; gate exit 0 (sau khi dual-write hết dự án SQLite lên PG — nếu PG mới tạo trống, **mirror một lần**: script thêm `INSERT` từ SQLite sang PG trong cùng file backfill, hoặc chạy dual-write batch).

Batch mirror (thêm cuối backfill): đọc SQLite `SELECT id, code, name, status, developer_name FROM crm_re_projects` và `INSERT … ON CONFLICT` từng dòng vào PG với `tenant_id` legacy. P0 **bắt buộc** batch này nếu gate đếm dự án.

- [ ] **Step 6: Commit nếu được yêu cầu** `feat(bds): legacy tenant backfill and re_buyer kind`

---

## 5. Runbook staging (N4)

```bash
# 1. DDL
./scripts/apply_pg_ddl_bds_p0.sh

# 2. Jest
cd services/ptt-crm-api && npx jest src/bds --runInBand && \
  npx jest src/leads-funnel/lead-flow-kind.util.spec.ts --runInBand

# 3. API PACK=0
# restart ptt-crm-api với PTT_BDS_PACK=0
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/api/v1/bds/tenants" \
  -H 'Content-Type: application/json' -d '{"code":"x","name":"X","mode":"developer"}'
# → 404

# 4. Chỉ staging: PACK=1 + internal key
export PTT_BDS_PACK=1 PTT_BDS_PG=1
# restart
curl -s -X POST "$API/api/v1/bds/tenants" \
  -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"code":"cdt-demo","name":"CĐT Demo","mode":"developer","operated_by_ptt":true}'
# → 201, 12 phòng

curl -s -X POST "$API/api/v1/bds/tenants/$ID/activate" \
  -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"assigned_position_codes":["gdkd"]}'
# → 400 br_bds_34

# 5. Backfill + gate
python3 scripts/backfill_bds_legacy_tenant.py
python3 scripts/bds_count_gate.py

# 6. Hồi quy RE cũ
curl -s -o /dev/null -w '%{http_code}\n' "$API/api/crm/re-projects"
# → 200 (PACK=0 hoặc 1 đều không 404 list cũ)
```

**Prod P0:** chỉ merge code + DDL apply **nếu** team chấp nhận bảng trống. Giữ `PTT_BDS_PACK=0`. Không backfill prod cho đến khi BDS-20 staging xanh 2 tenant.

---

## 6. Rollback

| Tình huống | Cách |
|------------|------|
| API lỗi | `PTT_BDS_PACK=0` — `/api/v1/bds/*` 404 |
| Dual-write lỗi | `PTT_BDS_PG=0` — hết ghi PG; SQLite là nguồn UI |
| DDL lỡ | Không DROP `bds_tenants` trên prod nếu đã có tenant; staging được DROP CASCADE |
| `re_buyer` phá board lead | Revert `lead-flow-kind.util.ts`; spa/B2B test phải xanh |

---

## 7. Definition of Done P0

- [ ] Jest `src/bds/**/*.spec.ts` + `lead-flow-kind.util.spec.ts` xanh
- [ ] BDS-01: PACK=0 → POST tenants **404**
- [ ] PACK=1 staging: tạo tenant `developer` → 12 `crm_departments` code `ban_*`
- [ ] `activate` thiếu 5 vị trí → 400 `br_bds_34`
- [ ] Tenant `PTT-RE-LEGACY` + mọi `crm_re_projects.tenant_id` PG not null
- [ ] `bds_count_gate.py` exit 0 (đếm dự án)
- [ ] GET `/api/crm/re-projects` hành vi cũ khi PACK=0
- [ ] Prod không bật PACK
- [ ] Không hold / UI `/crm/bds`

---

## 8. Rủi ro

| Rủi ro | Xử lý |
|--------|--------|
| `crm_re_projects` đã tồn tại trên PG schema khác | Chỉ `ADD COLUMN IF NOT EXISTS` — không `CREATE` đè |
| `crm_departments.code` trùng tên cũ PTT | Seed `SELECT` trước insert; không rename phòng PTT |
| Circular `BdsModule` ↔ `ReProjectsModule` | PG repo không import RE module |
| Gate lệch vì SQLite local ≠ PG staging | Truyền đúng `PTT_SQLITE_PATH` cùng máy backfill |

---

## Sau P0 xanh

Viết plan **P1** (inventory) và **P1b** (Project OS). Không P2 hold.
