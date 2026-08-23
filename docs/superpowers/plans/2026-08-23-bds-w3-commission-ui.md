# W3 — Tab Hoa hồng: Scheme · Ledger · Kỳ · Tạm ứng

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CV HH (`cv_hh`) chạy wizard scheme → activate trước CSBH; xem ledger T+0; khóa / duyệt / chi một kỳ; ghi tạm ứng — trên `/crm/bds/commissions` đã có bảng ledger.

**Architecture:** FE-first, reuse-first. Domain API P7 đã sống (`BdsCommissionController`). Nối vào **cùng** `lib/bds/api.ts` (`bdsFetch` / `bdsMutate`). Không ledger mới, không `crm_b2b_commission_ledger`. Không GET scheme/statement — giữ `scheme_id` / `statement` trong state + `sessionStorage` sau mutate.

**Tech Stack:** Next.js + Vitest (`ops-web`). Nest **không** thêm route trừ contract lệch (escalate).

**Spec:** [2026-08-23-bds-role-feature-execution.md](../specs/2026-08-23-bds-role-feature-execution.md) §3.15 HH-01–HH-06 + §7 W3  
**UX:** [2026-08-23-bds-ux-ui-complete.md](../specs/2026-08-23-bds-ux-ui-complete.md) §2.11, §4.15, §6  
**Actions:** [13-BDS-ROLE-ACTIONS.md](../../use-cases/actions/13-BDS-ROLE-ACTIONS.md) BDS-R-15  
**W2 (xong):** [2026-08-23-bds-w2-project-channel.md](./2026-08-23-bds-w2-project-channel.md)  
**OS plan:** [2026-08-23-bds-os-coding.md](./2026-08-23-bds-os-coding.md) Task 12

## Global Constraints

- Không thay Q1–Q48. Không sửa hold/TX/receipt/collection (W1).
- Không `Bds2Module`, không `/crm/bds-v2`, không board CSKH (W5), không ẩn B2B (W6), không finance hub (W7), không offboard (W8).
- Không ghi HH vào `crm_b2b_commission_ledger`. Không invent payroll (U7).
- `bdsMutate` lỗi: `` `${res.status} ${err.error}` `` — page map qua `w3ActionCopy`.
- `period_month` API = **`YYYY-MM-01`** (đầu tháng). UI input `type="month"` → normalize bằng `toPeriodMonthStart('2026-08')` → `'2026-08-01'`.
- Flag: không tắt `PTT_BDS_PACK` / `PTT_BDS_COMMISSION` / `NEXT_PUBLIC_PTT_BDS_UI` trên staging.
- Test FE: `cd services/ops-web && ./node_modules/.bin/vitest run <file>`
- Không commit trừ khi user yêu cầu.
- **Không có** `GET /commission-schemes`, `GET /commission-statements`, `GET /commission-advances`. Workaround: sau `POST commission-schemes` lưu `id`; sau `POST .../lock` lưu `StatementRow` (có `id`, `status`, số tiền) cho approve/pay.
- **Không có** `GET /tiers` catalog. Wizard `min_tier_id`: dropdown gợi ý từ `tier_id` duy nhất trên `fetchBdsAgencies()` + ô nhập UUID thủ công.
- HH-05 recalc hạng: **đã** trên `/crm/bds/tiers` (`postTiersRecalc`). W3 chỉ link — không nhân bản form recalc.
- CTV (`job_functions` includes `ctv`): `hideCommissionSchemePct(user)` — ẩn cột `%` ledger + % tier scheme (HH-06). Giữ `amount_vnd`.

### Cap FE (W0 — không seed cap mới)

| Nút / tab | Cap |
|-----------|-----|
| Xem tab Ledger | `bds_commission.view` |
| Wizard scheme (create / tiers / splits / activate) | `bds_commission.approve` |
| Khóa kỳ · Duyệt kỳ | `bds_commission.approve` |
| Chi kỳ | `bds_commission.payout` |
| Tạm ứng | `bds_commission.payout` |
| Link Recalc hạng | `bds_agency_tiers.configure` (optional — nút hoặc muted) |

`truong_kenh` chỉ `view` → thấy Ledger read-only, không nút mutate.

Nest `BdsCommissionGuard` chỉ check pack flag — **FE** phải gate nút.

### Copy lỗi W3

| `code` | Câu UI |
|--------|--------|
| `scheme_not_draft` | «Scheme không còn nháp — tạo scheme mới.» |
| `scheme_active` | «Dự án đã có scheme đang active.» |
| `split_sum` | «Tổng split mốc TX phải bằng 100%.» |
| `statement_mismatch` | «Ledger kỳ không khớp — đối soát lại trước khi khóa.» |
| `statement_status` | «Trạng thái kỳ không cho phép bước này.» |
| `period_locked` | «Kỳ đã khóa — không thêm tạm ứng.» |
| `advance_cap` | «Vượt hạn mức tạm ứng theo hạng đại lý.» |
| `advance_body` | «Nhập đại lý, kỳ và số tiền hợp lệ.» |
| `project_id` | «Chọn dự án.» |
| `base` | «Cơ sở tính: net hoặc list.» |

Clawback (HH-04): **system** qua `onTxCancelled` — không UI W3. Ledger tab hiển thị `status === 'clawback'` nếu có.

### Ngoài W3 (cấm trong PR này)

- Spine / ticket (W4), Deal Room / board (W5), nav ẩn B2B (W6), CAPI / finance hub (W7), offboard (W8).
- Sửa `bds-commission.service.ts` trừ bug contract P7.
- Payroll export map.

---

## File map

```
services/ops-web/src/lib/bds/types.ts                         NÂNG — Scheme/Ledger/Statement/Advance
services/ops-web/src/lib/bds/api.ts                           NÂNG — client W3 (~8 hàm)
services/ops-web/src/lib/bds/api.spec.ts                      NÂNG — path + body
services/ops-web/src/lib/bds/w3-copy.ts                       CREATE
services/ops-web/src/lib/bds/w3-copy.spec.ts                  CREATE
services/ops-web/src/lib/bds/w3-period.ts                     CREATE — toPeriodMonthStart
services/ops-web/src/lib/bds/w3-period.spec.ts               CREATE
services/ops-web/src/lib/bds/w3-tier-hints.ts                 CREATE — unique tier_id từ agencies
services/ops-web/src/lib/bds/w3-tier-hints.spec.ts            CREATE
services/ops-web/src/lib/bds/BdsCommissionSchemePanel.tsx     CREATE — wizard 4 bước
services/ops-web/src/lib/bds/BdsCommissionLedgerPanel.tsx     CREATE — tách từ page cũ
services/ops-web/src/lib/bds/BdsCommissionPeriodPanel.tsx     CREATE — lock / approve / pay
services/ops-web/src/lib/bds/BdsCommissionAdvancePanel.tsx    CREATE — POST advance
services/ops-web/src/app/crm/bds/commissions/page.tsx         NÂNG — tab + filter chung
```

API **GIỮ** (Nest `bds-commission.controller.ts`):

| Việc | Route | Body / query |
|------|--------|--------------|
| Tạo scheme | `POST /api/v1/bds/commission-schemes` | `{ project_id, phase_id?, base?: 'net'\|'list' }` → `SchemeRow` |
| Gán tier HH | `POST .../commission-schemes/:id/tiers` | `{ tiers: [{ min_tier_id, pct, product_line? }] }` |
| Split mốc | `POST .../commission-schemes/:id/splits` | `{ splits: [{ trigger_stage: 'vbtt'\|'contracted'\|'handed_over', pct }] }` — sum 100 |
| Activate | `POST .../commission-schemes/:id/activate` | — |
| Ledger | `GET /api/v1/bds/commissions` | `?agency_id=&period=YYYY-MM-01` |
| Khóa kỳ | `POST /api/v1/bds/commission-statements/lock` | `{ agency_id, period_month }` → `StatementRow` |
| Duyệt | `POST .../commission-statements/:id/approve` | — |
| Chi | `POST .../commission-statements/:id/pay` | — |
| Tạm ứng | `POST /api/v1/bds/commission-advances` | `{ agency_id, amount_vnd, period_month, note? }` |
| Recalc hạng | `POST /api/v1/bds/tiers/recalc` | đã trên `/crm/bds/tiers` — link only |

---

### Task 1: Client + copy + period helpers

**Files:**
- Modify: `services/ops-web/src/lib/bds/types.ts`
- Modify: `services/ops-web/src/lib/bds/api.ts`
- Modify: `services/ops-web/src/lib/bds/api.spec.ts`
- Create: `services/ops-web/src/lib/bds/w3-copy.ts`
- Create: `services/ops-web/src/lib/bds/w3-copy.spec.ts`
- Create: `services/ops-web/src/lib/bds/w3-period.ts`
- Create: `services/ops-web/src/lib/bds/w3-period.spec.ts`
- Create: `services/ops-web/src/lib/bds/w3-tier-hints.ts`
- Create: `services/ops-web/src/lib/bds/w3-tier-hints.spec.ts`

**Interfaces:**
- Consumes: `bdsMutate`, `bdsFetch`, `fetchBdsCommissions` (giữ)
- Produces: `postCommissionScheme`, `postCommissionSchemeTiers`, `postCommissionSchemeSplits`, `postCommissionSchemeActivate`, `postCommissionStatementLock`, `postCommissionStatementApprove`, `postCommissionStatementPay`, `postCommissionAdvance`; `w3ActionCopy`; `toPeriodMonthStart`; `uniqueTierIdsFromAgencies`

- [ ] **Step 1: Failing tests**

```ts
// w3-period.spec.ts
import { describe, expect, it } from 'vitest';
import { toPeriodMonthStart } from './w3-period';

describe('toPeriodMonthStart', () => {
  it('normalizes YYYY-MM to YYYY-MM-01', () => {
    expect(toPeriodMonthStart('2026-08')).toBe('2026-08-01');
    expect(toPeriodMonthStart('2026-08-01')).toBe('2026-08-01');
  });
});
```

```ts
// w3-tier-hints.spec.ts
import { describe, expect, it } from 'vitest';
import { uniqueTierIdsFromAgencies } from './w3-tier-hints';

describe('uniqueTierIdsFromAgencies', () => {
  it('dedupes non-null tier_id', () => {
    expect(
      uniqueTierIdsFromAgencies([
        { id: 'a1', tier_id: 't1' },
        { id: 'a2', tier_id: 't1' },
        { id: 'a3', tier_id: 't2' },
      ] as never),
    ).toEqual(['t1', 't2']);
  });
});
```

```ts
// w3-copy.spec.ts
import { describe, expect, it } from 'vitest';
import { w3ActionCopy } from './w3-copy';

describe('w3ActionCopy', () => {
  it('maps scheme / statement / advance errors', () => {
    expect(w3ActionCopy('409 scheme_not_draft')).toMatch(/nháp/i);
    expect(w3ActionCopy('409 scheme_active')).toMatch(/active/i);
    expect(w3ActionCopy('400 split_sum')).toMatch(/100%/);
    expect(w3ActionCopy('409 statement_mismatch')).toMatch(/đối soát/i);
    expect(w3ActionCopy('409 statement_status')).toMatch(/Trạng thái kỳ/i);
    expect(w3ActionCopy('409 period_locked')).toMatch(/khóa/i);
    expect(w3ActionCopy('400 advance_cap')).toMatch(/hạn mức/i);
  });

  it('does not steal w2 row_version', () => {
    expect(w3ActionCopy('409 row_version')).toBe('409 row_version');
  });
});
```

Thêm vào `api.spec.ts`:

```ts
it('posts commission statement lock', async () => {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => ({
      id: 'st1',
      agency_id: 'ag1',
      period_month: '2026-08-01',
      gross_vnd: 1000,
      advance_vnd: 0,
      clawback_vnd: 0,
      net_vnd: 1000,
      status: 'locked',
    }),
  });
  await postCommissionStatementLock('tok', { agency_id: 'ag1', period_month: '2026-08-01' });
  expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
    '/api/v1/bds/commission-statements/lock',
  );
});

it('posts commission scheme with base net', async () => {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'sch1', project_id: 9, status: 'draft', base: 'net' }),
  });
  await postCommissionScheme('tok', { project_id: 9, base: 'net' });
  const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(JSON.parse(init.body as string)).toEqual({ project_id: 9, base: 'net' });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds/w3-copy.spec.ts src/lib/bds/w3-period.spec.ts src/lib/bds/w3-tier-hints.spec.ts src/lib/bds/api.spec.ts`  
Expected: FAIL — modules / functions chưa có.

- [ ] **Step 3: Implement**

`w3-period.ts`:

```ts
export function toPeriodMonthStart(input: string): string {
  const trimmed = String(input ?? '').trim();
  if (/^\d{4}-\d{2}-01$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/^(\d{4})-(\d{2})/);
  if (!m) return trimmed;
  return `${m[1]}-${m[2]}-01`;
}
```

`w3-tier-hints.ts`:

```ts
import type { BdsAgency } from './types';

export function uniqueTierIdsFromAgencies(agencies: BdsAgency[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of agencies) {
    const id = String(row.tier_id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
```

`w3-copy.ts`:

```ts
export function w3ActionCopy(message: string): string {
  if (/scheme_not_draft/i.test(message)) return 'Scheme không còn nháp — tạo scheme mới.';
  if (/scheme_active/i.test(message)) return 'Dự án đã có scheme đang active.';
  if (/split_sum/i.test(message)) return 'Tổng split mốc TX phải bằng 100%.';
  if (/statement_mismatch/i.test(message)) return 'Ledger kỳ không khớp — đối soát lại trước khi khóa.';
  if (/statement_status/i.test(message)) return 'Trạng thái kỳ không cho phép bước này.';
  if (/period_locked/i.test(message)) return 'Kỳ đã khóa — không thêm tạm ứng.';
  if (/advance_cap/i.test(message)) return 'Vượt hạn mức tạm ứng theo hạng đại lý.';
  if (/advance_body/i.test(message)) return 'Nhập đại lý, kỳ và số tiền hợp lệ.';
  if (/\bproject_id\b/i.test(message)) return 'Chọn dự án.';
  if (/\bbase\b/i.test(message)) return 'Cơ sở tính: net hoặc list.';
  return message;
}
```

`types.ts` — thêm:

```ts
export type BdsSchemeBase = 'net' | 'list';
export type BdsTriggerStage = 'vbtt' | 'contracted' | 'handed_over';
export type BdsCommissionScheme = {
  id: string;
  project_id: number;
  phase_id?: string | null;
  status: string;
  base: BdsSchemeBase;
};
export type BdsCommissionLedger = {
  id: string;
  agency_id?: string;
  transaction_id?: string;
  trigger_stage?: string;
  status?: string;
  base_vnd?: number;
  pct?: number;
  amount_vnd: number;
};
export type BdsCommissionStatement = {
  id: string;
  agency_id: string;
  period_month: string;
  gross_vnd: number;
  advance_vnd: number;
  clawback_vnd: number;
  net_vnd: number;
  status: string;
};
export type BdsSchemeTierInput = { min_tier_id: string; pct: number; product_line?: string };
export type BdsSchemeSplitInput = { trigger_stage: BdsTriggerStage; pct: number };
```

`api.ts` — widen `fetchBdsCommissions` return `BdsCommissionLedger[]`; thêm:

```ts
export function postCommissionScheme(
  token: string,
  body: { project_id: number; phase_id?: string; base?: BdsSchemeBase },
) {
  return bdsMutate<BdsCommissionScheme>(token, '/api/v1/bds/commission-schemes', 'POST', body);
}

export function postCommissionSchemeTiers(token: string, schemeId: string, tiers: BdsSchemeTierInput[]) {
  return bdsMutate(token, `/api/v1/bds/commission-schemes/${schemeId}/tiers`, 'POST', { tiers });
}

export function postCommissionSchemeSplits(token: string, schemeId: string, splits: BdsSchemeSplitInput[]) {
  return bdsMutate(token, `/api/v1/bds/commission-schemes/${schemeId}/splits`, 'POST', { splits });
}

export function postCommissionSchemeActivate(token: string, schemeId: string) {
  return bdsMutate<BdsCommissionScheme>(
    token,
    `/api/v1/bds/commission-schemes/${schemeId}/activate`,
    'POST',
  );
}

export function postCommissionStatementLock(
  token: string,
  body: { agency_id: string; period_month: string },
) {
  return bdsMutate<BdsCommissionStatement>(token, '/api/v1/bds/commission-statements/lock', 'POST', body);
}

export function postCommissionStatementApprove(token: string, statementId: string) {
  return bdsMutate<BdsCommissionStatement>(
    token,
    `/api/v1/bds/commission-statements/${statementId}/approve`,
    'POST',
  );
}

export function postCommissionStatementPay(token: string, statementId: string) {
  return bdsMutate<BdsCommissionStatement>(
    token,
    `/api/v1/bds/commission-statements/${statementId}/pay`,
    'POST',
  );
}

export function postCommissionAdvance(
  token: string,
  body: { agency_id: string; amount_vnd: number; period_month: string; note?: string },
) {
  return bdsMutate(token, '/api/v1/bds/commission-advances', 'POST', body);
}
```

Import types từ `./types` — **không** re-export type từ `api.ts` trong page (lesson W2 build).

- [ ] **Step 4: Run — expect PASS**

Cùng lệnh Step 2. Expected: PASS.

- [ ] **Step 5:** Không commit trừ khi user yêu cầu.

---

### Task 2: Khung trang — tab + filter đại lý / kỳ

**Files:**
- Modify: `services/ops-web/src/app/crm/bds/commissions/page.tsx`
- Create: `services/ops-web/src/lib/bds/BdsCommissionLedgerPanel.tsx` (shell — Task 4 hoàn thiện)

**Interfaces:**
- Consumes: Task 1, `fetchBdsAgencies`, `useBdsPageAuth`, `hasCap`, `hideCommissionSchemePct`, `toPeriodMonthStart`
- Produces: `CommissionsTab` type `'scheme' | 'ledger' | 'period' | 'advance'`; shared state `agencyId`, `periodMonth`, `reloadToken`

- [ ] **Step 1:** Không test riêng page — dùng vitest Task 1 đã xanh.

- [ ] **Step 2: Refactor page**

Pattern: giống `re-projects/[id]/page.tsx` tab local state.

```tsx
type CommissionsTab = 'scheme' | 'ledger' | 'period' | 'advance';

const TABS: { id: CommissionsTab; label: string }[] = [
  { id: 'scheme', label: 'Scheme' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'period', label: 'Kỳ' },
  { id: 'advance', label: 'Tạm ứng' },
];
```

- Gate: `useBdsPageAuth([{ section: 'bds_commission', action: 'view' }])` — giữ.
- Load `fetchBdsAgencies` → `<select agency>` (required trước khi load ledger / lock).
- `<input type="month">` → `toPeriodMonthStart` on change; default tháng hiện tại.
- **First paint `cv_hh`:** default tab `ledger` (UX §4.15).
- Tab bar; render panel theo tab (placeholder OK cho Task 3–5).
- Footer link: nếu `hasCap(user, 'bds_agency_tiers', 'configure')` → `<Link href="/crm/bds/tiers">Recalc hạng</Link>` (HH-05).
- `BdsCommissionLedgerPanel`: di chuyển logic bảng hiện tại từ page (fetch on `agencyId` + `periodMonth` + `reloadToken`).

- [ ] **Step 3:** `npm run build` trong `services/ops-web` (optional smoke) — không lỗi import type.

- [ ] **Step 4:** Không commit trừ khi user yêu cầu.

---

### Task 3: Panel Scheme — wizard 4 bước

**Files:**
- Create: `services/ops-web/src/lib/bds/BdsCommissionSchemePanel.tsx`
- Modify: `services/ops-web/src/app/crm/bds/commissions/page.tsx` — mount panel tab scheme

**Interfaces:**
- Consumes: `postCommissionScheme*`, `fetchProjectPhases`, `fetchProjectTransactions`, `BdsProjectField`, `uniqueTierIdsFromAgencies`, `w3ActionCopy`, `hasCap(..., 'approve')`
- Produces: panel tự quản `schemeId` trong `sessionStorage` key `bds-w3-scheme-id`

- [ ] **Step 1:** Manual test checklist (không vitest UI).

- [ ] **Step 2: Implement wizard**

Bước 1 — **DA × đợt × cơ sở:** `BdsProjectField` + optional `<select phase>` từ `fetchProjectPhases(token, projectId)` + radio `base` net/list. Nút **Tạo scheme** → `postCommissionScheme` → lưu `id` sessionStorage + hiện step 2.

Bước 2 — **Tier × hạng:** bảng editable rows `{ min_tier_id, pct, product_line? }`. Dropdown gợi ý = `uniqueTierIdsFromAgencies(agencies)`. Nút **Lưu tier** → `postCommissionSchemeTiers`. Ẩn cột `%` nếu `hideCommissionSchemePct(user)` — vẫn gửi pct server-side cho cv_hh.

Bước 3 — **Split mốc:** 3 hàng mặc định `vbtt 30` · `contracted 50` · `handed_over 20` (editable). Client validate sum ≈ 100 trước POST. **Lưu split** → `postCommissionSchemeSplits`.

Bước 4 — **Activate:** nút chỉ khi `hasCap approve`. Trước activate: nếu `fetchProjectTransactions` có TX stage `deposit` | `vbtt` | `contracted` trên DA → `window.confirm('Đã có cọc/giao dịch — vẫn activate?')` (UX warn). **Activate** → `postCommissionSchemeActivate`. Success → chip `active` + disable edit tiers/splits.

Lỗi mutate → `w3ActionCopy`. Banner «Không có GET scheme — refresh mất draft trừ khi còn sessionStorage».

- [ ] **Step 3:** Tab scheme chỉ render khi `hasCap approve`; user chỉ `view` → muted «Chỉ CV HH được cấu hình scheme.»

- [ ] **Step 4:** Không commit trừ khi user yêu cầu.

---

### Task 4: Panel Ledger — HH-02 read + clawback hiển thị

**Files:**
- Modify: `services/ops-web/src/lib/bds/BdsCommissionLedgerPanel.tsx`

**Interfaces:**
- Consumes: `fetchBdsCommissions`, `hideCommissionSchemePct`, props `{ token, agencyId, periodMonth, reloadToken }`

- [ ] **Step 1: Hoàn thiện bảng**

Cột: ID (rút gọn) · TX · Mốc (`trigger_stage`) · Trạng thái (`accrued` / `paid` / `clawback`) · `%` (ẩn CTV) · Số tiền · Cơ sở (optional `base_vnd`).

Empty: «Chưa có dòng hoa hồng kỳ này.» — ledger do system T+0 khi TX đạt mốc (HH-02).

Clawback rows: style muted / label «Clawback» (HH-04 display-only).

Nút **Làm mới** → bump `reloadToken` parent.

- [ ] **Step 2:** `vitest run src/lib/bds/api.spec.ts` PASS (fetch path unchanged).

- [ ] **Step 3:** Không commit trừ khi user yêu cầu.

---

### Task 5: Panel Kỳ — lock · duyệt · chi

**Files:**
- Create: `services/ops-web/src/lib/bds/BdsCommissionPeriodPanel.tsx`
- Modify: `services/ops-web/src/app/crm/bds/commissions/page.tsx`

**Interfaces:**
- Consumes: `postCommissionStatementLock|Approve|Pay`, `w3ActionCopy`, props `{ token, agencyId, periodMonth, onStatementChange }`
- Produces: `statement: BdsCommissionStatement | null` in parent state (for tab advance disable + pay flow)

- [ ] **Step 1: Implement**

Hiển thị tóm tắt sau lock: `gross_vnd`, `advance_vnd`, `clawback_vnd`, `net_vnd`, chip `status`.

| status | Nút (cap) |
|--------|-----------|
| (none) | **Khóa kỳ** (`approve`) |
| `locked` | **Duyệt** (`approve`) |
| `approved` | **Chi** (`payout`) |
| `paid` | read-only «Đã chi» |

Flow:
1. **Khóa** → `postCommissionStatementLock` → set statement state từ response.
2. **Duyệt** → `postCommissionStatementApprove(statement.id)`.
3. **Chi** → `postCommissionStatementPay(statement.id)` → bump ledger reload.

Copy UX: «±0đ với Kênh» = hiển thị `net_vnd` rõ; không sửa GMV.

Persist `statement.id` + `status` in `sessionStorage` key `bds-w3-statement-${agencyId}-${periodMonth}` để refresh không mất id (vẫn không GET list).

- [ ] **Step 2:** Lỗi `statement_mismatch` / `statement_status` → banner đỏ `w3ActionCopy`.

- [ ] **Step 3:** Không commit trừ khi user yêu cầu.

---

### Task 6: Panel Tạm ứng + kiểm chứng W3

**Files:**
- Create: `services/ops-web/src/lib/bds/BdsCommissionAdvancePanel.tsx`
- Modify: `services/ops-web/src/app/crm/bds/commissions/page.tsx`

- [ ] **Step 1: Advance panel**

Form: agency (inherit filter) · amount_vnd · note optional · period (inherit). Nút **Ghi tạm ứng** chỉ khi `hasCap payout` và statement **chưa** `locked|approved|paid` (client guard — server `period_locked` backup).

Success → toast «Đã ghi tạm ứng» + clear amount; không list advances (no GET).

- [ ] **Step 2: Full vitest**

```bash
cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds
```

Expected: W1+W2+W3 FE xanh.

- [ ] **Step 3: Grep PR**

Không `Bds2Module`, không sửa `bds-hold.service.ts` / `bds-tx.service.ts`, không W4–W8 file mới, không `crm_b2b_commission_ledger`.

- [ ] **Step 4: Build smoke**

```bash
cd services/ops-web && NEXT_PUBLIC_PTT_BDS_UI=1 npm run build
```

Expected: PASS (import types từ `@/lib/bds/types`).

- [ ] **Step 5:** Không commit trừ khi user yêu cầu.

**UAT staging (sau deploy, user login lại):**

| Persona | Việc | Pass |
|---------|------|------|
| `cv_hh` | Wizard scheme + activate trước CSBH cùng DA | |
| `cv_hh` | TX vbtt/contracted → ledger có dòng accrued | |
| `cv_hh` | Tab Kỳ: Khóa → Duyệt → Chi một kỳ | |
| `cv_hh` | Tạm ứng trước khóa; sau khóa → «Kỳ đã khóa» | |
| `truong_kenh` | Chỉ xem ledger, không nút khóa/chi | |
| CTV (`job_functions` ctv) | Ledger không cột % | |

---

## Coverage vs spec §7 W3 / HH-01–06

| Tiêu chí | Task |
|----------|------|
| HH-01 Wizard + activate | 3 |
| HH-02 Ledger T+0 (read) | 4 |
| HH-03 Lock / approve / pay | 5 |
| HH-04 Clawback display | 4 |
| HH-05 Recalc link | 2 |
| HH-06 Ẩn % CTV | 2, 3, 4 |
| §7 W3 «lock/approve/pay một kỳ trên UI» | 5 |

## Pattern copy từ W2

- Filter `agencyId` / `periodMonth` ở page — panels nhận props, không fetch agencies trùng.
- Copy conflict **chỉ** `w3ActionCopy` trên mutate W3 — không dính `w2ActionCopy` trừ khi tái dùng chung message.
- Types import `@/lib/bds/types` trong TSX.
- `sessionStorage` cho id không có GET — document banner trong scheme panel.

## Escalate (chỉ khi UAT fail)

| Gap | Hướng xử lý |
|-----|-------------|
| Cần list scheme / statement sau refresh | ADD `GET` tối thiểu trên Nest — **ngoài** W3 mặc định |
| Cần dropdown tier_code thay UUID | ADD `GET /agencies/tiers` — W2 đã từ chối; chỉ khi product bắt buộc |
| Activate warn cọc cần API deposit-count | FE đủ với `fetchProjectTransactions` |

---

*Sau khi duyệt plan: cập nhật link trong [2026-08-23-bds-os-coding.md](./2026-08-23-bds-os-coding.md) Task 12 → file này.*
