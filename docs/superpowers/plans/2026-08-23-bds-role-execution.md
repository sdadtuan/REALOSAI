# BĐS — Kế hoạch thực thi theo chức vụ (W0–W1 + lộ trình W2–W8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi chức vụ CĐT bấm được việc nhà trên ops-web: W0 gán cap đúng 18 chức vụ; W1 nối Hold / Giao dịch / Lead / Công nợ vào API đã có.

**Architecture:** Tận dụng pack + ops-web đã có. W0 **nâng** `bds-org-seed` + catalog Admin. W1 **nối** 4 trang stub (`holds` / `transactions` / `leads` / `collections`) vào controller hiện có qua **cùng** `lib/bds/api.ts` (`bdsFetch`/`bdsMutate`). Mẫu UI: `aftersales/page.tsx`. Không tạo app BĐS thứ hai, không rewrite hold/TX.

**Tech Stack:** NestJS + Jest (`ptt-crm-api`); Next.js + Vitest (`ops-web`); PostgreSQL `staff_section_permissions`.

**Spec:** [2026-08-23-bds-role-feature-execution.md](../specs/2026-08-23-bds-role-feature-execution.md)  
**Chu trình:** [2026-08-23-bds-crm-operating-cycle.md](../specs/2026-08-23-bds-crm-operating-cycle.md)  
**Mẫu UI sống:** `services/ops-web/src/app/crm/bds/aftersales/page.tsx`

## Global Constraints

- Không thay Q1–Q48. HĐMB cổng kép. Hai hold một căn = 409. `re_buyer` không Deal Room.
- Không ghi HH vào `crm_b2b_commission_ledger`. Không import `ReProjectsModule` vào `BdsModule`.
- Flag mặc định code: `PTT_BDS_PACK=0`, `PTT_BDS_UI=0`. Staging đã bật — không tắt.
- GET ngoài tenant = 404, không PII. Copy UI: giữ chỗ · cọc · VBTT · HĐMB.
- Test API: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand`
- Test FE: `cd services/ops-web && ./node_modules/.bin/vitest run <file>`
- Không commit trừ khi user yêu cầu.
- U7 payroll map ngoài phạm vi.

---

## 0. File map (W0–W1)

```
services/ptt-crm-api/src/bds/org/bds-position-default-caps.ts   # CREATE — map 18 chức vụ → cap
services/ptt-crm-api/src/bds/org/bds-position-default-caps.spec.ts
services/ptt-crm-api/src/bds/org/bds-org-seed.ts               # + seedPositionDefaultCaps()
services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json  # + section bds_*
services/ops-web/src/lib/bds/types.ts                          # + HoldRow, TxRow, BuyerRow, AgingRow
services/ops-web/src/lib/bds/api.ts                            # + hold/tx/lead/collection client
services/ops-web/src/lib/bds/api.spec.ts                       # CREATE
services/ops-web/src/lib/bds/project-picker.ts                 # CREATE — ?project= + last project
services/ops-web/src/app/crm/bds/holds/page.tsx
services/ops-web/src/app/crm/bds/transactions/page.tsx
services/ops-web/src/app/crm/bds/leads/page.tsx
services/ops-web/src/app/crm/bds/collections/page.tsx
```

**Plan toàn hệ (W2–W8):** [`2026-08-23-bds-os-coding.md`](./2026-08-23-bds-os-coding.md) — chỉ mở sau Task 7 PASS.

---

### Task 1: Catalog RBAC + cap mặc định 18 chức vụ

**Plan W0 đầy đủ (làm cái này, không làm lại ở đây):** [`2026-08-23-bds-w0-caps.md`](./2026-08-23-bds-w0-caps.md).

**Files:**
- Create: `services/ptt-crm-api/src/bds/org/bds-position-default-caps.ts`
- Create: `services/ptt-crm-api/src/bds/org/bds-position-default-caps.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/org/bds-org-seed.ts`
- Modify: `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json`
- Test: `services/ptt-crm-api/src/bds/org/bds-position-default-caps.spec.ts`

**Interfaces:**
- Consumes: `BDS_POSITION_SEEDS`, `BDS_CAP_CATALOG`, `staff_section_permissions`
- Produces: `BDS_POSITION_DEFAULT_CAPS: Record<string, ReadonlyArray<{ section: string; action: string }>>`, `capsForPosition(code: string)`, `BdsOrgSeedService.seedPositionDefaultCaps()` — INSERT ON CONFLICT DO NOTHING, không DELETE

- [ ] **Step 1: Write the failing test**

```ts
import { BDS_POSITION_SEEDS } from './bds-org-seed';
import { BDS_CAP_CATALOG } from '../bds-cap-catalog';
import { BDS_POSITION_DEFAULT_CAPS, capsForPosition } from './bds-position-default-caps';

describe('BDS_POSITION_DEFAULT_CAPS', () => {
  it('covers all 18 seeded positions', () => {
    expect(Object.keys(BDS_POSITION_DEFAULT_CAPS).sort()).toEqual(
      [...BDS_POSITION_SEEDS].map((p) => p.code).sort(),
    );
  });

  it('every cap exists in BDS_CAP_CATALOG', () => {
    const allowed = new Set(BDS_CAP_CATALOG.map((c) => `${c.section}:${c.action}`));
    for (const caps of Object.values(BDS_POSITION_DEFAULT_CAPS)) {
      for (const c of caps) {
        expect(allowed.has(`${c.section}:${c.action}`)).toBe(true);
      }
    }
  });

  it('tvv cannot approve hold or edit HĐMB', () => {
    const caps = capsForPosition('tvv_inhouse');
    expect(caps.some((c) => c.section === 'bds_holds' && c.action === 'approve')).toBe(false);
    expect(caps.some((c) => c.section === 'bds_transactions' && c.action === 'edit')).toBe(false);
    expect(caps.some((c) => c.section === 'bds_holds' && c.action === 'create')).toBe(true);
  });

  it('gdkd can approve hold and activate policy', () => {
    const caps = capsForPosition('gdkd');
    expect(caps.some((c) => c.section === 'bds_holds' && c.action === 'approve')).toBe(true);
    expect(caps.some((c) => c.section === 'bds_policies' && c.action === 'approve')).toBe(true);
  });

  it('truong_pc and truong_collection are not the same A set', () => {
    const pc = new Set(capsForPosition('truong_pc').map((c) => `${c.section}:${c.action}`));
    const cl = new Set(capsForPosition('truong_collection').map((c) => `${c.section}:${c.action}`));
    expect(pc.has('bds_legal:approve')).toBe(true);
    expect(cl.has('bds_collections:create')).toBe(true);
    expect(pc.has('bds_collections:create')).toBe(false);
    expect(cl.has('bds_legal:approve')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/org/bds-position-default-caps.spec.ts --runInBand`  
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`bds-position-default-caps.ts` — copy ma trận spec §4. Mỗi chức vụ gồm đủ `view` của section họ ghi. Ví dụ rút:

```ts
import type { StaffSectionCap } from '../../staff-auth/staff-auth.types';

const v = (section: string, ...actions: string[]): StaffSectionCap[] =>
  actions.map((action) => ({ section, action }));

export const BDS_POSITION_DEFAULT_CAPS: Record<string, readonly StaffSectionCap[]> = {
  tgd: [
    ...v('bds_tenant', 'view'),
    ...v('bds_holds', 'view'),
    ...v('bds_launches', 'view'),
    ...v('bds_transactions', 'view'),
    ...v('bds_collections', 'view'),
    ...v('bds_project_os', 'view'),
    ...v('bds_aftersales', 'view'),
  ],
  gdkd: [
    ...v('bds_tenant', 'view'),
    ...v('bds_holds', 'view', 'approve', 'cancel'),
    ...v('bds_policies', 'view', 'approve'),
    ...v('bds_launches', 'view', 'open'),
    ...v('bds_agency_tiers', 'view', 'override'),
    ...v('bds_transactions', 'view'),
    ...v('bds_buyers', 'view'),
    ...v('bds_agencies', 'view'),
  ],
  tvv_inhouse: [
    ...v('bds_holds', 'view', 'create'),
    ...v('bds_buyers', 'view'),
    ...v('bds_transactions', 'view', 'create'),
  ],
  // ... đủ 18 code — không bỏ sót; khớp test Step 1
};

export function capsForPosition(code: string): StaffSectionCap[] {
  return [...(BDS_POSITION_DEFAULT_CAPS[code] ?? [])];
}
```

Trong `bds-org-seed.ts` thêm (sau insert positions):

```ts
async seedPositionDefaultCaps(): Promise<void> {
  for (const pos of BDS_POSITION_SEEDS) {
    const caps = capsForPosition(pos.code);
    for (const cap of caps) {
      await this.db.query(
        `INSERT INTO staff_section_permissions (position_id, section_id, action)
         SELECT p.id, $2, $3 FROM crm_positions p
         WHERE p.code = $1
         ON CONFLICT (position_id, section_id, action) DO NOTHING`,
        [pos.code, cap.section, cap.action],
      );
    }
  }
}
```

Gọi từ `seedForTenant` sau vòng `BDS_POSITION_SEEDS`. Không `DELETE`. Không set `grants_customized`.

`rbac-admin-catalog.json`: thêm `extra_actions`: `lock`, `import`, `cancel`, `suspend`, `payout`, `open` + label tiếng Việt. Thêm mỗi `bds_*` vào `permission_ids`, `sections` (group `BĐS`), `section_actions` khớp `BDS_CAP_CATALOG`. Nếu không thêm, Admin lưu ma trận sẽ **xóa** cap BĐS (`normalizeGrantPayload`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/org/bds-position-default-caps.spec.ts src/bds/org/bds-org-seed.spec.ts --runInBand`  
Expected: PASS.

- [ ] **Step 5: Commit** (chỉ khi user yêu cầu)

```bash
git add services/ptt-crm-api/src/bds/org/bds-position-default-caps.ts \
  services/ptt-crm-api/src/bds/org/bds-position-default-caps.spec.ts \
  services/ptt-crm-api/src/bds/org/bds-org-seed.ts \
  services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json
git commit -m "$(cat <<'EOF'
feat(bds): seed default caps for 18 CĐT positions

EOF
)"
```

---

### Task 2: Client API Hold / TX / Lead / Collection

**Plan W1 đầy đủ (làm cái này, không làm lại ở đây):** [`2026-08-23-bds-w1-fe.md`](./2026-08-23-bds-w1-fe.md).

**Files:**
- Modify: `services/ops-web/src/lib/bds/types.ts`
- Modify: `services/ops-web/src/lib/bds/api.ts`
- Create: `services/ops-web/src/lib/bds/api.spec.ts`
- Create: `services/ops-web/src/lib/bds/project-picker.ts`
- Create: `services/ops-web/src/lib/bds/project-picker.spec.ts`

**Interfaces:**
- Consumes: `bdsFetch`, `bdsMutate` (private trong `api.ts` — export mutate helpers)
- Produces: types + functions dưới đây

```ts
export type BdsHoldRow = {
  id: string;
  project_id: number;
  product_id: number;
  lead_id: number;
  channel_partner_id: string;
  status: 'pending' | 'active' | 'cancelled' | 'expired' | 'converted';
  expires_at: string | null;
  note: string;
  approved_by: string;
};

export type BdsTxRow = {
  id: string;
  project_id: number;
  product_id: number;
  hold_id: string | null;
  stage: string;
  net_price_vnd: number;
  paid_pct: number;
};

export type BdsHdmbGate = {
  legal_ok: boolean;
  paid_ok: boolean;
  paid_pct: number;
  hdmb_min_paid_pct: number;
  legal_gate: string;
};

export type BdsBuyerRow = {
  id: number;
  name: string;
  phone?: string;
  stage: string;
  project_id: number | null;
  touched_at: string | null;
};

export type BdsAgingRow = {
  transaction_id: string;
  product_id: number;
  overdue_days: number;
  remaining_vnd: number;
};

export function fetchProjectHolds(token: string, projectId: number): Promise<BdsHoldRow[]>;
export function fetchHold(token: string, id: string): Promise<BdsHoldRow>;
export function postUnitHold(token: string, unitId: number, body: {
  lead_id: number;
  row_version: number;
  channel_partner_id?: string;
  note?: string;
}, idempotencyKey: string): Promise<BdsHoldRow>;
export function postHoldApprove(token: string, id: string, approved_by: string): Promise<BdsHoldRow>;
export function postHoldReject(token: string, id: string, reason: string): Promise<BdsHoldRow>;
export function postHoldCancel(token: string, id: string, reason: string): Promise<BdsHoldRow>;

export function fetchProjectTransactions(token: string, projectId: number): Promise<BdsTxRow[]>;
export function fetchTransaction(token: string, id: string): Promise<BdsTxRow>;
export function fetchHdmbGate(token: string, txId: string): Promise<BdsHdmbGate>;
export function postConvertDeposit(token: string, holdId: string, body?: object): Promise<BdsTxRow>;
export function postTxVbtt(token: string, txId: string, body?: object): Promise<BdsTxRow>;
export function postTxContract(token: string, txId: string, body?: object): Promise<BdsTxRow>;

export function fetchBdsLeads(token: string, projectId?: number): Promise<BdsBuyerRow[]>;
export function postLeadQualify(token: string, id: number, body?: object): Promise<BdsBuyerRow>;
export function postLeadTouch(token: string, id: number): Promise<BdsBuyerRow>;
export function postLeadVisit(token: string, id: number, body: { visited_at?: string; note?: string }): Promise<unknown>;

export function postReceipt(token: string, body: {
  transaction_id: string;
  amount_vnd: number;
  received_at?: string;
  note?: string;
}): Promise<unknown>;
export function fetchCollectionAging(token: string, projectId?: number): Promise<BdsAgingRow[]>;
export function fetchCollectionExportUrl(projectId?: number): string;
```

`postUnitHold` / mutate: nếu `res.status === 409` ném `Error` với `message` chứa `409` (page Hold hiện nguyên văn).

`readBdsProjectId()`: `URLSearchParams` `project` → `sessionStorage['bds-project-id']` → `Number(process.env.NEXT_PUBLIC_BDS_PROJECT_ID ?? 0)` → `0`.  
`writeBdsProjectId(id: number)` ghi sessionStorage.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { postUnitHold, fetchProjectHolds } from './api';

describe('bds api client W1', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('lists holds by project', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'h1', status: 'pending', project_id: 9001, product_id: 1, lead_id: 1, channel_partner_id: '', note: '', approved_by: '', expires_at: null }],
    });
    const rows = await fetchProjectHolds('tok', 9001);
    expect(rows[0].id).toBe('h1');
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain('/api/v1/bds/projects/9001/holds');
  });

  it('surfaces 409 on second hold', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'hold_conflict' }),
    });
    await expect(
      postUnitHold('tok', 1, { lead_id: 2, row_version: 1 }, 'k1'),
    ).rejects.toThrow(/409|hold_conflict/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds/api.spec.ts`  
Expected: FAIL — `fetchProjectHolds` / `postUnitHold` not exported.

- [ ] **Step 3: Write minimal implementation**

Thêm types vào `types.ts`. Thêm hàm vào `api.ts` dùng `bdsFetch` / `bdsMutate`. `postUnitHold` gửi header `Idempotency-Key`. `bdsMutate` đổi: nếu `!res.ok` ném `Error` gồm `status` và `error` (`${status} ${error}`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds/api.spec.ts src/lib/bds/project-picker.spec.ts`  
Expected: PASS.

- [ ] **Step 5: Commit** (chỉ khi user yêu cầu)

```bash
git add services/ops-web/src/lib/bds/types.ts services/ops-web/src/lib/bds/api.ts \
  services/ops-web/src/lib/bds/api.spec.ts services/ops-web/src/lib/bds/project-picker.ts \
  services/ops-web/src/lib/bds/project-picker.spec.ts
git commit -m "$(cat <<'EOF'
feat(bds): add hold, tx, lead, collection API clients

EOF
)"
```

---

### Task 3: Trang Hold — TVV tạo, GĐKD duyệt, AM F1

**Files:**
- Modify: `services/ops-web/src/app/crm/bds/holds/page.tsx`
- Pattern: `services/ops-web/src/app/crm/bds/aftersales/page.tsx`

**Interfaces:**
- Consumes: Task 2 hold functions + `useBdsPageAuth([{ section: 'bds_holds', action: 'view' }])` + `hasCap`
- Produces: UI list + form + approve/reject/cancel

Màn (tiếng Việt):

1. Chọn dự án (`readBdsProjectId` + input số + `fetchReProjects` dropdown nếu có sẵn).  
2. Bảng hold: căn, lead, status, TTL, kênh, note.  
3. Form tạo (cap `create`): `product_id`, `lead_id`, `row_version`, `channel_partner_id` optional, note. Nút **Giữ chỗ**.  
4. Hàng `pending` + cap `approve`: **Duyệt** / **Từ chối** (lý do bắt buộc khi từ chối).  
5. Hàng `active|pending` + cap `cancel`: **Hủy**.  
6. Lỗi 409: «Căn đã có giữ chỗ — chọn căn khác.»  
7. Query `?hold=` scroll/highlight đúng dòng. Link **Việc** giữ như stub hiện tại.

- [ ] **Step 1: Write the failing test**

Không có harness RTL page trong repo — test hành vi client đã ở Task 2. Thêm spec thuần:

```ts
// services/ops-web/src/lib/bds/hold-copy.spec.ts
import { describe, expect, it } from 'vitest';
import { holdConflictCopy } from './hold-copy';

describe('holdConflictCopy', () => {
  it('maps 409 to Vietnamese', () => {
    expect(holdConflictCopy('409 hold_conflict')).toMatch(/đã có giữ chỗ/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds/hold-copy.spec.ts`  
Expected: FAIL — module not found.

- [ ] **Step 3: Write `hold-copy.ts` + page**

```ts
export function holdConflictCopy(message: string): string {
  if (/409|hold_conflict|conflict/i.test(message)) {
    return 'Căn đã có giữ chỗ — chọn căn khác.';
  }
  return message;
}
```

Thay stub `holds/page.tsx` bằng list/form như aftersales: `useEffect` load khi có `token` + `projectId`. Nút ẩn theo `hasCap(user, 'bds_holds', 'create'|'approve'|'cancel')`.

- [ ] **Step 4: Run tests**

Run: `cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds/hold-copy.spec.ts src/lib/bds/nav.spec.ts`  
Expected: PASS. Typecheck page: không import mới ngoài `cursor`/repo.

- [ ] **Step 5: Commit** (chỉ khi user yêu cầu)

```bash
git add services/ops-web/src/app/crm/bds/holds/page.tsx \
  services/ops-web/src/lib/bds/hold-copy.ts services/ops-web/src/lib/bds/hold-copy.spec.ts
git commit -m "$(cat <<'EOF'
feat(bds): wire Hold page to create, approve, and reject APIs

EOF
)"
```

---

### Task 4: Trang Giao dịch — cọc → VBTT → cổng kép → HĐMB

**Files:**
- Modify: `services/ops-web/src/app/crm/bds/transactions/page.tsx`
- Create: `services/ops-web/src/lib/bds/tx-copy.ts`
- Create: `services/ops-web/src/lib/bds/tx-copy.spec.ts`

**Interfaces:**
- Consumes: Task 2 TX functions
- Produces: list TX + 3 hành động có cap

Copy lỗi:

```ts
export function txGateCopy(message: string): string {
  if (/paid_pct/i.test(message)) return 'Chưa đủ % thu — Công nợ phải ghi phiếu.';
  if (/legal_gate/i.test(message)) return 'Chưa đủ điều kiện bán — Pháp chế bật cổng.';
  if (/400/.test(message)) return message;
  return message;
}
```

UI:

1. Chọn dự án. List TX: căn, stage, `paid_pct`, `net_price_vnd`.  
2. Form **Cọc**: `hold_id` → `postConvertDeposit` (cap `bds_transactions.create`).  
3. Chọn TX: hiện `GET hdmb-gate` hai cột «Pháp lý» / «Thu %».  
4. Nút **Ghi VBTT** (`edit`) → `postTxVbtt`.  
5. Nút **Ký HĐMB** (`edit`) → `postTxContract`; 400 hiện `txGateCopy`.  
6. GĐKD **không** có `edit` → không thấy nút VBTT/HĐMB (đúng BR-35 trên UI).

- [ ] **Step 1: Write the failing test** (`tx-copy.spec.ts` như trên, expect hai chuỗi tiếng Việt)

- [ ] **Step 2: Run** `vitest run src/lib/bds/tx-copy.spec.ts` — FAIL missing module

- [ ] **Step 3: Implement copy + page** (cùng layout aftersales)

- [ ] **Step 4: Run** `vitest run src/lib/bds/tx-copy.spec.ts` — PASS

- [ ] **Step 5: Commit** khi user yêu cầu — `feat(bds): wire transaction wizard and HDMB gate copy`

---

### Task 5: Trang Lead khách mua — qualify / touch / visit

**Files:**
- Modify: `services/ops-web/src/app/crm/bds/leads/page.tsx`

**Interfaces:**
- Consumes: `fetchBdsLeads`, `postLeadQualify`, `postLeadTouch`, `postLeadVisit`
- Produces: list + 3 nút. **Không** mở Deal Room. Không claim đây là board CSKH (W5).

UI:

1. List lead (lọc `project` nếu có). Cột: tên, stage, `touched_at`, dự án.  
2. Cap `edit`: **Chạm** (`touch`), **Qualify**, **Đặt xem nhà** (datetime + note).  
3. Link Việc `entity_type=lead` nếu tickets bật.

- [ ] **Step 1:** Thêm test client nếu chưa cover `fetchBdsLeads` path `/api/v1/bds/leads` trong `api.spec.ts`

```ts
it('lists buyers', async () => {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => [{ id: 1, name: 'A', stage: 'new', project_id: 9001, touched_at: null }],
  });
  const rows = await fetchBdsLeads('tok', 9001);
  expect(rows[0].id).toBe(1);
  expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain('/api/v1/bds/leads');
});
```

- [ ] **Step 2: Run** `vitest run src/lib/bds/api.spec.ts` — FAIL nếu chưa có hàm

- [ ] **Step 3:** Implement hàm (nếu thiếu) + thay placeholder page

- [ ] **Step 4: Run** `vitest run src/lib/bds/api.spec.ts` — PASS

- [ ] **Step 5: Commit** khi user yêu cầu — `feat(bds): wire buyer lead list qualify touch visit`

---

### Task 6: Trang Công nợ — phiếu thu + aging + export

**Files:**
- Modify: `services/ops-web/src/app/crm/bds/collections/page.tsx`

**Interfaces:**
- Consumes: `postReceipt`, `fetchCollectionAging`; cap `bds_collections.create` / `export`
- Produces: form phiếu + bảng aging + link CSV

UI copy: «Sổ thu căn — không phải hạch toán.»

1. Form: `transaction_id`, `amount_vnd`, ngày, note → `POST /api/v1/bds/receipts`.  
2. Bảng aging: TX, căn, ngày quá hạn, còn lại.  
3. Nút xuất: `GET /api/v1/bds/collections/export` (mở URL có Bearer không được — dùng `bdsFetch` blob + download, hoặc `window.open` nếu API cookie; **dùng fetch blob** + `URL.createObjectURL`).

- [ ] **Step 1:** Test `fetchCollectionAging` path chứa `/api/v1/bds/collections/aging`

- [ ] **Step 2: Run** FAIL nếu chưa có hàm

- [ ] **Step 3:** Hàm + page

- [ ] **Step 4: Run** `vitest run src/lib/bds/api.spec.ts` PASS

- [ ] **Step 5: Commit** khi user yêu cầu — `feat(bds): wire collection receipts and aging`

---

### Task 7: Kiểm chứng W0–W1

**Files:** không thêm domain.

- [ ] **Step 1: Unit**

```
cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/org/bds-position-default-caps.spec.ts src/bds/org/bds-org-seed.spec.ts --runInBand
cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds
```

Expected: PASS.

- [ ] **Step 2: Manual staging** (tenant `cdt-demo`, project `9001`)

| Persona | Việc | Kỳ vọng |
|---------|------|---------|
| `tvv_inhouse` | Hold tạo căn trống | 201 + hàng `active` |
| `tvv_inhouse` | Hold trùng căn | «Căn đã có giữ chỗ» |
| `gdkd` | Duyệt F1 | status `active`; không thấy nút HĐMB |
| `truong_collection` | Phiếu thu | aging đổi; `paid_pct` trên TX |
| `cv_hd` | HĐMB thiếu % | «Chưa đủ % thu» |
| `cskh_lead` | Touch + visit | `touched_at` + visit tạo |

- [ ] **Step 3:** Không claim W2–W8 xong.

---

## W2–W8 — plan con (viết trước khi code)

| Plan file (tạo khi bắt đầu sóng) | Phạm vi | Chức vụ mở khóa |
|----------------------------------|---------|-----------------|
| [`2026-08-23-bds-w2-project-channel.md`](./2026-08-23-bds-w2-project-channel.md) | Tab Project OS, policies, agencies/[id], tiers, basket grant | PM, SP, CV giá, Kênh, PC kho |
| [`2026-08-23-bds-w3-commission-ui.md`](./2026-08-23-bds-w3-commission-ui.md) | Scheme / statement / advances | `cv_hh` |
| [`2026-08-23-bds-w4-spine.md`](./2026-08-23-bds-w4-spine.md) | U0 spine v1 — hook ticket idempotent (U-12) | nền |
| `2026-08-23-bds-w5-cskh-360.md` | U1+U2 board + Deal Room 404 + after intake | CSKH, After |
| `2026-08-23-bds-w6-nav-hub.md` | U3+U8 ẩn B2B, 4 widget | TGĐ, GĐKD |
| `2026-08-23-bds-w7-finance-capi.md` | U4+U5 | Collection, MKT |
| [`2026-08-23-bds-w8-hr-offboard.md`](./2026-08-23-bds-w8-hr-offboard.md) | U6 hold U-07/U-08 (KPI/G0 = W8b) | `hr_bp` |

Mỗi plan con bắt buộc: file map, TDD, không đụng API hold/TX đã ổn.

---

*W0–W1 xong → TVV / GĐKD / Collection / CV HĐ / CSKH tạm chạy một chu trình trên web. Plan W2 đã viết — code khi user chọn hướng.*
