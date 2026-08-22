# P7 Triển khai — Hoa hồng (scheme / ledger / bảng kê)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sổ hoa hồng CĐT→sàn trên PG: scheme bậc thang theo hạng, accrue lúc TX đạt mốc, clawback khi hủy, bảng kê kỳ **±0đ** (BDS-27 / UC-048), tạm ứng ≤ cap (UC-049), recalc điểm một bậc (BDS-24). Hook CAPI `Purchase` **stub/log** khi `PTT_BDS_CAPI=1`. Không payroll, không UI.

**Architecture:** Bounded context `src/bds/commission/` (`BdsCommissionService` = spec §8.1 / §20.4). HTTP `/api/v1/bds` sau `StaffOrInternalKeyGuard` + `BdsPackGuard` + `BdsCommissionGuard` (`PTT_BDS_PACK=1` **và** `PTT_BDS_COMMISSION=1`). Accrue: `BdsTxService.vbtt` / `contract` / `cancel` gọi `@Optional() BdsCommissionService` **chỉ khi** COMMISSION=1 và TX có `channel_partner_id` — inhouse (SĐT rỗng) không sinh ledger. Không import `ReProjectsModule`. Không ghi `crm_b2b_commission_ledger`. CAPI: service mỏng log `bds_capi_events` — **không** gọi Graph Meta trên prod.

**Tech Stack:** NestJS `ptt-crm-api`, Jest local binary, `pg` Pool, `psql`.

**Spec:** [2026-08-21-bds-industry-pack-design.md](../specs/2026-08-21-bds-industry-pack-design.md) §10.4, §15 P7, §20.2, §20.4, BR-BDS-09/19/21/22.  
**UC:** [13-BDS-INDUSTRY-PACK.md](../../use-cases/13-BDS-INDUSTRY-PACK.md) UC-048, UC-049.  
**P4:** [2026-08-22-bds-p4-transaction.md](./2026-08-22-bds-p4-transaction.md) — TX stage + `channel_partner_id`  
**P5:** [2026-08-22-bds-p5-agency.md](./2026-08-22-bds-p5-agency.md) — hạng / HĐ / override  
**P6:** [2026-08-22-bds-p6-buyer-crm.md](./2026-08-22-bds-p6-buyer-crm.md) — CAPI Schedule **không** làm ở P7  
**Roadmap:** [2026-08-22-bds-coding-roadmap.md](./2026-08-22-bds-coding-roadmap.md)

**Test ID P7:** BDS-13 (ledger lúc HĐMB), BDS-24 (recalc hạng), BDS-27 (statement ±0đ).  
**BDS-25** override hạng = P5 — P7 **không** đổi.  
**`handed_over` split 30%** = **P9** — P7 seed split **vbtt 20 + contracted 80** (tổng 100).  
**Lớp 2 sàn→CTV / quarterly_bonus** = backlog P7b.  
**UI `/crm/bds/commissions`** = **P8**.  
**Ticket `commission_period`** = **P11/P12**.  
**CAPI Graph production** = staging sau, ngoài v1.

## Global Constraints

- `PTT_BDS_PACK` mặc định `0` — mọi `POST /api/v1/bds/*` = **404**.
- `PTT_BDS_COMMISSION` mặc định `0` — route HH + hook accrue = **404 / no-op** dù PACK=1.
- `PTT_BDS_CAPI` mặc định `0` — không ghi `bds_capi_events` dù COMMISSION=1.
- GET ngoài tenant = **404**, không 403, không PII (BR-BDS-05).
- Không ghi hoa hồng BĐS vào `crm_b2b_commission_ledger`.
- `%` ledger = scheme tại `converted_at` / mốc accrue. Đổi hạng **không** sửa dòng cũ (BR-BDS-19).
- Accrue chỉ khi TX đạt trigger scheme (BR-BDS-09). Hủy TX: dòng `accrued` chưa `paid` → `clawback`; đã `paid` → dòng clawback kỳ sau (BR-BDS-22).
- Tạm ứng ≤ `advance_cap_vnd` HĐ (BR-BDS-21). Thiếu cap → 400 `{ error: 'advance_cap' }`.
- Inhouse (`channel_partner_id` rỗng) → **không** accrue.
- COMMISSION=0 → TX P4 nguyên (không ledger).
- `BdsModule` **không** import `ReProjectsModule` / `MetaTrackingModule`.
- Folder `commission/` — hook TX chỉ `@Optional()` 1 inject, giống collection/agency.
- `DATABASE_URL` script: `postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb`.
- Test: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand`.
- Không commit trừ khi user yêu cầu.
- Prod VPS: **không** bật `PTT_BDS_PACK` / `PTT_BDS_COMMISSION` / `PTT_BDS_CAPI`.

---

## 0. Phạm vi / ngoài phạm vi

**Làm**

- Flag `isBdsCommissionEnabled()` + `isBdsCapiEnabled()` + `BdsCommissionGuard`
- DDL schemes / scheme_tiers / payout_splits / ledger / statements / advances / tier_scores
- ALTER `bds_agency_contracts` thêm `advance_cap_vnd`, `clawback_days`
- CRUD scheme + bậc + split (tổng split = 100)
- Accrue lúc `vbtt` / `contracted` (BDS-13)
- Clawback lúc `cancel`
- Chốt bảng kê kỳ: `gross − advance − clawback = net` ±0đ (BDS-27)
- Approve / pay statement
- Tạm ứng ≤ cap (UC-049)
- Recalc điểm kỳ: GMV + units; lên/xuống **một** bậc (BDS-24)
- Hook CAPI `Purchase` log khi CAPI=1 + `contracted`

**Không làm**

- Split `handed_over` (P9)
- Lớp 2 CTV / `kind=quarterly_bonus`
- Training / cancel_rate / hold_convert trong điểm (thiếu quota → 0; bảng `bds_agency_quotas` / trainings = P7b)
- Cron ngày 1 (chỉ `POST /tiers/recalc`)
- Payroll / xuất bank file
- UI ops-web
- Graph Meta / Google Enhanced (chỉ log stub)
- CAPI `Lead` ingest / `Schedule` visit (P6 leftover — P7b hoặc staging)

---

## 1. File map

```
docs/specs/postgresql-ddl-bds-p7.sql
scripts/apply_pg_ddl_bds_p7.sh

services/ptt-crm-api/src/bds/bds.flags.ts                         # + COMMISSION + CAPI
services/ptt-crm-api/src/bds/bds.flags.spec.ts
services/ptt-crm-api/src/config/app-config.service.ts             # bdsCommissionEnabled, bdsCapiEnabled
services/ptt-crm-api/src/bds/guards/bds-commission.guard.ts
services/ptt-crm-api/src/bds/guards/bds-commission.guard.spec.ts
services/ptt-crm-api/src/bds/commission/bds-commission.types.ts
services/ptt-crm-api/src/bds/commission/bds-commission.util.ts
services/ptt-crm-api/src/bds/commission/bds-commission.util.spec.ts
services/ptt-crm-api/src/bds/commission/bds-commission.repository.ts
services/ptt-crm-api/src/bds/commission/bds-commission.service.ts
services/ptt-crm-api/src/bds/commission/bds-commission.service.spec.ts
services/ptt-crm-api/src/bds/commission/bds-commission-score.service.ts
services/ptt-crm-api/src/bds/commission/bds-commission-score.service.spec.ts
services/ptt-crm-api/src/bds/commission/bds-capi-hook.service.ts
services/ptt-crm-api/src/bds/commission/bds-capi-hook.service.spec.ts
services/ptt-crm-api/src/bds/commission/bds-commission.controller.ts
services/ptt-crm-api/src/bds/commission/bds-commission.controller.spec.ts
services/ptt-crm-api/src/bds/bds.module.ts
services/ptt-crm-api/src/bds/transactions/bds-tx.service.ts         # hook accrue/clawback/capi
services/ptt-crm-api/src/bds/transactions/bds-tx.service.spec.ts

docs/superpowers/plans/2026-08-22-bds-coding-roadmap.md             # link P7 + flag §4
```

---

## 2. DDL (PostgreSQL)

`docs/specs/postgresql-ddl-bds-p7.sql`:

```sql
BEGIN;

ALTER TABLE bds_agency_contracts
  ADD COLUMN IF NOT EXISTS advance_cap_vnd BIGINT,
  ADD COLUMN IF NOT EXISTS clawback_days INTEGER;

CREATE TABLE IF NOT EXISTS bds_commission_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id),
  phase_id UUID,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  base TEXT NOT NULL DEFAULT 'net'
    CHECK (base IN ('net', 'list')),
  currency TEXT NOT NULL DEFAULT 'VND',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_commission_scheme_active
  ON bds_commission_schemes (tenant_id, project_id, COALESCE(phase_id, '00000000-0000-0000-0000-000000000000'))
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS bds_commission_scheme_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES bds_commission_schemes (id) ON DELETE CASCADE,
  min_tier_id UUID NOT NULL REFERENCES bds_tier_defs (id),
  product_line TEXT NOT NULL DEFAULT '',
  pct NUMERIC NOT NULL,
  bonus_units_from INTEGER,
  bonus_extra_pct NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bds_commission_payout_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES bds_commission_schemes (id) ON DELETE CASCADE,
  trigger_stage TEXT NOT NULL
    CHECK (trigger_stage IN ('vbtt', 'contracted', 'handed_over')),
  pct NUMERIC NOT NULL,
  UNIQUE (scheme_id, trigger_stage)
);

CREATE TABLE IF NOT EXISTS bds_commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  agency_id UUID NOT NULL REFERENCES bds_agencies (id),
  transaction_id UUID NOT NULL REFERENCES bds_transactions (id),
  scheme_id UUID REFERENCES bds_commission_schemes (id),
  scheme_tier_id UUID REFERENCES bds_commission_scheme_tiers (id),
  trigger_stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'accrued'
    CHECK (status IN ('accrued', 'paid', 'clawback')),
  base_vnd BIGINT NOT NULL,
  pct NUMERIC NOT NULL,
  amount_vnd BIGINT NOT NULL,
  period_month DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_commission_ledger_tx_trigger
  ON bds_commission_ledger (transaction_id, trigger_stage)
  WHERE status <> 'clawback';

CREATE INDEX IF NOT EXISTS idx_bds_commission_ledger_agency
  ON bds_commission_ledger (agency_id, period_month);

CREATE TABLE IF NOT EXISTS bds_commission_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  agency_id UUID NOT NULL REFERENCES bds_agencies (id),
  period_month DATE NOT NULL,
  gross_vnd BIGINT NOT NULL DEFAULT 0,
  advance_vnd BIGINT NOT NULL DEFAULT 0,
  clawback_vnd BIGINT NOT NULL DEFAULT 0,
  net_vnd BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'locked', 'approved', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, period_month)
);

CREATE TABLE IF NOT EXISTS bds_commission_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  agency_id UUID NOT NULL REFERENCES bds_agencies (id),
  amount_vnd BIGINT NOT NULL,
  period_month DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bds_agency_tier_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  agency_id UUID NOT NULL REFERENCES bds_agencies (id),
  period_month DATE NOT NULL,
  gmv_score NUMERIC NOT NULL DEFAULT 0,
  units_score NUMERIC NOT NULL DEFAULT 0,
  total_score NUMERIC NOT NULL DEFAULT 0,
  from_tier_id UUID REFERENCES bds_tier_defs (id),
  to_tier_id UUID REFERENCES bds_tier_defs (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, period_month)
);

CREATE TABLE IF NOT EXISTS bds_capi_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  transaction_id UUID REFERENCES bds_transactions (id),
  lead_id BIGINT,
  event_name TEXT NOT NULL,
  value_vnd BIGINT,
  status TEXT NOT NULL DEFAULT 'logged'
    CHECK (status IN ('logged', 'skipped', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
```

Script: `scripts/apply_pg_ddl_bds_p7.sh` — copy `apply_pg_ddl_bds_p6.sh`.

---

### Task 1: Flag COMMISSION + CAPI + guard + util

**Files:**
- Modify: `services/ptt-crm-api/src/bds/bds.flags.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.flags.spec.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts`
- Create: `services/ptt-crm-api/src/bds/guards/bds-commission.guard.ts`
- Create: `services/ptt-crm-api/src/bds/guards/bds-commission.guard.spec.ts`
- Create: `services/ptt-crm-api/src/bds/commission/bds-commission.types.ts`
- Create: `services/ptt-crm-api/src/bds/commission/bds-commission.util.ts`
- Create: `services/ptt-crm-api/src/bds/commission/bds-commission.util.spec.ts`

**Interfaces — produces:**

```ts
export function isBdsCommissionEnabled(): boolean;
export function isBdsCapiEnabled(): boolean;

export function assertSplitsSum100(splits: { pct: number }[]): void;
// throws BadRequestException { error: 'split_sum' } nếu tổng ≠ 100 (±0.01)

export function pickSchemeTier(
  rows: { min_score: number; pct: number }[],
  agencyMinScore: number,
): { min_score: number; pct: number } | null;
// hàng có min_score lớn nhất ≤ agencyMinScore

export function computeLineAmount(baseVnd: number, pct: number, splitPct: number): number;
// Math.round(baseVnd * pct/100 * splitPct/100)

export function computeStatementNet(input: {
  grossVnd: number;
  advanceVnd: number;
  clawbackVnd: number;
}): number;
// gross - advance - clawback

export function periodMonthStart(d: Date): string;
// YYYY-MM-01 UTC
```

- [ ] **Step 1: Flags spec (RED)**

```ts
it('defaults COMMISSION off when unset', () => {
  delete process.env.PTT_BDS_COMMISSION;
  expect(isBdsCommissionEnabled()).toBe(false);
});

it('defaults CAPI off when unset', () => {
  delete process.env.PTT_BDS_CAPI;
  expect(isBdsCapiEnabled()).toBe(false);
});
```

- [ ] **Step 2: Util spec (RED)**

```ts
it('pickSchemeTier takes nearest min_score ≤ agency', () => {
  const rows = [
    { min_score: 0, pct: 1.5 },
    { min_score: 20, pct: 2.0 },
    { min_score: 45, pct: 2.5 },
  ];
  expect(pickSchemeTier(rows, 20)?.pct).toBe(2.0);
  expect(pickSchemeTier(rows, 44)?.pct).toBe(2.0);
  expect(pickSchemeTier(rows, 45)?.pct).toBe(2.5);
});

it('BDS-27 net = gross − advance − clawback', () => {
  expect(computeStatementNet({ grossVnd: 1000, advanceVnd: 200, clawbackVnd: 100 })).toBe(700);
});

it('split sum not 100 → 400', () => {
  expect(() => assertSplitsSum100([{ pct: 20 }, { pct: 50 }])).toThrow(
    expect.objectContaining({ response: { error: 'split_sum' } }),
  );
});
```

- [ ] **Step 3: Implement flags + guard + util**

- [ ] **Step 4: Run specs**

Run: `./node_modules/.bin/jest src/bds/bds.flags.spec.ts src/bds/guards/bds-commission.guard.spec.ts src/bds/commission/bds-commission.util.spec.ts --runInBand`

Expected: PASS

---

### Task 2: DDL + apply script

**Files:**
- Create: `docs/specs/postgresql-ddl-bds-p7.sql`
- Create: `scripts/apply_pg_ddl_bds_p7.sh`

- [ ] **Step 1: Write DDL + script** (nội dung §2)

- [ ] **Step 2: Apply ×2 idempotent**

Run: `bash scripts/apply_pg_ddl_bds_p7.sh && bash scripts/apply_pg_ddl_bds_p7.sh`

Expected: lần 2 chỉ NOTICE skip

---

### Task 3: Repository

**Files:**
- Create: `services/ptt-crm-api/src/bds/commission/bds-commission.repository.ts`

**Interfaces — produces:**

```ts
export class BdsCommissionRepository {
  insertScheme(input: InsertSchemeInput): Promise<SchemeRow>;
  getActiveScheme(projectId: number, tenantId?: string): Promise<SchemeRow | null>;
  listSchemeTiers(schemeId: string): Promise<SchemeTierRow[]>;
  replaceSchemeTiers(schemeId: string, rows: InsertSchemeTierInput[]): Promise<SchemeTierRow[]>;
  replaceSplits(schemeId: string, rows: InsertSplitInput[]): Promise<SplitRow[]>;
  listSplits(schemeId: string): Promise<SplitRow[]>;
  activateScheme(id: string): Promise<SchemeRow>;

  insertLedger(input: InsertLedgerInput): Promise<LedgerRow>;
  listLedgerByTx(transactionId: string): Promise<LedgerRow[]>;
  listLedgerByAgencyPeriod(agencyId: string, periodMonth: string): Promise<LedgerRow[]>;
  clawbackOpenLines(transactionId: string): Promise<LedgerRow[]>;

  upsertStatement(input: UpsertStatementInput): Promise<StatementRow>;
  getStatement(id: string, tenantId?: string): Promise<StatementRow | null>;
  setStatementStatusIf(id: string, next: StatementStatus, expected: StatementStatus): Promise<StatementRow | null>;

  insertAdvance(input: InsertAdvanceInput): Promise<AdvanceRow>;
  sumAdvances(agencyId: string, periodMonth: string): Promise<number>;

  insertScore(input: InsertScoreInput): Promise<ScoreRow>;
  insertCapiEvent(input: InsertCapiInput): Promise<void>;
}
```

- [ ] **Step 1: Implement repository** (`pg` Pool, map row giống collection)

- [ ] **Step 2: Smoke** — insert scheme draft + unique active

---

### Task 4: Scheme API

**Files:**
- Create: `services/ptt-crm-api/src/bds/commission/bds-commission.service.ts` (phần scheme)
- Create: `services/ptt-crm-api/src/bds/commission/bds-commission.service.spec.ts`

**API logic:**

- `createScheme(body, tenantId)` — `status=draft`, `base` `net|list`
- `putTiers(schemeId, rows, tenantId)` — mỗi `min_tier_id` + `pct`
- `putSplits(schemeId, rows, tenantId)` — `assertSplitsSum100`
- `activate(schemeId, tenantId)` — unique active / project

- [ ] **Step 1: Service spec (RED)**

```ts
it('activate second scheme same project → 409 scheme_active', async () => {
  repo.getActiveScheme.mockResolvedValue({ id: 's1', status: 'active' });
  await expect(svc.activate('s2', 't1')).rejects.toMatchObject({
    response: { error: 'scheme_active' },
  });
});
```

- [ ] **Step 2: Implement + run spec** — PASS

---

### Task 5: Accrue + clawback (BDS-13) + TX hook

**Files:**
- Modify: `services/ptt-crm-api/src/bds/commission/bds-commission.service.ts`
- Modify: `services/ptt-crm-api/src/bds/commission/bds-commission.service.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/transactions/bds-tx.service.ts`
- Modify: `services/ptt-crm-api/src/bds/transactions/bds-tx.service.spec.ts`

**Luồng accrue `onTxStage(tx, trigger)`:**

1. COMMISSION off hoặc `channel_partner_id` rỗng → return.
2. `getActiveScheme(tx.project_id)` — không có → log, return (không 400 TX).
3. Agency + `tier_id` → `min_score` của hạng (P5 `bds_tier_defs`).
4. `pickSchemeTier` trên `listSchemeTiers`.
5. `base_vnd` = `scheme.base === 'list' ? tx.list_price_vnd : tx.net_price_vnd`.
6. Split khớp `trigger_stage`. `amount = computeLineAmount(base, tier.pct, split.pct)`.
7. Insert ledger `accrued`, `period_month = periodMonthStart(now)`.
8. Unique `(tx, trigger)` — trùng → no-op (idempotent hook).

**Clawback `onTxCancelled(tx)`:**

- Mọi dòng `accrued` của TX → `status=clawback` (cùng amount âm không cần; status đổi).
- Dòng `paid` → insert dòng mới `clawback` (kỳ hiện tại) cùng `amount_vnd` (BR-BDS-22).

**TX hook** (best-effort, `try/catch` + `logger.warn` — **không** rollback TX):

```ts
if (isBdsCommissionEnabled()) {
  await this.commission?.onTxStage(updated, 'vbtt'); // sau vbtt
  await this.commission?.onTxStage(updated, 'contracted'); // sau contract
  await this.commission?.onTxCancelled(updated); // sau cancel
}
```

- [ ] **Step 1: Accrue spec (RED)**

```ts
it('BDS-13 contracted accrues ledger for agency', async () => {
  repo.getActiveScheme.mockResolvedValue({ id: 's1', base: 'net' });
  repo.listSplits.mockResolvedValue([{ trigger_stage: 'contracted', pct: 80 }]);
  repo.listSchemeTiers.mockResolvedValue([{ min_tier_id: 'bronze', pct: 2 }]);
  await svc.onTxStage(
    { id: 'tx1', channel_partner_id: 'a1', project_id: 12, net_price_vnd: 1_000_000_000, tenant_id: 't1' },
    'contracted',
  );
  expect(repo.insertLedger).toHaveBeenCalledWith(
    expect.objectContaining({ trigger_stage: 'contracted', status: 'accrued' }),
  );
});

it('inhouse empty partner skips accrue', async () => {
  await svc.onTxStage({ id: 'tx1', channel_partner_id: '', net_price_vnd: 1 }, 'contracted');
  expect(repo.insertLedger).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Wire TX + existing hold/tx specs vẫn PASS**

- [ ] **Step 3: Run**

Run: `./node_modules/.bin/jest src/bds/commission/bds-commission.service.spec.ts src/bds/transactions/bds-tx.service.spec.ts --runInBand`

Expected: PASS

---

### Task 6: Statement lock / approve / pay (BDS-27, UC-048)

**Files:**
- Modify: `services/ptt-crm-api/src/bds/commission/bds-commission.service.ts`
- Modify: `services/ptt-crm-api/src/bds/commission/bds-commission.service.spec.ts`

**`lockStatement(agencyId, periodMonth, tenantId)`:**

1. Sum ledger `accrued` kỳ = `gross_vnd`
2. Sum ledger `clawback` kỳ = `clawback_vnd`
3. Sum advances kỳ = `advance_vnd`
4. `net_vnd = computeStatementNet(...)`
5. Upsert statement `status=locked`
6. Nếu `gross !== sum(accrued)` → 409 `{ error: 'statement_mismatch' }` (BDS-27)

**Approve:** `locked` → `approved`. **Pay:** `approved` → `paid` + mark ledger accrued của kỳ `paid`.

- [ ] **Step 1: Spec (RED)**

```ts
it('BDS-27 lock statement net matches ledger', async () => {
  repo.listLedgerByAgencyPeriod.mockResolvedValue([
    { status: 'accrued', amount_vnd: 1000 },
    { status: 'clawback', amount_vnd: 100 },
  ]);
  repo.sumAdvances.mockResolvedValue(200);
  repo.upsertStatement.mockImplementation(async (row) => row);
  const out = await svc.lockStatement('a1', '2026-08-01', 't1');
  expect(out.gross_vnd).toBe(1000);
  expect(out.clawback_vnd).toBe(100);
  expect(out.advance_vnd).toBe(200);
  expect(out.net_vnd).toBe(700);
  expect(out.status).toBe('locked');
});
```

- [ ] **Step 2: Implement + run** — PASS

---

### Task 7: Advances (UC-049) + recalc điểm (BDS-24)

**Files:**
- Create: `services/ptt-crm-api/src/bds/commission/bds-commission-score.service.ts`
- Create: `services/ptt-crm-api/src/bds/commission/bds-commission-score.service.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/commission/bds-commission.service.ts`

**Advance:**

```ts
async createAdvance(body: { agency_id: string; amount_vnd: number; period_month: string; note?: string }, tenantId: string)
```

- Đọc HĐ `active` bất kỳ của agency (v1: max `advance_cap_vnd` các HĐ active).
- `sumAdvances + amount > cap` → 400 `{ error: 'advance_cap' }`.
- Statement đã `locked|approved|paid` cùng kỳ → 409 `{ error: 'period_locked' }`.

**Recalc `recalcTiers(periodMonth, tenantId)`:**

- Với mỗi agency `active` tenant:
  - `gmv` = SUM `bds_transactions.net_price_vnd` `stage=contracted` + `channel_partner_id=agency` trong tháng
  - `units` = COUNT TX đó
  - `gmv_score = min(100, gmv/target_gmv*100)` — **P7 target seed:** nếu không có quota, `target_gmv=0` → điểm thành phần **0** (đúng spec). Để BDS-24 testable: body optional `{ target_gmv, target_units }` **hoặc** dùng fallback test inject.
  - **Khóa v1 testable:** nếu caller truyền `targets: { agencyId, target_gmv, target_units }[]` thì tính; không truyền → score 0, hạng giữ.
  - `total = 0.35*gmv + 0.25*units` (các trọng số còn lại 0)
  - Chọn `bds_tier_defs` có `min_score` lớn nhất ≤ total
  - Lên/xuống **tối đa 1 bậc** so với hạng hiện tại (trừ `tier_override=true` → skip)
  - Snapshot `bds_agency_tier_scores`
  - Update `agencies.tier_id` nếu đổi
- Ledger cũ **không** đụng (BDS-24)

- [ ] **Step 1: Advance spec** — over cap → 400

- [ ] **Step 2: Recalc spec**

```ts
it('BDS-24 bronze→silver after score; old ledger pct unchanged', async () => {
  agencies = [{ id: 'a1', tier_code: 'bronze', min_score: 20, override: false }];
  txs = [{ net_price_vnd: 10_000_000_000 }]; // đủ điểm bạc khi target thấp
  await score.recalc('2026-08-01', 't1', {
    targets: [{ agencyId: 'a1', target_gmv: 1, target_units: 1 }],
  });
  expect(agencyRepo.setTier).toHaveBeenCalledWith('a1', expect.objectContaining({ code: 'silver' }));
  expect(ledgerRepo.updatePct).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Implement + run** — PASS

---

### Task 8: CAPI stub + controller + module + roadmap + verify

**Files:**
- Create: `services/ptt-crm-api/src/bds/commission/bds-capi-hook.service.ts`
- Create: `services/ptt-crm-api/src/bds/commission/bds-capi-hook.service.spec.ts`
- Create: `services/ptt-crm-api/src/bds/commission/bds-commission.controller.ts`
- Create: `services/ptt-crm-api/src/bds/commission/bds-commission.controller.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.module.ts`
- Modify: `services/ptt-crm-api/src/bds/transactions/bds-tx.service.ts` (gọi capi sau contracted)
- Modify: `docs/superpowers/plans/2026-08-22-bds-coding-roadmap.md`

**CAPI hook:**

```ts
async onPurchase(tx: TxRow): Promise<void> {
  if (!isBdsCapiEnabled()) return;
  await this.repo.insertCapiEvent({
    tenantId: tx.tenant_id,
    transactionId: tx.id,
    leadId: tx.lead_id,
    eventName: 'Purchase',
    valueVnd: tx.net_price_vnd,
    status: 'logged',
  });
}
```

Không enqueue `capi_dispatch`. Không hash PII. CAPI=0 → không insert.

**Routes (`BdsCommissionController` `@Controller('api/v1/bds')`):**

| Method | Path | Việc |
|--------|------|------|
| POST | `/commission-schemes` | Tạo draft |
| POST | `/commission-schemes/:id/tiers` | Thay bậc |
| POST | `/commission-schemes/:id/splits` | Thay split |
| POST | `/commission-schemes/:id/activate` | Active |
| GET | `/commissions?agency_id=&period=` | Ledger |
| POST | `/commission-statements/lock` | Chốt kỳ |
| POST | `/commission-statements/:id/approve` | Duyệt |
| POST | `/commission-statements/:id/pay` | Chi |
| POST | `/commission-advances` | Tạm ứng |
| POST | `/tiers/recalc` | Recalc điểm |

- [ ] **Step 1: CAPI spec** — CAPI=0 no insert; CAPI=1 logs Purchase

- [ ] **Step 2: Controller delegates**

- [ ] **Step 3: Register module** — guard, repos, services, controller; export `BdsCommissionService`

- [ ] **Step 4: Roadmap** — link plan P7; flag §4 tách `PTT_BDS_COMMISSION` và `PTT_BDS_CAPI`

- [ ] **Step 5: Full suite**

Run: `./node_modules/.bin/jest src/bds --runInBand`

Expected: all pass (baseline + ~20 tests P7)

- [ ] **Step 6: Build**

Run: `npm run build`

Expected: exit 0

---

## 3. Definition of Done

- [ ] BDS-13: `POST .../contract` + COMMISSION=1 + agency + scheme active → 1 dòng ledger `accrued` `trigger=contracted`
- [ ] BDS-24: recalc đủ điểm → lên 1 bậc; ledger cũ giữ `%`
- [ ] BDS-27: lock statement `gross − advance − clawback = net` ±0đ
- [ ] UC-049: advance > cap → 400 `advance_cap`
- [ ] Hủy TX: dòng accrued → `clawback`
- [ ] Inhouse / COMMISSION=0 → không ledger; TX spec P4 không đổi
- [ ] CAPI=0 → 0 row `bds_capi_events`; CAPI=1 → log `Purchase` lúc contracted
- [ ] DDL apply ×2 idempotent
- [ ] `PTT_BDS_COMMISSION=0` → `/api/v1/bds/commission-schemes` 404

---

## 4. Rollback

`PTT_BDS_PACK=0` và/hoặc `PTT_BDS_COMMISSION=0`. Không DROP bảng HH trên prod.

---

## 5. Sau P7 xanh

**P8** UI `/crm/bds/commissions` + ẩn net CTV (BDS-09). **P9** accrue `handed_over` 30% (đổi seed split). **P7b** lớp 2 CTV, quota/training score, cron ngày 1. **P11/P12** card `commission_period`. Staging CAPI Graph sau khi PO bật `PTT_BDS_CAPI` + pixel.

---

*P7 không phải UI pack. Thắng: scheme → accrue HĐMB → bảng kê ±0đ; hủy clawback; recalc một bậc; CAPI log stub.*
