# P5 Triển khai — Agency OS (đại lý / hạng / giỏ / cổng hold)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mạng đại lý trên PG: sàn hold căn ngoài giỏ / pool `inhouse` → **404** (BDS-04, BDS-35); F2 hold căn không có trong giỏ cha → **404** (BDS-34); agency `suspended` → 409 `{ error: 'agency_suspended' }` (BDS-28); hết quota hạng → 409 `{ error: 'hold_quota' }` (BDS-23); hai exclusive cùng căn → 400 `{ error: 'exclusive' }` (BDS-26); Đồng không được gán exclusive → 400 `{ error: 'exclusive_tier' }` (BDS-22); sàn gửi `net_price_vnd` ≠ CSBH → 400 `{ error: 'one_price' }` (BDS-33).

**Architecture:** Bounded context `src/bds/agencies/` (`BdsAgencyService` = spec §5 / §20). HTTP `/api/v1/bds` sau `StaffOrInternalKeyGuard` + `BdsPackGuard` + `BdsAgencyGuard` (`PTT_BDS_PACK=1` **và** `PTT_BDS_AGENCY=1`). Cổng hold: `BdsHoldService.create` gọi `agency.assertCanHold` **chỉ khi** `PTT_BDS_AGENCY=1` và `channel_partner_id` không rỗng — AGENCY=0 giữ hành vi P2 (BDS-05 pending, không giỏ). `channel_partner_id` = UUID `bds_agencies.id`. Tenant stamp từ project, không từ body. Không import `ReProjectsModule`. Không scheme HH, không UI.

**Tech Stack:** NestJS `ptt-crm-api`, Jest local binary, `pg` Pool, `psql`.

**Spec:** [2026-08-21-bds-industry-pack-design.md](../specs/2026-08-21-bds-industry-pack-design.md) §10.4, §15 P5, §20.1–20.3, BR-BDS-08/11/23/24/26/28/29.  
**UC:** 014 cổng hold (không chat/ticket) · 025 onboard rút · 026 giỏ `units` · 027 override hạng · 028 one_price · 060 `GET /me/basket`.  
**P2:** [2026-08-22-bds-p2-hold-ttl.md](./2026-08-22-bds-p2-hold-ttl.md)  
**P3:** [2026-08-22-bds-p3-csbh.md](./2026-08-22-bds-p3-csbh.md)  
**P4:** [2026-08-22-bds-p4-transaction.md](./2026-08-22-bds-p4-transaction.md)  
**Roadmap:** [2026-08-22-bds-coding-roadmap.md](./2026-08-22-bds-coding-roadmap.md)

**Test ID P5:** BDS-04, BDS-22, BDS-23, BDS-26, BDS-28, BDS-33, BDS-34, BDS-35.  
**BDS-05** đã xanh P2 — P5 **không** đổi khi AGENCY=0.  
**BDS-08 / 17 / 18** = **P6** (lead / RBAC).  
**BDS-19** empty `GET /api/crm/re-projects` + nav sàn = **P8**. P5 chỉ `GET /me/basket`.  
**BDS-24** recalc điểm + % scheme = **P7**. P5 override tay (BDS-25) **có**.  
**BDS-15** = cùng BDS-26 (gán exclusive đụng).  
**BDS-09** ẩn `net_price` CTV = **P8**.  
**Hoa hồng scheme / ledger / statement** = **P7**.  
**Chat card / ticket `hold_f1_approve`** = **P11/P12**.

## Global Constraints

- `PTT_BDS_PACK` mặc định `0` — mọi `POST /api/v1/bds/*` = **404**.
- `PTT_BDS_AGENCY` mặc định `0` — route agency = **404** dù PACK=1. Hold **không** check giỏ khi flag tắt (an toàn prod, giống POLICY / TX).
- Ngoài giỏ / inhouse / F2 ngoài giỏ cha → **404 rỗng** (không 403, không PII, BR-BDS-05). Spec §10.3 ghi 403 — **khóa 404** theo BDS-04.
- GET ngoài tenant = 404. Optional `x-bds-tenant` giống inventory. Header `x-bds-agency` = UUID đại lý đang xem giỏ (P5 chưa có `org_kind=broker` login).
- Không xóa `re-projects/`. Không đụng `crm_b2b_projects`. Không tạo `bds_commission_*` / `bds_receipts` / `bds_agency_tier_scores` / `bds_agency_quotas` / `bds_agency_trainings`.
- Một căn `exclusivity=exclusive` và `revoked_at IS NULL` tối đa một đại lý — unique partial (BR-BDS-08).
- Agency không `active` (kể `probation` / `suspended`) → không hold mới; giỏ **đọc** được (BR-BDS-23).
- Thiếu HĐ `active` trên dự án → 400 `{ error: 'contract' }` khi gán giỏ hoặc hold.
- `one_price` + client gửi `net_price_vnd` lệch CSBH → 400 `{ error: 'one_price' }` — reuse `assertOnePrice` (BR-BDS-26).
- F2 chỉ hold căn còn trong giỏ **cha** (`parent_agency_id`) chưa revoke (BR-BDS-29).
- `pool=inhouse` → F1/F2 không thấy / không hold (BR-BDS-28).
- Rule P5 **chỉ** `scope_type=units` (gán tay). Materialize zone/tower/phase = **P5b**.
- Override hạng: `cdt_sales_dir` + `reason` trim ≥ 10 ký tự (BDS-25). Không cron recalc.
- Activate agency: `cdt_channel`. Gán exclusive: `cdt_sales_dir`.
- `BdsModule` **không** import `ReProjectsModule`.
- Folder `agencies/` — **không** nhét agency vào `hold/` ngoài 1 inject `@Optional() BdsAgencyService`.
- `DATABASE_URL` script: `postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb`.
- Test: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand` (không `npx jest`).
- Không commit trừ khi user yêu cầu.
- Prod VPS: **không** bật `PTT_BDS_PACK` / `PTT_BDS_AGENCY`. Không đụng `ngoinhahomnay.vn` / :3000.

---

## 0. Phạm vi / ngoài phạm vi

**Làm**

- Flag `isBdsAgencyEnabled()` + `BdsAgencyGuard`
- DDL agencies / contracts / tier_defs / basket_rules / basket_units
- Seed 5 hạng (`trial`…`strategic`)
- Onboard rút: create `prospect` → activate `active` + `trial`
- HĐ phân phối `active` trên project
- Cấp / gỡ giỏ `units` (exclusive / shared)
- Override hạng tay (BDS-25)
- `assertCanHold` + hook P2 hold
- GET `/me/basket`, GET `/units/:id` lọc agency
- Quote agency one_price (BDS-33)

**Không làm**

- `bds_commission_schemes` / ledger / statement (P7, BDS-24/27)
- Recalc điểm kỳ / quota table / training (P7)
- Materialize rule `zone`/`tower`/`phase` (P5b)
- Empty `GET /api/crm/re-projects` (P8, BDS-19)
- Ẩn Deal Room / nav sàn / ẩn `net_price` CTV (P8, BDS-09)
- Lead dedup SĐT (P6, BDS-08)
- Chat/ticket duyệt hold F1 (P11/P12)
- `linked_broker_tenant_id` isolation SaaS
- UI ops-web `/crm/bds/agencies`

---

## 1. File map

```
docs/specs/postgresql-ddl-bds-p5.sql
scripts/apply_pg_ddl_bds_p5.sh

services/ptt-crm-api/src/bds/bds.flags.ts                         # + isBdsAgencyEnabled
services/ptt-crm-api/src/bds/bds.flags.spec.ts
services/ptt-crm-api/src/config/app-config.service.ts             # bdsAgencyEnabled
services/ptt-crm-api/src/bds/guards/bds-agency.guard.ts
services/ptt-crm-api/src/bds/guards/bds-agency.guard.spec.ts
services/ptt-crm-api/src/bds/agencies/bds-agency.types.ts
services/ptt-crm-api/src/bds/agencies/bds-agency.util.ts
services/ptt-crm-api/src/bds/agencies/bds-agency.util.spec.ts
services/ptt-crm-api/src/bds/agencies/bds-agency.repository.ts
services/ptt-crm-api/src/bds/agencies/bds-agency.service.ts
services/ptt-crm-api/src/bds/agencies/bds-agency.service.spec.ts
services/ptt-crm-api/src/bds/agencies/bds-agency.controller.ts
services/ptt-crm-api/src/bds/agencies/bds-agency.controller.spec.ts
services/ptt-crm-api/src/bds/hold/bds-hold.service.ts              # Optional agency.assertCanHold
services/ptt-crm-api/src/bds/hold/bds-hold.service.spec.ts        # AGENCY=1 gates
services/ptt-crm-api/src/bds/inventory/bds-inventory.controller.ts # GET units/:id + x-bds-agency
services/ptt-crm-api/src/bds/bds.module.ts
docs/superpowers/plans/2026-08-22-bds-coding-roadmap.md           # hàng P5
```

Không sửa DDL P0–P4. Không đổi transition máy căn. Hold P2 khi AGENCY=0 **nguyên**.

---

### Task 1: Flag AGENCY + util cổng

**Files:**
- Modify: `services/ptt-crm-api/src/bds/bds.flags.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.flags.spec.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts` — `bdsAgencyEnabled` cạnh `bdsTxEnabled`
- Create: `services/ptt-crm-api/src/bds/guards/bds-agency.guard.ts`
- Create: `services/ptt-crm-api/src/bds/guards/bds-agency.guard.spec.ts`
- Create: `services/ptt-crm-api/src/bds/agencies/bds-agency.types.ts`
- Create: `services/ptt-crm-api/src/bds/agencies/bds-agency.util.ts`
- Create: `services/ptt-crm-api/src/bds/agencies/bds-agency.util.spec.ts`

**Interfaces:**
- Produces: `isBdsAgencyEnabled(): boolean`
- Produces: `BdsAgencyGuard` → 404 unless PACK **và** AGENCY
- Produces: `canActivateAgency(actorRole): boolean` — `'cdt_channel'`
- Produces: `canOverrideTier(actorRole): boolean` — `'cdt_sales_dir'`
- Produces: `canGrantExclusive(actorRole): boolean` — `'cdt_sales_dir'`
- Produces: `canHoldAgencyStatus(status): boolean` — chỉ `'active'`
- Produces: `assertExclusiveAllowed(exclusiveAllowed, exclusivity): void` — exclusive + !allowed → `{ error: 'exclusive_tier' }`
- Produces: `assertHoldQuota(openCount, maxConcurrent): void` — `openCount >= max` → `{ error: 'hold_quota' }`
- Produces: `isInhousePool(pool): boolean`
- Produces: `parentKindAllowsF2(parentKind): boolean` — `f1` hoặc `tong_dai_ly`

`AppConfigService`: `bdsAgencyEnabled` cùng kiểu `bdsTxEnabled` (`PTT_BDS_AGENCY ?? '0'`).

- [ ] **Step 1: Flags + util spec (RED)**

```ts
// bds.flags.spec.ts — restore PTT_BDS_AGENCY in afterEach
it('defaults AGENCY off when unset', () => {
  delete process.env.PTT_BDS_AGENCY;
  expect(isBdsAgencyEnabled()).toBe(false);
});

it('AGENCY on for 1', () => {
  process.env.PTT_BDS_AGENCY = '1';
  expect(isBdsAgencyEnabled()).toBe(true);
});
```

```ts
// bds-agency.guard.spec.ts
describe('BdsAgencyGuard', () => {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevAgency = process.env.PTT_BDS_AGENCY;
  afterEach(() => {
    if (prevPack === undefined) delete process.env.PTT_BDS_PACK;
    else process.env.PTT_BDS_PACK = prevPack;
    if (prevAgency === undefined) delete process.env.PTT_BDS_AGENCY;
    else process.env.PTT_BDS_AGENCY = prevAgency;
  });

  it('404 when PACK off', () => {
    process.env.PTT_BDS_PACK = '0';
    process.env.PTT_BDS_AGENCY = '1';
    expect(() => new BdsAgencyGuard().canActivate()).toThrow(NotFoundException);
  });

  it('404 when AGENCY off', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_AGENCY = '0';
    expect(() => new BdsAgencyGuard().canActivate()).toThrow(NotFoundException);
  });

  it('allows when PACK and AGENCY on', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_AGENCY = '1';
    expect(new BdsAgencyGuard().canActivate()).toBe(true);
  });
});
```

```ts
// bds-agency.util.spec.ts
it('only cdt_channel activates agency', () => {
  expect(canActivateAgency('cdt_channel')).toBe(true);
  expect(canActivateAgency('cdt_sales_dir')).toBe(false);
});

it('BDS-22 exclusive not allowed throws exclusive_tier', () => {
  expect(() => assertExclusiveAllowed(false, 'exclusive')).toThrow(
    expect.objectContaining({ error: 'exclusive_tier' }),
  );
  expect(() => assertExclusiveAllowed(false, 'shared')).not.toThrow();
  expect(() => assertExclusiveAllowed(true, 'exclusive')).not.toThrow();
});

it('BDS-23 quota at max throws hold_quota', () => {
  expect(() => assertHoldQuota(3, 3)).toThrow(
    expect.objectContaining({ error: 'hold_quota' }),
  );
  expect(() => assertHoldQuota(2, 3)).not.toThrow();
});

it('only active can hold', () => {
  expect(canHoldAgencyStatus('active')).toBe(true);
  expect(canHoldAgencyStatus('suspended')).toBe(false);
  expect(canHoldAgencyStatus('probation')).toBe(false);
});

it('inhouse pool detect', () => {
  expect(isInhousePool('inhouse')).toBe(true);
  expect(isInhousePool('channel')).toBe(false);
});

it('F2 parent kinds', () => {
  expect(parentKindAllowsF2('f1')).toBe(true);
  expect(parentKindAllowsF2('tong_dai_ly')).toBe(true);
  expect(parentKindAllowsF2('f2')).toBe(false);
});
```

Implement:

```ts
// bds-agency.types.ts
export type AgencyKind =
  | 'inhouse'
  | 'tong_dai_ly'
  | 'f1'
  | 'f2'
  | 'alliance'
  | 'ctv_network';

export type AgencyStatus =
  | 'prospect'
  | 'onboarding'
  | 'active'
  | 'probation'
  | 'suspended'
  | 'terminated';

export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated';
export type BasketExclusivity = 'exclusive' | 'shared';
export type RevokeReason = 'rank_drop' | 'manual' | 'phase_close' | 'contract_end';

export const TIER_SEED: ReadonlyArray<{
  code: string;
  name: string;
  min_score: number;
  max_concurrent_holds: number;
  exclusive_allowed: boolean;
  ttl_multiplier: number;
}> = [
  { code: 'trial', name: 'Thử nghiệm', min_score: 0, max_concurrent_holds: 3, exclusive_allowed: false, ttl_multiplier: 1 },
  { code: 'bronze', name: 'Đồng', min_score: 20, max_concurrent_holds: 8, exclusive_allowed: false, ttl_multiplier: 1 },
  { code: 'silver', name: 'Bạc', min_score: 45, max_concurrent_holds: 20, exclusive_allowed: false, ttl_multiplier: 1.5 },
  { code: 'gold', name: 'Vàng', min_score: 70, max_concurrent_holds: 50, exclusive_allowed: true, ttl_multiplier: 2 },
  { code: 'strategic', name: 'Chiến lược', min_score: 90, max_concurrent_holds: 200, exclusive_allowed: true, ttl_multiplier: 3 },
];
```

```ts
// bds-agency.util.ts
export function canActivateAgency(actorRole: string): boolean {
  return String(actorRole ?? '').trim() === 'cdt_channel';
}

export function canOverrideTier(actorRole: string): boolean {
  return String(actorRole ?? '').trim() === 'cdt_sales_dir';
}

export function canGrantExclusive(actorRole: string): boolean {
  return String(actorRole ?? '').trim() === 'cdt_sales_dir';
}

export function canHoldAgencyStatus(status: string): boolean {
  return String(status) === 'active';
}

export function assertExclusiveAllowed(
  exclusiveAllowed: boolean,
  exclusivity: string,
): void {
  if (exclusivity === 'exclusive' && exclusiveAllowed !== true) {
    throw { error: 'exclusive_tier' };
  }
}

export function assertHoldQuota(openCount: number, maxConcurrent: number): void {
  if (openCount >= maxConcurrent) {
    throw { error: 'hold_quota' };
  }
}

export function isInhousePool(pool: string): boolean {
  return String(pool) === 'inhouse';
}

export function parentKindAllowsF2(parentKind: string): boolean {
  const k = String(parentKind);
  return k === 'f1' || k === 'tong_dai_ly';
}
```

- [ ] **Step 2: Implement + Jest**

```bash
cd services/ptt-crm-api
./node_modules/.bin/jest src/bds/bds.flags.spec.ts src/bds/guards/bds-agency.guard.spec.ts src/bds/agencies/bds-agency.util.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 3: Commit** — chỉ khi user yêu cầu: `feat(bds): P5 agency flag and basket utils`

---

### Task 2: DDL agency + giỏ

**Files:**
- Create: `docs/specs/postgresql-ddl-bds-p5.sql`
- Create: `scripts/apply_pg_ddl_bds_p5.sh` (copy `scripts/apply_pg_ddl_bds_p3.sh`, đổi file + echo `OK  bds P5 DDL`)

Không sửa DDL P0–P4. Không ADD FK `products` → basket (tránh vòng). Unique exclusive trên `product_id`.

- [ ] **Step 1: Write DDL**

```sql
-- Pack BĐS P5 — Apply: scripts/apply_pg_ddl_bds_p5.sh
BEGIN;

CREATE TABLE IF NOT EXISTS bds_tier_defs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  min_score INTEGER NOT NULL DEFAULT 0,
  max_concurrent_holds INTEGER NOT NULL DEFAULT 3,
  exclusive_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  ttl_multiplier NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS bds_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  legal_name TEXT NOT NULL DEFAULT '',
  tax_id TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'f1'
    CHECK (kind IN (
      'inhouse', 'tong_dai_ly', 'f1', 'f2', 'alliance', 'ctv_network'
    )),
  parent_agency_id UUID REFERENCES bds_agencies (id),
  status TEXT NOT NULL DEFAULT 'prospect'
    CHECK (status IN (
      'prospect', 'onboarding', 'active', 'probation', 'suspended', 'terminated'
    )),
  tier_id UUID REFERENCES bds_tier_defs (id),
  tier_override BOOLEAN NOT NULL DEFAULT FALSE,
  tier_override_reason TEXT NOT NULL DEFAULT '',
  tier_override_until DATE,
  owner_staff_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_agency_tenant_code
  ON bds_agencies (tenant_id, code);

CREATE TABLE IF NOT EXISTS bds_agency_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES bds_agencies (id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'expired', 'terminated')),
  signed_on DATE,
  expires_on DATE,
  exclusive_project BOOLEAN NOT NULL DEFAULT FALSE,
  max_concurrent_holds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_agency_contract_open
  ON bds_agency_contracts (agency_id, project_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS bds_basket_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES bds_agencies (id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL DEFAULT 'units'
    CHECK (scope_type IN ('units', 'zone', 'tower', 'phase', 'product_line')),
  exclusivity TEXT NOT NULL DEFAULT 'shared'
    CHECK (exclusivity IN ('exclusive', 'shared')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_basket_rule_agency_project
  ON bds_basket_rules (agency_id, project_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS bds_basket_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES bds_basket_rules (id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES bds_agencies (id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL REFERENCES crm_re_project_products (id) ON DELETE CASCADE,
  exclusivity TEXT NOT NULL DEFAULT 'shared'
    CHECK (exclusivity IN ('exclusive', 'shared')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by TEXT NOT NULL DEFAULT '',
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_basket_exclusive_unit
  ON bds_basket_units (product_id)
  WHERE exclusivity = 'exclusive' AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_basket_agency_unit_open
  ON bds_basket_units (agency_id, product_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bds_basket_units_agency
  ON bds_basket_units (agency_id, project_id)
  WHERE revoked_at IS NULL;

COMMIT;
```

- [ ] **Step 2: Apply local (idempotent ×2)**

```bash
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
chmod +x scripts/apply_pg_ddl_bds_p5.sh
bash scripts/apply_pg_ddl_bds_p5.sh
bash scripts/apply_pg_ddl_bds_p5.sh
psql "$DATABASE_URL" -c '\d bds_agencies'
```

Expected: 5 bảng + unique exclusive; lần 2 NOTICE / OK.

- [ ] **Step 3: Commit** — chỉ khi user yêu cầu

---

### Task 3: Repo agency + basket

**Files:**
- Create: `services/ptt-crm-api/src/bds/agencies/bds-agency.repository.ts`

**Interfaces:**
- Consumes: bảng Task 2
- Produces:
  - `ensureTiers(tenantId): TierRow[]` — INSERT seed `ON CONFLICT (tenant_id, code) DO NOTHING`, rồi `listTiers`
  - `getTierByCode(tenantId, code): TierRow | null`
  - `getTier(id): TierRow | null`
  - `insertAgency(row): AgencyRow` — 23505 → ném `{ code: '23505' }`
  - `getAgency(id): AgencyRow | null`
  - `listAgencies(tenantId): AgencyRow[]`
  - `setAgencyStatusIf(id, status, extra, expected): AgencyRow | null`
  - `setAgencyTier(id, tierId, override?): AgencyRow`
  - `insertContract(row): ContractRow`
  - `getActiveContract(agencyId, projectId): ContractRow | null`
  - `getOrCreateRule(agencyId, projectId): BasketRuleRow`
  - `grantUnit(row): BasketUnitRow` — 23505 → `{ code: '23505' }`
  - `getOpenUnit(agencyId, productId): BasketUnitRow | null`
  - `listOpenUnits(agencyId, projectId?): BasketUnitRow[]`
  - `revokeUnit(id, reason, now): BasketUnitRow | null` — `WHERE revoked_at IS NULL`
  - `countOpenHolds(agencyId): number` — SQL `bds_holds` status `pending`/`active` AND `channel_partner_id = agencyId`
  - `resolveProjectTenantId(projectId): string | null`
  - `getProjectOnePrice(projectId): boolean | null`
  - `getUnitPool(productId): { project_id, pool, status, hold_id } | null`

Pool pattern copy `BdsHoldRepository` / `BdsTxRepository`.

`AgencyRow` fields: `id`, `tenant_id`, `code`, `name`, `legal_name`, `tax_id`, `kind`, `parent_agency_id`, `status`, `tier_id`, `tier_override`, `tier_override_reason`, `tier_override_until`, `owner_staff_id`, `created_at`, `updated_at`.

`countOpenHolds`:

```sql
SELECT COUNT(*)::int FROM bds_holds
WHERE channel_partner_id = $1 AND status IN ('pending', 'active')
```

Không bắt buộc Jest repo. `tsc --noEmit` 0.

- [ ] **Step 1: Implement repo**
- [ ] **Step 2:** `./node_modules/.bin/tsc -p tsconfig.build.json --noEmit` exit 0

---

### Task 4: Service onboard + HĐ + override

**Files:**
- Create: `services/ptt-crm-api/src/bds/agencies/bds-agency.service.ts`
- Create: `services/ptt-crm-api/src/bds/agencies/bds-agency.service.spec.ts`
- Modify: `bds.module.ts` — providers `BdsAgencyRepository`, `BdsAgencyService`; export service. **Không** controller ở task này.

**Interfaces:**
- Consumes: repo; `BdsInventoryService.getOrThrow` / `listUnits` (Task 6 mới dùng đầy đủ)
- Produces:
  - `create(body, tenantId?): AgencyRow`
  - `activate(id, actorRole, tenantId?): AgencyRow`
  - `suspend(id, tenantId?): AgencyRow`
  - `createContract(agencyId, body, tenantId?): ContractRow`
  - `overrideTier(id, body, tenantId?): AgencyRow`
  - `get(id, tenantId?): AgencyRow`
  - `list(tenantId?): AgencyRow[]`
  - `seedTiers(tenantId?): TierRow[]`

`CreateAgencyBody`: `{ code: string; name?: string; kind?: AgencyKind; parent_agency_id?: string; legal_name?: string; tax_id?: string }`  
`code` trim rỗng → 400 `{ error: 'code' }`.  
`kind=f2` mà thiếu parent hoặc parent không `parentKindAllowsF2` → 400 `{ error: 'parent_agency_id' }`.  
23505 → 409 `{ error: 'code' }`. Status insert = `prospect`. `tenant_id` từ header/project — **không** body. Nếu không tenant: `resolve` từ header bắt buộc khi list/create (header rỗng → vẫn insert `tenant_id=null` chỉ khi test; prod luôn gửi header).

`activate`: `canActivateAgency` false → 403. `setAgencyStatusIf(..., 'active', { tier from trial }, 'prospect'|'onboarding')`. Miss → 409 `{ error: 'agency_closed' }`. Gán `tier_id` = seed `trial` của cùng tenant.

`suspend`: `setAgencyStatusIf(..., 'suspended', {}, current)` nếu current `active`/`probation`.

`CreateContractBody`: `{ project_id: number; max_concurrent_holds?: number | null }`  
`project_id` không finite → 400. `assertProjectTenant` qua `inventory.listUnits(projectId, tenantId)` (404 tenant). `getAgency` 404. Insert status `active`. 23505 → 409 `{ error: 'contract_open' }`.

`OverrideTierBody`: `{ tier_code: string; actor_role: string; reason: string; until?: string }`  
`canOverrideTier` false → 403. `reason` trim `< 10` → 400 `{ error: 'reason' }` (BDS-25). `getTierByCode` 404. `setAgencyTier` + `tier_override=true`.

Tenant header khác `agency.tenant_id` → 404.

- [ ] **Step 1: Spec (RED)**

```ts
const repo = {
  ensureTiers: jest.fn().mockResolvedValue([{ id: 'tr', code: 'trial', exclusive_allowed: false, max_concurrent_holds: 3 }]),
  getTierByCode: jest.fn(),
  insertAgency: jest.fn(),
  getAgency: jest.fn(),
  setAgencyStatusIf: jest.fn(),
  setAgencyTier: jest.fn(),
  insertContract: jest.fn(),
  getActiveContract: jest.fn(),
  resolveProjectTenantId: jest.fn().mockResolvedValue('t1'),
};
const inventory = { listUnits: jest.fn().mockResolvedValue([]), getOrThrow: jest.fn() };

it('create f2 without parent → 400 parent_agency_id', async () => {
  const svc = new BdsAgencyService(repo as never, inventory as never);
  await expect(
    svc.create({ code: 'F2-1', kind: 'f2' }, 't1'),
  ).rejects.toMatchObject({ response: { error: 'parent_agency_id' } });
});

it('activate cdt_channel → active + trial', async () => {
  repo.getAgency.mockResolvedValue({ id: 'a1', status: 'prospect', tenant_id: 't1' });
  repo.getTierByCode.mockResolvedValue({ id: 'tr', code: 'trial' });
  repo.setAgencyStatusIf.mockResolvedValue({ id: 'a1', status: 'active', tier_id: 'tr' });
  const svc = new BdsAgencyService(repo as never, inventory as never);
  const out = await svc.activate('a1', 'cdt_channel', 't1');
  expect(out.status).toBe('active');
});

it('BDS-25 override without long reason → 400', async () => {
  const svc = new BdsAgencyService(repo as never, inventory as never);
  await expect(
    svc.overrideTier('a1', { tier_code: 'gold', actor_role: 'cdt_sales_dir', reason: 'ngan' }, 't1'),
  ).rejects.toMatchObject({ response: { error: 'reason' } });
});
```

- [ ] **Step 2: Implement + Jest `src/bds/agencies/bds-agency.service.spec.ts --runInBand` xanh**
- [ ] **Step 3: Commit** — chỉ khi user yêu cầu

---

### Task 5: Cấp / gỡ giỏ — BDS-22 / BDS-26

**Files:**
- Modify: `bds-agency.service.ts` + spec

**Interfaces:**
- Produces:
  - `grantUnits(agencyId, body, tenantId?): BasketUnitRow[]`
  - `revokeUnit(agencyId, productId, reason, tenantId?): BasketUnitRow`
  - `listBasket(agencyId, projectId?, tenantId?): BasketUnitRow[]`

`GrantUnitsBody`: `{ project_id: number; product_ids: number[]; exclusivity?: 'exclusive' | 'shared'; actor_role?: string; granted_by?: string }`

Thứ tự `grantUnits`:

1. `product_ids` rỗng hoặc không phải mảng số → 400 `{ error: 'product_ids' }`.
2. `getAgency` 404 tenant. `status` `terminated` → 409 `{ error: 'agency_closed' }`.
3. `getActiveContract(agency, project)` null → 400 `{ error: 'contract' }`.
4. `ensureTiers` + `getTier(agency.tier_id)` — thiếu → 400 `{ error: 'tier' }`.
5. `exclusivity` default `shared`. `assertExclusiveAllowed(tier.exclusive_allowed, exclusivity)` → 400 `exclusive_tier` (BDS-22 lúc **gán**, không đợi hold).
6. Nếu `exclusive`: `canGrantExclusive(actor_role)` false → 403.
7. `getOrCreateRule(agency, project)` `scope_type=units`.
8. Mỗi `product_id`: `inventory.getOrThrow` — `project_id` lệch → 404. `isInhousePool(unit.pool)` → 404 (không nhét inhouse vào giỏ).
9. `grantUnit`. 23505 → 400 `{ error: 'exclusive' }` (BDS-26).

`revokeUnit`: `getOpenUnit` null → 404. Unit `status` `hold`/`reserved`/`booked` **hoặc** `hold_id` khác rỗng → 400 `{ error: 'unit_in_flight' }`. `reason` không thuộc `RevokeReason` → 400 `{ error: 'reason' }`. `revokeUnit` SQL.

`listBasket`: giỏ đọc được cả khi `suspended` (BR-BDS-23). Filter `revoked_at IS NULL`. Không trả căn `pool=inhouse` (phòng hờ).

- [ ] **Step 1: Spec (RED)**

```ts
it('BDS-22 bronze grant exclusive → 400 exclusive_tier', async () => {
  repo.getAgency.mockResolvedValue({ id: 'a1', status: 'active', tenant_id: 't1', tier_id: 'br' });
  repo.getActiveContract.mockResolvedValue({ id: 'c1', status: 'active' });
  repo.getTier.mockResolvedValue({ id: 'br', code: 'bronze', exclusive_allowed: false });
  const svc = new BdsAgencyService(/* mocks */);
  await expect(
    svc.grantUnits('a1', { project_id: 1, product_ids: [9], exclusivity: 'exclusive', actor_role: 'cdt_sales_dir' }, 't1'),
  ).rejects.toMatchObject({ response: { error: 'exclusive_tier' } });
});

it('BDS-26 second exclusive same unit → 400 exclusive', async () => {
  repo.getAgency.mockResolvedValue({ id: 'a2', status: 'active', tenant_id: 't1', tier_id: 'g' });
  repo.getActiveContract.mockResolvedValue({ id: 'c1' });
  repo.getTier.mockResolvedValue({ exclusive_allowed: true });
  repo.getOrCreateRule.mockResolvedValue({ id: 'r1' });
  inventory.getOrThrow.mockResolvedValue({ id: 9, project_id: 1, pool: 'channel', status: 'available' });
  repo.grantUnit.mockRejectedValue({ code: '23505' });
  const svc = new BdsAgencyService(/* mocks */);
  await expect(
    svc.grantUnits('a2', { project_id: 1, product_ids: [9], exclusivity: 'exclusive', actor_role: 'cdt_sales_dir' }, 't1'),
  ).rejects.toMatchObject({ response: { error: 'exclusive' } });
});

it('revoke in-flight hold → 400 unit_in_flight', async () => {
  repo.getAgency.mockResolvedValue({ id: 'a1', tenant_id: 't1', status: 'active' });
  repo.getOpenUnit.mockResolvedValue({ id: 'bu1', product_id: 9 });
  inventory.getOrThrow.mockResolvedValue({ id: 9, status: 'hold', hold_id: 'h1', pool: 'channel' });
  await expect(svc.revokeUnit('a1', 9, 'manual', 't1')).rejects.toMatchObject({
    response: { error: 'unit_in_flight' },
  });
});
```

- [ ] **Step 2: Implement + Jest `src/bds/agencies --runInBand` xanh**

---

### Task 6: Cổng hold + visibility + BDS-33

**Files:**
- Modify: `bds-agency.service.ts` + spec — `assertCanHold`, `assertUnitVisible`, `quote`
- Modify: `bds-hold.service.ts` — `@Optional() private readonly agency?: BdsAgencyService | null`
- Modify: `bds-hold.service.spec.ts` — AGENCY=1 cases; AGENCY=0 giữ BDS-05
- Modify: `bds-inventory.controller.ts` — `GET units/:id` + filter list khi `x-bds-agency`

**Interfaces:**
- Produces: `assertCanHold(agencyId, productId, tenantId?): Promise<void>`
- Produces: `assertUnitVisible(agencyId, productId, tenantId?): Promise<void>`
- Produces: `quote(agencyId, body, tenantId?): { list_price_vnd, discount_pct, net_price_vnd }`

Thứ tự `assertCanHold`:

1. `getAgency` 404 tenant.
2. `!canHoldAgencyStatus` → 409 `{ error: 'agency_suspended' }` (BDS-28; dùng cùng code cho probation).
3. `inventory.getOrThrow(productId)` — 404 tenant/unit.
4. `isInhousePool(unit.pool)` → `NotFoundException()` (BDS-35).
5. `getActiveContract(agency, unit.project_id)` null → 400 `{ error: 'contract' }`.
6. `getOpenUnit(agency, productId)` null → `NotFoundException()` (BDS-04).
7. Nếu `agency.kind === 'f2'`: `parent_agency_id` bắt buộc; `getOpenUnit(parent, productId)` null → `NotFoundException()` (BDS-34).
8. `getTier` + `max = contract.max_concurrent_holds ?? tier.max_concurrent_holds`. `countOpenHolds` + `assertHoldQuota` → 409 `hold_quota` (BDS-23).

`assertUnitVisible`: bước 1, 3, 4, 6, 7 — **không** check status hold / quota / contract (đọc giỏ khi suspended). Inhouse / ngoài giỏ → 404.

`QuoteBody`: `{ list_price_vnd: number; discount_pct: number; net_price_vnd?: number; policy_id: string }`  
Reuse `BdsPolicyService.get` + `assertDiscountAllowed` + `computeNetFromCsBh` + `assertOnePrice` (BDS-33). Inject `BdsPolicyService` vào `BdsAgencyService`.

Hook hold — **sau** validate `lead_id`/`row_version`, **trước** `insertHold`:

```ts
if (isBdsAgencyEnabled() && decideHoldActor(body.channel_partner_id) === 'channel') {
  if (!this.agency) throw new NotFoundException();
  await this.agency.assertCanHold(String(body.channel_partner_id), productId, opts.tenantId);
}
```

AGENCY=0: không gọi. Test P2 BDS-05 **vẫn xanh**.

`GET /units/:id` (thêm controller inventory, PACK-only — **không** AgencyGuard, để CĐT xem mọi căn):

```ts
@Get('units/:id')
async getUnit(
  @Param('id', ParseIntPipe) id: number,
  @Headers('x-bds-tenant') tenantId?: string,
  @Headers('x-bds-agency') agencyId?: string,
) {
  const row = await this.inventory.getOrThrow(id, tenantId);
  const agency = String(agencyId ?? '').trim();
  if (agency && isBdsAgencyEnabled() && this.agencies) {
    await this.agencies.assertUnitVisible(agency, id, tenantId);
  }
  return row;
}
```

`listUnits`: nếu `x-bds-agency` + AGENCY=1 → `agencies.listBasket` rồi filter `inventory.listUnits` theo `product_id` trong giỏ và `pool !== inhouse`. Không header → list CĐT như P1.

Inject `@Optional() BdsAgencyService` vào `BdsInventoryController` / `BdsHoldService`.

- [ ] **Step 1: Spec hold + agency (RED)**

```ts
it('BDS-04 channel hold unit not in basket → 404', async () => {
  process.env.PTT_BDS_AGENCY = '1';
  agency.assertCanHold.mockRejectedValue(new NotFoundException());
  await expect(
    svc.create(9, { lead_id: 2, row_version: 1, channel_partner_id: 'a1' }, {}),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect(repo.insertHold).not.toHaveBeenCalled();
});

it('BDS-28 suspended → 409 agency_suspended', async () => {
  process.env.PTT_BDS_AGENCY = '1';
  agency.assertCanHold.mockRejectedValue(new ConflictException({ error: 'agency_suspended' }));
  await expect(
    svc.create(9, { lead_id: 2, row_version: 1, channel_partner_id: 'a1' }, {}),
  ).rejects.toMatchObject({ response: { error: 'agency_suspended' } });
});

it('AGENCY off + channel → BDS-05 pending, no assertCanHold', async () => {
  delete process.env.PTT_BDS_AGENCY;
  const out = await svc.create(9, { lead_id: 2, row_version: 1, channel_partner_id: 'a1' }, {});
  expect(out.status).toBe('pending');
  expect(agency.assertCanHold).not.toHaveBeenCalled();
});

it('BDS-33 agency quote net mismatch → 400 one_price', async () => {
  policies.get.mockResolvedValue({ id: 'pol', project_id: 1, discount_cap_pct: 5 });
  repo.getAgency.mockResolvedValue({ id: 'a1', tenant_id: 't1', status: 'active' });
  repo.getProjectOnePrice.mockResolvedValue(true);
  await expect(
    agencySvc.quote('a1', { policy_id: 'pol', list_price_vnd: 1000, discount_pct: 0, net_price_vnd: 900 }, 't1'),
  ).rejects.toMatchObject({ response: { error: 'one_price' } });
});
```

`make()` hold spec: thêm `agency: { assertCanHold: jest.fn() }` và `new BdsHoldService(..., agency)`.

- [ ] **Step 2: Implement + Jest**

```bash
./node_modules/.bin/jest src/bds/agencies src/bds/hold/bds-hold.service.spec.ts --runInBand
```

Expected: PASS. P2 BDS-05 không vỡ.

---

### Task 7: HTTP + module + DoD

**Files:**
- Create: `services/ptt-crm-api/src/bds/agencies/bds-agency.controller.ts`
- Create: `services/ptt-crm-api/src/bds/agencies/bds-agency.controller.spec.ts` (thin: `create` / `grantUnits` / `meBasket` delegate)
- Modify: `bds.module.ts` — `BdsAgencyController` + `BdsAgencyGuard` + providers
- Modify: roadmap hàng P5 + flag §4

**Guards agency routes:** `@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsAgencyGuard)`.

| Method | Path | HttpCode |
|--------|------|----------|
| POST | `/api/v1/bds/agencies` | **201** |
| GET | `/api/v1/bds/agencies` | 200 |
| GET | `/api/v1/bds/agencies/:id` | 200 |
| POST | `/api/v1/bds/agencies/:id/activate` | 200 |
| POST | `/api/v1/bds/agencies/:id/suspend` | 200 |
| POST | `/api/v1/bds/agencies/:id/contracts` | 201 |
| POST | `/api/v1/bds/agencies/:id/tier/override` | 200 |
| POST | `/api/v1/bds/agencies/:id/basket/units` | 200 |
| POST | `/api/v1/bds/agencies/:id/basket/units/:productId/revoke` | 200 |
| GET | `/api/v1/bds/agencies/:id/basket` | 200 |
| GET | `/api/v1/bds/me/basket` | 200 — bắt buộc `x-bds-agency` |
| POST | `/api/v1/bds/agencies/:id/quote` | 200 |

Hold / GET unit **không** gắn AgencyGuard (PACK-only) — cổng nằm trong service khi flag on.

`GET /me/basket`: `x-bds-agency` rỗng → 400 `{ error: 'agency_id' }`.

Roadmap:

| Cột | Giá trị |
|-----|---------|
| Plan file | `[bds-p5-agency.md](./2026-08-22-bds-p5-agency.md)` |
| Thắng | `BDS-04, 22, 23, 26, 28, 33–35` |

Mục «### P5 — Agency OS» thêm: flag `PTT_BDS_AGENCY`; hold ngoài giỏ 404; exclusive unique; F2 giỏ cha; AGENCY=0 = P2 nguyên. Scheme HH = P7. Recalc điểm = P7.

Flag §4: `PTT_BDS_AGENCY` — mặc định 0; staging bật khi PACK=1 + P2 (PROJECT_OS khuyến nghị cho `phase_closed`).

- [ ] **Step 1: Register; `tsc --noEmit` 0; Jest `src/bds --runInBand` xanh**
- [ ] **Step 2: PACK=0 hoặc AGENCY=0 → HTTP `POST /agencies` 404 (sau auth)**
- [ ] **Step 3: Roadmap P5**

---

## 4. Definition of Done P5

- [ ] Jest flags + agency util + agency service + guard + controller + hold gates xanh
- [ ] `tsc` build api 0
- [ ] DDL P5 apply idempotent
- [ ] BDS-04: channel + AGENCY=1 + căn không trong giỏ → hold 404, không insert
- [ ] BDS-22: bronze grant exclusive → 400 `exclusive_tier`
- [ ] BDS-23: open holds ≥ `max_concurrent_holds` → 409 `hold_quota`
- [ ] BDS-26: exclusive thứ hai cùng `product_id` → 400 `exclusive`
- [ ] BDS-28: `suspended` + POST hold → 409 `agency_suspended`
- [ ] BDS-33: quote/convert net ≠ CSBH → 400 `one_price`
- [ ] BDS-34: F2 hold căn không có giỏ cha → 404
- [ ] BDS-35: `x-bds-agency` + `pool=inhouse` GET/hold → 404
- [ ] AGENCY=0: BDS-05 channel hold `pending` như P2
- [ ] PACK=0 hoặc AGENCY=0 → HTTP agency 404
- [ ] Prod không bật PACK / AGENCY
- [ ] Không scheme HH / không UI `/crm/bds/agencies`

---

## 5. Rollback

`PTT_BDS_PACK=0` và/hoặc `PTT_BDS_AGENCY=0`. Không DROP bảng agency trên prod.

---

## 6. Sau P5 xanh

P5b materialize zone/tower (nếu demo lưới). P7 scheme + ledger + recalc điểm (BDS-24/27). P8 nav sàn + empty re-projects (BDS-19) + ẩn net CTV. P6 lead isolation (BDS-08/17/18). P11/P12 card/ticket duyệt hold F1.

---

*P5 không phải Hoa hồng OS. Thắng: ngoài giỏ / inhouse / F2 lệch cha = 404; exclusive một căn một sàn; suspend cắt hold mới; một giá.*
