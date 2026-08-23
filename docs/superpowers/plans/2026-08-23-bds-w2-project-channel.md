# W2 — Tab Project OS / Giá / Kênh / Tồn kho

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PM đánh mốc `reached`; SP import + stack; CV giá soạn draft; GĐKD activate CSBH; Kênh cấp giỏ; PC gắn văn bản Sở — trên trang DA / policies / agencies đã có chỗ gắn.

**Architecture:** FE-first, reuse-first. Domain API đã sống (`BdsProjectOsController`, `BdsPolicyController`, `BdsAgencyController`, `BdsInventoryController`). Nối vào **cùng** `lib/bds/api.ts` (`bdsFetch` / `bdsMutate`). Không trang `/crm/bds/projects`. Không rewrite Project OS / policy / agency / inventory Nest.

**Tech Stack:** Next.js + Vitest (`ops-web`). Nest **không** thêm route. Không import `ReProjectsModule` vào `BdsModule`.

**Spec:** [2026-08-23-bds-role-feature-execution.md](../specs/2026-08-23-bds-role-feature-execution.md) §3.2–3.4, 3.8–3.9, 3.12 + §7 W2  
**Chu trình:** [2026-08-23-bds-crm-operating-cycle.md](../specs/2026-08-23-bds-crm-operating-cycle.md)  
**UX copy:** [2026-08-23-bds-ux-ui-complete.md](../specs/2026-08-23-bds-ux-ui-complete.md) §6  
**W1 (xong):** [2026-08-23-bds-w1-fe.md](./2026-08-23-bds-w1-fe.md)  
**OS plan:** [2026-08-23-bds-os-coding.md](./2026-08-23-bds-os-coding.md) Task 8–11

## Global Constraints

- Không thay Q1–Q48. Không đụng contract hold/TX/receipt (W1 đã ổn).
- Không `Bds2Module`, không `/crm/bds-v2`, không xóa tab KPI/budget trên `re-projects/[id]`.
- `re_buyer` Deal Room = W5. Ẩn `/crm/sales` = W6. HH scheme = W3.
- `bdsMutate` lỗi: `` `${res.status} ${err.error}` `` (đã có). Page map copy từ chuỗi đó.
- `projectId === 0` → không gọi GET project-scoped (leads/units/policies/legal-docs).
- Flag: không tắt `PTT_BDS_PACK` / `PTT_BDS_UI` trên staging.
- Test FE: `cd services/ops-web && ./node_modules/.bin/vitest run <file>`
- Không commit trừ khi user yêu cầu.
- Không ghi HH vào `crm_b2b_commission_ledger`. Không invent `GET /tiers` hay `POST /bds/projects`.
- **Actor role Nest ≠ mã chức vụ W0.** FE gửi đúng chuỗi API (xem Task 1). Không sửa `canActivatePolicy` / `canActivateAgency`.
- PM/SP/PC W0 **không** có `crm_re_projects.view` — phải nới gate FE + `rbac-routes` (Task 2). Không seed cap RE mới.

### Actor role (khóa — Nest util)

| Việc | Cap nút | Body `actor_role` |
|------|---------|-------------------|
| Activate / archive CSBH | `bds_policies.approve` | `cdt_sales_dir` |
| Activate đại lý | `bds_agencies.edit` | `cdt_channel` |
| Override hạng / exclusive | `bds_agency_tiers.override` | `cdt_sales_dir` |

`canActivatePolicy('gdkd')` = **false**. Gửi `gdkd` → 403 `activate_forbidden`.

### Copy lỗi W2 (UX §6 — đúng code API)

| `code` | Câu |
|--------|-----|
| `legal_gate` | «Chưa đủ điều kiện mở đợt / giữ chỗ sàn.» |
| `one_price` | «Giá phải khớp CSBH CĐT. Không được kê.» |
| `contract` | «Chưa có HĐ phân phối — không cấp giỏ.» |
| `row_version` (409 hoặc lock) | «Người khác vừa sửa căn. Làm mới.» |
| `activate_forbidden` | «Chỉ GĐKD được kích hoạt CSBH.» |
| `unit_in_flight` | «Không gỡ giỏ — căn đang giữ chỗ hoặc giao dịch.» |

`legal_gate_hdmb` / `paid_pct` đã map ở W1 (`tx-copy.ts`) — không đụng.

### Ngoài W2 (cấm trong PR này)

- PM-07 RACI: **không có HTTP** — escalate, đừng invent bảng.
- `one_price` / `hdmb_min_paid_pct` trên `CreateReProjectBody`: **không có**. `one_price` cột default `TRUE`. `% HĐMB` nhập trên **policy**. Không nới `ReProjectsModule`.
- `required_roles`: **không có** trên Project OS — không viết test giả.
- List hạng riêng: không có `GET /tiers`. Hạng = `GET /agencies` + override trên `[id]`. `POST /tiers/recalc` = score HH (controller commission) — chỉ gọi nếu user có `bds_agency_tiers.configure`.

---

## File map

```
services/ops-web/src/lib/bds/types.ts                      NÂNG — OS/Policy/Agency/Unit
services/ops-web/src/lib/bds/api.ts                        NÂNG — client W2
services/ops-web/src/lib/bds/api.spec.ts                   NÂNG — path + 400/409
services/ops-web/src/lib/bds/actor-role.ts                 CREATE
services/ops-web/src/lib/bds/actor-role.spec.ts            CREATE
services/ops-web/src/lib/bds/w2-copy.ts                    CREATE
services/ops-web/src/lib/bds/w2-copy.spec.ts               CREATE
services/ops-web/src/lib/bds/caps.ts                       NÂNG canViewBdsProjectHouse
services/ops-web/src/lib/bds/caps.spec.ts                  NÂNG
services/ops-web/src/lib/bds/nav.ts                        NÂNG link policies
services/ops-web/src/lib/bds/nav.spec.ts                   NÂNG
services/ops-web/src/lib/rbac-routes.ts                    NÂNG /crm/re-projects + /crm/bds anyOf
services/ops-web/src/components/OpsNav.tsx                 NÂNG title policies
services/ops-web/src/lib/bds/BdsProjectOsPanel.tsx         CREATE — tab Pháp lý/Tòa/Đợt/Mốc/Plan
services/ops-web/src/lib/bds/BdsInventoryPanel.tsx         CREATE — list/stack/import/lock
services/ops-web/src/app/crm/re-projects/page.tsx          NÂNG gate + field mã/CĐT
services/ops-web/src/app/crm/re-projects/[id]/page.tsx     NÂNG tab + panel (không xóa KPI)
services/ops-web/src/app/crm/bds/policies/page.tsx         CREATE
services/ops-web/src/app/crm/bds/agencies/page.tsx         NÂNG Link [id] + tạo DL
services/ops-web/src/app/crm/bds/agencies/[id]/page.tsx    CREATE
services/ops-web/src/app/crm/bds/tiers/page.tsx            NỐI recalc
```

API **GIỮ** (không sửa Nest trừ W2 FAIL vì contract lệch — escalate):

| Việc | Route | Body / note |
|------|--------|-------------|
| Tòa | `GET/POST /api/v1/bds/projects/:id/towers` | `{ code, name?, floor_min?, floor_max? }` |
| Khu / layout | `GET/POST …/zones` · `…/layouts` | `{ code, name? }` |
| Văn bản | `GET/POST …/legal-docs` | `{ doc_type, status?, file_id?, issued_on?, expires_on?, required_for_sale? }` |
| Cổng PC | `POST …/legal-gate` | `{ override?, reason? }` — override cần `reason` ≥ 10 ký tự |
| Đợt | `GET/POST …/phases` · `POST /phases/:id/open\|close` | `{ code, name?, open_to_channel? }` |
| Mốc | `GET/POST …/milestones` · `POST /milestones/:id/reach` | reach `{ actual_date? }` |
| Plan | `GET/POST …/plan-revisions` · `POST /plan-revisions/:id/approve` | `{ kind: business\|marketing\|sales }` · approve `{ reviewed_by }` |
| Policy | `GET/POST …/projects/:id/policies` · `POST /policies/:id/update\|activate\|archive\|quote` | activate `{ phase_id, price_list_id, actor_role, activated_by? }` |
| Price list | `GET/POST …/price-lists` · `POST /price-lists/:id/items` | `{ version_code }` · item `{ unit_code, list_price_vnd? }` |
| Đại lý | `GET/POST /agencies` · `GET /agencies/:id` · `POST …/activate\|suspend\|contracts` | contract `{ project_id }` |
| Giỏ | `GET …/basket` (header `x-bds-project` optional) · `POST …/basket/units` · `POST …/units/:productId/revoke` | grant `{ project_id, product_ids, exclusivity?, actor_role? }` |
| Hạng | `POST …/tier/override` · `POST /tiers/recalc` | override `{ tier_code, actor_role, reason, until? }` |
| Tồn kho | `GET …/units` · `GET …/stack` · `POST …/units/import` · `POST /units/:id/lock\|unlock` · `PATCH /units/:id/pool` | import `{ csv }` · lock `{ row_version, reason? }` · pool `{ row_version, pool }` |

`doc_type` bán: `quy_hoach_1_500` · `qsd_dat` · `nghia_vu_tai_chinh` · `gpxd` · `nghiem_thu_mong` · `bao_lanh_nh` · `so_xd_du_dieu_kien_ban`.

---

### Task 1: Client + actor role + copy

**Files:**
- Modify: `services/ops-web/src/lib/bds/types.ts`
- Modify: `services/ops-web/src/lib/bds/api.ts`
- Modify: `services/ops-web/src/lib/bds/api.spec.ts`
- Create: `services/ops-web/src/lib/bds/actor-role.ts`
- Create: `services/ops-web/src/lib/bds/actor-role.spec.ts`
- Create: `services/ops-web/src/lib/bds/w2-copy.ts`
- Create: `services/ops-web/src/lib/bds/w2-copy.spec.ts`

**Interfaces:**
- Consumes: `bdsFetch`, `bdsMutate` (private, cùng file), `isPositiveProjectId`
- Produces: hàm client dưới đây; `policyActivateRole()` / `agencyActivateRole()` / `tierOverrideRole()`; `w2ActionCopy(message)`

- [ ] **Step 1: Failing tests**

```ts
// actor-role.spec.ts
import { describe, expect, it } from 'vitest';
import { agencyActivateRole, policyActivateRole, tierOverrideRole } from './actor-role';

describe('actor-role', () => {
  it('maps W0 positions to Nest role strings', () => {
    expect(policyActivateRole()).toBe('cdt_sales_dir');
    expect(agencyActivateRole()).toBe('cdt_channel');
    expect(tierOverrideRole()).toBe('cdt_sales_dir');
  });
});
```

```ts
// w2-copy.spec.ts
import { describe, expect, it } from 'vitest';
import { w2ActionCopy } from './w2-copy';

describe('w2ActionCopy', () => {
  it('maps legal_gate / one_price / contract / row_version', () => {
    expect(w2ActionCopy('400 legal_gate')).toMatch(/mở đợt/i);
    expect(w2ActionCopy('400 one_price')).toMatch(/một giá|khớp CSBH/i);
    expect(w2ActionCopy('400 contract')).toMatch(/HĐ phân phối/i);
    expect(w2ActionCopy('409 row_version')).toMatch(/Làm mới/i);
    expect(w2ActionCopy('403 activate_forbidden')).toMatch(/GĐKD/i);
  });

  it('does not steal hold_closed', () => {
    expect(w2ActionCopy('409 hold_closed')).toBe('409 hold_closed');
  });
});
```

Thêm vào `api.spec.ts`:

```ts
it('posts milestone reach at /milestones/:id/reach', async () => {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'm1', status: 'reached' }),
  });
  await postMilestoneReach('tok', 'm1', { actual_date: '2026-08-23' });
  expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
    '/api/v1/bds/milestones/m1/reach',
  );
});

it('posts policy activate with Nest actor_role', async () => {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'p1', status: 'active' }),
  });
  await postPolicyActivate('tok', 'p1', {
    phase_id: 'ph1',
    price_list_id: 3,
    actor_role: 'cdt_sales_dir',
  });
  const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(JSON.parse(init.body as string).actor_role).toBe('cdt_sales_dir');
});

it('skips project-scoped W2 GETs when projectId is 0', async () => {
  await expect(fetchProjectPolicies('tok', 0)).resolves.toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});

it('surfaces 400 contract on grant units', async () => {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: false,
    status: 400,
    json: async () => ({ error: 'contract' }),
  });
  await expect(
    postAgencyGrantUnits('tok', 'ag1', { project_id: 1, product_ids: [9] }),
  ).rejects.toSatisfy((err: unknown) => {
    const msg = (err as Error).message;
    return msg.includes('400') && msg.includes('contract');
  });
});

it('posts unit import csv on pack path', async () => {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => ({ imported: 1, skipped_sold: [], conflicts: [] }),
  });
  await postUnitImport('tok', 7, 'unit_code\nA-01\n');
  expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
    '/api/v1/bds/projects/7/units/import',
  );
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd services/ops-web && ./node_modules/.bin/vitest run \
  src/lib/bds/actor-role.spec.ts src/lib/bds/w2-copy.spec.ts src/lib/bds/api.spec.ts
```

Expected: FAIL — modules / exports missing.

- [ ] **Step 3: Minimal implementation**

`actor-role.ts`:

```ts
export function policyActivateRole(): string {
  return 'cdt_sales_dir';
}
export function agencyActivateRole(): string {
  return 'cdt_channel';
}
export function tierOverrideRole(): string {
  return 'cdt_sales_dir';
}
```

`w2-copy.ts`:

```ts
export function w2ActionCopy(message: string): string {
  if (/activate_forbidden/i.test(message)) return 'Chỉ GĐKD được kích hoạt CSBH.';
  if (/legal_gate/i.test(message) && !/hdmb/i.test(message)) {
    return 'Chưa đủ điều kiện mở đợt / giữ chỗ sàn.';
  }
  if (/one_price/i.test(message)) return 'Giá phải khớp CSBH CĐT. Không được kê.';
  if (/\bcontract\b/i.test(message)) return 'Chưa có HĐ phân phối — không cấp giỏ.';
  if (/row_version/i.test(message)) return 'Người khác vừa sửa căn. Làm mới.';
  if (/unit_in_flight/i.test(message)) {
    return 'Không gỡ giỏ — căn đang giữ chỗ hoặc giao dịch.';
  }
  return message;
}
```

`types.ts` — thêm (đủ field UI; thừa API bỏ qua):

```ts
export type BdsLegalDoc = {
  id: string;
  doc_type: string;
  status: string;
  file_id?: string;
  issued_on?: string | null;
  expires_on?: string | null;
};
export type BdsTower = { id: string; code: string; name: string };
export type BdsPhase = { id: string; code: string; name: string; status: string };
export type BdsMilestone = {
  id: string;
  code: string;
  name: string;
  status: string;
  target_date?: string | null;
  actual_date?: string | null;
};
export type BdsPlanRevision = { id: string; kind: string; version: number; status: string };
export type BdsPolicy = {
  id: string;
  code: string;
  name: string;
  status: string;
  project_id: number;
  hdmb_min_paid_pct?: number;
};
export type BdsPriceList = { id: number; version_code: string; name?: string };
export type BdsAgency = {
  id: string;
  code: string;
  name: string;
  status: string;
  kind?: string;
  tier_id?: string | null;
};
export type BdsBasketUnit = { product_id: number; exclusivity?: string };
export type BdsUnit = {
  id: number;
  unit_code: string;
  tower?: string;
  floor?: string;
  status?: string;
  pool?: string;
  row_version?: number;
};
export type BdsStack = {
  project_id: number;
  towers: Array<{ tower: string; floors: Array<{ floor: string; units: BdsUnit[] }> }>;
};
export type BdsImportResult = {
  imported: number;
  skipped_sold: Array<{ unit_code: string; reason: string }>;
  conflicts: Array<{ unit_code: string; error: string }>;
};
```

`api.ts` — mọi GET project-scoped bọc `isPositiveProjectId` → `[]` / skip. Dùng `bdsMutate` cho POST/PATCH. `fetchAgencyBasket` gửi header `x-bds-project` khi `projectId > 0`.

Hàm bắt buộc: `fetchProjectTowers` · `postProjectTower` · `fetchProjectLegalDocs` · `postProjectLegalDoc` · `postLegalGate` · `fetchProjectPhases` · `postProjectPhase` · `postPhaseOpen` · `postPhaseClose` · `fetchProjectMilestones` · `postProjectMilestone` · `postMilestoneReach` · `fetchPlanRevisions` · `postPlanRevision` · `postPlanApprove` · `fetchProjectPolicies` · `postProjectPolicy` · `postPolicyUpdate` · `postPolicyActivate` · `postPolicyArchive` · `postPolicyQuote` · `fetchPriceLists` · `postPriceList` · `postPriceListItem` · `fetchAgency` · `postAgency` · `postAgencyActivate` · `postAgencySuspend` · `postAgencyContract` · `postAgencyGrantUnits` · `postAgencyRevokeUnit` · `fetchAgencyBasket` · `postAgencyTierOverride` · `postTiersRecalc` · `fetchProjectUnits` · `fetchProjectStack` · `postUnitImport` · `postUnitLock` · `postUnitUnlock` · `patchUnitPool`.

Widen `fetchBdsAgencies` return `BdsAgency[]`.

- [ ] **Step 4: Run — expect PASS**

Cùng lệnh Step 2. Expected: PASS (kể cả case W1 cũ trong `api.spec.ts`).

- [ ] **Step 5:** Không commit trừ khi user yêu cầu.

---

### Task 2: Tab Project OS trên DA hiện có

**Files:**
- Modify: `services/ops-web/src/lib/bds/caps.ts`
- Modify: `services/ops-web/src/lib/bds/caps.spec.ts`
- Modify: `services/ops-web/src/lib/rbac-routes.ts`
- Create: `services/ops-web/src/lib/bds/BdsProjectOsPanel.tsx`
- Modify: `services/ops-web/src/app/crm/re-projects/page.tsx`
- Modify: `services/ops-web/src/app/crm/re-projects/[id]/page.tsx`

**Interfaces:**
- Consumes: client Task 1, `w2ActionCopy`, `hasCap`, `isBdsUiFeEnabled`
- Produces: `canViewBdsProjectHouse(user)`; tab `legal|towers|phases|milestones|plans` khi UI=1

- [ ] **Step 1: Failing cap / route tests**

```ts
// caps.spec.ts
import { canViewBdsProjectHouse } from './caps';

it('PM / SP / PC house without crm_re_projects', () => {
  expect(canViewBdsProjectHouse(user([{ section: 'bds_project_os', action: 'view' }]))).toBe(true);
  expect(canViewBdsProjectHouse(user([{ section: 'bds_inventory', action: 'view' }]))).toBe(true);
  expect(canViewBdsProjectHouse(user([{ section: 'bds_legal', action: 'view' }]))).toBe(true);
  expect(canViewBdsProjectHouse(user([{ section: 'crm_re_projects', action: 'view' }]))).toBe(true);
  expect(canViewBdsProjectHouse(user([{ section: 'bds_holds', action: 'view' }]))).toBe(false);
});
```

Thêm case `auth.spec.ts` hoặc file nhỏ `rbac-routes` hiện có: `resolvePathCapRequirements('/crm/re-projects/1')` chứa `{ section: 'bds_project_os', action: 'view' }`.

- [ ] **Step 2:** `vitest run src/lib/bds/caps.spec.ts src/lib/auth.spec.ts` — FAIL.

- [ ] **Step 3: Implement**

`caps.ts`:

```ts
export function canViewBdsProjectHouse(user: StoredStaffUser | null): boolean {
  return (
    hasCap(user, 'crm_re_projects', 'view') ||
    hasCap(user, 'crm_re_projects_products', 'view') ||
    hasCap(user, 'bds_project_os', 'view') ||
    hasCap(user, 'bds_inventory', 'view') ||
    hasCap(user, 'bds_legal', 'view')
  );
}
```

`rbac-routes.ts` — **trước** rule `/crm` (prefix dài hơn thắng):

```ts
{
  prefix: '/crm/re-projects',
  anyOf: [
    { section: 'crm_re_projects', action: 'view' },
    { section: 'crm_re_projects_products', action: 'view' },
    { section: 'bds_project_os', action: 'view' },
    { section: 'bds_inventory', action: 'view' },
    { section: 'bds_legal', action: 'view' },
  ],
},
```

Thêm `bds_policies.view` + `bds_project_os.view` + `bds_legal.view` vào `anyOf` của `/crm/bds` (policies URL nằm dưới `/crm/bds`).

`re-projects/page.tsx` + `[id]/page.tsx` `ensureAuth`: thay check `crm_re_projects` bằng `canViewBdsProjectHouse(me)`.

Form tạo DA (UI=1 + `bds_project_os.edit`): thêm `code`, `developer_name` (đã có trên `CreateReProjectBody`). **Không** gửi `one_price` / `hdmb_min_paid_pct`.

`BdsProjectOsPanel.tsx`: props `{ token, projectId, user }`. Sub-tab Pháp lý / Tòa / Đợt / Mốc / Kế hoạch.

Nút:
- Gắn văn bản + **Bật cổng** chỉ `bds_legal.approve` (PC). Override: `reason` ≥ 10 ký tự.
- Tạo tòa/khu/đợt/mốc + **Đạt** / **Mở đợt** / **Đóng đợt** chỉ `bds_project_os.edit`.
- Duyệt plan chỉ `bds_project_os.approve`. `reviewed_by = user.email`.
- Lỗi: `setActionError(w2ActionCopy(msg))`.
- Race: `projectIdRef` sync trong `onProject`/`useEffect` như Hold W1.

`[id]/page.tsx`: mở rộng `DetailTab` + `tabLabels` + `visibleTabs` khi `isBdsUiFeEnabled()` và cap tương ứng. Render `<BdsProjectOsPanel />`. **Không** xóa `kpi|budget|risks|accounting`.

- [ ] **Step 4:** caps + auth.spec PASS. Typecheck panel: import chỉ từ `@/lib/bds/*` + `hasCap`.

- [ ] **Step 5:** Không commit trừ khi user yêu cầu.

---

### Task 3: Trang Policies

**Files:**
- Modify: `services/ops-web/src/lib/bds/nav.ts`
- Modify: `services/ops-web/src/lib/bds/nav.spec.ts`
- Modify: `services/ops-web/src/components/OpsNav.tsx`
- Create: `services/ops-web/src/app/crm/bds/policies/page.tsx`

**Interfaces:**
- Consumes: policy/price-list/quote/activate client; `policyActivateRole`; `BdsProjectField`; `useBdsPageAuth([{ section: 'bds_policies', action: 'view' }])`
- Produces: URL `/crm/bds/policies` trên nav CĐT khi `bds_policies.view`

- [ ] **Step 1: Failing nav test**

```ts
it('CĐT with policies view shows Giá / CSBH', () => {
  process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
  const links =
    buildBdsNavSections(
      user([
        { section: 'bds_tenant', action: 'view' },
        { section: 'bds_policies', action: 'view' },
      ]),
      'developer',
    )[0]?.links ?? [];
  expect(links.some((l) => l.href === '/crm/bds/policies' && l.label === 'Giá / CSBH')).toBe(true);
});

it('broker never shows policies', () => {
  process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
  const links = buildBdsNavSections(
    user([{ section: 'bds_policies', action: 'view' }]),
    'broker',
  )[0]?.links ?? [];
  expect(links.some((l) => l.href === '/crm/bds/policies')).toBe(false);
});
```

- [ ] **Step 2:** `vitest run src/lib/bds/nav.spec.ts` — FAIL.

- [ ] **Step 3:** `buildDeveloperLinks`: sau «Dự án» (hoặc trước Hold) push policies nếu `hasCap(..., 'bds_policies', 'view')`. Không thêm vào `buildBrokerLinks`.

`OpsNav.tsx` `PAGE_TITLES`: `'/crm/bds/policies': 'Giá / CSBH'`.

Page: `useBdsPageAuth` + `BdsProjectField` + list policies/price lists.

Form soạn (`bds_policies.create` / `edit`): `code`, `name`, `hdmb_min_paid_pct`, `discount_cap_pct`. Price list `version_code` + item `unit_code` + `list_price_vnd`.

Quote (`view`): `list_price_vnd`, `discount_pct`, optional `net_price_vnd` — hiện kết quả hoặc `w2ActionCopy`.

**Activate / Archive** chỉ khi `hasCap(user, 'bds_policies', 'approve')`. Confirm Activate: «Một giá khóa. Kênh không cộng phí.» Body: `{ phase_id, price_list_id, actor_role: policyActivateRole(), activated_by: user.email }`. CV giá **không** thấy nút.

`projectId === 0` → «Chọn dự án», không fetch.

- [ ] **Step 4:** nav.spec PASS.

- [ ] **Step 5:** Không commit trừ khi user yêu cầu.

---

### Task 4: Đại lý `[id]` + hạng recalc

**Files:**
- Modify: `services/ops-web/src/app/crm/bds/agencies/page.tsx`
- Create: `services/ops-web/src/app/crm/bds/agencies/[id]/page.tsx`
- Modify: `services/ops-web/src/app/crm/bds/tiers/page.tsx`

**Interfaces:**
- Consumes: agency/basket/contract/tier client; `agencyActivateRole`; `tierOverrideRole`; `w2ActionCopy`
- Produces: hàng list → `/crm/bds/agencies/:id`; cấp giỏ disabled + copy khi 400 `contract`

- [ ] **Step 1: Client path already in Task 1.** Thêm test copy contract (đã có). Không invent `GET /tiers`.

- [ ] **Step 2:** (optional) `vitest run src/lib/bds/api.spec.ts` vẫn PASS.

- [ ] **Step 3:**

List: `Link` mã/tên → `[id]`. Form tạo (`bds_agencies.create`): `code`, `name`, `kind` (`f1` default). Nút Activate (`edit`) gửi `{ actor_role: agencyActivateRole() }`. Suspend = `bds_agencies.suspend`.

Detail `useBdsPageAuth([{ section: 'bds_agencies', action: 'view' }])`:
- `GET /agencies/:id` + basket (`x-bds-project` từ `BdsProjectField`).
- HĐ: `POST …/contracts` `{ project_id }` — `bds_agencies.edit` (PC xem; Kênh tạo).
- Cấp giỏ: `product_ids` (ô CSV số) + `project_id`. Default `exclusivity: 'shared'`. Exclusive chỉ nếu `hasCap(..., 'bds_agency_tiers', 'override')` kèm `actor_role: tierOverrideRole()`.
- 400 `contract` → `w2ActionCopy` + disable nút cấp sau lỗi đó đến khi contract 201.
- Thu hồi: `reason` bắt buộc (`manual` đủ nếu API nhận string).
- Override hạng: `tier_code` + `reason` ≥ 10 + `actor_role: tierOverrideRole()` — chỉ `bds_agency_tiers.override`.

Tiers page: bảng `fetchBdsAgencies` (cột mã / status / `tier_id`). Form `period_month` (`YYYY-MM`) + **Tính lại hạng** → `postTiersRecalc` chỉ `bds_agency_tiers.configure`. Giữ câu «Override trên từng đại lý trong mục Mạng.»

- [ ] **Step 4:** Typecheck pages. Không gọi path ngoài bảng API.

- [ ] **Step 5:** Không commit trừ khi user yêu cầu.

---

### Task 5: Nối tồn kho RE → pack

**Files:**
- Create: `services/ops-web/src/lib/bds/BdsInventoryPanel.tsx`
- Modify: `services/ops-web/src/app/crm/re-projects/[id]/page.tsx`

**Interfaces:**
- Consumes: units/stack/import/lock/unlock/pool; `w2ActionCopy`; `parseRequiredRowVersion` từ `tx-copy.ts` (đã có — không default 1)
- Produces: khi `isBdsUiFeEnabled()` tab Sản phẩm / Tồn kho render panel pack; khi UI=0 giữ `fetchReProjectProducts` / `inventory-by-profile`

- [ ] **Step 1:** Test import path đã có ở Task 1. Thêm:

```ts
it('lock requires explicit row_version in body', async () => {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => ({ id: 1 }),
  });
  await postUnitLock('tok', 4, { row_version: 3, reason: 'ops' });
  const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(JSON.parse(init.body as string)).toEqual({ row_version: 3, reason: 'ops' });
});
```

- [ ] **Step 2:** FAIL nếu hàm chưa có (Task 1 phải xong trước).

- [ ] **Step 3:**

`BdsInventoryPanel`: list units; lưới stack (tòa × tầng); textarea CSV + **Import** (`bds_inventory.import`) — hiện `imported` / `conflicts[]` / `skipped_sold[]` (không nuốt lỗi).

Khóa / Mở / Đổi pool (`inhouse|channel|reserved_vip|reserved_staff`): ô `row_version` **bắt buộc rỗng**, parse bằng `parseRequiredRowVersion`. Nút theo `lock` / `edit`. 409 → `w2ActionCopy`.

Không xóa tab RE khi `NEXT_PUBLIC_PTT_BDS_UI !== 1`.

`[id]/page.tsx` tab `products` / `inventory`: nếu `isBdsUiFeEnabled() && hasCap(..., 'bds_inventory', 'view')` → panel; else giữ fetch RE cũ.

- [ ] **Step 4:** `vitest run src/lib/bds/api.spec.ts src/lib/bds/tx-copy.spec.ts` PASS.

- [ ] **Step 5:** Không commit trừ khi user yêu cầu.

---

### Task 6: Kiểm chứng W2

**Files:** không thêm feature.

- [ ] **Step 1:**

```bash
cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/bds/org/bds-position-default-caps.spec.ts \
  src/bds/org/bds-org-seed.spec.ts --runInBand
```

Expected: W1+W2 FE xanh; W0 11/11 — không regress cap.

- [ ] **Step 2:** Grep PR — không có `Bds2Module`, không `app/crm/bds-v2`, không sửa `bds-hold.service.ts` / `bds-tx.service.ts` / `bds-collection.service.ts`, không `canActivatePolicy(`.

- [ ] **Step 3:** Không làm W3 (HH scheme) / W5 (board) / W6 (ẩn B2B) trong PR này.

**UAT staging (sau deploy, user login lại):**

| Persona | Việc | Pass |
|---------|------|------|
| `pm_du_an` | Mở `/crm/re-projects/:id` không 403; **Đạt** mốc | |
| `truong_sp` | Import CSV + thấy stack; 409 lock sai version → «Làm mới» | |
| `cv_gia` | Draft policy + quote; **không** nút Activate | |
| `gdkd` | Activate (role `cdt_sales_dir`); không thấy Ký HĐMB (W1) | |
| `truong_kenh` | HĐ rồi cấp giỏ; chưa HĐ → «HĐ phân phối» | |
| `truong_pc` | Gắn `so_xd_du_dieu_kien_ban` + bật cổng | |

---

## Coverage vs spec §7 W2

| Tiêu chí xong | Task |
|---------------|------|
| PM `reached` mốc trên UI | 2 |
| SP import + stack | 5 |
| CV giá draft | 3 |
| GĐKD activate | 3 (`cdt_sales_dir`) |
| Kênh cấp giỏ | 4 |
| PC gắn văn bản | 2 |

## Pattern copy từ W1

- `projectIdRef` set **đồng bộ** khi đổi dự án; effect `cancelled`; `reload` so `ref`.
- Copy conflict **chỉ** đúng verb (I1 W1): `w2ActionCopy` trên mutate W2, không dính approve hold.
- `row_version` không default `1` (I2 W1).

---

*W2 xong → PM/SP/Giá/Kênh/PC chạy trên web. Plan W3: `2026-08-23-bds-w3-commission-ui.md` (chưa viết).*
