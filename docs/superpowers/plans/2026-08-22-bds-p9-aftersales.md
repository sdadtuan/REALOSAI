# P9 Triển khai — After-sales (checklist bàn giao, defect, sổ hồng)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After-sales OS trên PG: hẹn bàn giao, checklist 4 mục bắt buộc (hoặc waive `cdt_aftersales`), cổng `handed_over` (BDS-38 / BR-BDS-32), ticket `defect|title|other` **không** ghi `crm_staff_tickets` (BR-BDS-46), `title_status` submitted → issued → handed_to_buyer (UC-041…043). UI mỏng `/crm/bds/aftersales` (SCR-BDS-100).

**Architecture:** Bounded context `src/bds/aftersales/` (`BdsAftersalesService` = spec §23.7). HTTP sau `StaffOrInternalKeyGuard` + `BdsPackGuard` + `BdsAftersalesGuard` (`PTT_BDS_PACK=1` **và** `PTT_BDS_AFTERSALES=1`). Cổng bàn giao: `BdsTxService.handover` gọi `aftersales.assertCanHandover` **chỉ khi** AFTERSALES=1 — flag tắt → route handover/title/defect **404**, TX P4 giữ `contracted`. Tenant `broker` → board/hub aftersales **404** (CSKH sau bán là CĐT). Không import `ReProjectsModule`. Không đụng `crm_staff_tickets` / `/crm/work`.

**Tech Stack:** NestJS `ptt-crm-api` + Jest; Next.js `ops-web` + Vitest; `pg` Pool; `psql`.

**Spec:** [2026-08-21-bds-industry-pack-design.md](../specs/2026-08-21-bds-industry-pack-design.md) §10.3–10.4, §15 P9, §23.2, §23.7, BR-BDS-32/46.  
**UX:** [2026-08-22-bds-ux-ui-design.md](../specs/2026-08-22-bds-ux-ui-design.md) §4.14 SCR-BDS-100.  
**UC:** [13-BDS-INDUSTRY-PACK.md](../../use-cases/13-BDS-INDUSTRY-PACK.md) UC-041, UC-042, UC-043.  
**P4:** [2026-08-22-bds-p4-transaction.md](./2026-08-22-bds-p4-transaction.md) — stage `handed_over` / `title_issued` đã có trên DDL, **chưa** có API.  
**P4b:** [2026-08-22-bds-p4b-collection.md](./2026-08-22-bds-p4b-collection.md) — TX `contracted` là intake after-sales.  
**P7:** [2026-08-22-bds-p7-commission.md](./2026-08-22-bds-p7-commission.md) — `onTxStage(..., 'handed_over')` đã type-ready, P7 **không** gọi.  
**P8:** [2026-08-22-bds-p8-ui-rbac.md](./2026-08-22-bds-p8-ui-rbac.md) — cap `bds_aftersales` đã catalog; nav **chưa** có «Sau bán».  
**Roadmap:** [2026-08-22-bds-coding-roadmap.md](./2026-08-22-bds-coding-roadmap.md)

**Test ID P9:** BDS-38 (bàn giao thiếu checklist → 400 `{ error: 'handover_checklist' }`).  
**UC-041** hẹn + pass/waive → `handed_over`.  
**UC-042** POST defect sau BG; cấm `crm_staff_tickets`.  
**UC-043** `POST .../title` submitted → issued → handed_to_buyer.  
**Ticket việc `handover_book` / work ticket trỏ defect** = **P12**.  
**Portal buyer / email-Zalo mốc XD** = ngoài v1.  
**Cron nhắc 15N** = v1 tính on-read `appointment_due` trên GET board (không job).  
**Template checklist theo dự án** = ngoài P9 (catalog cố định 4 mục).

**Hướng khóa: 1** — API đủ cổng + UI list/detail mỏng (giống P4b logic + P8 page). Không wizard, không cron, không P12.

| Hướng | Làm | Không | Khi nào chọn |
|-------|-----|-------|----------------|
| **1 (khóa)** | Flag + DDL + API + cổng BDS-38 + page `/crm/bds/aftersales` + nav | Cron, portal, work ticket, checklist theo DA | Đúng cổng P4b→P9 |
| 2 | Chỉ API, không FE | Nav «Sau bán» | Nếu muốn tách UI sang P9b |
| 3 | After OS đầy đủ: cron 15N, template DA, email, P12 link | — | Quá rộng, phá YAGNI |

---

## Global Constraints

- `PTT_BDS_PACK` mặc định `0` — mọi `/api/v1/bds/*` = **404**.
- `PTT_BDS_AFTERSALES` mặc định `0` — route aftersales + handover/title/defect = **404** dù PACK=1. TX `contract` P4 **nguyên**.
- GET ngoài tenant = **404**, không 403, không PII (BR-BDS-05).
- Tenant `broker` không có board aftersales (404).
- Bàn giao thiếu 4 mục `pass` và không waive → 400 `{ error: 'handover_checklist' }` (BDS-38 / BR-BDS-32).
- Waive chỉ khi caller có cap `bds_aftersales` **approve** + `waive_reason` ≥ 3 ký tự.
- Ticket after-sales **cấm** INSERT `crm_staff_tickets` (BR-BDS-46).
- `re_buyer` không liên quan P9 (không Deal Room, không đổi P6).
- `BdsModule` **không** import `ReProjectsModule`.
- Folder `aftersales/` — hook TX: `@Optional() BdsAftersalesService` **không** cần nếu handover sống trong aftersales service và gọi `BdsTxRepository.setStageIf` trực tiếp. **Khóa:** aftersales service gọi `txRepo.setStageIf`; `BdsTxService` **không** thêm method `handover` (tránh hai cổng). Commission: aftersales gọi `commission?.onTxStage(updated, 'handed_over')` khi COMMISSION=1.
- Tiếng Việt UI: Bàn giao · Sổ hồng · Bảo hành. Không «Handover / Closing».
- `DATABASE_URL` script: `postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb`.
- Test API: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand`.
- Test FE: `cd services/ops-web && ./node_modules/.bin/vitest run <file>`.
- Không commit trừ khi user yêu cầu.
- Prod VPS: **không** bật `PTT_BDS_PACK` / `PTT_BDS_AFTERSALES`.

---

## 0. Phạm vi / ngoài phạm vi

**Làm**

- Flag `isBdsAftersalesEnabled()` + `BdsAftersalesGuard`
- DDL: `title_status` + appointment/waive trên `bds_transactions`; `bds_handover_checks`; `bds_aftersales_tickets`
- Catalog checklist cố định: `water` · `electric` · `interior` · `minutes`
- `GET /aftersales` board TX `contracted`+
- `POST /transactions/:id/handover-appointment`
- `POST /transactions/:id/handover-check`
- `POST /transactions/:id/handover` (BDS-38)
- `POST /transactions/:id/defects` (sau `handed_over`)
- `PATCH /aftersales-tickets/:id`
- `POST /transactions/:id/title`
- `GET /transactions/:id/aftersales`
- Mở `canAdvanceTx`: `contracted → handed_over`, `handed_over → title_issued`
- Hook commission `handed_over` nếu COMMISSION=1
- Page + nav «Sau bán» (cap `bds_aftersales` view); ẩn với broker

**Không làm**

- `crm_staff_tickets` / queue `handover_book` (P12)
- Work ticket «nhờ PM» trỏ defect (P12 — chỉ lưu `bds_aftersales_tickets`)
- Portal khách mua / email / Zalo mốc XD
- Cron 15N / SSE chuông
- Template checklist theo `project_id`
- Ra quân / war-room (P10)
- Chat `/crm/chat`
- Đổi cổng HĐMB P4b
- Payroll / sổ cái

---

## 1. File map

```
docs/specs/postgresql-ddl-bds-p9.sql
scripts/apply_pg_ddl_bds_p9.sh

services/ptt-crm-api/src/bds/bds.flags.ts                         # + isBdsAftersalesEnabled
services/ptt-crm-api/src/bds/bds.flags.spec.ts
services/ptt-crm-api/src/config/app-config.service.ts             # bdsAftersalesEnabled
services/ptt-crm-api/src/bds/guards/bds-aftersales.guard.ts
services/ptt-crm-api/src/bds/guards/bds-aftersales.guard.spec.ts
services/ptt-crm-api/src/bds/aftersales/bds-aftersales.types.ts
services/ptt-crm-api/src/bds/aftersales/bds-aftersales.util.ts
services/ptt-crm-api/src/bds/aftersales/bds-aftersales.util.spec.ts
services/ptt-crm-api/src/bds/aftersales/bds-aftersales.repository.ts
services/ptt-crm-api/src/bds/aftersales/bds-aftersales.service.ts
services/ptt-crm-api/src/bds/aftersales/bds-aftersales.service.spec.ts
services/ptt-crm-api/src/bds/aftersales/bds-aftersales.controller.ts
services/ptt-crm-api/src/bds/aftersales/bds-aftersales.controller.spec.ts
services/ptt-crm-api/src/bds/transactions/bds-tx.util.ts          # ADVANCES + title_issued
services/ptt-crm-api/src/bds/transactions/bds-tx.util.spec.ts
services/ptt-crm-api/src/bds/transactions/bds-tx.types.ts         # title_status trên TxRow
services/ptt-crm-api/src/bds/transactions/bds-tx.repository.ts    # map + STAGE_EXTRA_COLS
services/ptt-crm-api/src/bds/bds.module.ts

services/ops-web/src/lib/bds/api.ts                              # aftersales fetch/mutate
services/ops-web/src/lib/bds/nav.ts                              # link Sau bán
services/ops-web/src/lib/bds/nav.spec.ts
services/ops-web/src/components/layout/nav-icons.tsx             # /crm/bds/aftersales
services/ops-web/src/app/crm/bds/aftersales/page.tsx

docs/superpowers/plans/2026-08-22-bds-coding-roadmap.md           # link P9 + flag §4
```

Không sửa DDL P0–P8 (chỉ ALTER P4 table trong file P9). Không tạo `staff-tickets/`.

---

### Task 1: Flag AFTERSALES + util checklist / cổng / title

**Files:**
- Modify: `services/ptt-crm-api/src/bds/bds.flags.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.flags.spec.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts`
- Create: `services/ptt-crm-api/src/bds/guards/bds-aftersales.guard.ts`
- Create: `services/ptt-crm-api/src/bds/guards/bds-aftersales.guard.spec.ts`
- Create: `services/ptt-crm-api/src/bds/aftersales/bds-aftersales.types.ts`
- Create: `services/ptt-crm-api/src/bds/aftersales/bds-aftersales.util.ts`
- Create: `services/ptt-crm-api/src/bds/aftersales/bds-aftersales.util.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/transactions/bds-tx.util.ts`
- Modify: `services/ptt-crm-api/src/bds/transactions/bds-tx.util.spec.ts`

**Interfaces:**
- Consumes: `envFlagOn`, `canAdvanceTx` hiện có
- Produces: `isBdsAftersalesEnabled()`, `HANDOVER_CHECK_CODES`, `canHandover()`, `canAdvanceTitle()`, `appointmentDue()`

- [ ] **Step 1: Write failing tests**

`bds.flags.spec.ts` — thêm restore `PTT_BDS_AFTERSALES` trong `afterEach` (cùng pattern UI):

```ts
it('defaults AFTERSALES off when unset', () => {
  delete process.env.PTT_BDS_AFTERSALES;
  expect(isBdsAftersalesEnabled()).toBe(false);
});

it('AFTERSALES on for 1', () => {
  process.env.PTT_BDS_AFTERSALES = '1';
  expect(isBdsAftersalesEnabled()).toBe(true);
});
```

`bds-aftersales.util.spec.ts`:

```ts
import {
  HANDOVER_CHECK_CODES,
  appointmentDue,
  canAdvanceTitle,
  canHandover,
} from './bds-aftersales.util';

describe('bds-aftersales.util', () => {
  it('catalog has 4 codes', () => {
    expect(HANDOVER_CHECK_CODES).toEqual(['water', 'electric', 'interior', 'minutes']);
  });

  it('BDS-38: missing pass → cannot handover', () => {
    expect(canHandover([{ item_code: 'water', status: 'pass' }], { waive: false })).toBe(false);
  });

  it('all 4 pass → can handover', () => {
    const checks = HANDOVER_CHECK_CODES.map((item_code) => ({ item_code, status: 'pass' as const }));
    expect(canHandover(checks, { waive: false })).toBe(true);
  });

  it('fail item blocks even if others pass', () => {
    const checks = HANDOVER_CHECK_CODES.map((item_code) => ({
      item_code,
      status: item_code === 'water' ? ('fail' as const) : ('pass' as const),
    }));
    expect(canHandover(checks, { waive: false })).toBe(false);
  });

  it('waive + approve + reason ≥3 → can handover', () => {
    expect(
      canHandover([], { waive: true, hasApproveCap: true, waiveReason: 'KH nhận thô' }),
    ).toBe(true);
  });

  it('waive without approve cap → false', () => {
    expect(canHandover([], { waive: true, hasApproveCap: false, waiveReason: 'ok ok' })).toBe(false);
  });

  it('title submitted → issued → handed_to_buyer', () => {
    expect(canAdvanceTitle('not_started', 'submitted')).toBe(true);
    expect(canAdvanceTitle('submitted', 'issued')).toBe(true);
    expect(canAdvanceTitle('issued', 'handed_to_buyer')).toBe(true);
    expect(canAdvanceTitle('not_started', 'issued')).toBe(false);
    expect(canAdvanceTitle('handed_to_buyer', 'submitted')).toBe(false);
  });

  it('appointmentDue when missing or within 15 days', () => {
    const now = new Date('2026-08-22T00:00:00Z');
    expect(appointmentDue(null, now)).toBe(true);
    expect(appointmentDue(new Date('2026-08-30T00:00:00Z'), now)).toBe(true);
    expect(appointmentDue(new Date('2026-10-01T00:00:00Z'), now)).toBe(false);
  });
});
```

`bds-tx.util.spec.ts` — thêm:

```ts
expect(canAdvanceTx('contracted', 'handed_over')).toBe(true);
expect(canAdvanceTx('handed_over', 'title_issued')).toBe(true);
expect(canAdvanceTx('contracted', 'title_issued')).toBe(false);
expect(canAdvanceTx('handed_over', 'cancelled')).toBe(false);
```

`bds-aftersales.guard.spec.ts` — copy `bds-collection.guard.spec.ts`, đổi `PTT_BDS_COLLECTION` → `PTT_BDS_AFTERSALES`, class `BdsAftersalesGuard`.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/bds.flags.spec.ts src/bds/aftersales/bds-aftersales.util.spec.ts src/bds/guards/bds-aftersales.guard.spec.ts src/bds/transactions/bds-tx.util.spec.ts --runInBand`

Expected: FAIL — `isBdsAftersalesEnabled` / files not found; `canAdvanceTx('contracted', 'handed_over')` false.

- [ ] **Step 3: Minimal implementation**

`bds.flags.ts`:

```ts
export function isBdsAftersalesEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_AFTERSALES);
}
```

`app-config.service.ts` — thêm field + constructor (cạnh `bdsUiEnabled`):

```ts
readonly bdsAftersalesEnabled: boolean;
// constructor:
this.bdsAftersalesEnabled = ['1', 'true', 'yes', 'on'].includes(
  (process.env.PTT_BDS_AFTERSALES ?? '0').trim().toLowerCase(),
);
```

`bds-aftersales.guard.ts` — copy collection guard, gọi `isBdsAftersalesEnabled()`.

`bds-aftersales.types.ts`:

```ts
export const HANDOVER_CHECK_CODES = ['water', 'electric', 'interior', 'minutes'] as const;
export type HandoverCheckCode = (typeof HANDOVER_CHECK_CODES)[number];
export type CheckStatus = 'pending' | 'pass' | 'fail';
export type TitleStatus = 'not_started' | 'submitted' | 'issued' | 'handed_to_buyer';
export type AftersalesTicketKind = 'defect' | 'title' | 'other';
export type AftersalesTicketStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

export type CheckInput = { item_code: string; status: string };

export type HandoverGateOpts = {
  waive: boolean;
  hasApproveCap?: boolean;
  waiveReason?: string;
};

export type HandoverCheckRow = {
  id: string;
  tenant_id: string | null;
  transaction_id: string;
  item_code: HandoverCheckCode;
  status: CheckStatus;
  note: string;
  checked_by: number | null;
  checked_at: Date | null;
};

export type AftersalesTicketRow = {
  id: string;
  tenant_id: string | null;
  transaction_id: string;
  kind: AftersalesTicketKind;
  status: AftersalesTicketStatus;
  title: string;
  body: string;
  opened_by: number | null;
  created_at: Date;
  updated_at: Date;
};

export type AftersalesBoardRow = {
  transaction_id: string;
  project_id: number;
  product_id: number;
  stage: string;
  contract_no: string;
  handover_appointment_at: Date | null;
  appointment_due: boolean;
  title_status: TitleStatus;
  checks_passed: number;
  checks_total: number;
  open_defects: number;
};
```

`bds-aftersales.util.ts`:

```ts
import {
  HANDOVER_CHECK_CODES,
  type CheckInput,
  type HandoverGateOpts,
  type TitleStatus,
} from './bds-aftersales.types';

export { HANDOVER_CHECK_CODES };

const TITLE_NEXT: Record<TitleStatus, TitleStatus | null> = {
  not_started: 'submitted',
  submitted: 'issued',
  issued: 'handed_to_buyer',
  handed_to_buyer: null,
};

const APPOINTMENT_DUE_MS = 15 * 24 * 60 * 60 * 1000;

export function canHandover(checks: CheckInput[], opts: HandoverGateOpts): boolean {
  if (opts.waive) {
    return Boolean(opts.hasApproveCap) && String(opts.waiveReason ?? '').trim().length >= 3;
  }
  const passed = new Set(
    checks.filter((c) => c.status === 'pass').map((c) => c.item_code),
  );
  return HANDOVER_CHECK_CODES.every((code) => passed.has(code));
}

export function canAdvanceTitle(from: string, to: string): boolean {
  return TITLE_NEXT[from as TitleStatus] === to;
}

export function appointmentDue(scheduledAt: Date | null, now = new Date()): boolean {
  if (!scheduledAt) return true;
  return scheduledAt.getTime() - now.getTime() <= APPOINTMENT_DUE_MS;
}

export function isHandoverCheckCode(raw: string): raw is (typeof HANDOVER_CHECK_CODES)[number] {
  return (HANDOVER_CHECK_CODES as readonly string[]).includes(raw);
}
```

`bds-tx.util.ts` — mở ADVANCES:

```ts
const ADVANCES: Record<string, TxStage[]> = {
  reservation: ['deposit', 'cancelled'],
  deposit: ['vbtt', 'contracted', 'cancelled'],
  vbtt: ['contracted', 'cancelled'],
  contracted: ['handed_over'],
  handed_over: ['title_issued'],
};
```

Export `HANDOVER_CHECK_CODES` từ `types.ts` (util re-export) để service không import kép lệch.

- [ ] **Step 4: Run tests — expect PASS**

Cùng lệnh Step 2. Expected: PASS.

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu.

---

### Task 2: DDL P9 + apply script

**Files:**
- Create: `docs/specs/postgresql-ddl-bds-p9.sql`
- Create: `scripts/apply_pg_ddl_bds_p9.sh`

**Interfaces:**
- Consumes: `bds_transactions` P4 (đã có `handover_at`, `title_issued_at`, stage enum)
- Produces: cột aftersales trên TX + 2 bảng mới

- [ ] **Step 1: Write SQL**

```sql
-- Pack BĐS P9 — Apply: scripts/apply_pg_ddl_bds_p9.sh
BEGIN;

ALTER TABLE bds_transactions
  ADD COLUMN IF NOT EXISTS title_status TEXT NOT NULL DEFAULT 'not_started';

ALTER TABLE bds_transactions
  DROP CONSTRAINT IF EXISTS bds_transactions_title_status_check;

ALTER TABLE bds_transactions
  ADD CONSTRAINT bds_transactions_title_status_check
  CHECK (title_status IN ('not_started', 'submitted', 'issued', 'handed_to_buyer'));

ALTER TABLE bds_transactions
  ADD COLUMN IF NOT EXISTS handover_appointment_at TIMESTAMPTZ;

ALTER TABLE bds_transactions
  ADD COLUMN IF NOT EXISTS handover_waived_at TIMESTAMPTZ;

ALTER TABLE bds_transactions
  ADD COLUMN IF NOT EXISTS handover_waived_by INTEGER;

ALTER TABLE bds_transactions
  ADD COLUMN IF NOT EXISTS handover_waive_reason TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS bds_handover_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  transaction_id UUID NOT NULL REFERENCES bds_transactions (id) ON DELETE CASCADE,
  item_code TEXT NOT NULL
    CHECK (item_code IN ('water', 'electric', 'interior', 'minutes')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'pass', 'fail')),
  note TEXT NOT NULL DEFAULT '',
  checked_by INTEGER,
  checked_at TIMESTAMPTZ,
  UNIQUE (transaction_id, item_code)
);

CREATE INDEX IF NOT EXISTS idx_bds_handover_checks_tx
  ON bds_handover_checks (transaction_id);

CREATE TABLE IF NOT EXISTS bds_aftersales_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  transaction_id UUID NOT NULL REFERENCES bds_transactions (id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK (kind IN ('defect', 'title', 'other')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  opened_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bds_aftersales_tickets_tx
  ON bds_aftersales_tickets (transaction_id, status);

COMMIT;
```

`scripts/apply_pg_ddl_bds_p9.sh` — copy P7, đổi `p7` → `p9`.

- [ ] **Step 2: Apply local (nếu Postgres :5433 chạy)**

Run: `DATABASE_URL=postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb bash scripts/apply_pg_ddl_bds_p9.sh`

Expected: `OK  bds P9 DDL`. Nếu PG không chạy: ghi chú, apply lúc verify/deploy — **không** chặn Task 3 (repo mock được).

- [ ] **Step 3: Commit** — chỉ khi user yêu cầu.

---

### Task 3: Repository + map TxRow `title_status`

**Files:**
- Create: `services/ptt-crm-api/src/bds/aftersales/bds-aftersales.repository.ts`
- Modify: `services/ptt-crm-api/src/bds/transactions/bds-tx.types.ts`
- Modify: `services/ptt-crm-api/src/bds/transactions/bds-tx.repository.ts`

**Interfaces:**
- Consumes: DDL Task 2; `TxRow` P4
- Produces: `BdsAftersalesRepository` methods dưới đây; `TxRow.title_status`

```ts
// TxRow + InsertTxInput thêm:
title_status: TitleStatus; // default 'not_started'
handover_appointment_at: Date | null;
```

`STAGE_EXTRA_COLS` thêm:

```ts
handover_at: 'handover_at',
title_issued_at: 'title_issued_at',
title_status: 'title_status',
handover_appointment_at: 'handover_appointment_at',
handover_waived_at: 'handover_waived_at',
handover_waived_by: 'handover_waived_by',
handover_waive_reason: 'handover_waive_reason',
```

`mapTx` đọc `title_status` (default `not_started`) và `handover_appointment_at`. **Không** đổi `insertTx` column list trừ khi test insert cần — default DB đủ.

`BdsAftersalesRepository` (Pool giống collection):

```ts
listBoard(tenantId: string, projectId?: number): Promise<AftersalesBoardRow[]>
listChecks(txId: string): Promise<HandoverCheckRow[]>
upsertCheck(input: {
  tenant_id: string | null;
  transaction_id: string;
  item_code: string;
  status: string;
  note: string;
  checked_by: number | null;
}): Promise<HandoverCheckRow>
listTickets(txId: string): Promise<AftersalesTicketRow[]>
insertTicket(input: {
  tenant_id: string | null;
  transaction_id: string;
  kind: string;
  title: string;
  body: string;
  opened_by: number | null;
}): Promise<AftersalesTicketRow>
updateTicketStatus(id: string, status: string, tenantId?: string): Promise<AftersalesTicketRow | null>
countOpenDefects(txId: string): Promise<number>
```

Board SQL (rút gọn):

```sql
SELECT t.id AS transaction_id, t.project_id, t.product_id, t.stage, t.contract_no,
       t.handover_appointment_at, t.title_status,
       COALESCE((
         SELECT COUNT(*) FROM bds_handover_checks c
         WHERE c.transaction_id = t.id AND c.status = 'pass'
       ), 0) AS checks_passed,
       4 AS checks_total,
       COALESCE((
         SELECT COUNT(*) FROM bds_aftersales_tickets d
         WHERE d.transaction_id = t.id AND d.kind = 'defect' AND d.status IN ('open', 'in_progress')
       ), 0) AS open_defects
FROM bds_transactions t
WHERE t.tenant_id = $1
  AND t.stage IN ('contracted', 'handed_over', 'title_issued')
  AND ($2::int IS NULL OR t.project_id = $2)
ORDER BY t.contracted_at ASC NULLS LAST
```

`appointment_due` **không** tính trong SQL — service gọi `appointmentDue()`.

- [ ] **Step 1:** Không bắt buộc test repo (giống P4b repo). Map `title_status` thiếu → sửa `mapTx` ngay để GET TX cũ không vỡ.

- [ ] **Step 2:** `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/transactions --runInBand`  
Expected: PASS (thêm field optional trên mock objects).

- [ ] **Step 3: Commit** — chỉ khi user yêu cầu.

---

### Task 4: Service — appointment, checklist, cổng handover (BDS-38)

**Files:**
- Create: `services/ptt-crm-api/src/bds/aftersales/bds-aftersales.service.ts`
- Create: `services/ptt-crm-api/src/bds/aftersales/bds-aftersales.service.spec.ts`

**Interfaces:**
- Consumes: `BdsAftersalesRepository`, `BdsTxRepository`, `canHandover`, `canAdvanceTx`, `@Optional() BdsCommissionService`, `BdsTenantService.getMe` (chặn broker)
- Produces: `scheduleAppointment`, `upsertCheck`, `handover`, `getDetail`, `listBoard`

Cách lấy tenant mode: inject `BdsTenantService`. Gọi `getMe(tenantId)` — miss → 404 sẵn. Nếu `mode === 'broker'` → `NotFoundException` trên `listBoard` / `getDetail` / mutate.

- [ ] **Step 1: Write failing service tests**

```ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BdsAftersalesService } from './bds-aftersales.service';

function tx(over: Record<string, unknown> = {}) {
  return {
    id: 'tx1',
    tenant_id: 't1',
    project_id: 1,
    product_id: 9,
    stage: 'contracted',
    contract_no: 'HD-1',
    title_status: 'not_started',
    handover_appointment_at: null,
    handover_at: null,
    ...over,
  };
}

describe('BdsAftersalesService', () => {
  const asRepo = {
    listBoard: jest.fn(),
    listChecks: jest.fn(),
    upsertCheck: jest.fn(),
    listTickets: jest.fn(),
    insertTicket: jest.fn(),
    updateTicketStatus: jest.fn(),
    countOpenDefects: jest.fn(),
  };
  const txRepo = {
    getTx: jest.fn(),
    setStageIf: jest.fn(),
  };
  const tenants = { getMe: jest.fn().mockResolvedValue({ mode: 'developer' }) };
  const commission = { onTxStage: jest.fn() };
  let svc: BdsAftersalesService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PTT_BDS_COMMISSION = '0';
    svc = new BdsAftersalesService(asRepo as never, txRepo as never, tenants as never, commission as never);
    txRepo.getTx.mockResolvedValue(tx());
    asRepo.listChecks.mockResolvedValue([]);
    asRepo.listTickets.mockResolvedValue([]);
  });

  it('BDS-38 handover without checklist → 400 handover_checklist', async () => {
    await expect(svc.handover('tx1', { waive: false }, 't1')).rejects.toBeInstanceOf(BadRequestException);
    try {
      await svc.handover('tx1', { waive: false }, 't1');
    } catch (err) {
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'handover_checklist' });
    }
  });

  it('handover after 4 pass → handed_over', async () => {
    asRepo.listChecks.mockResolvedValue(
      ['water', 'electric', 'interior', 'minutes'].map((item_code) => ({ item_code, status: 'pass' })),
    );
    txRepo.setStageIf.mockResolvedValue(tx({ stage: 'handed_over' }));
    const out = await svc.handover('tx1', { waive: false }, 't1');
    expect(out.stage).toBe('handed_over');
    expect(txRepo.setStageIf).toHaveBeenCalledWith(
      'tx1',
      'handed_over',
      expect.objectContaining({ handover_at: expect.any(Date) }),
      'contracted',
    );
  });

  it('waive without approve → 400 handover_waive', async () => {
    await expect(
      svc.handover('tx1', { waive: true, waive_reason: 'KH nhận thô', hasApproveCap: false }, 't1'),
    ).rejects.toMatchObject({ response: { error: 'handover_waive' } });
  });

  it('wrong stage → 409 tx_stage', async () => {
    txRepo.getTx.mockResolvedValue(tx({ stage: 'deposit' }));
    await expect(svc.handover('tx1', { waive: false }, 't1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('missing tx tenant → 404', async () => {
    txRepo.getTx.mockResolvedValue(null);
    await expect(svc.handover('tx1', { waive: false }, 't1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('check unknown code → 400 item_code', async () => {
    await expect(
      svc.upsertCheck('tx1', { item_code: 'wifi', status: 'pass' }, 't1'),
    ).rejects.toMatchObject({ response: { error: 'item_code' } });
  });

  it('broker board → 404', async () => {
    tenants.getMe.mockResolvedValue({ mode: 'broker' });
    await expect(svc.listBoard('t1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

Constructor thật: khớp Nest inject (`@Optional() commission`). Nếu test `toMatchObject` trên exception Nest khó — dùng `getResponse()` như case BDS-38.

- [ ] **Step 2: Run — expect FAIL** (class missing / constructor)

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/aftersales/bds-aftersales.service.spec.ts --runInBand`

- [ ] **Step 3: Implement service (handover + check + appointment + board/detail)**

```ts
async assertTenantNotBroker(tenantId: string): Promise<void> {
  const tenant = await this.tenants.getMe(tenantId);
  if (!tenant || tenant.mode === 'broker') throw new NotFoundException();
}

async getTxOrThrow(txId: string, tenantId?: string) {
  const row = await this.txRepo.getTx(txId);
  if (!row || (tenantId && row.tenant_id && row.tenant_id !== tenantId)) {
    throw new NotFoundException();
  }
  return row;
}

async handover(txId: string, body: {
  waive?: boolean;
  waive_reason?: string;
  hasApproveCap?: boolean;
}, tenantId?: string) {
  const tx = await this.getTxOrThrow(txId, tenantId);
  if (tenantId) await this.assertTenantNotBroker(tenantId);
  if (!canAdvanceTx(tx.stage, 'handed_over')) {
    throw new ConflictException({ error: 'tx_stage' });
  }
  const checks = await this.asRepo.listChecks(tx.id);
  const waive = Boolean(body.waive);
  if (!canHandover(checks, {
    waive,
    hasApproveCap: Boolean(body.hasApproveCap),
    waiveReason: body.waive_reason,
  })) {
    throw new BadRequestException({
      error: waive ? 'handover_waive' : 'handover_checklist',
    });
  }
  const now = new Date();
  const extra: Record<string, unknown> = { handover_at: now };
  if (waive) {
    extra.handover_waived_at = now;
    extra.handover_waive_reason = String(body.waive_reason ?? '').trim();
  }
  const updated = await this.txRepo.setStageIf(tx.id, 'handed_over', extra, tx.stage);
  if (!updated) throw new ConflictException({ error: 'tx_closed' });
  if (isBdsCommissionEnabled()) {
    try {
      await this.commission?.onTxStage(updated, 'handed_over');
    } catch (err) {
      this.logger.warn(`commission handover hook failed tx=${updated.id}: ${String(err)}`);
    }
  }
  return updated;
}
```

`upsertCheck`: chỉ khi `stage === 'contracted'` (hoặc `handed_over` cho sửa biên bản — **khóa:** chỉ `contracted`). Code lạ → 400 `item_code`. Status không thuộc `pending|pass|fail` → 400 `status`.

`scheduleAppointment`: `scheduled_at` ISO parse fail → 400 `scheduled_at`; stage phải `contracted`. Gọi `setStageIf` **không** đổi stage — **không dùng setStageIf**. Thêm `txRepo.updateExtras(id, extra)` **hoặc** `setStageIf(id, tx.stage, { handover_appointment_at }, tx.stage)` (stage không đổi). Khóa: `setStageIf` với `expected === current stage`.

`listBoard`: map `appointment_due: appointmentDue(row.handover_appointment_at)`.

`getDetail`: `{ tx, checks, tickets, appointment_due }`.

- [ ] **Step 4: Run — expect PASS**

Cùng lệnh Step 2.

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu.

---

### Task 5: Service — defect + sổ hồng

**Files:**
- Modify: `services/ptt-crm-api/src/bds/aftersales/bds-aftersales.service.ts`
- Modify: `services/ptt-crm-api/src/bds/aftersales/bds-aftersales.service.spec.ts`

**Interfaces:**
- Produces: `createTicket`, `patchTicket`, `setTitle`

- [ ] **Step 1: Write failing tests (append)**

```ts
  it('UC-042 defect before handover → 400 not_handed_over', async () => {
    await expect(
      svc.createTicket('tx1', { kind: 'defect', title: 'Rò nước' }, 't1'),
    ).rejects.toMatchObject({ response: { error: 'not_handed_over' } });
  });

  it('UC-042 defect after handover → insert kind defect', async () => {
    txRepo.getTx.mockResolvedValue(tx({ stage: 'handed_over' }));
    asRepo.insertTicket.mockResolvedValue({ id: 'd1', kind: 'defect', title: 'Rò nước' });
    const out = await svc.createTicket('tx1', { kind: 'defect', title: 'Rò nước' }, 't1');
    expect(out.kind).toBe('defect');
    expect(asRepo.insertTicket).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'defect', transaction_id: 'tx1' }),
    );
  });

  it('kind invalid → 400 kind', async () => {
    txRepo.getTx.mockResolvedValue(tx({ stage: 'handed_over' }));
    await expect(
      svc.createTicket('tx1', { kind: 'jira', title: 'x' }, 't1'),
    ).rejects.toMatchObject({ response: { error: 'kind' } });
  });

  it('UC-043 title skip → 400 title_status', async () => {
    txRepo.getTx.mockResolvedValue(tx({ stage: 'handed_over', title_status: 'not_started' }));
    await expect(svc.setTitle('tx1', 'issued', 't1')).rejects.toMatchObject({
      response: { error: 'title_status' },
    });
  });

  it('UC-043 issued from handed_over + submitted → title_issued', async () => {
    txRepo.getTx.mockResolvedValue(tx({ stage: 'handed_over', title_status: 'submitted' }));
    txRepo.setStageIf.mockResolvedValue(tx({ stage: 'title_issued', title_status: 'issued' }));
    const out = await svc.setTitle('tx1', 'issued', 't1');
    expect(out.stage).toBe('title_issued');
    expect(txRepo.setStageIf).toHaveBeenCalledWith(
      'tx1',
      'title_issued',
      expect.objectContaining({ title_status: 'issued', title_issued_at: expect.any(Date) }),
      'handed_over',
    );
  });

  it('submitted keeps contracted/handed_over stage', async () => {
    txRepo.getTx.mockResolvedValue(tx({ stage: 'contracted', title_status: 'not_started' }));
    txRepo.setStageIf.mockResolvedValue(tx({ stage: 'contracted', title_status: 'submitted' }));
    const out = await svc.setTitle('tx1', 'submitted', 't1');
    expect(out.title_status).toBe('submitted');
    expect(txRepo.setStageIf).toHaveBeenCalledWith(
      'tx1',
      'contracted',
      expect.objectContaining({ title_status: 'submitted' }),
      'contracted',
    );
  });
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

Rules:
- `createTicket`: `kind` ∈ defect|title|other; `title`.trim() ≥ 3; stage ∈ `handed_over|title_issued` (UC-042 «Sau BG»). `kind=title` cũng chỉ sau BG.
- `patchTicket`: status ∈ open|in_progress|done|cancelled; miss id/tenant → 404.
- `setTitle`: `canAdvanceTitle`; `issued` / `handed_to_buyer` **chỉ** khi stage `handed_over` hoặc đã `title_issued`. `issued` lần đầu: `setStageIf(..., 'title_issued', { title_status, title_issued_at }, 'handed_over')`. `handed_to_buyer`: `setStageIf(..., 'title_issued', { title_status }, 'title_issued')`.
- `submitted` cho phép từ `contracted` hoặc `handed_over` (nộp cục sớm).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu.

---

### Task 6: Controller + module

**Files:**
- Create: `services/ptt-crm-api/src/bds/aftersales/bds-aftersales.controller.ts`
- Create: `services/ptt-crm-api/src/bds/aftersales/bds-aftersales.controller.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.module.ts`

**Interfaces:**
- Consumes: service Task 4–5
- Produces: HTTP dưới `/api/v1/bds`

| Method | Path | Body | Lỗi |
|--------|------|------|-----|
| GET | `/aftersales?project_id=` | | 404 broker / flag off |
| GET | `/transactions/:id/aftersales` | | 404 |
| POST | `/transactions/:id/handover-appointment` | `{ scheduled_at }` | 400 `scheduled_at` |
| POST | `/transactions/:id/handover-check` | `{ item_code, status, note? }` | 400 `item_code` |
| POST | `/transactions/:id/handover` | `{ waive?, waive_reason? }` | 400 `handover_checklist` / `handover_waive` |
| POST | `/transactions/:id/defects` | `{ kind?, title, body? }` | default kind=`defect` |
| PATCH | `/aftersales-tickets/:id` | `{ status }` | 404 |
| POST | `/transactions/:id/title` | `{ title_status }` | 400 `title_status` |

Guards: `StaffOrInternalKeyGuard`, `BdsPackGuard`, `BdsAftersalesGuard`.

Waive cap: đọc `req.staffUser?.caps` — có `{ section: 'bds_aftersales', action: 'approve' }` **hoặc** `staffAuthVia === 'internal'` → `hasApproveCap=true`.

- [ ] **Step 1: Controller spec**

```ts
it('handover delegates waive cap from jwt', async () => {
  const svc = { handover: jest.fn().mockResolvedValue({ id: 'tx1' }) };
  const ctl = new BdsAftersalesController(svc as never);
  await ctl.handover('tx1', { waive: true, waive_reason: 'KH nhận thô' }, 't1', {
    staffUser: { caps: [{ section: 'bds_aftersales', action: 'approve' }] },
  } as never);
  expect(svc.handover).toHaveBeenCalledWith(
    'tx1',
    expect.objectContaining({ waive: true, hasApproveCap: true }),
    't1',
  );
});
```

Thêm 1 test `AFTERSALES` guard đã cover 404 ở Task 1 — controller spec không cần boot Nest app.

- [ ] **Step 2: Implement controller + register module**

`bds.module.ts`: import `BdsAftersalesGuard`, `BdsAftersalesRepository`, `BdsAftersalesService`, `BdsAftersalesController`. Thêm controller + providers. Export `BdsAftersalesService`.

- [ ] **Step 3: Run**

`cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/aftersales src/bds/guards/bds-aftersales.guard.spec.ts src/bds/bds.flags.spec.ts src/bds/transactions/bds-tx.util.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 4: Commit** — chỉ khi user yêu cầu.

---

### Task 7: UI mỏng + nav «Sau bán» + roadmap

**Files:**
- Modify: `services/ops-web/src/lib/bds/nav.ts`
- Modify: `services/ops-web/src/lib/bds/nav.spec.ts`
- Modify: `services/ops-web/src/lib/bds/api.ts`
- Modify: `services/ops-web/src/components/layout/nav-icons.tsx`
- Create: `services/ops-web/src/app/crm/bds/aftersales/page.tsx`
- Modify: `docs/superpowers/plans/2026-08-22-bds-coding-roadmap.md`

**Interfaces:**
- Consumes: `hasCap(..., 'bds_aftersales', 'view')`, `isBdsUiFeEnabled()`, API Task 6
- Produces: link CĐT/hybrid; page list + 3 action

- [ ] **Step 1: Nav test**

```ts
it('CĐT with aftersales cap shows Sau bán', () => {
  process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
  const links =
    buildBdsNavSections(
      user([
        { section: 'bds_tenant', action: 'view' },
        { section: 'bds_aftersales', action: 'view' },
      ]),
      'developer',
    )[0]?.links ?? [];
  expect(links.some((l) => l.href === '/crm/bds/aftersales' && l.label === 'Sau bán')).toBe(true);
});

it('broker never shows Sau bán', () => {
  process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
  const links = buildBdsNavSections(
    user([
      { section: 'bds_baskets', action: 'view' },
      { section: 'bds_aftersales', action: 'view' },
    ]),
    'broker',
  )[0]?.links ?? [];
  expect(links.some((l) => l.href === '/crm/bds/aftersales')).toBe(false);
});
```

- [ ] **Step 2: Run nav test — FAIL** rồi thêm link trong `buildDeveloperLinks`:

```ts
if (hasCap(user, 'bds_aftersales', 'view')) {
  links.push({ href: '/crm/bds/aftersales', label: 'Sau bán' });
}
```

Đặt sau «Công nợ» / trước «Hoa hồng». `nav-icons.tsx`: `'/crm/bds/aftersales': 'task'`.

- [ ] **Step 3: API helpers**

```ts
export type AftersalesBoardRow = {
  transaction_id: string;
  project_id: number;
  product_id: number;
  stage: string;
  contract_no: string;
  handover_appointment_at: string | null;
  appointment_due: boolean;
  title_status: string;
  checks_passed: number;
  checks_total: number;
  open_defects: number;
};

export async function fetchBdsAftersales(
  token: string,
  projectId?: number,
): Promise<AftersalesBoardRow[]> {
  const qs = projectId != null ? `?project_id=${projectId}` : '';
  return bdsFetch(token, `/api/v1/bds/aftersales${qs}`);
}

async function bdsMutate<T>(token: string, path: string, method: string, body?: unknown): Promise<T> {
  const tenantId = getBdsTenantId();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(tenantId ? { 'x-bds-tenant': tenantId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `BDS ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function postHandoverCheck(token: string, txId: string, item_code: string, status: string) {
  return bdsMutate(token, `/api/v1/bds/transactions/${txId}/handover-check`, 'POST', {
    item_code,
    status,
  });
}
export function postHandover(token: string, txId: string, waive?: boolean, waive_reason?: string) {
  return bdsMutate(token, `/api/v1/bds/transactions/${txId}/handover`, 'POST', { waive, waive_reason });
}
export function postTitle(token: string, txId: string, title_status: string) {
  return bdsMutate(token, `/api/v1/bds/transactions/${txId}/title`, 'POST', { title_status });
}
export function postDefect(token: string, txId: string, title: string) {
  return bdsMutate(token, `/api/v1/bds/transactions/${txId}/defects`, 'POST', {
    kind: 'defect',
    title,
  });
}
```

- [ ] **Step 4: Page** `aftersales/page.tsx` — `useBdsPageAuth([{ section: 'bds_aftersales', action: 'view' }])`. Load board. Bảng: HĐ · stage · checklist `checks_passed/4` · sổ hồng · hẹn (badge «đến hạn 15N» nếu `appointment_due`) · defect mở.

Hàng chọn được:
- 4 nút tick checklist (`water`…) → `postHandoverCheck(..., 'pass')`
- **Bàn giao** → `postHandover`
- **Waive** (chỉ hiện nếu `hasCap(user, 'bds_aftersales', 'approve')`) → prompt lý do → `postHandover(token, id, true, reason)`
- **Nộp sổ / Cấp sổ / Giao KH** → `postTitle` theo `title_status` hiện tại
- **Defect** (khi stage `handed_over`/`title_issued`) → prompt tiêu đề → `postDefect`

Copy lỗi API ra `muted` (`handover_checklist` → «Thiếu checklist bàn giao»). AFTERSALES=0 / 404 → «Sau bán chưa bật».

Không vẽ `/crm/work`. Không PWA.

- [ ] **Step 5: Roadmap**

Trong bảng pha: P9 → `[bds-p9-aftersales.md](./2026-08-22-bds-p9-aftersales.md)`.  
§3 P9: checklist / defect / `title_status` / BDS-38 / flag `PTT_BDS_AFTERSALES`.  
§4 flag table thêm hàng:

`17 | PTT_BDS_AFTERSALES | mặc định 0; bàn giao + defect + sổ hồng. Bật khi PACK=1 + P4 (contracted). COLLECTION khuyến nghị.`

- [ ] **Step 6: Verify**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds --runInBand
cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds
cd services/ptt-crm-api && npm run build
cd services/ops-web && npm run build
```

Expected: Jest xanh (baseline + P9); Vitest xanh; 2 build exit 0.

- [ ] **Step 7: Commit** — chỉ khi user yêu cầu.

---

## 4. Definition of Done

- [ ] BDS-38: `POST /handover` khi thiếu 4 `pass` và không waive → 400 `{ error: 'handover_checklist' }`
- [ ] UC-041: 4 pass **hoặc** waive + approve + reason → stage `handed_over`, `handover_at` set
- [ ] UC-041: hẹn `handover_appointment_at`; GET board `appointment_due` nếu thiếu hoặc ≤15N
- [ ] UC-042: defect trước BG → 400 `not_handed_over`; sau BG → row `bds_aftersales_tickets`; **0** row `crm_staff_tickets`
- [ ] UC-043: title tuần tự; `issued` → stage `title_issued` + `title_issued_at`
- [ ] Flag off → mọi route trên **404**
- [ ] Broker `GET /aftersales` → 404
- [ ] Nav CĐT có «Sau bán» khi UI=1 + cap; sàn không có
- [ ] COMMISSION=1 + scheme split `handed_over` → accrue (best-effort, lỗi log không fail handover)
- [ ] Prod không bật `PTT_BDS_AFTERSALES`

---

## 5. Rollback

`PTT_BDS_AFTERSALES=0` (+ PACK=0 nếu cần). Route 404. Không DROP bảng. UI «Sau bán chưa bật».

---

## 6. Deploy VPS (khi user yêu cầu)

1. `DATABASE_URL=... bash scripts/apply_pg_ddl_bds_p9.sh` trên VPS (user `deploy` + psql).
2. rsync `ptt-crm-api/dist/` + `ops-web/.next/standalone/`.
3. `sudo systemctl restart realosai-api realosai-ops-web`.
4. **Không** ghi `.env` `PTT_BDS_AFTERSALES=1` trên prod.

Staging bật:

```bash
PTT_BDS_PACK=1
PTT_BDS_AFTERSALES=1
PTT_BDS_UI=1
NEXT_PUBLIC_PTT_BDS_UI=1
```

---

## 7. Sau P9 xanh

**P10** launch TTL 180s + war-room.  
**P11/P12** chat + ticket việc (`handover_book` 15N, work ticket trỏ defect).  
**P9b (optional):** template checklist theo DA, cron nhắc, modal biên bản.

---

*P9 thắng: HĐMB `contracted` không nhảy `handed_over` khi thiếu checklist; defect không lẫn board việc; sổ hồng đi từng bước; CĐT thấy «Sau bán».*
