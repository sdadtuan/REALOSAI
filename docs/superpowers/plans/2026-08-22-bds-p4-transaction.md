# P4 Triển khai — Transaction (cọc / VBTT / HĐMB chưa chặn %)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giao dịch trên PG: convert hold → cọc dưới `deposit_min` → 400 `{ error: 'deposit_min' }` (BDS-11); hủy cọc → TX `cancelled` + căn `available` (BDS-14); stage `reservation` → `deposit` → `vbtt` → `contracted` **không** enforce `paid_pct` / `legal_gate_hdmb`.

**Architecture:** Bounded context `src/bds/transactions/` (`BdsTxService` = spec `BdsTxService`). HTTP `/api/v1/bds` sau `StaffOrInternalKeyGuard` + `BdsPackGuard` + `BdsTxGuard` (`PTT_BDS_PACK=1` **và** `PTT_BDS_TX=1`). Đổi `status` căn chỉ qua `BdsInventoryService.transition` (`reservation_fee` / `deposit` / `contract` / `cancel`). Tenant stamp từ hold/unit/project, không từ body. Không import `ReProjectsModule`. Không phiếu thu, không agency, không UI.

**Tech Stack:** NestJS `ptt-crm-api`, Jest local binary, `pg` Pool, `psql`.

**Spec:** [2026-08-21-bds-industry-pack-design.md](../specs/2026-08-21-bds-industry-pack-design.md) §6.5, §10.3, §15 P4, §23.2, BR-BDS-01/03/13/26.  
**UC:** 017 reservation · 018 convert cọc · 019 VBTT · 021 hủy. UC-020 HĐMB **API có, cổng kép = P4b**.  
**P2:** [2026-08-22-bds-p2-hold-ttl.md](./2026-08-22-bds-p2-hold-ttl.md)  
**P3:** [2026-08-22-bds-p3-csbh.md](./2026-08-22-bds-p3-csbh.md)  
**Roadmap:** [2026-08-22-bds-coding-roadmap.md](./2026-08-22-bds-coding-roadmap.md)

**Test ID P4:** BDS-11, BDS-14.  
**BDS-31 / BDS-32 / BR-BDS-27** (`paid_pct`, `legal_gate_hdmb`) = **P4b** — P4 `POST .../contract` **không** check.  
**BDS-13** (HĐMB + ledger accrue) = **P7**.  
**BDS-33** HTTP đại lý net ≠ CSBH = **P5** — P4 gọi `assertOnePrice` khi client gửi `net_price_vnd` lúc convert.  
**BDS-37** hoàn phí launch = **P10**.

## Global Constraints

- `PTT_BDS_PACK` mặc định `0` — mọi `POST /api/v1/bds/*` = **404**.
- `PTT_BDS_TX` mặc định `0` — route TX / convert-deposit = **404** dù PACK=1. An toàn prod (giống POLICY / HOLD_TTL).
- GET ngoài tenant = 404, không PII (BR-BDS-05). Optional `x-bds-tenant` giống inventory.
- Không xóa `re-projects/`. Không đụng `crm_b2b_projects`. Không tạo `bds_agencies` / `bds_receipts` / `bds_buyers` / `bds_payment_schedules`.
- Một căn tối đa một TX **open** (stage không `cancelled` / `lost`) — unique partial (BR-BDS-01).
- Convert chỉ hold `active`. Hold `pending` / `expired` / `cancelled` / `converted` → 409 `{ error: 'hold_closed' }`.
- `deposit_vnd < policy.deposit_min_vnd` → 400 `{ error: 'deposit_min' }` (BDS-11, UC-018 E1).
- `discount_pct > discount_cap_pct` và `discount_approved !== true` → 400 `{ error: 'discount_cap' }` (BR-BDS-03) — reuse `assertDiscountAllowed`.
- `one_price` + client gửi `net_price_vnd` lệch CSBH → 400 `{ error: 'one_price' }` — reuse `assertOnePrice`.
- `POST .../contract` **không** check `paid_pct` / Sở XD (P4b). `POST .../vbtt` **không** check `vbtt_min_paid_pct` (P4b).
- `Idempotency-Key` trên convert (và reservation) trong 24h → replay (BR-BDS-13). Reuse bảng `bds_idempotency_keys`.
- Đổi căn: `reservation_fee` → `reserved`; `deposit` → `booked`; `contract` → `sold`; hủy TX open (chưa `contracted`) → `cancel` → `available`. Không `reverse_sold` ở P4.
- Convert / reservation → hold `converted` (nhả unique hold mở; TTL P2 không đụng căn `reserved`/`booked`).
- `BdsModule` **không** import `ReProjectsModule`.
- Folder `transactions/` (roadmap) — **không** nhét TX vào `hold/` service ngoài 1 dòng HTTP ủy quyền nếu cần.
- `DATABASE_URL` script: `postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb`.
- Test: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand` (không `npx jest`).
- Không commit trừ khi user yêu cầu.
- Prod VPS: **không** bật `PTT_BDS_PACK` / `PTT_BDS_TX`. Không đụng `ngoinhahomnay.vn` / :3000.

---

## 0. Phạm vi / ngoài phạm vi

**Làm**

- Flag `isBdsTxEnabled()` + `BdsTxGuard`
- DDL `bds_transactions`; unique one-open-TX
- `convertDeposit` (BDS-11) + snapshot giá / `policy_id`
- Optional `reservation` (UC-017) — phí giữ chỗ, căn `reserved`
- `vbtt` (số VBTT) — không cổng %
- `contract` — căn `sold`, không cổng pháp lý/%
- `cancel` (BDS-14) — TX `cancelled`, căn `available`, xóa hold pointers
- HTTP convert + TX GET/list/vbtt/contract/cancel
- Idempotency convert / reservation

**Không làm**

- `bds_receipts` / `paid_pct` sống / aging / mortgage (P4b, BDS-31/32)
- Sinh `bds_payment_installments` từ `payment_template_json` (P4b / UC-036)
- `legal_gate_hdmb` / bảo lãnh / giải chấp (P4b)
- `handover` / `title_issued` / `reverse_sold` (P9)
- Ledger HH accrue / clawback (P7, BR-BDS-09)
- Chat card / ticket `collection_schedule` (P11/P12)
- Agency / giỏ / BDS-33 HTTP đại lý (P5)
- Launch hoàn phí hết cửa sổ (P10, BDS-37)
- `bds_buyers` FK (buyer_id nullable, không FK)
- UI ops-web

---

## 1. File map

```
docs/specs/postgresql-ddl-bds-p4.sql
scripts/apply_pg_ddl_bds_p4.sh

services/ptt-crm-api/src/bds/bds.flags.ts                         # + isBdsTxEnabled
services/ptt-crm-api/src/bds/bds.flags.spec.ts
services/ptt-crm-api/src/config/app-config.service.ts             # bdsTxEnabled
services/ptt-crm-api/src/bds/guards/bds-tx.guard.ts
services/ptt-crm-api/src/bds/guards/bds-tx.guard.spec.ts
services/ptt-crm-api/src/bds/transactions/bds-tx.types.ts
services/ptt-crm-api/src/bds/transactions/bds-tx.util.ts
services/ptt-crm-api/src/bds/transactions/bds-tx.util.spec.ts
services/ptt-crm-api/src/bds/transactions/bds-tx.repository.ts
services/ptt-crm-api/src/bds/transactions/bds-tx.service.ts
services/ptt-crm-api/src/bds/transactions/bds-tx.service.spec.ts
services/ptt-crm-api/src/bds/transactions/bds-tx.controller.ts
services/ptt-crm-api/src/bds/transactions/bds-tx.controller.spec.ts
services/ptt-crm-api/src/bds/bds.module.ts
docs/superpowers/plans/2026-08-22-bds-coding-roadmap.md           # hàng P4
```

Không sửa DDL P0–P3. Transition máy căn **đã có** (`hold:deposit` → `booked`, v.v.) — không đổi util P1 trừ khi test đỏ chứng minh thiếu event.

---

### Task 1: Flag TX + util stage

**Files:**
- Modify: `services/ptt-crm-api/src/bds/bds.flags.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.flags.spec.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts` — `bdsTxEnabled` cạnh `bdsPolicyEnabled`
- Create: `services/ptt-crm-api/src/bds/guards/bds-tx.guard.ts`
- Create: `services/ptt-crm-api/src/bds/guards/bds-tx.guard.spec.ts`
- Create: `services/ptt-crm-api/src/bds/transactions/bds-tx.types.ts`
- Create: `services/ptt-crm-api/src/bds/transactions/bds-tx.util.ts`
- Create: `services/ptt-crm-api/src/bds/transactions/bds-tx.util.spec.ts`

**Interfaces:**
- Produces: `isBdsTxEnabled(): boolean`
- Produces: `BdsTxGuard` → 404 unless PACK **và** TX
- Produces: `isOpenTxStage(stage): boolean` — không `cancelled`/`lost`
- Produces: `assertDepositMin(depositVnd, minVnd): void` — `depositVnd < minVnd` → ném `{ error: 'deposit_min' }`
- Produces: `decideTxChannel(channelPartnerId?: string): 'inhouse' | 'agency'`
- Produces: `canAdvanceTx(from, to): boolean` — xem bảng dưới
- Produces: `unitEventForConvert(unitStatus): 'deposit' | never` — `hold` hoặc `reserved` → `'deposit'`
- Produces: `unitEventForReservation(): 'reservation_fee'`
- Produces: `unitEventForContract(): 'contract'`
- Produces: `unitEventForCancel(unitStatus): 'cancel'` — `reserved` hoặc `booked`

Bảng `canAdvanceTx` (P4):

| from | to |
|------|-----|
| (new) | `reservation` hoặc `deposit` (create, không gọi hàm này) |
| `reservation` | `deposit` |
| `deposit` | `vbtt` **hoặc** `contracted` (bỏ qua VBTT được) |
| `vbtt` | `contracted` |
| `reservation` \| `deposit` \| `vbtt` | `cancelled` |
| `contracted` | **không** `cancelled` ở P4 |

- [ ] **Step 1: Flags + util spec (RED)**

```ts
// bds.flags.spec.ts — restore PTT_BDS_TX in afterEach (delete if prev undefined)
it('defaults TX off when unset', () => {
  delete process.env.PTT_BDS_TX;
  expect(isBdsTxEnabled()).toBe(false);
});

it('TX on for 1', () => {
  process.env.PTT_BDS_TX = '1';
  expect(isBdsTxEnabled()).toBe(true);
});
```

```ts
// bds-tx.guard.spec.ts — copy BdsPolicyGuard spec, đổi POLICY → TX
it('404 when PACK off', () => { ... });
it('404 when TX off', () => { ... });
it('allows when PACK and TX on', () => { ... });
```

```ts
// bds-tx.util.spec.ts
it('BDS-11 deposit under min throws deposit_min', () => {
  expect(() => assertDepositMin(50, 100)).toThrow(
    expect.objectContaining({ error: 'deposit_min' }),
  );
});

it('deposit at or over min ok', () => {
  expect(() => assertDepositMin(100, 100)).not.toThrow();
  expect(() => assertDepositMin(150, 100)).not.toThrow();
});

it('empty channel → inhouse', () => {
  expect(decideTxChannel('')).toBe('inhouse');
  expect(decideTxChannel(undefined)).toBe('inhouse');
});

it('non-empty channel → agency', () => {
  expect(decideTxChannel('ag-1')).toBe('agency');
});

it('open stages exclude cancelled/lost', () => {
  expect(isOpenTxStage('deposit')).toBe(true);
  expect(isOpenTxStage('contracted')).toBe(true);
  expect(isOpenTxStage('cancelled')).toBe(false);
  expect(isOpenTxStage('lost')).toBe(false);
});

it('advance deposit→vbtt / deposit→contracted / vbtt→contracted', () => {
  expect(canAdvanceTx('deposit', 'vbtt')).toBe(true);
  expect(canAdvanceTx('deposit', 'contracted')).toBe(true);
  expect(canAdvanceTx('vbtt', 'contracted')).toBe(true);
  expect(canAdvanceTx('reservation', 'deposit')).toBe(true);
  expect(canAdvanceTx('contracted', 'cancelled')).toBe(false);
  expect(canAdvanceTx('deposit', 'reservation')).toBe(false);
});

it('unit events', () => {
  expect(unitEventForConvert('hold')).toBe('deposit');
  expect(unitEventForConvert('reserved')).toBe('deposit');
  expect(unitEventForReservation()).toBe('reservation_fee');
  expect(unitEventForContract()).toBe('contract');
  expect(unitEventForCancel('booked')).toBe('cancel');
  expect(unitEventForCancel('reserved')).toBe('cancel');
});
```

- [ ] **Step 2: RED rồi implement**

```ts
export function isBdsTxEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_TX);
}
```

Guard copy `BdsPolicyGuard`, đổi `isBdsTxEnabled`.

```ts
// bds-tx.types.ts
export type TxStage =
  | 'reservation'
  | 'deposit'
  | 'vbtt'
  | 'contracted'
  | 'handed_over'
  | 'title_issued'
  | 'cancelled'
  | 'lost';

export type TxChannel = 'inhouse' | 'agency';
```

```ts
// bds-tx.util.ts
const OPEN = new Set(['reservation', 'deposit', 'vbtt', 'contracted', 'handed_over', 'title_issued']);

const ADVANCES: Record<string, readonly string[]> = {
  reservation: ['deposit', 'cancelled'],
  deposit: ['vbtt', 'contracted', 'cancelled'],
  vbtt: ['contracted', 'cancelled'],
};

export function isOpenTxStage(stage: string): boolean {
  return OPEN.has(String(stage));
}

export function assertDepositMin(depositVnd: number, minVnd: number): void {
  if (depositVnd < minVnd) throw { error: 'deposit_min' };
}

export function decideTxChannel(channelPartnerId?: string): TxChannel {
  return String(channelPartnerId ?? '').trim() ? 'agency' : 'inhouse';
}

export function canAdvanceTx(from: string, to: string): boolean {
  return (ADVANCES[from] ?? []).includes(to);
}

export function unitEventForConvert(unitStatus: string): 'deposit' {
  const s = String(unitStatus);
  if (s !== 'hold' && s !== 'reserved') throw { error: 'unit_locked' };
  return 'deposit';
}

export function unitEventForReservation(): 'reservation_fee' {
  return 'reservation_fee';
}

export function unitEventForContract(): 'contract' {
  return 'contract';
}

export function unitEventForCancel(unitStatus: string): 'cancel' {
  const s = String(unitStatus);
  if (s !== 'reserved' && s !== 'booked') throw { error: 'unit_locked' };
  return 'cancel';
}
```

`AppConfigService`: `bdsTxEnabled` cùng kiểu `bdsPolicyEnabled` (`PTT_BDS_TX ?? '0'`).

Jest:

```bash
cd services/ptt-crm-api
./node_modules/.bin/jest src/bds/bds.flags.spec.ts src/bds/guards/bds-tx.guard.spec.ts src/bds/transactions/bds-tx.util.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 3: Commit** — chỉ khi user yêu cầu: `feat(bds): P4 TX flag and stage utils`

---

### Task 2: DDL `bds_transactions`

**Files:**
- Create: `docs/specs/postgresql-ddl-bds-p4.sql`
- Create: `scripts/apply_pg_ddl_bds_p4.sh` (copy `scripts/apply_pg_ddl_bds_p3.sh`, đổi file + echo `OK  bds P4 DDL`)

Không sửa DDL P0–P3. Không ADD FK `products` → TX.

- [ ] **Step 1: Write DDL**

```sql
-- Pack BĐS P4 — Apply: scripts/apply_pg_ddl_bds_p4.sh
BEGIN;

CREATE TABLE IF NOT EXISTS bds_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES crm_re_project_products (id) ON DELETE CASCADE,
  hold_id UUID,
  lead_id INTEGER NOT NULL,
  buyer_id UUID,
  policy_id UUID,
  channel_partner_id TEXT NOT NULL DEFAULT '',
  closer_staff_id INTEGER,
  first_touch_staff_id INTEGER,
  stage TEXT NOT NULL DEFAULT 'deposit'
    CHECK (stage IN (
      'reservation', 'deposit', 'vbtt', 'contracted',
      'handed_over', 'title_issued', 'cancelled', 'lost'
    )),
  channel TEXT NOT NULL DEFAULT 'inhouse'
    CHECK (channel IN ('inhouse', 'agency')),
  list_price_vnd BIGINT NOT NULL DEFAULT 0,
  net_price_vnd BIGINT NOT NULL DEFAULT 0,
  discount_vnd BIGINT NOT NULL DEFAULT 0,
  reservation_fee_vnd BIGINT NOT NULL DEFAULT 0,
  reservation_paid_at TIMESTAMPTZ,
  deposit_vnd BIGINT NOT NULL DEFAULT 0,
  deposit_paid_at TIMESTAMPTZ,
  vbtt_no TEXT NOT NULL DEFAULT '',
  vbtt_at TIMESTAMPTZ,
  contract_no TEXT NOT NULL DEFAULT '',
  contracted_at TIMESTAMPTZ,
  paid_pct NUMERIC NOT NULL DEFAULT 0,
  mortgage_status TEXT NOT NULL DEFAULT 'none'
    CHECK (mortgage_status IN ('none', 'applying', 'approved', 'disbursed', 'rejected')),
  handover_at TIMESTAMPTZ,
  title_issued_at TIMESTAMPTZ,
  lost_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_tx_one_open
  ON bds_transactions (product_id)
  WHERE stage NOT IN ('cancelled', 'lost');

CREATE INDEX IF NOT EXISTS idx_bds_tx_project_stage
  ON bds_transactions (project_id, stage);

COMMIT;
```

Không FK `hold_id` → `bds_holds` / `policy_id` → `bds_sales_policies` (tránh vòng khi archive / convert). Service giữ đồng bộ.

- [ ] **Step 2: Apply local (idempotent ×2)**

```bash
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
bash scripts/apply_pg_ddl_bds_p4.sh
bash scripts/apply_pg_ddl_bds_p4.sh
psql "$DATABASE_URL" -c '\d bds_transactions'
```

Expected: bảng + `uq_bds_tx_one_open`; lần 2 NOTICE / OK. Nếu Docker postgres down: start `rnosai-postgres`.

- [ ] **Step 3: Commit** — chỉ khi user yêu cầu

---

### Task 3: Repo TX + idempotency

**Files:**
- Create: `services/ptt-crm-api/src/bds/transactions/bds-tx.repository.ts`

**Interfaces:**
- Consumes: bảng Task 2 + `bds_idempotency_keys` (P2)
- Produces:
  - `insertTx(row): TxRow`
  - `getTx(id): TxRow | null`
  - `getOpenByProduct(productId): TxRow | null`
  - `listByProject(projectId): TxRow[]`
  - `setStageIf(id, stage, extra, expected): TxRow | null`
  - `resolveProjectTenantId(projectId): string | null`
  - `getProjectOnePrice(projectId): boolean | null`
  - `getIdempotency(route, key)` / `putIdempotency(...)` — copy SQL P2 `BdsHoldRepository` (cùng bảng)

Pool pattern copy `BdsHoldRepository`.

`insertTx` bắt `23505` → ném `{ code: '23505' }`.

`TxRow` fields khớp cột Task 2 (`list_price_vnd` / `deposit_vnd` / `paid_pct` đọc `Number(...)`).

```ts
async setStageIf(
  id: string,
  stage: TxStage,
  extra: Record<string, unknown>,
  expected: TxStage,
): Promise<TxRow | null> {
  // UPDATE ... SET stage=$2, <optional cols from extra>, updated_at=NOW()
  // WHERE id=$1 AND stage=$expected RETURNING *
}
```

`extra` keys được phép (chỉ set nếu !== undefined):  
`deposit_vnd`, `deposit_paid_at`, `reservation_fee_vnd`, `reservation_paid_at`, `vbtt_no`, `vbtt_at`, `contract_no`, `contracted_at`, `lost_reason`, `list_price_vnd`, `net_price_vnd`, `discount_vnd`, `policy_id`.

Không bắt buộc Jest repo. `tsc --noEmit` 0.

- [ ] **Step 1: Implement repo**
- [ ] **Step 2:** `./node_modules/.bin/tsc -p tsconfig.build.json --noEmit` exit 0

---

### Task 4: Service convert-deposit — BDS-11

**Files:**
- Create: `services/ptt-crm-api/src/bds/transactions/bds-tx.service.ts`
- Create: `services/ptt-crm-api/src/bds/transactions/bds-tx.service.spec.ts`
- Modify: `bds.module.ts` — providers `BdsTxRepository`, `BdsTxService`; export service. **Không** controller ở task này.

**Interfaces:**
- Consumes: TX repo; `BdsHoldRepository.getHold` / `setHoldStatusIf`; `BdsInventoryService.getOrThrow` / `transition`; `BdsReProductPgRepository.setHoldPointers`; `BdsPolicyService.get` (hoặc repo `getPolicy` + `getProjectOnePrice`)
- Produces: `convertDeposit(holdId, body, opts): TxRow`

`ConvertDepositBody`:

```ts
{
  deposit_vnd: number;
  policy_id: string;
  row_version: number;
  list_price_vnd?: number;      // default unit.list_price_vnd
  discount_pct?: number;        // default 0
  discount_approved?: boolean;
  net_price_vnd?: number;       // optional one_price check
}
```

`ConvertOpts`: `{ tenantId?: string; idempotencyKey?: string; now?: Date }`

Thứ tự `convertDeposit`:

1. Replay idempotency nếu key + route `POST /holds/${holdId}/convert-deposit` còn trong 24h.
2. `deposit_vnd` / `row_version` không finite → 400 `{ error: 'deposit_vnd' }` / `{ error: 'row_version' }`.
3. `policy_id` trim rỗng → 400 `{ error: 'policy_id' }`.
4. `getHold` — 404 tenant (copy `getHoldOrThrow` P2). `status !== 'active'` → 409 `{ error: 'hold_closed' }`.
5. `getOrThrow(hold.product_id)` — unit không `hold`/`reserved` → 409 `{ error: 'unit_locked' }`.
6. `BdsPolicyService.get(policy_id, tenantId)` — 404. `policy.project_id !== hold.project_id` → 404.
7. `assertDepositMin(deposit_vnd, policy.deposit_min_vnd)` → `BadRequestException`.
8. `list = list_price_vnd ?? Number(unit.list_price_vnd ?? 0)`. `discount_pct` default 0. `assertDiscountAllowed(cap, pct, !!approved)` → 400 `discount_cap`.
9. `net = computeNetFromCsBh(list, pct)`. Nếu `net_price_vnd` là số: `assertOnePrice(getProjectOnePrice ?? true, ...)`.
10. `insertTx` stage `deposit`, `hold_id`, snapshot giá, `channel` từ hold, `deposit_paid_at=now`, `tenant_id` từ hold/unit/project (**không** body). 23505 → 409 `{ error: 'tx_open' }`.
11. `inventory.transition(product_id, 'deposit', row_version, tenantId)`. Fail → `setStageIf(id, 'cancelled', { lost_reason: 'conflict' }, 'deposit')` rồi ném 409 `unit_locked` (không để TX open + căn không booked).
12. `setHoldStatusIf(hold.id, 'converted', {}, 'active')`. Miss → 409 `{ error: 'hold_closed' }` (TX đã insert: vẫn `setStageIf` cancelled + **không** transition ngược nếu unit đã booked — nếu step 12 miss **sau** transition thành công: cancel TX **và** `transition(..., 'cancel', newVersion)` nếu unit `booked`. Test: mock setHoldStatusIf null **trước** transition thì không cần; mock null **sau** transition → cancel unit + TX).
13. `putIdempotency` status 201 + TX row.
14. Return TX.

Khuyến nghị thứ tự an toàn (tránh căn booked + hold vẫn active): **transition unit trước** `setHoldStatusIf` converted, giống P2 cancel (unit rồi hold). Nếu hold If-miss sau unit booked: `transition cancel` + cancel TX.

Đơn giản hơn cho implementer (chọn **một**, viết test khớp):

**Thứ tự khóa:** insert TX → transition unit → convert hold → idempotency.  
Fail transition: cancel TX vừa insert.  
Fail convert hold: cancel unit (`cancel`) + cancel TX.

Tenant header khác hold.tenant_id → 404. Không persist header.

- [ ] **Step 1: Spec (RED)**

```ts
const holds = {
  getHold: jest.fn(),
  setHoldStatusIf: jest.fn(),
  getIdempotency: jest.fn(),
  putIdempotency: jest.fn(),
};
const inventory = {
  getOrThrow: jest.fn(),
  transition: jest.fn().mockResolvedValue({ id: 9, status: 'booked', row_version: 2 }),
};
const products = { setHoldPointers: jest.fn(), resolveProjectTenantId: jest.fn() };
const policies = { get: jest.fn() };
const repo = {
  insertTx: jest.fn(),
  setStageIf: jest.fn(),
  getIdempotency: jest.fn(),
  putIdempotency: jest.fn(),
  getProjectOnePrice: jest.fn().mockResolvedValue(true),
  resolveProjectTenantId: jest.fn().mockResolvedValue('t1'),
};

it('BDS-11 deposit under min → 400 deposit_min', async () => {
  holds.getHold.mockResolvedValue({
    id: 'h1', product_id: 9, project_id: 1, lead_id: 7, status: 'active',
    tenant_id: 't1', channel_partner_id: '',
  });
  inventory.getOrThrow.mockResolvedValue({
    id: 9, project_id: 1, status: 'hold', row_version: 1, list_price_vnd: 1000, tenant_id: 't1',
  });
  policies.get.mockResolvedValue({ id: 'pol', project_id: 1, deposit_min_vnd: 100, discount_cap_pct: 5 });
  const svc = new BdsTxService(repo as never, holds as never, inventory as never, products as never, policies as never);
  await expect(
    svc.convertDeposit('h1', { deposit_vnd: 50, policy_id: 'pol', row_version: 1 }, { tenantId: 't1' }),
  ).rejects.toMatchObject({ response: { error: 'deposit_min' } });
  expect(repo.insertTx).not.toHaveBeenCalled();
});

it('convert active hold → deposit TX + unit booked + hold converted', async () => {
  holds.getHold.mockResolvedValue({
    id: 'h1', product_id: 9, project_id: 1, lead_id: 7, status: 'active',
    tenant_id: 't1', channel_partner_id: '',
  });
  inventory.getOrThrow.mockResolvedValue({
    id: 9, project_id: 1, status: 'hold', row_version: 3, list_price_vnd: 1000, tenant_id: 't1',
  });
  policies.get.mockResolvedValue({ id: 'pol', project_id: 1, deposit_min_vnd: 100, discount_cap_pct: 5 });
  repo.insertTx.mockImplementation(async (row) => ({ id: 'tx1', ...row }));
  holds.setHoldStatusIf.mockResolvedValue({ id: 'h1', status: 'converted' });
  const svc = new BdsTxService(/* mocks */);
  const out = await svc.convertDeposit(
    'h1',
    { deposit_vnd: 200, policy_id: 'pol', row_version: 3, discount_pct: 0 },
    { tenantId: 't1' },
  );
  expect(out.stage).toBe('deposit');
  expect(inventory.transition).toHaveBeenCalledWith(9, 'deposit', 3, 't1');
  expect(holds.setHoldStatusIf).toHaveBeenCalledWith('h1', 'converted', {}, 'active');
});

it('pending hold → 409 hold_closed', async () => {
  holds.getHold.mockResolvedValue({ id: 'h1', status: 'pending', tenant_id: 't1', product_id: 9 });
  const svc = new BdsTxService(/* mocks */);
  await expect(
    svc.convertDeposit('h1', { deposit_vnd: 200, policy_id: 'pol', row_version: 1 }, { tenantId: 't1' }),
  ).rejects.toMatchObject({ response: { error: 'hold_closed' } });
});
```

Map Nest: `BadRequestException` / `ConflictException` / `NotFoundException`. Bắt `{ error }` từ util → `BadRequestException`.

- [ ] **Step 2: Implement + Jest `src/bds/transactions/bds-tx.service.spec.ts --runInBand` xanh**
- [ ] **Step 3: Commit** — chỉ khi user yêu cầu

---

### Task 5: Reservation + VBTT + contract (không cổng %)

**Files:**
- Modify: `bds-tx.service.ts` + spec

**Interfaces:**
- Produces:
  - `reservation(holdId, body, opts): TxRow` — UC-017
  - `vbtt(txId, body, tenantId?): TxRow`
  - `contract(txId, body, tenantId?): TxRow` — **không** `paid_pct` / legal gate
  - `get(id, tenantId?): TxRow`
  - `listByProject(projectId, tenantId?): TxRow[]`

`ReservationBody`: `{ reservation_fee_vnd: number; row_version: number }`  
`fee <= 0` hoặc không finite → 400 `{ error: 'reservation_fee_vnd' }`.  
Hold phải `active`, unit phải `hold`. Insert TX `reservation`, transition `reservation_fee`, hold `converted`. Idempotency route `POST /holds/${holdId}/reservation`. 23505 → 409 `tx_open`.

Từ reservation → cọc: `convertDeposit` khi unit `reserved` + hold **đã** `converted`.  
**Quyết định khóa:** convert từ reservation **không** cần hold `active`. Nếu `getOpenByProduct` = reservation cùng `hold_id`: `setStageIf(..., 'deposit', extras, 'reservation')` thay vì `insertTx`. Không hold active → không 409 `hold_closed`. Test: reservation rồi convert cùng hold_id.

`VbttBody`: `{ vbtt_no: string }` — trim rỗng → 400 `{ error: 'vbtt_no' }`.  
`canAdvanceTx(stage, 'vbtt')` false → 409 `{ error: 'tx_stage' }`.  
`setStageIf(..., 'vbtt', { vbtt_no, vbtt_at: now }, expected)`. Miss → 409 `{ error: 'tx_closed' }`. Không đụng căn.

`ContractBody`: `{ contract_no: string; row_version: number }`  
`contract_no` trim rỗng → 400 `{ error: 'contract_no' }`.  
`canAdvanceTx(stage, 'contracted')` false → 409 `{ error: 'tx_stage' }`.  
Unit phải `booked` (nếu `reserved` mà skip cọc — **cấm**; phải deposit trước).  
Thứ tự: transition `contract` **rồi** `setStageIf` `contracted`. Transition fail → không đổi stage. If-miss sau sold: **không** `reverse_sold` (P4); ném 409 `{ error: 'tx_closed' }` + log (ledger Minor). Test If-miss **trước** transition.

`listByProject`: `assert` project qua `inventory.listUnits(projectId, tenantId)` (404 tenant, giống hold list) rồi `repo.listByProject`.

- [ ] **Step 1: Spec (RED)**

```ts
it('reservation active hold → reserved unit + TX reservation', async () => { ... });

it('convert after reservation advances same TX to deposit', async () => {
  repo.getOpenByProduct.mockResolvedValue({ id: 'tx1', stage: 'reservation', hold_id: 'h1', product_id: 9, project_id: 1 });
  holds.getHold.mockResolvedValue({ id: 'h1', status: 'converted', product_id: 9, project_id: 1, tenant_id: 't1', lead_id: 7, channel_partner_id: '' });
  inventory.getOrThrow.mockResolvedValue({ id: 9, status: 'reserved', row_version: 4, list_price_vnd: 1000, project_id: 1, tenant_id: 't1' });
  policies.get.mockResolvedValue({ id: 'pol', project_id: 1, deposit_min_vnd: 100, discount_cap_pct: 5 });
  repo.setStageIf.mockResolvedValue({ id: 'tx1', stage: 'deposit' });
  // không insertTx
  await svc.convertDeposit('h1', { deposit_vnd: 200, policy_id: 'pol', row_version: 4 }, { tenantId: 't1' });
  expect(repo.insertTx).not.toHaveBeenCalled();
  expect(repo.setStageIf).toHaveBeenCalledWith('tx1', 'deposit', expect.anything(), 'reservation');
  expect(inventory.transition).toHaveBeenCalledWith(9, 'deposit', 4, 't1');
});

it('vbtt from deposit ok; from contracted → 409 tx_stage', async () => { ... });

it('contract from deposit → sold + contracted (no paid_pct check)', async () => {
  repo.getTx.mockResolvedValue({ id: 'tx1', stage: 'deposit', product_id: 9, tenant_id: 't1', project_id: 1 });
  inventory.getOrThrow.mockResolvedValue({ id: 9, status: 'booked', row_version: 5, tenant_id: 't1' });
  repo.setStageIf.mockResolvedValue({ id: 'tx1', stage: 'contracted' });
  await svc.contract('tx1', { contract_no: 'HD-1', row_version: 5 }, 't1');
  expect(inventory.transition).toHaveBeenCalledWith(9, 'contract', 5, 't1');
  // không gọi legal gate / paid_pct
});
```

- [ ] **Step 2: Implement + Jest `src/bds/transactions --runInBand` xanh**

---

### Task 6: Cancel — BDS-14

**Files:**
- Modify: `bds-tx.service.ts` + spec

**Interfaces:**
- Produces: `cancel(txId, reason, tenantId?): TxRow`

`reason` trim `< 3` → 400 `{ error: 'reason' }`.  
`getTx` 404 tenant.  
`!canAdvanceTx(stage, 'cancelled')` (gồm `contracted`) → 409 `{ error: 'tx_closed' }`.  
Unit `reserved` hoặc `booked` → `transition(..., 'cancel', row_version)` **trước** `setStageIf` cancelled (P2 cancel order). Lấy `row_version` từ unit hiện tại (`getOrThrow`), không bắt client gửi version (hủy vận hành). Transition fail → 409 `unit_locked`, không đổi TX.  
Unit đã `available` (race) → vẫn `setStageIf` cancelled.  
`setHoldPointers(product_id, { hold_id: null, hold_lead_id: null, hold_at: '' })`.  
`setStageIf(..., 'cancelled', { lost_reason: reason }, expectedStage)`. Miss → 409 `{ error: 'tx_closed' }`.

Không `reverse_sold`. Không clawback HH.

- [ ] **Step 1: Spec (RED)**

```ts
it('BDS-14 cancel deposit → TX cancelled + unit available + clear pointers', async () => {
  repo.getTx.mockResolvedValue({
    id: 'tx1', stage: 'deposit', product_id: 9, tenant_id: 't1', project_id: 1,
  });
  inventory.getOrThrow.mockResolvedValue({ id: 9, status: 'booked', row_version: 6, tenant_id: 't1' });
  repo.setStageIf.mockResolvedValue({ id: 'tx1', stage: 'cancelled' });
  await svc.cancel('tx1', 'khach bo', 't1');
  expect(inventory.transition).toHaveBeenCalledWith(9, 'cancel', 6, 't1');
  expect(products.setHoldPointers).toHaveBeenCalledWith(9, {
    hold_id: null, hold_lead_id: null, hold_at: '',
  });
  expect(inventory.transition.mock.invocationCallOrder[0]).toBeLessThan(
    repo.setStageIf.mock.invocationCallOrder[0],
  );
});

it('cancel contracted → 409 tx_closed, no transition', async () => {
  repo.getTx.mockResolvedValue({ id: 'tx1', stage: 'contracted', product_id: 9, tenant_id: 't1' });
  await expect(svc.cancel('tx1', 'nope', 't1')).rejects.toMatchObject({
    response: { error: 'tx_closed' },
  });
  expect(inventory.transition).not.toHaveBeenCalled();
});

it('reason too short → 400', async () => {
  await expect(svc.cancel('tx1', 'ab', 't1')).rejects.toMatchObject({
    response: { error: 'reason' },
  });
});
```

- [ ] **Step 2: Implement + Jest `src/bds/transactions --runInBand` xanh**

---

### Task 7: HTTP + module + DoD

**Files:**
- Create: `services/ptt-crm-api/src/bds/transactions/bds-tx.controller.ts`
- Create: `services/ptt-crm-api/src/bds/transactions/bds-tx.controller.spec.ts` (thin: `convertDeposit` / `cancel` delegate)
- Modify: `bds.module.ts` — `BdsTxController` + `BdsTxGuard`
- Modify: roadmap hàng P4

**Guards:** `@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsTxGuard)`.

| Method | Path | HttpCode |
|--------|------|----------|
| POST | `/api/v1/bds/holds/:id/convert-deposit` | **201** |
| POST | `/api/v1/bds/holds/:id/reservation` | **201** |
| GET | `/api/v1/bds/transactions/:id` | 200 |
| GET | `/api/v1/bds/projects/:id/transactions` | 200 |
| POST | `/api/v1/bds/transactions/:id/vbtt` | 200 |
| POST | `/api/v1/bds/transactions/:id/contract` | 200 |
| POST | `/api/v1/bds/transactions/:id/cancel` | 200 |

Hold id / TX id = UUID string. Project `:id` = `ParseIntPipe`.

`convert-deposit` **không** gắn `BdsHoldController` (tránh PACK-only lọt khi TX=0). Cùng prefix `/api/v1/bds` trên controller TX.

```ts
@Controller('api/v1/bds')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsTxGuard)
export class BdsTxController {
  constructor(private readonly txs: BdsTxService) {}

  @Post('holds/:id/convert-deposit')
  convertDeposit(
    @Param('id') id: string,
    @Body() body: ConvertDepositBody,
    @Headers('x-bds-tenant') tenantId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.txs.convertDeposit(id, {
      deposit_vnd: Number(body.deposit_vnd),
      policy_id: String(body.policy_id ?? ''),
      row_version: Number(body.row_version),
      list_price_vnd: body.list_price_vnd,
      discount_pct: body.discount_pct,
      discount_approved: body.discount_approved,
      net_price_vnd: body.net_price_vnd,
    }, { tenantId, idempotencyKey });
  }
}
```

Header `x-bds-tenant` chỉ auth/404. Không route `handover`. Không `paid_pct` body trên contract.

Roadmap:

| Cột | Giá trị |
|-----|---------|
| Plan file | `[bds-p4-transaction.md](./2026-08-22-bds-p4-transaction.md)` |
| Thắng | `BDS-11, BDS-14` |

Mục «### P4 — Transaction» giữ: stage reservation→deposit→vbtt→contracted; HĐMB **chưa** BR-27 đến P4b. Thêm: convert `Idempotency-Key`; BDS-31/32 = P4b.

Flag §4: thêm `PTT_BDS_TX` sau POLICY — mặc định 0; staging bật khi PACK=1 + P2 + P3.

- [ ] **Step 1: Register; `tsc --noEmit` 0; Jest `src/bds --runInBand` xanh**
- [ ] **Step 2: PACK=0 hoặc TX=0 → HTTP convert 404 (sau auth)**
- [ ] **Step 3: Roadmap P4**

---

## 4. Definition of Done P4

- [ ] Jest flags + tx util + tx service + guard + controller xanh
- [ ] `tsc` build api 0
- [ ] DDL P4 apply idempotent
- [ ] BDS-11: convert `deposit_vnd < deposit_min` → 400 `{ error: 'deposit_min' }`
- [ ] Convert hold `active` + đủ min → TX `deposit`, căn `booked`, hold `converted`
- [ ] BDS-14: cancel deposit → TX `cancelled`, căn `available`, pointers null
- [ ] Cancel `contracted` → 409 `tx_closed`
- [ ] `contract` không đọc `paid_pct` / legal gate
- [ ] PACK=0 hoặc TX=0 → HTTP TX 404
- [ ] Prod không bật PACK / TX
- [ ] Không receipts / không agency / không UI `/crm/bds`

---

## 5. Rollback

`PTT_BDS_PACK=0` và/hoặc `PTT_BDS_TX=0`. Không DROP `bds_transactions` trên prod.

---

## 6. Sau P4 xanh

P4b collection + cổng HĐMB (BDS-31/32, phiếu thu, `paid_pct`). P5 Agency + BDS-33 HTTP. P7 ledger lúc `contracted`. P8 UI hồ sơ cọc/VBTT/HĐMB.

---

*P4 không phải Collection OS. Thắng: cọc dưới min bị chặn; hủy cọc trả căn; HĐMB API có nhưng chưa khóa %.*
