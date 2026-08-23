# W6 — Ẩn B2B nav + hub CSKH/thu + home-summary `re_buyer`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `tgd` / `gdkd` trên tenant CĐT thấy nav sạch (không «Kinh doanh» B2B), `/crm/sales` 403; hub `/crm/bds` thêm 2 ô **CSKH breach 15p** và **phiếu thu hôm nay**; home `/` thêm block `re_buyer` tách số SPA.

**Architecture:** Reuse-first (hướng 1). Một `OpsNav` — lọc link B2B bằng helper thuần khi `tenant.mode` ∈ `{developer,hybrid}` + flag FE. Một hub (`HubKpi` + `bds-hub.repository` + `/crm/bds/page.tsx`) — thêm 2 field vào **cùng DTO**, default 0. Một `buildHomeSummary` — thêm block `re_buyer` optional, **không** cộng vào `sla.breach_count` SPA. Không nav tree mới, không `/crm/bds/finance`, không `BdsFinanceHubController`.

**Tech Stack:** NestJS + Jest (`ptt-crm-api`); Next.js + Vitest (`ops-web`).

**Spec:** [2026-08-23-bds-role-feature-execution.md](../specs/2026-08-23-bds-role-feature-execution.md) TGD-03, KD-06, §6–7 W6  
**Unification:** [2026-08-23-bds-crm-os-unification-design.md](../specs/2026-08-23-bds-crm-os-unification-design.md) U3, U8, U-04, U-11  
**OS plan:** [2026-08-23-bds-os-coding.md](./2026-08-23-bds-os-coding.md) Task 16–17  
**W5 (xong):** [2026-08-23-bds-w5-cskh-360.md](./2026-08-23-bds-w5-cskh-360.md)

## Global Constraints

- Không thay Q1–Q48. Không `app/crm/bds-v2`. Không `Bds2Module`.
- **Cấm** Kafka, **cấm** `bds_spine_events`, **cấm** `PTT_BDS_OS` / `PTT_BDS_CSKH_BOARD` / `PTT_BDS_FINANCE_HUB`.
- Flag mới **chỉ** `PTT_BDS_NAV_HIDE_B2B` + `NEXT_PUBLIC_PTT_BDS_NAV_HIDE_B2B` (default `0`). Gate hub/home `re_buyer` bằng `PTT_BDS_PACK` + `PTT_BDS_BUYER` + `PTT_BDS_UI` **đã có**.
- Ẩn B2B khi flag ON **và** `mode` là `developer` hoặc `hybrid`. `broker` giữ nav B2B.
- `/crm/cskh-board` **không** `flow` = board SPA Meta — **giữ** (W5). Không ẩn «Bảng CSKH SLA» nếu user có `crm_leads.view`.
- Không finance hub / CAPI HTTP (W7). Không offboard (W8). Không chip launch «Lead đang xem nhà».
- Hub 4 ô cũ **giữ**. 2 ô mới click → URL **đã có** (board `flow=re_buyer`, `/crm/bds/collections`).
- Flag staging hiện có **không tắt:** `PTT_BDS_PACK` / `PTT_BDS_BUYER` / `PTT_BDS_UI` / `PTT_STAFF_TICKETS`. `NAV_HIDE_B2B` default 0 — bật trên VPS chỉ khi UAT CĐT.
- Test Nest: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand`
- Test FE: `cd services/ops-web && ./node_modules/.bin/vitest run <file>`
- Không commit trừ khi user yêu cầu.

### Gap hôm nay (khóa — đúng code)

| Chỗ | Thực tế |
|-----|---------|
| `OpsNav` `buildSections` | Luôn push `/crm/sales`, `/crm/b2b/*`, `/crm/gdkd-enterprise` theo cap — **không** đọc `tenant.mode`. |
| `/crm/sales` | Page B2B đầy đủ; không 403 CĐT. |
| `HubKpi` | 4 số: `sell_through_pct`, `gmv_contracted_month_vnd`, `overdue_gt_30d`, `holds_expiring_2h`. |
| `/crm/bds/page.tsx` | 4 ô, không click CSKH/thu. |
| `GET /api/crm/cskh-board/home-summary` | Chỉ SPA (`spa_meta_only: true`). Không block `re_buyer`. |
| `HomeCskhWidgetRow` | 3 ô Meta/SLA/review — không ô khách mua. |
| Flag | Không `PTT_BDS_NAV_HIDE_B2B` / `NEXT_PUBLIC_PTT_BDS_NAV_HIDE_B2B`. |

### Cap / flag W6

| Bề mặt | Gate |
|--------|------|
| Ẩn nav B2B + 403 `/crm/sales` | `NEXT_PUBLIC_PTT_BDS_NAV_HIDE_B2B=1` **và** mode `developer`/`hybrid` |
| Hub 2 ô mới | `GET /hub` đã sau `BdsUiGuard` (PACK+UI) + `bds_tenant.view` |
| `cskh_breach_15m` | PACK+BUYER+UI; không thì `0` |
| `receipts_today_count` | PACK+COLLECTION; không thì `0` |
| Home block `re_buyer` | PACK+BUYER+UI; thiếu → **omit** field (SPA giữ nguyên) |
| Board SPA `/crm/cskh-board` | `crm_leads.view` — **không** đổi W5 |

### Ngoài W6 (cấm trong PR này)

- `PTT_BDS_OS`, `PTT_BDS_CSKH_BOARD`, `PTT_BDS_FINANCE_HUB`, `GET /api/v1/bds/finance/*`.
- CAPI `net_price_vnd` HTTP (W7). `offboardUser` hold release (W8).
- Rewrite `OpsNav` / `buildBdsNavSections` thành tree mới.
- Ẩn `/crm/cskh-board` (không `flow`) hoặc `/crm/leads` list SPA.
- Trang `/crm/bds/finance`. Chip launch visit. Kafka / `bds_spine_events`.

---

## File map

```
services/ptt-crm-api/src/bds/bds.flags.ts                         NÂNG — isBdsNavHideB2bEnabled
services/ptt-crm-api/src/bds/bds.flags.spec.ts                    NÂNG
services/ptt-crm-api/src/bds/reports/bds-hub.types.ts              NÂNG — 2 field HubKpi
services/ptt-crm-api/src/bds/reports/bds-hub.util.ts               NÂNG — withW6HubKpi
services/ptt-crm-api/src/bds/reports/bds-hub.util.spec.ts          NÂNG
services/ptt-crm-api/src/bds/reports/bds-hub.repository.ts         NÂNG — 2 query
services/ptt-crm-api/src/bds/reports/bds-hub.service.spec.ts       NÂNG — mock 2 field
services/ptt-crm-api/src/cskh-board/home-summary.util.ts           NÂNG — re_buyer block
services/ptt-crm-api/src/cskh-board/home-summary.util.spec.ts      NÂNG
services/ptt-crm-api/src/cskh-board/cskh-board.service.ts          NÂNG — getHomeSummary load re_buyer

services/ops-web/src/lib/bds/flags.ts                             NÂNG — isBdsNavHideB2bFeEnabled
services/ops-web/src/lib/bds/flags.spec.ts                        NÂNG
services/ops-web/src/lib/bds/nav-hide.ts                          CREATE — shouldHideB2bNav
services/ops-web/src/lib/bds/nav-hide.spec.ts                     CREATE
services/ops-web/src/lib/bds/types.ts                             NÂNG — HubKpi 2 field
services/ops-web/src/components/OpsNav.tsx                        NÂNG — filter sections
services/ops-web/src/app/crm/sales/page.tsx                       NÂNG — 403 CĐT
services/ops-web/src/app/crm/gdkd-enterprise/page.tsx             NÂNG — 403 CĐT
services/ops-web/src/app/crm/bds/page.tsx                         NÂNG — 2 ô + Link
services/ops-web/src/lib/api.ts                                   NÂNG — CskhHomeSummary.re_buyer
services/ops-web/src/components/home/HomeCskhWidgetRow.tsx        NÂNG — ô khách mua
```

API **GIỮ** path: `GET /api/v1/bds/hub`, `GET /api/crm/cskh-board/home-summary`. Không route mới.

---

### Task 1: Flag + ẩn B2B + `/crm/sales` 403

**Files:**
- Modify: `services/ptt-crm-api/src/bds/bds.flags.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.flags.spec.ts`
- Modify: `services/ops-web/src/lib/bds/flags.ts`
- Modify: `services/ops-web/src/lib/bds/flags.spec.ts`
- Create: `services/ops-web/src/lib/bds/nav-hide.ts`
- Create: `services/ops-web/src/lib/bds/nav-hide.spec.ts`
- Modify: `services/ops-web/src/components/OpsNav.tsx`
- Modify: `services/ops-web/src/app/crm/sales/page.tsx`
- Modify: `services/ops-web/src/app/crm/gdkd-enterprise/page.tsx`

**Interfaces:**
- Consumes: `BdsTenantMode` từ `lib/bds/nav.ts`; `getBdsTenantMode()` / `fetchBdsTenantMe` đã có.
- Produces: `isBdsNavHideB2bEnabled()`, `isBdsNavHideB2bFeEnabled()`, `shouldHideB2bNav(mode, hideFlag)`, `isB2bNavHref(href)`, `filterB2bNavLinks(links, hide)`.

- [ ] **Step 1: Write the failing Nest flag test**

Thêm vào cuối `bds.flags.spec.ts` (cùng `afterEach` restore env như các case UI):

```ts
it('defaults NAV_HIDE_B2B off when unset', () => {
  delete process.env.PTT_BDS_NAV_HIDE_B2B;
  expect(isBdsNavHideB2bEnabled()).toBe(false);
});

it('NAV_HIDE_B2B on for 1', () => {
  process.env.PTT_BDS_NAV_HIDE_B2B = '1';
  expect(isBdsNavHideB2bEnabled()).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/bds.flags.spec.ts --runInBand`

Expected: FAIL — `isBdsNavHideB2bEnabled` is not exported.

- [ ] **Step 3: Add flag (reuse `envFlagOn`)**

Trong `bds.flags.ts`, sau `isBdsUiEnabled`:

```ts
export function isBdsNavHideB2bEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_NAV_HIDE_B2B);
}
```

- [ ] **Step 4: Re-run Nest flag spec**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/bds.flags.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Write the failing FE hide tests**

Tạo `services/ops-web/src/lib/bds/nav-hide.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { filterB2bNavLinks, isB2bNavHref, shouldHideB2bNav } from './nav-hide';

describe('shouldHideB2bNav', () => {
  it('developer + flag → hide', () => {
    expect(shouldHideB2bNav('developer', true)).toBe(true);
  });

  it('hybrid + flag → hide', () => {
    expect(shouldHideB2bNav('hybrid', true)).toBe(true);
  });

  it('broker + flag → keep', () => {
    expect(shouldHideB2bNav('broker', true)).toBe(false);
  });

  it('developer + flag off → keep', () => {
    expect(shouldHideB2bNav('developer', false)).toBe(false);
  });

  it('null mode → keep', () => {
    expect(shouldHideB2bNav(null, true)).toBe(false);
  });
});

describe('isB2bNavHref', () => {
  it('matches sales and nested services', () => {
    expect(isB2bNavHref('/crm/sales')).toBe(true);
    expect(isB2bNavHref('/crm/sales/services')).toBe(true);
  });

  it('matches b2b leads but not unrelated /crm/bds', () => {
    expect(isB2bNavHref('/crm/b2b/leads')).toBe(true);
    expect(isB2bNavHref('/crm/b2b-inbox')).toBe(true);
    expect(isB2bNavHref('/crm/gdkd-enterprise')).toBe(true);
    expect(isB2bNavHref('/crm/cskh-board')).toBe(false);
    expect(isB2bNavHref('/crm/cskh-board?flow=re_buyer')).toBe(false);
    expect(isB2bNavHref('/crm/bds')).toBe(false);
    expect(isB2bNavHref('/crm/leads')).toBe(false);
  });
});

describe('filterB2bNavLinks', () => {
  it('drops B2B hrefs when hide', () => {
    const out = filterB2bNavLinks(
      [
        { href: '/crm/sales', label: 'Kinh doanh' },
        { href: '/crm/cskh-board', label: 'Bảng CSKH SLA' },
      ],
      true,
    );
    expect(out.map((x) => x.href)).toEqual(['/crm/cskh-board']);
  });
});
```

Thêm vào `flags.spec.ts`:

```ts
import { isBdsNavHideB2bFeEnabled, isBdsUiFeEnabled } from './flags';

it('defaults NAV_HIDE_B2B off', () => {
  delete process.env.NEXT_PUBLIC_PTT_BDS_NAV_HIDE_B2B;
  expect(isBdsNavHideB2bFeEnabled()).toBe(false);
});
```

- [ ] **Step 6: Run FE tests to verify they fail**

Run: `cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds/nav-hide.spec.ts src/lib/bds/flags.spec.ts`

Expected: FAIL — modules/exports missing.

- [ ] **Step 7: Implement helpers**

`flags.ts` — thêm:

```ts
export function isBdsNavHideB2bFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_PTT_BDS_NAV_HIDE_B2B ?? '0').trim().toLowerCase(),
  );
}
```

Tạo `nav-hide.ts`:

```ts
import type { BdsTenantMode } from './nav';

export const B2B_NAV_PREFIXES = [
  '/crm/sales',
  '/crm/b2b',
  '/crm/b2b-inbox',
  '/crm/intake',
  '/crm/solution',
  '/crm/gdkd-enterprise',
  '/crm/b2b-projects',
  '/crm/b2b-speed',
  '/crm/b2b-gdkd',
] as const;

export function shouldHideB2bNav(
  mode: BdsTenantMode | null | undefined,
  hideFlag: boolean,
): boolean {
  if (!hideFlag) return false;
  return mode === 'developer' || mode === 'hybrid';
}

export function isB2bNavHref(href: string): boolean {
  const path = String(href ?? '').split('?')[0];
  return B2B_NAV_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function filterB2bNavLinks<T extends { href: string }>(links: T[], hide: boolean): T[] {
  if (!hide) return links;
  return links.filter((link) => !isB2bNavHref(link.href));
}

export function filterB2bNavSections<T extends { links: Array<{ href: string }> }>(
  sections: T[],
  hide: boolean,
): T[] {
  if (!hide) return sections;
  return sections
    .map((section) => ({ ...section, links: filterB2bNavLinks(section.links, true) }))
    .filter((section) => section.links.length > 0);
}
```

- [ ] **Step 8: Re-run FE hide + flag specs**

Run: `cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds/nav-hide.spec.ts src/lib/bds/flags.spec.ts`

Expected: PASS.

- [ ] **Step 9: Wire OpsNav**

Trong `OpsNav.tsx`, sau khi có `baseSections` + `bdsMode`:

```ts
import { isBdsNavHideB2bFeEnabled } from '@/lib/bds/flags';
import { filterB2bNavSections, shouldHideB2bNav } from '@/lib/bds/nav-hide';

const hideB2b = shouldHideB2bNav(bdsMode, isBdsNavHideB2bFeEnabled());
const sections = [...bdsSections, ...filterB2bNavSections(baseSections, hideB2b)];
```

**Cấm:** xóa `buildSections` hoặc viết `buildBdsNavSections` thứ hai. Section «CRM · CSKH vận hành» còn «Bảng CSKH SLA» sau filter.

- [ ] **Step 10: 403 `/crm/sales` và `/crm/gdkd-enterprise`**

Helper nhỏ trong `nav-hide.ts` (dùng chung page):

```ts
export function bdsB2bPageForbidden(
  mode: BdsTenantMode | null | undefined,
  hideFlag: boolean,
): boolean {
  return shouldHideB2bNav(mode, hideFlag);
}
```

Đầu `CrmSalesContent` (sau khi có token/user): đọc `getBdsTenantMode()`; nếu null thì `fetchBdsTenantMe`. Nếu `bdsB2bPageForbidden(mode, isBdsNavHideB2bFeEnabled())`:

```tsx
return (
  <StaffPageShell user={user} onLogout={logout} loading={false}>
    <p className="muted" data-testid="bds-b2b-forbidden">Không tìm thấy</p>
  </StaffPageShell>
);
```

Không gọi `fetchSalesSummary` khi forbidden. Làm tương tự `gdkd-enterprise/page.tsx` (sau auth).

Không redirect `/crm/sales` → `/crm/bds` — U-04 / §7 W6 = **403 / không tìm thấy**. Landing CĐT vẫn `/crm/bds` qua nav BĐS.

- [ ] **Step 11: Commit**

```bash
git add services/ptt-crm-api/src/bds/bds.flags.ts \
  services/ptt-crm-api/src/bds/bds.flags.spec.ts \
  services/ops-web/src/lib/bds/flags.ts \
  services/ops-web/src/lib/bds/flags.spec.ts \
  services/ops-web/src/lib/bds/nav-hide.ts \
  services/ops-web/src/lib/bds/nav-hide.spec.ts \
  services/ops-web/src/components/OpsNav.tsx \
  services/ops-web/src/app/crm/sales/page.tsx \
  services/ops-web/src/app/crm/gdkd-enterprise/page.tsx
git commit -m "$(cat <<'EOF'
feat(bds): hide B2B links on existing OpsNav for CĐT

EOF
)"
```

---

### Task 2: Hub +2 số (U8 / TGD-03)

**Files:**
- Modify: `services/ptt-crm-api/src/bds/reports/bds-hub.types.ts`
- Modify: `services/ptt-crm-api/src/bds/reports/bds-hub.util.ts`
- Modify: `services/ptt-crm-api/src/bds/reports/bds-hub.util.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/reports/bds-hub.repository.ts`
- Modify: `services/ptt-crm-api/src/bds/reports/bds-hub.service.spec.ts`
- Modify: `services/ops-web/src/lib/bds/types.ts`
- Modify: `services/ops-web/src/app/crm/bds/page.tsx`

**Interfaces:**
- Consumes: `buildReBuyerListFilter('postgres', 'l')` từ `leads-funnel/lead-flow-list-filter.util.ts`; `CSKH_FIRST_CALL_SLA_MINUTES` (15); `crm_lead_activities.activity_type = 'call'` (cùng SQL `firstCallAtByLeadIds`); `bds_receipts.paid_at`.
- Produces: `HubKpi.cskh_breach_15m: number`, `HubKpi.receipts_today_count: number`; `withW6HubKpi(kpi)`.

- [ ] **Step 1: Write the failing util test**

Thêm vào `bds-hub.util.spec.ts`:

```ts
import { clampInbox, sellThroughPct, withW6HubKpi } from './bds-hub.util';

it('withW6HubKpi defaults missing fields to 0', () => {
  const out = withW6HubKpi({
    sell_through_pct: 10,
    gmv_contracted_month_vnd: 2,
    overdue_gt_30d: 1,
    holds_expiring_2h: 3,
  });
  expect(out.cskh_breach_15m).toBe(0);
  expect(out.receipts_today_count).toBe(0);
  expect(out.sell_through_pct).toBe(10);
});

it('withW6HubKpi keeps provided W6 fields', () => {
  const out = withW6HubKpi({
    sell_through_pct: 10,
    gmv_contracted_month_vnd: 2,
    overdue_gt_30d: 1,
    holds_expiring_2h: 3,
    cskh_breach_15m: 4,
    receipts_today_count: 7,
  });
  expect(out.cskh_breach_15m).toBe(4);
  expect(out.receipts_today_count).toBe(7);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/reports/bds-hub.util.spec.ts --runInBand`

Expected: FAIL — `withW6HubKpi` not exported.

- [ ] **Step 3: Extend type + util**

`bds-hub.types.ts` `HubKpi`:

```ts
export type HubKpi = {
  sell_through_pct: number;
  gmv_contracted_month_vnd: number;
  overdue_gt_30d: number;
  holds_expiring_2h: number;
  cskh_breach_15m: number;
  receipts_today_count: number;
};
```

`bds-hub.util.ts`:

```ts
import type { HubKpi } from './bds-hub.types';

export function withW6HubKpi(
  kpi: Omit<HubKpi, 'cskh_breach_15m' | 'receipts_today_count'> &
    Partial<Pick<HubKpi, 'cskh_breach_15m' | 'receipts_today_count'>>,
): HubKpi {
  return {
    ...kpi,
    cskh_breach_15m: Number(kpi.cskh_breach_15m ?? 0),
    receipts_today_count: Number(kpi.receipts_today_count ?? 0),
  };
}
```

Cùng shape trên `services/ops-web/src/lib/bds/types.ts` `HubKpi`.

- [ ] **Step 4: Re-run util spec**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/reports/bds-hub.util.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Repository — 2 query fail-soft**

Trong `kpi()`, sau 4 số cũ:

```ts
import { isBdsBuyerEnabled, isBdsCollectionEnabled, isBdsPackEnabled, isBdsUiEnabled } from '../bds.flags';
import { buildReBuyerListFilter } from '../../leads-funnel/lead-flow-list-filter.util';
import { CSKH_FIRST_CALL_SLA_MINUTES } from '../../cskh-board/cskh-board-sla.util';
import { withW6HubKpi } from './bds-hub.util';

const cskh = isBdsPackEnabled() && isBdsBuyerEnabled() && isBdsUiEnabled()
  ? await this.cskhBreach15m(tenantId)
  : 0;
const receipts = isBdsCollectionEnabled() ? await this.receiptsToday(tenantId) : 0;
return withW6HubKpi({
  sell_through_pct: sell,
  gmv_contracted_month_vnd: gmv,
  overdue_gt_30d: overdue,
  holds_expiring_2h: holdsExpiring,
  cskh_breach_15m: cskh,
  receipts_today_count: receipts,
});
```

`cskhBreach15m` — **không** đọc cột `first_call_at` trên `crm_leads` (không có). Reuse activity `call`:

```ts
private async cskhBreach15m(tenantId: string): Promise<number> {
  try {
    const reBuyer = buildReBuyerListFilter('postgres', 'l');
    const res = await this.db.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt
       FROM crm_leads l
       WHERE l.tenant_id = $1::uuid
         AND (${reBuyer})
         AND l.received_at IS NOT NULL
         AND l.received_at < NOW() - ($2::int * interval '1 minute')
         AND NOT EXISTS (
           SELECT 1 FROM crm_lead_activities a
           WHERE a.lead_id = l.id AND a.activity_type = 'call'
         )
         AND lower(trim(COALESCE(l.status, ''))) NOT IN ('chot', 'lost', 'closed', 'won')`,
      [tenantId, CSKH_FIRST_CALL_SLA_MINUTES],
    );
    return Number(res.rows[0]?.cnt ?? 0);
  } catch {
    return 0;
  }
}

private async receiptsToday(tenantId: string): Promise<number> {
  try {
    const res = await this.db.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt
       FROM bds_receipts r
       JOIN bds_transactions t ON t.id = r.transaction_id
       WHERE t.tenant_id = $1::uuid
         AND r.paid_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')
         AND r.paid_at < date_trunc('day', NOW() AT TIME ZONE 'UTC') + interval '1 day'`,
      [tenantId],
    );
    return Number(res.rows[0]?.cnt ?? 0);
  } catch {
    return 0;
  }
}
```

Cập nhật mock `repo.kpi` trong `bds-hub.service.spec.ts` thêm `cskh_breach_15m: 0`, `receipts_today_count: 0` (hoặc để `withW6HubKpi` ở service — **ưu tiên repo trả đủ 6 field**).

- [ ] **Step 6: Run hub specs**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/reports --runInBand`

Expected: PASS.

- [ ] **Step 7: Hub page — 2 ô Link**

Trong `/crm/bds/page.tsx`, sau ô Hold 2h:

```tsx
<Link href="/crm/cskh-board?flow=re_buyer&sla_filter=breach&sla_tier=first_call_15m">
  <p className="muted">CSKH breach 15p</p>
  <strong>{hub.kpi.cskh_breach_15m ?? 0}</strong>
</Link>
<Link href="/crm/bds/collections">
  <p className="muted">Phiếu thu hôm nay</p>
  <strong>{hub.kpi.receipts_today_count ?? 0}</strong>
</Link>
```

`?? 0` để bundle cũ không nổ. **Cấm** route `/crm/bds/finance`.

- [ ] **Step 8: Commit**

```bash
git add services/ptt-crm-api/src/bds/reports \
  services/ops-web/src/lib/bds/types.ts \
  services/ops-web/src/app/crm/bds/page.tsx
git commit -m "$(cat <<'EOF'
feat(bds): extend existing hub KPI with CSKH and receipt counts

EOF
)"
```

---

### Task 3: Home-summary block `re_buyer` (U-11)

**Files:**
- Modify: `services/ptt-crm-api/src/cskh-board/home-summary.util.ts`
- Modify: `services/ptt-crm-api/src/cskh-board/home-summary.util.spec.ts`
- Modify: `services/ptt-crm-api/src/cskh-board/cskh-board.service.ts`
- Modify: `services/ops-web/src/lib/api.ts` (`CskhHomeSummary`)
- Modify: `services/ops-web/src/components/home/HomeCskhWidgetRow.tsx`

**Interfaces:**
- Consumes: `getHomeSummary` + `listLeadCandidates` / enrich SLA **đã có** trong `CskhBoardService`; `isBdsPackEnabled` + `isBdsBuyerEnabled` + `isBdsUiEnabled`.
- Produces: `HomeSummaryResponse.re_buyer?: { leads_new_today: number; breach_15m: number; drill_href: string }`.

- [ ] **Step 1: Write the failing util test**

Thêm vào `home-summary.util.spec.ts`:

```ts
it('omits re_buyer when not provided — SPA counts unchanged', () => {
  const out = buildHomeSummary({
    boardRows: [
      {
        id: 1,
        sla_tiers: [{ tier: 'first_call_15m', sla_state: 'breach' }],
      },
    ] as unknown as CskhBoardRow[],
    tierSummaries,
    leadsNewToday: 5,
    reviewMetrics: { queue_count: 0, max_hours: null },
  });
  expect(out.re_buyer).toBeUndefined();
  expect(out.sla.breach_count).toBe(1);
  expect(out.leads_new_today).toBe(5);
});

it('attaches re_buyer without mixing into spa sla', () => {
  const out = buildHomeSummary({
    boardRows: [],
    tierSummaries,
    leadsNewToday: 2,
    reviewMetrics: { queue_count: 0, max_hours: null },
    reBuyer: { leads_new_today: 3, breach_15m: 4 },
  });
  expect(out.leads_new_today).toBe(2);
  expect(out.sla.breach_count).toBe(0);
  expect(out.re_buyer).toEqual({
    leads_new_today: 3,
    breach_15m: 4,
    drill_href: '/crm/cskh-board?flow=re_buyer&sla_filter=breach&sla_tier=first_call_15m',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/cskh-board/home-summary.util.spec.ts --runInBand`

Expected: FAIL — `re_buyer` / `reBuyer` unknown.

- [ ] **Step 3: Extend util**

```ts
export interface HomeSummaryReBuyer {
  leads_new_today: number;
  breach_15m: number;
  drill_href: string;
}

export const RE_BUYER_HOME_DRILL =
  '/crm/cskh-board?flow=re_buyer&sla_filter=breach&sla_tier=first_call_15m';

export interface HomeSummaryResponse {
  ok: true;
  generated_at: string;
  leads_new_today: number;
  sla: { /* unchanged */ };
  review_queue: { /* unchanged */ };
  ai?: HomeSummaryAiSlice;
  re_buyer?: HomeSummaryReBuyer;
}

export function buildHomeSummary(input: {
  boardRows: CskhBoardRow[];
  tierSummaries: Record<CskhSlaTier, CskhSlaTierSummary>;
  leadsNewToday: number;
  reviewMetrics: Pick<ReviewQueueMetrics, 'queue_count' | 'max_hours'>;
  ai?: HomeSummaryAiSlice | null;
  reBuyer?: { leads_new_today: number; breach_15m: number } | null;
  now?: Date;
}): HomeSummaryResponse {
  // ...existing return...
  return {
    /* existing fields */
    ...(input.reBuyer
      ? {
          re_buyer: {
            leads_new_today: input.reBuyer.leads_new_today,
            breach_15m: input.reBuyer.breach_15m,
            drill_href: RE_BUYER_HOME_DRILL,
          },
        }
      : {}),
  };
}
```

`sla.drill_href` SPA **giữ** `/crm/cskh-board?sla_filter=breach` (không `flow`).

- [ ] **Step 4: Re-run util spec**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/cskh-board/home-summary.util.spec.ts --runInBand`

Expected: PASS (kể cả 3 test cũ).

- [ ] **Step 5: `getHomeSummary` load `re_buyer` trong cùng service**

Trong `CskhBoardService.getHomeSummary`, **sau** `loadAllEnrichedRows()` (SPA). Không inject `BdsModule` thêm (đã `forwardRef`).

```ts
import { isBdsBuyerEnabled, isBdsPackEnabled, isBdsUiEnabled } from '../bds/bds.flags';

let reBuyer: { leads_new_today: number; breach_15m: number } | undefined;
if (isBdsPackEnabled() && isBdsBuyerEnabled() && isBdsUiEnabled()) {
  const buyerRows = await this.loadAllEnrichedRows({
    spa_meta_only: false,
    flow: 're_buyer',
  });
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  reBuyer = {
    leads_new_today: buyerRows.filter(
      (row) => row.received_at && new Date(row.received_at) >= start,
    ).length,
    breach_15m: buyerRows.filter((row) =>
      row.sla_tiers.some((t) => t.tier === 'first_call_15m' && t.sla_state === 'breach'),
    ).length,
  };
}
```

Tách `loadAllEnrichedRows(opts?: { spa_meta_only?: boolean; flow?: 're_buyer' })` — mặc định `{ spa_meta_only: true }` để `getShiftHandoff` / `getSlaPredictions` **không đổi**.

`listLeadCandidates` đã nhận `spa_meta_only` + filter `re_buyer` (W5). Truyền `flow: 're_buyer'` giống `cskh-board.service` list.

Guard `home-summary` **giữ** `StaffLeadsViewGuard` (`crm_leads.view`). `cskh_lead` không có cap này → home SPA 403 như cũ; nhà họ là board `flow=re_buyer` (W5).

- [ ] **Step 6: FE type + widget**

`CskhHomeSummary` thêm:

```ts
re_buyer?: {
  leads_new_today: number;
  breach_15m: number;
  drill_href: string;
};
```

`HomeCskhWidgetRow` — **sau** ô SLA SPA, chỉ khi `summary.re_buyer`:

```tsx
{summary.re_buyer ? (
  <Link
    href={summary.re_buyer.drill_href}
    className={`home-cskh-widget summary-card ${toneClass(summary.re_buyer.breach_15m)}`}
    data-testid="home-cskh-re-buyer"
  >
    <span className="muted">Khách mua · breach 15p</span>
    <strong className="home-cskh-widget__value">{summary.re_buyer.breach_15m}</strong>
    <span className="home-cskh-widget__hint muted">
      Mới hôm nay {summary.re_buyer.leads_new_today}
    </span>
  </Link>
) : null}
```

Không đổi copy «Lead Meta mới hôm nay». Không trộn số.

- [ ] **Step 7: Run home-summary + board service specs**

Run:

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/cskh-board/home-summary.util.spec.ts \
  src/cskh-board/cskh-board.service.spec.ts \
  --runInBand
```

Expected: PASS. Nếu `cskh-board.service.spec.ts` mock `loadAllEnrichedRows` / `getHomeSummary` — cập nhật mock flag off → không `re_buyer`.

- [ ] **Step 8: Commit**

```bash
git add services/ptt-crm-api/src/cskh-board/home-summary.util.ts \
  services/ptt-crm-api/src/cskh-board/home-summary.util.spec.ts \
  services/ptt-crm-api/src/cskh-board/cskh-board.service.ts \
  services/ops-web/src/lib/api.ts \
  services/ops-web/src/components/home/HomeCskhWidgetRow.tsx
git commit -m "$(cat <<'EOF'
feat(bds): add re_buyer block to existing CSKH home-summary

EOF
)"
```

---

### Task 4: Verify U-04 / U8 / U-11 + không W7+

**Files:** không file mới trừ sửa nếu build fail.

- [ ] **Step 1: Nest W6 subset**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/bds/bds.flags.spec.ts \
  src/bds/reports \
  src/cskh-board/home-summary.util.spec.ts \
  src/cskh-board/cskh-board-flow.util.spec.ts \
  --runInBand
```

Expected: all PASS.

- [ ] **Step 2: FE W6 subset**

```bash
cd services/ops-web && ./node_modules/.bin/vitest run \
  src/lib/bds/flags.spec.ts \
  src/lib/bds/nav-hide.spec.ts \
  src/lib/bds/nav.spec.ts
```

Expected: all PASS. `nav.spec.ts` **không** đổi href board W5.

- [ ] **Step 3: Production builds**

```bash
cd services/ptt-crm-api && npm run build
cd services/ops-web && NEXT_PUBLIC_PTT_BDS_UI=1 npm run build
```

Expected: both compile. Nếu `HubKpi` thiếu field ở chỗ mock — thêm `cskh_breach_15m: 0`, `receipts_today_count: 0`.

- [ ] **Step 4: Leak check W7+**

```bash
rg -n "PTT_BDS_OS|PTT_BDS_CSKH_BOARD|PTT_BDS_FINANCE_HUB|finance/hub|bds_spine_events|offboardUser" \
  services/ptt-crm-api/src services/ops-web/src
```

Expected:

| Pattern | Được |
|---------|------|
| `PTT_BDS_NAV_HIDE_B2B` | Task 1 flags |
| `offboardUser` | **0** trong diff W6 (file HR cũ không đụng) |
| `finance/hub` | **0** |
| `PTT_BDS_OS` / `CSKH_BOARD` / `FINANCE_HUB` | **0** |
| `bds_spine_events` | **0** |

- [ ] **Step 5: Commit verify-only fixes nếu có**

```bash
git commit -m "$(cat <<'EOF'
fix(bds): keep W6 hub types build-safe

EOF
)"
```

Chỉ khi Step 3 bắt buộc sửa.

---

## Coverage vs spec §7 W6

| Tiêu chí | Task |
|----------|------|
| Tenant CĐT: `/crm/sales` 403 / không tìm thấy | 1 |
| Nav không «Kinh doanh» B2B khi flag + CĐT/hybrid | 1 |
| Board SPA `/crm/cskh-board` còn | 1 (không filter href này) |
| Hub CSKH breach 15p | 2 |
| Hub phiếu thu hôm nay | 2 |
| Click ô → board `re_buyer` / collections | 2 |
| Home-summary `re_buyer` tách SPA (U-11) | 3 |
| Không finance / CAPI / offboard | 4 leak |

## UAT staging (sau deploy Nest + ops-web)

Bật **một lần** trên VPS `.env` (không commit):

```
PTT_BDS_NAV_HIDE_B2B=1
```

Rebuild ops-web với `NEXT_PUBLIC_PTT_BDS_NAV_HIDE_B2B=1` (flag FE bake lúc build). Không DDL.

| Việc | Pass |
|------|------|
| Login `tgd` / `gdkd` tenant CĐT | Nav không «Kinh doanh»; có «BĐS · Tổng quan» |
| Mở `/crm/sales` | «Không tìm thấy» — không funnel B2B |
| `/crm/gdkd-enterprise` | «Không tìm thấy» |
| User PTT `crm_leads.view` + flag off **hoặc** mode broker | `/crm/sales` vẫn vào |
| Hub `/crm/bds` | 6 ô; click CSKH → `?flow=re_buyer&sla_filter=breach`; click thu → collections |
| Home `/` user `crm_leads.view` + PACK/UI/BUYER | Ô «Khách mua · breach 15p» **cạnh** ô SLA Meta; số không bằng nhau nếu mix lead |
| User chỉ SPA, BUYER=0 | Home **không** ô khách mua |

Deploy W6: **cả** `realosai-api` (Nest dist) **và** `realosai-ops-web` (standalone, bake `NEXT_PUBLIC_PTT_BDS_NAV_HIDE_B2B` nếu UAT CĐT). Không DDL mới.

## Escalate

| Gap | Hướng |
|-----|--------|
| `crm_leads.tenant_id` null trên staging | Query hub `cskhBreach15m` fail-soft → 0; escalate, **không** bỏ `tenant_id` |
| `loadAllEnrichedRows` signature đụng 3 caller | Default `spa_meta_only: true`; chỉ `getHomeSummary` truyền `re_buyer` |
| `HubKpi` breaking JSON client cũ | Field mới luôn số; FE `?? 0` |
| Hybrid vẫn cần `/crm/sales` | Spec 11.1 ẩn hybrid khi flag ON. Nếu UAT fail: `shouldHideB2bNav` chỉ `developer` — ghi PR, không bịa mode mới |

---

*Sau khi duyệt plan: cập nhật Task 16–17 trong [2026-08-23-bds-os-coding.md](./2026-08-23-bds-os-coding.md).*
