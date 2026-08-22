# P8 Triển khai — UI + RBAC (nav CĐT/sàn, hub, ẩn Deal Room)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skin ops-web theo `tenant.mode`: nav CĐT/hybrid vs sàn, hub điều hành SCR-BDS-001 (UC-001), ẩn Deal Room trên `re_buyer` (UC-003), cap `bds_*`, chuông hold TTL tối thiểu (UC-002 v1). Không PWA, không chat/ticket, không war-room.

**Architecture:** API hub mỏng `src/bds/reports/` (`BdsHubService`) sau `StaffOrInternalKeyGuard` + `BdsPackGuard` + `BdsUiGuard` (`PTT_BDS_PACK=1` **và** `PTT_BDS_UI=1`). FE: `NEXT_PUBLIC_PTT_BDS_UI` (mặc định `0`) + builder `buildBdsNavSections(user, mode)` gắn vào `OpsNav`. Tenant broker: `/crm/bds` redirect `/crm/bds/basket` (UC-001 E1). User không có cap `bds_*` → UI cũ nguyên (spec §11). Không import `ReProjectsModule`. Không đổi API hold/TX/agency/commission — chỉ đọc.

**Tech Stack:** NestJS `ptt-crm-api` + Jest; Next.js `ops-web` + Vitest; Playwright staging (skip khi UI=0).

**Spec:** [2026-08-21-bds-industry-pack-design.md](../specs/2026-08-21-bds-industry-pack-design.md) §9, §11, §15 P8.  
**UX:** [2026-08-22-bds-ux-ui-design.md](../specs/2026-08-22-bds-ux-ui-design.md) §2, §3.1, §4.1, §5.  
**UC:** [13-BDS-INDUSTRY-PACK.md](../../use-cases/13-BDS-INDUSTRY-PACK.md) UC-001, UC-002, UC-003.  
**P1b:** [2026-08-22-bds-p1b-project-os.md](./2026-08-22-bds-p1b-project-os.md) — `legal_gate` / tòa (hub sell-through best-effort).  
**P5:** [2026-08-22-bds-p5-agency.md](./2026-08-22-bds-p5-agency.md) — mạng / hạng.  
**P6:** [2026-08-22-bds-p6-buyer-crm.md](./2026-08-22-bds-p6-buyer-crm.md) — lead `re_buyer` + Deal Room API 404.  
**P7:** [2026-08-22-bds-p7-commission.md](./2026-08-22-bds-p7-commission.md) — ledger / statement UI đọc.  
**Roadmap:** [2026-08-22-bds-coding-roadmap.md](./2026-08-22-bds-coding-roadmap.md)

**Test ID P8:** UC-001 hub + redirect broker; UC-003 ẩn Deal Room FE; BDS-19 copy tenant broker trên `/crm/re-projects`.  
**Chuông ticket/mention** = **P11/P12** — P8 chỉ badge hold TTL từ hub.  
**Launches / aftersales / `/crm/chat` / `/crm/work`** = **P9–P12** — **không** hiện trên nav P8.  
**Stack / pháp lý / CSBH / modal HĐMB** = giữ trang `re-projects` cũ; P8 không vẽ lại.  
**PWA 3 màn** = ngoài v1 P8.  
**Ẩn net CTV (BDS-09)** trên màn HH = P8 commissions list: CTV không thấy `pct` scheme CĐT — chỉ `amount_vnd` dòng mình.

## Global Constraints

- `PTT_BDS_PACK` mặc định `0` — mọi `/api/v1/bds/*` = **404**.
- `PTT_BDS_UI` mặc định `0` — hub + leaderboard HTTP **404** dù PACK=1.
- `NEXT_PUBLIC_PTT_BDS_UI` mặc định `0` — không inject section **BĐS** vào sidebar; `/crm/bds/*` render empty/404 shell.
- GET ngoài tenant = **404**, không 403, không PII (BR-BDS-05).
- Tenant `broker` không có hub CĐT (UC-001 E1).
- `re_buyer` **cấm** Deal Room (BR-BDS-06) — API P6 đã 404; P8 ẩn link + trang 404.
- User chỉ cap agency/PTT (không `bds_*`) → nav/proposal/Deal Room **không đổi**.
- Tiếng Việt: Giữ chỗ · cọc · VBTT · HĐMB. Không «Deal / SPA / Closing» trên UI CĐT.
- `BdsModule` **không** import `ReProjectsModule`.
- Test API: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand`.
- Test FE: `cd services/ops-web && ./node_modules/.bin/vitest run <file>`.
- Không commit trừ khi user yêu cầu.
- Prod VPS: **không** bật `PTT_BDS_PACK` / `PTT_BDS_UI` / `NEXT_PUBLIC_PTT_BDS_UI`.

---

## 0. Phạm vi / ngoài phạm vi

**Làm**

- Flag `isBdsUiEnabled()` + `BdsUiGuard` + `NEXT_PUBLIC_PTT_BDS_UI` / `isBdsUiFeEnabled()`
- Catalog cap `bds_*` (§9.2) + stub seed khi UI=1 (staging)
- `GET /api/v1/bds/hub` — KPI + inbox (max 8)
- `GET /api/v1/bds/leaderboard?period=` — đọc `bds_agency_tier_scores`
- Nav builder CĐT/hybrid vs sàn + gắn `OpsNav`
- Top bar: mode badge + badge hold TTL (UC-002 v1)
- Pages mỏng: hub, leads, holds, transactions, agencies, tiers, leaderboard, commissions, collections, basket
- Redirect broker `/crm/bds` → `/crm/bds/basket`
- Ẩn Deal Room / proposal trên `re_buyer` và khi user **chỉ** có `bds_*`
- Copy BDS-19 trên `/crm/re-projects` nếu `mode=broker`
- Path cap `/crm/bds*` trong `rbac-routes.ts`

**Không làm**

- Ra quân / war-room (P10)
- After-sales (P9)
- Chat `/crm/chat` · việc `/crm/work` (P11/P12)
- PWA staff 3 màn
- Modal cổng HĐMB 2 cột (API P4b đã 400; UI modal = P8b hoặc khi TX page sâu)
- Vẽ lại stack / pháp lý / CSBH
- SSE chuông ticket/mention
- Payroll / xuất bank
- Graph CAPI

---

## 1. File map

```
services/ptt-crm-api/src/bds/bds.flags.ts                         # + isBdsUiEnabled
services/ptt-crm-api/src/bds/bds.flags.spec.ts
services/ptt-crm-api/src/config/app-config.service.ts             # bdsUiEnabled
services/ptt-crm-api/src/bds/guards/bds-ui.guard.ts
services/ptt-crm-api/src/bds/guards/bds-ui.guard.spec.ts
services/ptt-crm-api/src/bds/reports/bds-hub.types.ts
services/ptt-crm-api/src/bds/reports/bds-hub.util.ts
services/ptt-crm-api/src/bds/reports/bds-hub.util.spec.ts
services/ptt-crm-api/src/bds/reports/bds-hub.repository.ts
services/ptt-crm-api/src/bds/reports/bds-hub.service.ts
services/ptt-crm-api/src/bds/reports/bds-hub.service.spec.ts
services/ptt-crm-api/src/bds/reports/bds-hub.controller.ts
services/ptt-crm-api/src/bds/reports/bds-hub.controller.spec.ts
services/ptt-crm-api/src/staff-auth/staff-auth.service.ts         # BDS_CAPS catalog + stub
services/ptt-crm-api/src/bds/bds.module.ts
services/ptt-crm-api/src/deal-room/deal-room.service.ts           # đã 404 re_buyer — không đổi trừ thiếu

services/ops-web/src/lib/bds/flags.ts
services/ops-web/src/lib/bds/flags.spec.ts
services/ops-web/src/lib/bds/caps.ts
services/ops-web/src/lib/bds/caps.spec.ts
services/ops-web/src/lib/bds/nav.ts
services/ops-web/src/lib/bds/nav.spec.ts
services/ops-web/src/lib/bds/deal-room-hide.ts
services/ops-web/src/lib/bds/deal-room-hide.spec.ts
services/ops-web/src/lib/rbac-routes.ts                           # /crm/bds*
services/ops-web/src/lib/auth.spec.ts                             # path /crm/bds
services/ops-web/src/components/OpsNav.tsx                        # section BĐS + badge
services/ops-web/src/components/layout/nav-icons.tsx              # titles /crm/bds
services/ops-web/src/app/crm/bds/page.tsx
services/ops-web/src/app/crm/bds/leads/page.tsx
services/ops-web/src/app/crm/bds/holds/page.tsx
services/ops-web/src/app/crm/bds/transactions/page.tsx
services/ops-web/src/app/crm/bds/agencies/page.tsx
services/ops-web/src/app/crm/bds/tiers/page.tsx
services/ops-web/src/app/crm/bds/leaderboard/page.tsx
services/ops-web/src/app/crm/bds/commissions/page.tsx
services/ops-web/src/app/crm/bds/collections/page.tsx
services/ops-web/src/app/crm/bds/basket/page.tsx
services/ops-web/src/app/crm/leads/[id]/deal-room/page.tsx        # 404 re_buyer
services/ops-web/src/app/crm/leads/meeting-prep/SalesCockpitDealReadyTab.tsx  # ẩn CTA
services/ops-web/e2e/bds/bds-nav.spec.ts                          # skip nếu UI=0

docs/superpowers/plans/2026-08-22-bds-coding-roadmap.md           # link P8 + flag §4
```

Không tạo `postgresql-ddl-bds-p8.sql` — hub/leaderboard đọc bảng P2/P4/P4b/P5/P7.

---

## 2. Flag + cap

### 2.1. API flag

```ts
export function isBdsUiEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_UI);
}
```

`BdsUiGuard`: PACK off **hoặc** UI off → `NotFoundException`.

### 2.2. FE flag

```ts
// services/ops-web/src/lib/bds/flags.ts
export function isBdsUiFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_PTT_BDS_UI ?? '0').trim().toLowerCase(),
  );
}
```

### 2.3. Cap catalog (spec §9.2)

Hằng `BDS_CAP_CATALOG` (section + actions). Stub login (`DEFAULT_STUB_CAPS`) **chỉ append** khi `isBdsUiEnabled()` — prod PACK/UI=0 không lộ cap BĐS cho user PTT.

```ts
export const BDS_CAP_CATALOG: ReadonlyArray<{ section: string; action: string }> = [
  { section: 'bds_tenant', action: 'view' },
  { section: 'bds_tenant', action: 'configure' },
  { section: 'bds_inventory', action: 'view' },
  { section: 'bds_inventory', action: 'create' },
  { section: 'bds_inventory', action: 'edit' },
  { section: 'bds_inventory', action: 'import' },
  { section: 'bds_inventory', action: 'lock' },
  { section: 'bds_holds', action: 'view' },
  { section: 'bds_holds', action: 'create' },
  { section: 'bds_holds', action: 'approve' },
  { section: 'bds_holds', action: 'cancel' },
  { section: 'bds_transactions', action: 'view' },
  { section: 'bds_transactions', action: 'create' },
  { section: 'bds_transactions', action: 'edit' },
  { section: 'bds_transactions', action: 'export' },
  { section: 'bds_policies', action: 'view' },
  { section: 'bds_policies', action: 'create' },
  { section: 'bds_policies', action: 'edit' },
  { section: 'bds_policies', action: 'approve' },
  { section: 'bds_agencies', action: 'view' },
  { section: 'bds_agencies', action: 'create' },
  { section: 'bds_agencies', action: 'edit' },
  { section: 'bds_agencies', action: 'suspend' },
  { section: 'bds_agency_tiers', action: 'view' },
  { section: 'bds_agency_tiers', action: 'configure' },
  { section: 'bds_agency_tiers', action: 'override' },
  { section: 'bds_baskets', action: 'view' },
  { section: 'bds_baskets', action: 'create' },
  { section: 'bds_baskets', action: 'edit' },
  { section: 'bds_commission', action: 'view' },
  { section: 'bds_commission', action: 'approve' },
  { section: 'bds_commission', action: 'export' },
  { section: 'bds_commission', action: 'payout' },
  { section: 'bds_project_os', action: 'view' },
  { section: 'bds_project_os', action: 'edit' },
  { section: 'bds_project_os', action: 'approve' },
  { section: 'bds_legal', action: 'view' },
  { section: 'bds_legal', action: 'edit' },
  { section: 'bds_legal', action: 'approve' },
  { section: 'bds_launches', action: 'view' },
  { section: 'bds_launches', action: 'create' },
  { section: 'bds_launches', action: 'open' },
  { section: 'bds_collections', action: 'view' },
  { section: 'bds_collections', action: 'create' },
  { section: 'bds_collections', action: 'export' },
  { section: 'bds_aftersales', action: 'view' },
  { section: 'bds_aftersales', action: 'edit' },
  { section: 'bds_aftersales', action: 'approve' },
  { section: 'bds_buyers', action: 'view' },
  { section: 'bds_buyers', action: 'edit' },
  { section: 'bds_buyers', action: 'view_pii' },
];
```

`staff_chat` / `staff_tickets` **không** seed ở P8.

FE helper:

```ts
export function hasAnyBdsCap(user: StoredStaffUser | null): boolean {
  return Boolean(user?.caps?.some((c) => String(c.section).startsWith('bds_')));
}
```

---

## 3. API hub + leaderboard

### 3.1. Types

```ts
export type HubInboxKind = 'hold_f1_pending' | 'hdmb_gate' | 'launch_open';

export type HubInboxRow = {
  kind: HubInboxKind;
  id: string;
  label: string;
  href: string;
};

export type HubKpi = {
  sell_through_pct: number;
  gmv_contracted_month_vnd: number;
  overdue_gt_30d: number;
  holds_expiring_2h: number;
};

export type HubResponse = {
  tenant_id: string;
  mode: 'developer' | 'broker' | 'hybrid';
  kpi: HubKpi;
  inbox: HubInboxRow[];
  sell_through_by_tower: Array<{ tower_code: string; pct: number }>;
  sell_through_by_agency: Array<{ agency_id: string; name: string; units: number }>;
};

export type LeaderboardRow = {
  agency_id: string;
  name: string;
  total_score: number;
  from_tier_id: string | null;
  to_tier_id: string | null;
};
```

### 3.2. Util

```ts
export function clampInbox(rows: HubInboxRow[], max = 8): HubInboxRow[] {
  return rows.slice(0, max);
}

export function sellThroughPct(sold: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((sold / total) * 100);
}

export function assertNotBrokerHub(mode: string): void {
  if (mode === 'broker') {
    throw Object.assign(new Error('hub_broker'), { status: 404 });
  }
}
```

Service ném `NotFoundException` khi tenant `broker` (không 403).

### 3.3. KPI nguồn (best-effort, thiếu bảng = 0)

| KPI | SQL / nguồn |
|-----|-------------|
| `sell_through_pct` | `crm_re_project_products` tenant: `status='sold'` / tất cả (trừ locked nếu cột có) |
| `gmv_contracted_month_vnd` | `SUM(bds_transactions.net_price_vnd)` `stage='contracted'` `contracted_at` trong tháng UTC |
| `overdue_gt_30d` | `COUNT(bds_payment_installments)` `status` overdue / `overdue_days>30` — **0** nếu COLLECTION off hoặc bảng trống |
| `holds_expiring_2h` | `bds_holds` `status IN ('pending','active')` AND `expires_at <= now()+2h` |

Inbox P8: chỉ `hold_f1_pending` (`status='pending'`, cap 8). `hdmb_gate` / `launch_open` = `[]` (P4b/P10).

`sell_through_by_tower`: JOIN `bds_towers` nếu P1b có dữ liệu; không có → `[]`.  
`sell_through_by_agency`: TOP 5 `channel_partner_id` TX contracted tháng.

### 3.4. Routes

| Method | Path | Guard | Việc |
|--------|------|-------|------|
| GET | `/api/v1/bds/hub` | PACK+UI | Hub; broker 404 |
| GET | `/api/v1/bds/leaderboard?period=YYYY-MM-01` | PACK+UI | Scores kỳ, sort `total_score` DESC |

`x-bds-tenant` bắt buộc (như `GET /tenants/me`). Thiếu → 404.

---

### Task 1: Flag UI + guard + util hub

**Files:**
- Modify: `services/ptt-crm-api/src/bds/bds.flags.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.flags.spec.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts`
- Create: `services/ptt-crm-api/src/bds/guards/bds-ui.guard.ts`
- Create: `services/ptt-crm-api/src/bds/guards/bds-ui.guard.spec.ts`
- Create: `services/ptt-crm-api/src/bds/reports/bds-hub.types.ts`
- Create: `services/ptt-crm-api/src/bds/reports/bds-hub.util.ts`
- Create: `services/ptt-crm-api/src/bds/reports/bds-hub.util.spec.ts`

- [ ] **Step 1: Flags spec (RED)**

```ts
it('defaults UI off when unset', () => {
  delete process.env.PTT_BDS_UI;
  expect(isBdsUiEnabled()).toBe(false);
});
```

- [ ] **Step 2: Util spec (RED)**

```ts
it('sellThroughPct 2/8 → 25', () => {
  expect(sellThroughPct(2, 8)).toBe(25);
});

it('clampInbox max 8', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    kind: 'hold_f1_pending' as const,
    id: String(i),
    label: 'x',
    href: '/crm/bds/holds',
  }));
  expect(clampInbox(rows)).toHaveLength(8);
});
```

- [ ] **Step 3: Implement flags + guard + util**

- [ ] **Step 4: Run**

Run: `./node_modules/.bin/jest src/bds/bds.flags.spec.ts src/bds/guards/bds-ui.guard.spec.ts src/bds/reports/bds-hub.util.spec.ts --runInBand`  
Expected: PASS

---

### Task 2: Hub + leaderboard service

**Files:**
- Create: `services/ptt-crm-api/src/bds/reports/bds-hub.repository.ts`
- Create: `services/ptt-crm-api/src/bds/reports/bds-hub.service.ts`
- Create: `services/ptt-crm-api/src/bds/reports/bds-hub.service.spec.ts`

**`BdsHubService.getHub(tenantId)`:**

1. `tenants.getMe(tenantId)` — 404 nếu thiếu.
2. `mode === 'broker'` → `NotFoundException`.
3. Gọi repo KPI + pending holds; `inbox = clampInbox(...)`.
4. Tower/agency best-effort try/catch → `[]`.

**`listLeaderboard(periodMonth, tenantId)`:**

- Join `bds_agency_tier_scores` + `bds_agencies` cùng tenant.
- Không `updatePct` ledger (BR-BDS-19).

- [ ] **Step 1: Service spec (RED)**

```ts
it('UC-001 broker hub → 404', async () => {
  tenants.getMe.mockResolvedValue({ id: 't1', mode: 'broker' });
  await expect(svc.getHub('t1')).rejects.toBeInstanceOf(NotFoundException);
  expect(repo.kpi).not.toHaveBeenCalled();
});

it('UC-001 developer returns kpi + inbox ≤8', async () => {
  tenants.getMe.mockResolvedValue({ id: 't1', mode: 'developer' });
  repo.kpi.mockResolvedValue({
    sell_through_pct: 25,
    gmv_contracted_month_vnd: 1,
    overdue_gt_30d: 0,
    holds_expiring_2h: 2,
  });
  repo.pendingHolds.mockResolvedValue(
    Array.from({ length: 9 }, (_, i) => ({
      kind: 'hold_f1_pending',
      id: `h${i}`,
      label: `A-${i}`,
      href: '/crm/bds/holds',
    })),
  );
  repo.byTower.mockResolvedValue([]);
  repo.byAgency.mockResolvedValue([]);
  const out = await svc.getHub('t1');
  expect(out.kpi.sell_through_pct).toBe(25);
  expect(out.inbox).toHaveLength(8);
});
```

- [ ] **Step 2: Implement + run** — PASS

---

### Task 3: Controller + module + stub caps

**Files:**
- Create: `services/ptt-crm-api/src/bds/reports/bds-hub.controller.ts`
- Create: `services/ptt-crm-api/src/bds/reports/bds-hub.controller.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.module.ts`
- Modify: `services/ptt-crm-api/src/staff-auth/staff-auth.service.ts`

Controller `@Controller('api/v1/bds')` + `StaffOrInternalKeyGuard`, `BdsPackGuard`, `BdsUiGuard`.

```ts
@Get('hub')
hub(@Headers('x-bds-tenant') tenantId?: string) {
  return this.hub.getHub(String(tenantId ?? ''));
}

@Get('leaderboard')
leaderboard(
  @Query('period') period: string,
  @Headers('x-bds-tenant') tenantId?: string,
) {
  return this.hub.listLeaderboard(period, String(tenantId ?? ''));
}
```

Stub caps: nếu `isBdsUiEnabled()` thì `DEFAULT_STUB_CAPS.push(...BDS_CAP_CATALOG)` **một lần** (copy array lúc construct, không mutate module-level nếu test song song — append trong getter stub).

- [ ] **Step 1: Controller delegates**

```ts
it('GET hub delegates', async () => {
  const hub = { getHub: jest.fn().mockResolvedValue({ mode: 'developer' }) };
  const ctrl = new BdsHubController(hub as never);
  await expect(ctrl.hub('t1')).resolves.toEqual({ mode: 'developer' });
});
```

- [ ] **Step 2: Register module** — guard, repo, service, controller; export `BdsHubService`

- [ ] **Step 3: Run**

Run: `./node_modules/.bin/jest src/bds/reports src/bds/guards/bds-ui.guard.spec.ts --runInBand`  
Expected: PASS

---

### Task 4: FE flags + nav builder + path cap

**Files:**
- Create: `services/ops-web/src/lib/bds/flags.ts`
- Create: `services/ops-web/src/lib/bds/flags.spec.ts`
- Create: `services/ops-web/src/lib/bds/caps.ts`
- Create: `services/ops-web/src/lib/bds/caps.spec.ts`
- Create: `services/ops-web/src/lib/bds/nav.ts`
- Create: `services/ops-web/src/lib/bds/nav.spec.ts`
- Modify: `services/ops-web/src/lib/rbac-routes.ts`

**`buildBdsNavSections(user, mode)`** trả `NavSection[]` (cùng shape OpsNav: `{ label, links, defaultOpen? }`).

CĐT / hybrid (`developer` | `hybrid`):

| Hiện khi | href | label |
|----------|------|-------|
| `bds_tenant.view` \| any `bds_*` | `/crm/bds` | Tổng quan |
| `crm_re_projects.view` \| `bds_inventory.view` | `/crm/re-projects` | Dự án |
| `bds_buyers.view` | `/crm/bds/leads` | Lead khách mua |
| `bds_holds.view` | `/crm/bds/holds` | Hold |
| `bds_transactions.view` | `/crm/bds/transactions` | Giao dịch |
| `bds_agencies.view` | `/crm/bds/agencies` | Mạng |
| `bds_agency_tiers.view` | `/crm/bds/tiers` | Hạng |
| `bds_agency_tiers.view` | `/crm/bds/leaderboard` | Bảng xếp hạng |
| `bds_collections.view` | `/crm/bds/collections` | Công nợ |
| `bds_commission.view` | `/crm/bds/commissions` | Hoa hồng |

Nhóm: một section `label: 'BĐS'` với mọi link trên (P8 không nest sidebar 3 cấp — OpsNav hiện flat links trong section). Hybrid: thêm link `{ href: '/crm/bds/basket', label: 'Sàn nội bộ' }` nếu `bds_baskets.view`.

Sàn (`broker`):

| Cap | href | label |
|-----|------|-------|
| `bds_baskets.view` | `/crm/bds/basket` | Giỏ hàng |
| `bds_buyers.view` | `/crm/bds/leads` | Lead |
| `bds_holds.view` | `/crm/bds/holds` | Hold |
| `bds_commission.view` | `/crm/bds/commissions` | Hoa hồng |

`isBdsUiFeEnabled() === false` **hoặc** `!hasAnyBdsCap(user)` → `[]`.

`rbac-routes.ts` — thêm **trước** prefix `/crm`:

```ts
{
  prefix: '/crm/bds',
  anyOf: [
    { section: 'bds_tenant', action: 'view' },
    { section: 'bds_buyers', action: 'view' },
    { section: 'bds_holds', action: 'view' },
    { section: 'bds_inventory', action: 'view' },
    { section: 'bds_agencies', action: 'view' },
    { section: 'bds_commission', action: 'view' },
    { section: 'bds_baskets', action: 'view' },
    { section: 'bds_transactions', action: 'view' },
    { section: 'bds_collections', action: 'view' },
  ],
},
```

- [ ] **Step 1: Nav spec (RED)**

```ts
it('UI off → no BĐS section', () => {
  process.env.NEXT_PUBLIC_PTT_BDS_UI = '0';
  const user = { caps: [{ section: 'bds_tenant', action: 'view' }] } as never;
  expect(buildBdsNavSections(user, 'developer')).toEqual([]);
});

it('CĐT shows hub; hides Deal Room href', () => {
  process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
  const user = {
    caps: [
      { section: 'bds_tenant', action: 'view' },
      { section: 'bds_buyers', action: 'view' },
    ],
  } as never;
  const links = buildBdsNavSections(user, 'developer')[0]?.links ?? [];
  expect(links.some((l) => l.href === '/crm/bds')).toBe(true);
  expect(links.some((l) => l.href.includes('deal-room'))).toBe(false);
});

it('broker nav has basket, no hub', () => {
  process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
  const user = { caps: [{ section: 'bds_baskets', action: 'view' }] } as never;
  const links = buildBdsNavSections(user, 'broker')[0]?.links ?? [];
  expect(links.some((l) => l.href === '/crm/bds/basket')).toBe(true);
  expect(links.some((l) => l.href === '/crm/bds')).toBe(false);
});

it('PTT user without bds_* → empty', () => {
  process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
  const user = { caps: [{ section: 'crm_leads', action: 'view' }] } as never;
  expect(buildBdsNavSections(user, 'developer')).toEqual([]);
});
```

- [ ] **Step 2: Implement + vitest** — PASS

---

### Task 5: Ẩn Deal Room (UC-003) + BDS-09 list HH

**Files:**
- Create: `services/ops-web/src/lib/bds/deal-room-hide.ts`
- Create: `services/ops-web/src/lib/bds/deal-room-hide.spec.ts`
- Modify: `services/ops-web/src/app/crm/leads/[id]/deal-room/page.tsx`
- Modify: `services/ops-web/src/app/crm/leads/meeting-prep/SalesCockpitDealReadyTab.tsx`

```ts
export function shouldHideDealRoom(input: {
  leadFlowKind?: string | null;
  user: StoredStaffUser | null;
}): boolean {
  if (String(input.leadFlowKind ?? '') === 're_buyer') return true;
  if (hasAnyBdsCap(input.user) && !hasCap(input.user, 'crm_b2b_projects', 'view')) {
    return true;
  }
  return false;
}

export function hideCommissionSchemePct(user: StoredStaffUser | null): boolean {
  const fns = inputJobFunctions(user); // job_functions codes
  return fns.includes('ctv');
}
```

`shouldHideDealRoom`: `re_buyer` **luôn** ẩn. User có `bds_*` mà không `crm_b2b_projects.view` → ẩn (spec §11). User PTT agency giữ Deal Room.

Deal Room page: fetch lead `lead_flow_kind` (API lead detail sẵn); nếu hide → `<main>Không tìm thấy</main>` status visual 404, **không** render `DealRoomPage`.

SalesCockpit: không render Link `/deal-room` khi hide.

- [ ] **Step 1: Spec**

```ts
it('UC-003 re_buyer hides deal room', () => {
  expect(shouldHideDealRoom({ leadFlowKind: 're_buyer', user: { caps: [] } as never })).toBe(true);
});

it('PTT b2b user keeps deal room on spa lead', () => {
  const user = { caps: [{ section: 'crm_b2b_projects', action: 'view' }] } as never;
  expect(shouldHideDealRoom({ leadFlowKind: 'b2b_prospect', user })).toBe(false);
});
```

- [ ] **Step 2: Wire pages + run vitest** — PASS

---

### Task 6: OpsNav + pages mỏng + hub UX

**Files:**
- Modify: `services/ops-web/src/components/OpsNav.tsx`
- Modify: `services/ops-web/src/components/layout/nav-icons.tsx` (`PAGE_TITLES` + icon map `/crm/bds`)
- Create: `services/ops-web/src/app/crm/bds/page.tsx` (+ các page list §1)
- Modify: existing `/crm/re-projects` list — banner BDS-19 nếu `me.mode==='broker'`

**OpsNav:** sau khi có `user`, nếu `isBdsUiFeEnabled()`:

1. `mode` từ `sessionStorage` key `bds-tenant-mode` **hoặc** fetch `GET /api/v1/bds/tenants/me` (header `x-bds-tenant` từ env/local `bds-tenant-id` — cùng convention API hiện tại). Fail/404 → coi như không có pack (không section).
2. `sections.unshift(...buildBdsNavSections(user, mode))` (BĐS trên cùng khi có).
3. Top bar: badge text `CĐT` | `Sàn` | `Hybrid`. Badge số `holds_expiring_2h` nếu >0 (fetch hub khi developer/hybrid; broker bỏ qua).

**Ẩn nav cũ khi user chỉ `bds_*`:** nếu `hasAnyBdsCap(user)` && `!hasCap(crm_leads.view)` && `!hasCap(crm_b2b_projects.view)` thì **không** push Deal Room / `/crm/proposals` / `/crm/tickets` (các block hiện tại đã `hasCap` — không cần xóa block PTT).

**`/crm/bds` page:**

```tsx
if (!isBdsUiFeEnabled()) return <main><p className="muted">Không tìm thấy</p></main>;
if (mode === 'broker') { redirect('/crm/bds/basket'); }
const hub = await fetchHub();
// 4 hàng: KPI · inbox (link href) · table tower/agency · lối tắt Hold / Công nợ
```

**List pages:** table 1 cột chính + empty copy UX §3.6. Gọi API P5/P6/P7 đã có (`/agencies`, `/leads`, `/holds`, `/commissions`). Collections: nếu 404 flag → copy «Công nợ chưa bật».

**Commissions:** nếu `hideCommissionSchemePct(user)` → không render cột `%` scheme.

**Basket:** empty «CĐT chưa cấp căn. Liên hệ AM.»

- [ ] **Step 1: Hub page redirect broker** — unit test helper `hubHomeHref(mode)` → `/crm/bds` vs `/crm/bds/basket`

```ts
export function hubHomeHref(mode: 'developer' | 'broker' | 'hybrid'): string {
  return mode === 'broker' ? '/crm/bds/basket' : '/crm/bds';
}
```

- [ ] **Step 2: Implement pages + OpsNav**

- [ ] **Step 3: Playwright** `services/ops-web/e2e/bds/bds-nav.spec.ts`

```ts
test('PACK/UI off hides BĐS nav', async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_PTT_BDS_UI === '1', 'staging UI on');
  await page.goto('/crm/leads');
  await expect(page.getByRole('link', { name: 'Tổng quan' })).toHaveCount(0);
});
```

Staging (UI=1): login stub CĐT thấy «Tổng quan»; stub sàn không thấy «Tổng quan», thấy «Giỏ hàng». File skip mặc định local.

- [ ] **Step 4: Full API suite không regress**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds --runInBand`  
Expected: all pass (baseline + ~12 P8)

- [ ] **Step 5: FE unit**

Run: `cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds src/lib/rbac-routes.ts`  
(nếu `rbac-routes` chưa có spec riêng: `src/lib/auth.spec.ts` thêm case `/crm/bds`)

- [ ] **Step 6: Build API**

Run: `cd services/ptt-crm-api && npm run build`  
Expected: exit 0

- [ ] **Step 7: Roadmap** — link plan P8; flag §4 thêm `PTT_BDS_UI` + `NEXT_PUBLIC_PTT_BDS_UI`

---

## 4. Definition of Done

- [ ] UC-001: `GET /hub` developer → KPI + inbox ≤8; broker → 404
- [ ] UC-001 E1: FE `/crm/bds` broker → `/crm/bds/basket`
- [ ] UC-001 E2: `NEXT_PUBLIC_PTT_BDS_UI=0` → 0 link BĐS
- [ ] UC-002 v1: badge số hold TTL 2h trên top bar (CĐT); sàn không gọi hub
- [ ] UC-003: `re_buyer` Deal Room page không mount `DealRoomPage`; API vẫn 404
- [ ] BDS-19: broker `/crm/re-projects` copy «Dùng giỏ hàng»
- [ ] User không `bds_*` → sidebar PTT nguyên (có Deal Room nếu cap B2B)
- [ ] CTV commissions: không cột `%` scheme
- [ ] Nav P8 **không** có Ra quân / Sau bán / Chat / Việc
- [ ] `PTT_BDS_UI=0` → `/api/v1/bds/hub` 404
- [ ] Prod không bật UI flag

---

## 5. Rollback

`PTT_BDS_PACK=0` và/hoặc `PTT_BDS_UI=0` + `NEXT_PUBLIC_PTT_BDS_UI=0`. Rebuild ops-web. Không DROP bảng.

---

## 6. Sau P8 xanh

**P8b (optional):** modal cổng HĐMB, drawer căn, TX full page.  
**P9** after-sales + nav «Sau bán».  
**P10** launches + nav «Ra quân».  
**P11/P12** Chat / Việc + chuông ticket/mention.  
E2E Playwright BDS-02/04/… trên staging khi PACK+UI=1.

---

*P8 thắng: CĐT thấy hub và nav tiếng Việt; sàn thấy giỏ; khách mua không Deal Room; PTT agency không bị mất UI cũ.*
