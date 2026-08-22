# P4b Triển khai — Collection + cổng HĐMB

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collection OS trên PG: sinh lịch thu từ `payment_template_json`, phiếu thu cập nhật `paid_pct`, aging công nợ; cổng kép HĐMB khi `PTT_BDS_COLLECTION=1` — thiếu Sở XD → 400 `{ error: 'legal_gate_hdmb' }` (BDS-31); `paid_pct` < `hdmb_min_paid_pct` → 400 `{ error: 'paid_pct' }` (BDS-32); phiếu vượt số còn lại → 400 `{ error: 'receipt_over' }` (BR-BDS-31).

**Architecture:** Bounded context `src/bds/collection/` (`BdsCollectionService` = spec §6.6 / §23.6). HTTP collection sau `StaffOrInternalKeyGuard` + `BdsPackGuard` + `BdsCollectionGuard` (`PTT_BDS_PACK=1` **và** `PTT_BDS_COLLECTION=1`). Cổng HĐMB: `BdsTxService.contract` gọi `collection.assertCanContract` **chỉ khi** `PTT_BDS_COLLECTION=1` — COLLECTION=0 giữ hành vi P4 (không check % / pháp lý). Sinh lịch: hook `convertDeposit` khi COLLECTION=1 (sync v1; job 4h = P11/P12 handoff sau). Tenant stamp từ TX/project. Không import `ReProjectsModule`. Không UI, không chat/ticket.

**Tech Stack:** NestJS `ptt-crm-api`, Jest local binary, `pg` Pool, `psql`.

**Spec:** [2026-08-21-bds-industry-pack-design.md](../specs/2026-08-21-bds-industry-pack-design.md) §6.6, §10.4, §15 P4b, §23.3, §23.6, BR-BDS-27/31/35.  
**UC:** 020 HĐMB cổng kép · 036 phiếu thu + lịch · 037 hồ sơ vay · 038 export ERP (CSV).  
**P1b:** [2026-08-22-bds-p1b-project-os.md](./2026-08-22-bds-p1b-project-os.md) — `bds_legal_documents`, `isLegalDocValid`  
**P3:** [2026-08-22-bds-p3-csbh.md](./2026-08-22-bds-p3-csbh.md) — `payment_template_json`, `hdmb_min_paid_pct`  
**P4:** [2026-08-22-bds-p4-transaction.md](./2026-08-22-bds-p4-transaction.md) — `contract` chưa cổng  
**Roadmap:** [2026-08-22-bds-coding-roadmap.md](./2026-08-22-bds-coding-roadmap.md)

**Test ID P4b:** BDS-31, BDS-32, BR-BDS-31 (receipt cap).  
**BDS-30** (mốc thi công unlock installment) = **P4b+ / ghép P1b milestone** — P4b v1 sinh lịch tĩnh từ template, không shift theo `bds_build_milestones`.  
**BDS-37** hoàn phí launch = **P10**.  
**BDS-38** checklist bàn giao = **P9** (BR-BDS-32 handover ≠ test BDS-32 paid_pct).  
**BDS-41 / 47 / 48** card + ticket collection = **P11/P12**.  
**BDS-13** ledger accrue HĐMB = **P7**.  
**Cron aging tự động** = v1 tính on-read `GET /collections/aging`; job nightly tùy chọn sau.

## Global Constraints

- `PTT_BDS_PACK` mặc định `0` — mọi `POST /api/v1/bds/*` = **404**.
- `PTT_BDS_COLLECTION` mặc định `0` — route collection = **404** dù PACK=1. `contract` **không** cổng HĐMB khi flag tắt (an toàn prod, giống P4).
- `PTT_BDS_TX=1` vẫn cần cho convert/contract; COLLECTION bổ sung cổng + phiếu thu, không thay TX guard trên route TX.
- GET ngoài tenant = 404, không PII (BR-BDS-05). Optional `x-bds-tenant` giống inventory.
- GĐKD **không** bypass cổng HĐMB (BR-BDS-35) — không route «ký anyway»; thiếu cổng → 400, không 403.
- Không xóa `re-projects/`. Không đụng `crm_b2b_projects`. Không sổ cái / payroll.
- `paid_pct` = `round(100 * total_paid_vnd / net_price_vnd, 2)` với `total_paid_vnd` = tổng phiếu thu **confirmed** (deposit đã ghi trên TX tính vào paid nếu chưa có receipt — xem Task 4).
- Phiếu thu: `amount_vnd + sum(existing) <= net_price_vnd` → else 400 `{ error: 'receipt_over' }`.
- Cổng pháp lý HĐMB **khác** cổng mở bán P1b (`legal_gate` / `enough_to_sell`). Chỉ check doc types HĐMB (Task 1 util).
- `BdsModule` **không** import `ReProjectsModule`. Đọc legal docs qua `BdsProjectOsService.listLegalDocs`.
- Folder `collection/` — hook TX: `@Optional() BdsCollectionService` trong `BdsTxService` (giống P5 agency).
- `DATABASE_URL` script: `postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb`.
- Test: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand`.
- Không commit trừ khi user yêu cầu.
- Prod VPS: **không** bật `PTT_BDS_PACK` / `PTT_BDS_COLLECTION`. Không đụng `ngoinhahomnay.vn` / :3000.

---

## 0. Phạm vi / ngoài phạm vi

**Làm**

- Flag `isBdsCollectionEnabled()` + `BdsCollectionGuard`
- DDL `bds_payment_schedules`, `bds_payment_installments`, `bds_receipts`, `bds_mortgages`
- Parse `payment_template_json` (mảng `{ code, pct, due_days_from_deposit }`)
- Sinh lịch khi `convertDeposit` + COLLECTION=1
- `POST /receipts`, recompute `bds_transactions.paid_pct`
- `GET /collections/aging` (bucket 0–15 / 16–30 / 31–60 / 60+)
- `POST /transactions/:id/mortgage` (status NH)
- `GET /transactions/:id/hdmb-gate` (2 cột cổng cho UC-020)
- Hook `BdsTxService.contract` — BDS-31/32 khi COLLECTION=1
- Hook `BdsTxService.vbtt` — optional `vbtt_min_paid_pct` khi COLLECTION=1
- Export CSV đơn giản (UC-038)
- Test BDS-31, BDS-32, receipt cap

**Không làm**

- BDS-30 milestone shift installment (P1b `bds_build_milestones` hook)
- Hoàn phí giữ chỗ launch (P10, BDS-37)
- Handover / checklist / `handed_over` (P9)
- Chat card `x_kd_collection` / ticket `collection_schedule` (P11/P12)
- Ledger HH / clawback (P7)
- UI `/crm/bds/collections`
- `max_collect_before_hdmb_pct` enforcement trên từng receipt (ghi nhận backlog)
- Agency / giỏ (P5)

---

## 1. File map

```
docs/specs/postgresql-ddl-bds-p4b.sql
scripts/apply_pg_ddl_bds_p4b.sh

services/ptt-crm-api/src/bds/bds.flags.ts                         # + isBdsCollectionEnabled
services/ptt-crm-api/src/bds/bds.flags.spec.ts
services/ptt-crm-api/src/config/app-config.service.ts             # bdsCollectionEnabled
services/ptt-crm-api/src/bds/guards/bds-collection.guard.ts
services/ptt-crm-api/src/bds/guards/bds-collection.guard.spec.ts
services/ptt-crm-api/src/bds/collection/bds-collection.types.ts
services/ptt-crm-api/src/bds/collection/bds-collection.util.ts
services/ptt-crm-api/src/bds/collection/bds-collection.util.spec.ts
services/ptt-crm-api/src/bds/collection/bds-hdmb-gate.util.ts
services/ptt-crm-api/src/bds/collection/bds-hdmb-gate.util.spec.ts
services/ptt-crm-api/src/bds/collection/bds-collection.repository.ts
services/ptt-crm-api/src/bds/collection/bds-collection.service.ts
services/ptt-crm-api/src/bds/collection/bds-collection.service.spec.ts
services/ptt-crm-api/src/bds/collection/bds-collection.controller.ts
services/ptt-crm-api/src/bds/collection/bds-collection.controller.spec.ts
services/ptt-crm-api/src/bds/transactions/bds-tx.service.ts       # hooks contract/vbtt/convert
services/ptt-crm-api/src/bds/transactions/bds-tx.service.spec.ts  # BDS-31/32, COLLECTION=0
services/ptt-crm-api/src/bds/transactions/bds-tx.controller.ts  # hdmb-gate, mortgage delegate
services/ptt-crm-api/src/bds/bds.module.ts
docs/superpowers/plans/2026-08-22-bds-coding-roadmap.md           # hàng P4b
```

Không sửa DDL P0–P5. P4 `contract` khi COLLECTION=0 **nguyên**.

---

### Task 1: Flag COLLECTION + util paid_pct / receipt / cổng HĐMB

**Files:**
- Modify: `services/ptt-crm-api/src/bds/bds.flags.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.flags.spec.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts`
- Create: `services/ptt-crm-api/src/bds/guards/bds-collection.guard.ts`
- Create: `services/ptt-crm-api/src/bds/guards/bds-collection.guard.spec.ts`
- Create: `services/ptt-crm-api/src/bds/collection/bds-collection.types.ts`
- Create: `services/ptt-crm-api/src/bds/collection/bds-collection.util.ts`
- Create: `services/ptt-crm-api/src/bds/collection/bds-collection.util.spec.ts`
- Create: `services/ptt-crm-api/src/bds/collection/bds-hdmb-gate.util.ts`
- Create: `services/ptt-crm-api/src/bds/collection/bds-hdmb-gate.util.spec.ts`

**Interfaces:**
- Produces: `isBdsCollectionEnabled(): boolean`
- Produces: `BdsCollectionGuard` → 404 unless PACK **và** COLLECTION
- Produces: `parsePaymentTemplate(json): PaymentTemplateRow[]` — validate pct 0–100, sum ≤ 100
- Produces: `computePaidPct(totalPaidVnd, netPriceVnd): number`
- Produces: `assertReceiptWithinBalance(amountVnd, netPriceVnd, paidSoFarVnd): void` → `{ error: 'receipt_over' }`
- Produces: `agingBucket(overdueDays): '0_15' | '16_30' | '31_60' | '60_plus'`
- Produces: `assertHdmbLegalGate(input): void` → `{ error: 'legal_gate_hdmb' }`
- Produces: `assertHdmbPaidPct(paidPct, minPct): void` → `{ error: 'paid_pct' }`

**HDMB legal input:**

```ts
export type HdmbGateInput = {
  docs: Array<{ doc_type: string; status: string; expires_on?: string | Date | null }>;
  now: Date;
  buyerWaiveGuarantee?: boolean;
  waiveFileId?: string;
};
```

**Quy tắc `assertHdmbLegalGate` (BR-BDS-27 rút gọn P4b):**

1. `so_xd_du_dieu_kien_ban` phải `valid` (reuse `isLegalDocValid` từ `bds-legal-gate.util.ts`).
2. `bao_lanh_nh` `valid` **hoặc** (`buyerWaiveGuarantee === true` **và** `waiveFileId` trim ≥ 1).
3. Nếu có row `giai_chap` (bất kỳ status) → phải `valid` (căn/dự án từng thế chấp).
4. `mau_hdmb` phải `valid` (mẫu đã duyệt = status valid P1b).

- [ ] **Step 1: Flags + guards (RED)**

```ts
// bds.flags.spec.ts
it('defaults COLLECTION off when unset', () => {
  delete process.env.PTT_BDS_COLLECTION;
  expect(isBdsCollectionEnabled()).toBe(false);
});

it('COLLECTION on for 1', () => {
  process.env.PTT_BDS_COLLECTION = '1';
  expect(isBdsCollectionEnabled()).toBe(true);
});
```

```ts
// bds-collection.guard.spec.ts — pattern giống bds-agency.guard.spec.ts
```

- [ ] **Step 2: Util spec (RED)**

```ts
// bds-collection.util.spec.ts
it('computePaidPct rounds 2 decimals', () => {
  expect(computePaidPct(30_000_000, 100_000_000)).toBe(30);
});

it('receipt over balance throws receipt_over', () => {
  expect(() => assertReceiptWithinBalance(50, 100, 60)).toThrow(
    expect.objectContaining({ error: 'receipt_over' }),
  );
  expect(() => assertReceiptWithinBalance(40, 100, 60)).not.toThrow();
});

it('aging buckets', () => {
  expect(agingBucket(10)).toBe('0_15');
  expect(agingBucket(45)).toBe('31_60');
});
```

```ts
// bds-hdmb-gate.util.spec.ts
const now = new Date('2026-08-22T12:00:00Z');

it('BDS-31 missing so_xd → legal_gate_hdmb', () => {
  expect(() =>
    assertHdmbLegalGate({
      docs: [{ doc_type: 'mau_hdmb', status: 'valid' }],
      now,
    }),
  ).toThrow(expect.objectContaining({ error: 'legal_gate_hdmb' }));
});

it('pass when so_xd + bao_lanh + mau_hdmb valid', () => {
  expect(() =>
    assertHdmbLegalGate({
      docs: [
        { doc_type: 'so_xd_du_dieu_kien_ban', status: 'valid' },
        { doc_type: 'bao_lanh_nh', status: 'valid' },
        { doc_type: 'mau_hdmb', status: 'valid' },
      ],
      now,
    }),
  ).not.toThrow();
});

it('waive bao_lanh requires file', () => {
  expect(() =>
    assertHdmbLegalGate({
      docs: [
        { doc_type: 'so_xd_du_dieu_kien_ban', status: 'valid' },
        { doc_type: 'mau_hdmb', status: 'valid' },
      ],
      now,
      buyerWaiveGuarantee: true,
      waiveFileId: 'file-1',
    }),
  ).not.toThrow();
});

it('BDS-32 paid pct below min', () => {
  expect(() => assertHdmbPaidPct(29.9, 30)).toThrow(
    expect.objectContaining({ error: 'paid_pct' }),
  );
  expect(() => assertHdmbPaidPct(30, 30)).not.toThrow();
});
```

- [ ] **Step 3: Implement util + guard**

- [ ] **Step 4: Run tests**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/collection/bds-collection.util.spec.ts src/bds/collection/bds-hdmb-gate.util.spec.ts src/bds/guards/bds-collection.guard.spec.ts src/bds/bds.flags.spec.ts --runInBand`

Expected: PASS

---

### Task 2: DDL collection tables

**Files:**
- Create: `docs/specs/postgresql-ddl-bds-p4b.sql`
- Create: `scripts/apply_pg_ddl_bds_p4b.sh`

- [ ] **Step 1: Write DDL**

```sql
-- Pack BĐS P4b — Apply: scripts/apply_pg_ddl_bds_p4b.sh
BEGIN;

CREATE TABLE IF NOT EXISTS bds_payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  transaction_id UUID NOT NULL REFERENCES bds_transactions (id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  policy_id UUID,
  source TEXT NOT NULL DEFAULT 'deposit'
    CHECK (source IN ('deposit', 'vbtt', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_payment_schedule_tx
  ON bds_payment_schedules (transaction_id);

CREATE TABLE IF NOT EXISTS bds_payment_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  schedule_id UUID NOT NULL REFERENCES bds_payment_schedules (id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES bds_transactions (id) ON DELETE CASCADE,
  seq INTEGER NOT NULL DEFAULT 0,
  milestone_code TEXT NOT NULL DEFAULT '',
  due_date DATE NOT NULL,
  amount_vnd BIGINT NOT NULL DEFAULT 0,
  paid_vnd BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'due'
    CHECK (status IN ('due', 'partial', 'paid', 'overdue', 'waived')),
  overdue_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_installment_schedule_seq
  ON bds_payment_installments (schedule_id, seq);

CREATE INDEX IF NOT EXISTS idx_bds_installments_tx
  ON bds_payment_installments (transaction_id);

CREATE TABLE IF NOT EXISTS bds_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  transaction_id UUID NOT NULL REFERENCES bds_transactions (id) ON DELETE CASCADE,
  installment_id UUID REFERENCES bds_payment_installments (id),
  receipt_no TEXT NOT NULL DEFAULT '',
  amount_vnd BIGINT NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method TEXT NOT NULL DEFAULT 'bank'
    CHECK (method IN ('bank', 'cash', 'loan')),
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bds_receipts_tx
  ON bds_receipts (transaction_id);

CREATE TABLE IF NOT EXISTS bds_mortgages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  transaction_id UUID NOT NULL REFERENCES bds_transactions (id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL DEFAULT '',
  amount_vnd BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'applying'
    CHECK (status IN ('applying', 'approved', 'disbursed', 'rejected')),
  file_id TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_mortgage_tx
  ON bds_mortgages (transaction_id);

COMMIT;
```

- [ ] **Step 2: Apply script**

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DDL="$ROOT/docs/specs/postgresql-ddl-bds-p4b.sql"
echo "==> Apply BĐS P4b DDL"
psql "${DATABASE_URL:?DATABASE_URL required}" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  bds P4b DDL"
```

- [ ] **Step 3: Apply ×2 idempotent locally**

Run: `bash scripts/apply_pg_ddl_bds_p4b.sh` (×2)

Expected: PASS, NOTICE skip lần 2

---

### Task 3: BdsCollectionRepository

**Files:**
- Create: `services/ptt-crm-api/src/bds/collection/bds-collection.repository.ts`

**Interfaces:**
- Consumes: Pool pattern như `BdsTxRepository` / `BdsAgencyRepository`
- Produces: `insertSchedule`, `insertInstallments`, `insertReceipt`, `sumReceiptsByTx`, `listInstallmentsByTx`, `listOverdueInstallments`, `upsertMortgage`, `getMortgage`, `updateTxPaidPct`, `updateInstallmentPaid`

- [ ] **Step 1: Repository với `@Injectable()` + `getPool()` từ `DATABASE_URL`**

- [ ] **Step 2: Không test integration DB v1 — mock trong service spec**

---

### Task 4: BdsCollectionService — lịch, phiếu thu, aging, mortgage, cổng

**Files:**
- Create: `services/ptt-crm-api/src/bds/collection/bds-collection.service.ts`
- Create: `services/ptt-crm-api/src/bds/collection/bds-collection.service.spec.ts`

**Inject:** `BdsCollectionRepository`, `BdsTxRepository`, `BdsPolicyService`, `BdsProjectOsService`

**Interfaces:**
- Produces: `ensureScheduleForTx(txId, tenantId?, now?): Promise<void>` — idempotent (schedule đã có → skip)
- Produces: `createReceipt(body, tenantId?): Promise<ReceiptRow>`
- Produces: `listAging(projectId, tenantId?): Promise<AgingRow[]>`
- Produces: `upsertMortgage(txId, body, tenantId?): Promise<MortgageRow>`
- Produces: `getHdmbGate(txId, tenantId?): Promise<HdmbGateStatus>`
- Produces: `assertCanContract(tx, opts): Promise<void>` — legal + paid_pct; throws BadRequestException
- Produces: `assertVbttPaidPct(tx, tenantId?): Promise<void>` — khi `paid_pct < vbtt_min_paid_pct`

**Sinh lịch (`ensureScheduleForTx`):**

1. Load TX + policy (`policy_id` trên TX).
2. `parsePaymentTemplate(policy.payment_template_json)`.
3. `net = tx.net_price_vnd`; `anchor = tx.deposit_paid_at ?? now`.
4. Mỗi dòng template: `amount = round(net * pct / 100)`; `due_date = anchor + due_days_from_deposit`.
5. Insert schedule + installments (`seq` 0..n-1).

**Phiếu thu (`createReceipt`):**

1. TX stage ∈ `deposit|vbtt|contracted` (chưa cancelled).
2. `paidSoFar = sum(receipts)`; cộng thêm `deposit_vnd` **một lần** nếu chưa có receipt gắn `milestone_code='deposit'` (tránh double-count).
3. `assertReceiptWithinBalance`.
4. Insert receipt; recompute `paid_pct` trên TX; cập nhật installment `paid_vnd` / `status` nếu `installment_id` gửi kèm.

- [ ] **Step 1: Service spec (RED)**

```ts
// bds-collection.service.spec.ts
it('createReceipt updates paid_pct', async () => {
  repo.sumReceiptsByTx.mockResolvedValue(0);
  txRepo.getTx.mockResolvedValue({
    id: 'tx1', net_price_vnd: 100_000_000, deposit_vnd: 30_000_000, stage: 'deposit',
  });
  await svc.createReceipt({ transaction_id: 'tx1', amount_vnd: 0, method: 'bank' }, 't1');
  expect(repo.updateTxPaidPct).toHaveBeenCalledWith('tx1', 30);
});

it('receipt over net throws receipt_over', async () => {
  txRepo.getTx.mockResolvedValue({
    id: 'tx1', net_price_vnd: 100, deposit_vnd: 90, stage: 'deposit',
  });
  repo.sumReceiptsByTx.mockResolvedValue(15);
  await expect(
    svc.createReceipt({ transaction_id: 'tx1', amount_vnd: 10, method: 'bank' }),
  ).rejects.toMatchObject({ response: { error: 'receipt_over' } });
});

it('assertCanContract BDS-31 throws legal_gate_hdmb', async () => {
  projectOs.listLegalDocs.mockResolvedValue([]);
  await expect(
    svc.assertCanContract({ id: 'tx1', project_id: 1, net_price_vnd: 1e9, paid_pct: 50, policy_id: 'p1' }),
  ).rejects.toMatchObject({ response: { error: 'legal_gate_hdmb' } });
});

it('assertCanContract BDS-32 throws paid_pct', async () => {
  projectOs.listLegalDocs.mockResolvedValue(validHdmbDocs);
  policies.getById.mockResolvedValue({ hdmb_min_paid_pct: 30 });
  await expect(
    svc.assertCanContract({
      id: 'tx1', project_id: 1, net_price_vnd: 1e9, paid_pct: 20, policy_id: 'p1',
    }),
  ).rejects.toMatchObject({ response: { error: 'paid_pct' } });
});
```

- [ ] **Step 2: Implement service**

- [ ] **Step 3: Run spec**

Run: `./node_modules/.bin/jest src/bds/collection/bds-collection.service.spec.ts --runInBand`

Expected: PASS

---

### Task 5: Hook BdsTxService (convert / vbtt / contract)

**Files:**
- Modify: `services/ptt-crm-api/src/bds/transactions/bds-tx.service.ts`
- Modify: `services/ptt-crm-api/src/bds/transactions/bds-tx.service.spec.ts`

**ContractBody mở rộng (chỉ dùng khi COLLECTION=1):**

```ts
export type ContractBody = {
  contract_no: string;
  row_version: number;
  buyer_waive_guarantee?: boolean;
  waive_file_id?: string;
};
```

- [ ] **Step 1: Inject `@Optional() collection?: BdsCollectionService`**

- [ ] **Step 2: Sau `convertDeposit` thành công — nếu `isBdsCollectionEnabled()` → `collection.ensureScheduleForTx(tx.id)`**

- [ ] **Step 3: `contract` — trước `inventory.transition`:**

```ts
if (isBdsCollectionEnabled()) {
  if (!this.collection) throw new NotFoundException();
  await this.collection.assertCanContract(tx, {
    tenantId,
    buyerWaiveGuarantee: body.buyer_waive_guarantee,
    waiveFileId: body.waive_file_id,
  });
}
```

- [ ] **Step 4: `vbtt` — khi COLLECTION=1 → `collection.assertVbttPaidPct(tx)`**

- [ ] **Step 5: Tx spec**

```ts
it('BDS-31 COLLECTION=1 contract without so_xd → 400 legal_gate_hdmb', async () => {
  process.env.PTT_BDS_COLLECTION = '1';
  collection.assertCanContract.mockRejectedValue(
    new BadRequestException({ error: 'legal_gate_hdmb' }),
  );
  // ... expect BadRequestException, inventory.transition not called
});

it('BDS-32 COLLECTION=1 contract paid_pct low → 400 paid_pct', async () => {
  process.env.PTT_BDS_COLLECTION = '1';
  collection.assertCanContract.mockRejectedValue(
    new BadRequestException({ error: 'paid_pct' }),
  );
  // ...
});

it('COLLECTION=0 contract skips gate (P4)', async () => {
  process.env.PTT_BDS_COLLECTION = '0';
  await svc.contract('tx1', { contract_no: 'HD-1', row_version: 1 });
  expect(collection.assertCanContract).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: Run hold+tx specs**

Run: `./node_modules/.bin/jest src/bds/transactions/bds-tx.service.spec.ts --runInBand`

Expected: PASS; P4 tests không vỡ

---

### Task 6: HTTP collection + hdmb-gate + export

**Files:**
- Create: `services/ptt-crm-api/src/bds/collection/bds-collection.controller.ts`
- Create: `services/ptt-crm-api/src/bds/collection/bds-collection.controller.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/transactions/bds-tx.controller.ts` — `GET transactions/:id/hdmb-gate`, `POST transactions/:id/mortgage`

**Guards:**

| Route | Guards |
|-------|--------|
| `POST /receipts`, `GET /collections/aging`, `GET /collections/export` | PACK + **Collection** |
| `GET /transactions/:id/hdmb-gate`, `POST .../mortgage` | PACK + TX (đọc/ghi TX) |
| `POST .../contract` | PACK + TX (cổng trong service) |

| Method | Path | HttpCode |
|--------|------|----------|
| POST | `/api/v1/bds/receipts` | **201** |
| GET | `/api/v1/bds/collections/aging` | 200 — query `project_id` |
| GET | `/api/v1/bds/collections/export` | 200 — CSV, query `project_id`, `from`, `to` |
| GET | `/api/v1/bds/transactions/:id/hdmb-gate` | 200 |
| POST | `/api/v1/bds/transactions/:id/mortgage` | 200 |

`GET /hdmb-gate` response:

```ts
{
  legal: { so_xd: boolean; bao_lanh: boolean; giai_chap: boolean; mau_hdmb: boolean; ready: boolean };
  paid_pct: number;
  hdmb_min_paid_pct: number;
  paid_ready: boolean;
  ready: boolean; // legal.ready && paid_ready
}
```

- [ ] **Step 1: Controller thin spec — delegate service**

- [ ] **Step 2: Implement controllers**

- [ ] **Step 3: Run controller specs**

---

### Task 7: Module + roadmap + DoD

**Files:**
- Modify: `services/ptt-crm-api/src/bds/bds.module.ts`
- Modify: `docs/superpowers/plans/2026-08-22-bds-coding-roadmap.md`

**Module:** register `BdsCollectionGuard`, `BdsCollectionRepository`, `BdsCollectionService`, `BdsCollectionController`; export `BdsCollectionService`.

Roadmap:

| Cột | Giá trị |
|-----|---------|
| Plan file | `[bds-p4b-collection.md](./2026-08-22-bds-p4b-collection.md)` |
| Thắng | `BDS-31, BDS-32, BR-BDS-31` |

Mục «### P4b — Collection + cổng HĐMB»: flag `PTT_BDS_COLLECTION`; COLLECTION=0 = P4 contract nguyên; BDS-30 milestone = sau; BDS-37 = P10.

Flag §4: `PTT_BDS_COLLECTION` — mặc định 0; staging bật khi PACK=1 + TX=1 + P3 (policy template). **Chặn HĐMB prod** cho đến khi bật COLLECTION.

- [ ] **Step 1: Register; `npm run build` 0; Jest `src/bds --runInBand` xanh**
- [ ] **Step 2: PACK=0 hoặc COLLECTION=0 → `POST /receipts` 404 (sau auth)**
- [ ] **Step 3: Roadmap P4b**

---

## 4. Definition of Done P4b

- [ ] Jest flags + collection util + hdmb gate + service + guard + controller + tx hooks xanh
- [ ] `npm run build` api 0
- [ ] DDL P4b apply idempotent
- [ ] BDS-31: COLLECTION=1 + thiếu `so_xd_du_dieu_kien_ban` → contract 400 `legal_gate_hdmb`, căn không `sold`
- [ ] BDS-32: COLLECTION=1 + `paid_pct` < `hdmb_min_paid_pct` → contract 400 `paid_pct`
- [ ] BR-BDS-31: receipt vượt `net − paid` → 400 `receipt_over`
- [ ] Convert deposit + COLLECTION=1 → schedule + installments tồn tại
- [ ] `GET /hdmb-gate` phản ánh 2 cột cổng
- [ ] COLLECTION=0: contract như P4 (không cổng)
- [ ] PACK=0 hoặc COLLECTION=0 → HTTP collection 404
- [ ] Prod không bật PACK / COLLECTION
- [ ] Không UI / không chat ticket / không ledger HH

---

## 5. Rollback

`PTT_BDS_PACK=0` và/hoặc `PTT_BDS_COLLECTION=0`. Route collection 404; `contract` trở về P4. Không DROP bảng collection trên prod.

---

## 6. Sau P4b xanh

**P9** after-sales (checklist BG, BDS-38). **P7** ledger lúc `contracted`. **P8** UI tab Collection + modal cổng HĐMB §3.4. **P10** hoàn phí launch (BDS-37). **P11/P12** card `x_kd_collection` + ticket `collection_schedule` (BDS-41/47/48). **P4b+** BDS-30 milestone unlock installment.

---

*P4b không phải After-sales OS. Thắng: cổng kép HĐMB khi COLLECTION=1; phiếu thu không vượt net; paid_pct sống trên TX.*
