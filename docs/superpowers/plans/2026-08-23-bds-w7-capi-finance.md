# W7 — CAPI HTTP + 4 số CFO trên hub

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `truong_collection` / `tgd` đọc 4 số tài chính tháng trên **cùng** `/crm/bds` (GMV HĐMB · đã thu · overdue · HH phải trả) và xuất CSV HĐQT; `truong_mkt` có CAPI thật khi `PTT_BDS_CAPI=1` — Purchase = `net_price_vnd` lúc **cọc**, Lead/Schedule không Graph client mới.

**Architecture:** Reuse-first (hướng 1). Một `HubKpi` — thêm 2 field CFO vào DTO W6. Một `GET /api/v1/bds/hub/export` trên `BdsHubController` đã có. Một `BdsCapiHookService` — ghi `bds_capi_events` như cũ + `JobQueueRepository.enqueueCapiDispatch` (worker Python `capi_dispatch` đã gửi Graph). Purchase chuyển từ `contract()` sang `convertDeposit()` (default). Không `/crm/bds/finance`, không `BdsFinanceHubController`, không `bds-capi-http.client.ts`.

**Tech Stack:** NestJS + Jest (`ptt-crm-api`); Next.js + Vitest (`ops-web`); job `capi_dispatch` hiện có.

**Spec:** [2026-08-23-bds-role-feature-execution.md](../specs/2026-08-23-bds-role-feature-execution.md) TGD-06, MK-02/04/06, CL-06/07, CS-04, §6–7 W7  
**Unification:** [2026-08-23-bds-crm-os-unification-design.md](../specs/2026-08-23-bds-crm-os-unification-design.md) Q36–Q38, U4, U5, U-05, U-06  
**OS plan:** [2026-08-23-bds-os-coding.md](./2026-08-23-bds-os-coding.md) Task 18–19  
**W6 (xong):** [2026-08-23-bds-w6-nav-hub.md](./2026-08-23-bds-w6-nav-hub.md)

## Global Constraints

- Không thay Q1–Q48. Không `app/crm/bds-v2`. Không `Bds2Module`.
- **Cấm** Kafka, **cấm** `bds_spine_events`, **cấm** `PTT_BDS_OS` / `PTT_BDS_CSKH_BOARD` / `PTT_BDS_FINANCE_HUB`.
- **Cấm** `GET /api/v1/bds/finance/*` và trang `/crm/bds/finance`. UC-066 UAT trên `/crm/bds` section `#finance`.
- **Cấm** `bds-capi-http.client.ts` / fetch `graph.facebook.com` từ pack BĐS. HTTP = job `capi_dispatch` đã có.
- Flag mới **chỉ** `PTT_BDS_CAPI_PURCHASE_AT` (`deposit` | `contracted`, default `deposit`) và `PTT_BDS_CAPI_CLIENT_ID` (UUID Meta client để enqueue). Gate CAPI vẫn `PTT_BDS_CAPI` **đã có** (default `0`).
- Purchase value **luôn** `transactions.net_price_vnd` — không `list_price`, không `deposit_vnd`.
- CAPI=0: TX/visit/lead **vẫn OK**, không insert `bds_capi_events`, không enqueue (test hiện có giữ).
- CAPI=1 + thiếu `PTT_BDS_CAPI_CLIENT_ID` hoặc chưa map form/page: insert `status=skipped`, không enqueue.
- Webhook Meta ingest Lead: **giữ** `enqueue_capi_lead_dispatch` Python — **không** gọi `onLead` lần hai trên cùng lead form.
- Flag staging **không tắt:** `PTT_BDS_PACK` / `PTT_BDS_BUYER` / `PTT_BDS_UI` / `PTT_BDS_COLLECTION` / `PTT_BDS_COMMISSION` / `PTT_STAFF_TICKETS`. `PTT_BDS_CAPI` default 0 — bật VPS chỉ khi đã map ad + `PTT_JOBS_ENABLED`.
- Không payroll (`PTT_BDS_PAYROLL_MAP`). Không offboard (W8). Không DDL mới (`bds_capi_events` đủ cột; `capi_event_log` lo retry).
- Test Nest: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand`
- Test FE: `cd services/ops-web && ./node_modules/.bin/vitest run <file>`
- Không commit trừ khi user yêu cầu.

### Gap hôm nay (khóa — đúng code)

| Chỗ | Thực tế |
|-----|---------|
| `HubKpi` | 6 số W6. Thiếu **đã thu tháng** và **HH phải trả kỳ**. |
| `/crm/bds` | 6 ô; không section Tài chính; không export HĐQT. |
| `GET /collections/export` | CSV phiếu thu theo `project_id` — không pack 4 số tenant. |
| `BdsCapiHookService.onPurchase` | Chỉ `insertCapiEvent` `status=logged`. **Không HTTP**. |
| `BdsTxService.contract` | Gọi `capi.onPurchase` lúc **HĐMB** — sai mốc mặc định (cọc). |
| `BdsTxService.convertDeposit` | Không gọi CAPI. |
| Visit / create lead Nest | Không `onSchedule` / `onLead`. |
| Flag | Có `PTT_BDS_CAPI`. Không `PTT_BDS_CAPI_PURCHASE_AT` / `PTT_BDS_CAPI_CLIENT_ID`. |

### Cap / flag W7

| Bề mặt | Gate |
|--------|------|
| 4 số CFO trên hub | `GET /hub` đã sau `BdsUiGuard` (PACK+UI) + `bds_tenant.view` |
| `collected_month_vnd` | PACK+COLLECTION; không thì `0` |
| `hh_payable_month_vnd` | PACK+COMMISSION; không thì `0` |
| Export HĐQT CSV | cùng guard hub + `bds_tenant.view` |
| CAPI insert + enqueue | `PTT_BDS_CAPI=1` |
| CAPI HTTP thật | thêm `PTT_JOBS_ENABLED=1` + `PTT_CAPI_ENABLED` hoặc `PTT_CAPI_STUB` (worker) + `PTT_BDS_CAPI_CLIENT_ID` |
| Purchase mốc | `PTT_BDS_CAPI_PURCHASE_AT` default `deposit` |
| ROAS trên hub | **không bịa spend**. Không map → copy «Chưa gắn ad account» |

### Ngoài W7 (cấm trong PR này)

- `PTT_BDS_OS`, `PTT_BDS_CSKH_BOARD`, `PTT_BDS_FINANCE_HUB`, `GET /api/v1/bds/finance/*`, `app/crm/bds/finance`.
- Graph client thứ hai. `offboardUser` hold release (W8).
- Cột `bds_tenants.capi_purchase_at` / ALTER `bds_capi_events`.
- Payroll map. Chip launch «Lead đang xem nhà». Kafka / `bds_spine_events`.
- Đổi contract hold/TX/receipt.

### Ba hướng (đã chọn 1)

| # | Cách | Trade-off |
|---|------|-----------|
| **1 (chọn)** | CFO trên hub + CAPI enqueue job cũ | Ship nhanh; UC-066 URL là hub không `/finance` |
| 2 | `BdsFinanceHubController` + flag `FINANCE_HUB` | Trùng `GET /hub`; unification Q44 — **cấm** hướng 1 |
| 3 | Graph client pack riêng | Copy `graph.facebook.com` — OS plan **cấm** |

---

## File map

```
services/ptt-crm-api/src/bds/bds.flags.ts                         NÂNG — bdsCapiPurchaseAt, bdsCapiClientId
services/ptt-crm-api/src/bds/bds.flags.spec.ts                    NÂNG
services/ptt-crm-api/src/bds/reports/bds-hub.types.ts              NÂNG — 2 field HubKpi
services/ptt-crm-api/src/bds/reports/bds-hub.util.ts               NÂNG — withW7HubKpi, buildHdqtCsv
services/ptt-crm-api/src/bds/reports/bds-hub.util.spec.ts          NÂNG
services/ptt-crm-api/src/bds/reports/bds-hub.repository.ts         NÂNG — 2 query
services/ptt-crm-api/src/bds/reports/bds-hub.service.ts            NÂNG — exportHdqtCsv
services/ptt-crm-api/src/bds/reports/bds-hub.service.spec.ts       NÂNG
services/ptt-crm-api/src/bds/reports/bds-hub.controller.ts         NÂNG — GET hub/export
services/ptt-crm-api/src/bds/reports/bds-hub.controller.spec.ts    NÂNG
services/ptt-crm-api/src/bds/commission/bds-commission.types.ts    NÂNG — transactionId optional
services/ptt-crm-api/src/bds/commission/bds-capi.util.ts           CREATE — mốc + value + enqueue payload
services/ptt-crm-api/src/bds/commission/bds-capi.util.spec.ts      CREATE
services/ptt-crm-api/src/bds/commission/bds-capi-hook.service.ts   NÂNG — enqueue + onLead + onSchedule
services/ptt-crm-api/src/bds/commission/bds-capi-hook.service.spec.ts NÂNG
services/ptt-crm-api/src/bds/transactions/bds-tx.service.ts        NÂNG — Purchase lúc cọc
services/ptt-crm-api/src/bds/buyers/bds-buyer-lead.service.ts      NÂNG — onLead sau create Nest
services/ptt-crm-api/src/bds/buyers/bds-buyer-visit.service.ts     NÂNG — onSchedule sau visit
services/ptt-crm-api/src/bds/bds.module.ts                         NÂNG — inject JobQueue nếu chưa

services/ops-web/src/lib/bds/types.ts                             NÂNG — 2 field HubKpi
services/ops-web/src/lib/bds/api.ts                               NÂNG — downloadHdqtExport
services/ops-web/src/app/crm/bds/page.tsx                         NÂNG — section #finance + nút CSV
services/ops-web/src/app/crm/bds/collections/page.tsx              NÂNG — dải 4 số + copy U-09
```

---

### Task 1: 4 số CFO trên hub + export HĐQT

**Files:**
- Modify: `services/ptt-crm-api/src/bds/reports/bds-hub.types.ts`
- Modify: `services/ptt-crm-api/src/bds/reports/bds-hub.util.ts`
- Modify: `services/ptt-crm-api/src/bds/reports/bds-hub.util.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/reports/bds-hub.repository.ts`
- Modify: `services/ptt-crm-api/src/bds/reports/bds-hub.service.ts`
- Modify: `services/ptt-crm-api/src/bds/reports/bds-hub.service.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/reports/bds-hub.controller.ts`
- Modify: `services/ptt-crm-api/src/bds/reports/bds-hub.controller.spec.ts`
- Test: files trên

**Interfaces:**
- Consumes: `HubKpi` W6 (6 field); `gmvContractedMonth` / `overdueGt30d` đã có; `bds_receipts.amount_vnd`; `bds_commission_ledger.status` ∈ `{accrued,paid,clawback}`
- Produces: `HubKpi.collected_month_vnd`, `HubKpi.hh_payable_month_vnd`; `withW7HubKpi()`; `buildHdqtCsv(kpi, period)`; `GET /api/v1/bds/hub/export?kind=hdqt`

- [ ] **Step 1: Write failing util tests**

Thêm vào `bds-hub.util.spec.ts`:

```ts
import { buildHdqtCsv, withW7HubKpi } from './bds-hub.util';

it('withW7HubKpi defaults CFO fields to 0', () => {
  const out = withW7HubKpi({
    sell_through_pct: 10,
    gmv_contracted_month_vnd: 2,
    overdue_gt_30d: 1,
    holds_expiring_2h: 3,
    cskh_breach_15m: 0,
    receipts_today_count: 0,
  });
  expect(out.collected_month_vnd).toBe(0);
  expect(out.hh_payable_month_vnd).toBe(0);
});

it('withW7HubKpi keeps provided CFO fields', () => {
  const out = withW7HubKpi({
    sell_through_pct: 10,
    gmv_contracted_month_vnd: 2,
    overdue_gt_30d: 1,
    holds_expiring_2h: 3,
    collected_month_vnd: 500,
    hh_payable_month_vnd: 80,
  });
  expect(out.collected_month_vnd).toBe(500);
  expect(out.hh_payable_month_vnd).toBe(80);
});

it('buildHdqtCsv has 4 CFO columns and GMV contracted', () => {
  const csv = buildHdqtCsv(
    {
      sell_through_pct: 10,
      gmv_contracted_month_vnd: 9_000,
      overdue_gt_30d: 2,
      holds_expiring_2h: 0,
      cskh_breach_15m: 0,
      receipts_today_count: 0,
      collected_month_vnd: 1_000,
      hh_payable_month_vnd: 300,
    },
    '2026-08-01',
  );
  expect(csv.split('\n')[0]).toBe(
    'period,gmv_contracted_month_vnd,collected_month_vnd,overdue_gt_30d,hh_payable_month_vnd',
  );
  expect(csv).toContain('2026-08-01,9000,1000,2,300');
  expect(csv).not.toContain('list_price');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/reports/bds-hub.util.spec.ts --runInBand`

Expected: FAIL — `withW7HubKpi` / `buildHdqtCsv` not exported.

- [ ] **Step 3: Types + util**

`bds-hub.types.ts` — thêm 2 field vào `HubKpi`:

```ts
  collected_month_vnd: number;
  hh_payable_month_vnd: number;
```

`bds-hub.util.ts` — thêm:

```ts
export function withW7HubKpi(
  kpi: Omit<HubKpi, 'collected_month_vnd' | 'hh_payable_month_vnd'> &
    Partial<Pick<HubKpi, 'collected_month_vnd' | 'hh_payable_month_vnd' | 'cskh_breach_15m' | 'receipts_today_count'>>,
): HubKpi {
  const w6 = withW6HubKpi(kpi);
  return {
    ...w6,
    collected_month_vnd: Number(kpi.collected_month_vnd ?? 0),
    hh_payable_month_vnd: Number(kpi.hh_payable_month_vnd ?? 0),
  };
}

export function buildHdqtCsv(kpi: HubKpi, period: string): string {
  const header =
    'period,gmv_contracted_month_vnd,collected_month_vnd,overdue_gt_30d,hh_payable_month_vnd';
  const line = [
    period,
    kpi.gmv_contracted_month_vnd,
    kpi.collected_month_vnd,
    kpi.overdue_gt_30d,
    kpi.hh_payable_month_vnd,
  ].join(',');
  return `${header}\n${line}\n`;
}
```

**Cấm:** đổi nghĩa `gmv_contracted_month_vnd` (vẫn SUM TX `contracted` tháng — TGD-01).

- [ ] **Step 4: Re-run util spec**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/reports/bds-hub.util.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Repository queries**

Trong `BdsHubRepository.kpi`, sau receipts W6:

```ts
const collected = isBdsCollectionEnabled() ? await this.collectedMonth(tenantId) : 0;
const hh = isBdsCommissionEnabled() ? await this.hhPayableMonth(tenantId) : 0;
return withW7HubKpi({
  sell_through_pct: sell,
  gmv_contracted_month_vnd: gmv,
  overdue_gt_30d: overdue,
  holds_expiring_2h: holdsExpiring,
  cskh_breach_15m: cskh,
  receipts_today_count: receipts,
  collected_month_vnd: collected,
  hh_payable_month_vnd: hh,
});
```

Import `isBdsCommissionEnabled`. Queries (cùng `date_trunc` UTC như GMV):

```ts
private async collectedMonth(tenantId: string): Promise<number> {
  try {
    const res = await this.db.query<{ sum: string | null }>(
      `SELECT COALESCE(SUM(r.amount_vnd), 0)::text AS sum
       FROM bds_receipts r
       JOIN bds_transactions t ON t.id = r.transaction_id
       WHERE t.tenant_id = $1::uuid
         AND r.paid_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
         AND r.paid_at < date_trunc('month', NOW() AT TIME ZONE 'UTC') + interval '1 month'`,
      [tenantId],
    );
    return Number(res.rows[0]?.sum ?? 0);
  } catch {
    return 0;
  }
}

private async hhPayableMonth(tenantId: string): Promise<number> {
  try {
    const res = await this.db.query<{ sum: string | null }>(
      `SELECT COALESCE(
         SUM(CASE WHEN status = 'accrued' THEN amount_vnd ELSE 0 END)
         - SUM(CASE WHEN status = 'paid' THEN amount_vnd ELSE 0 END)
         - SUM(CASE WHEN status = 'clawback' THEN amount_vnd ELSE 0 END)
       , 0)::text AS sum
       FROM bds_commission_ledger
       WHERE tenant_id = $1::uuid
         AND period_month >= date_trunc('month', NOW() AT TIME ZONE 'UTC')::date
         AND period_month < (date_trunc('month', NOW() AT TIME ZONE 'UTC') + interval '1 month')::date`,
      [tenantId],
    );
    return Number(res.rows[0]?.sum ?? 0);
  } catch {
    return 0;
  }
}
```

Công thức HH = unification §9.2 item 4.

- [ ] **Step 6: Service export + controller**

`BdsHubService`:

```ts
async exportHdqtCsv(tenantId: string): Promise<string> {
  const hub = await this.getHub(tenantId);
  return buildHdqtCsv(hub.kpi, periodMonthStart());
}
```

`BdsHubController` — thêm (cùng guard hiện có):

```ts
@Get('hub/export')
async exportHdqt(
  @Query('kind') kind: string,
  @Headers('x-bds-tenant') tenantId: string | undefined,
  @Res({ passthrough: true }) res: Response,
) {
  if (String(kind ?? '') !== 'hdqt') {
    throw new BadRequestException({ error: 'kind' });
  }
  const csv = await this.hubService.exportHdqtCsv(String(tenantId ?? ''));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bds-hdqt.csv"');
  return csv;
}
```

Import `BadRequestException`, `Res`, `Response` giống `BdsCollectionController`.

Controller spec: `kind` khác `hdqt` → 400; `kind=hdqt` gọi `exportHdqtCsv`.

Service spec mock thêm `collected_month_vnd: 0`, `hh_payable_month_vnd: 0` trên mọi `repo.kpi`.

Webhook (tuỳ chọn, cùng method export): nếu `process.env.PTT_BDS_FINANCE_WEBHOOK_URL` có URL `https://` — `fetch` JSON `{ period, kpi }` **sau** khi build CSV; lỗi webhook **không** fail HTTP export (try/catch + logger). Không tạo worker mới.

- [ ] **Step 7: Run Nest hub specs**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/reports --runInBand`

Expected: all PASS.

- [ ] **Step 8: Commit (chỉ khi user yêu cầu)**

```bash
git commit -m "$(cat <<'EOF'
feat(bds): add CFO totals and HDQT export on existing hub

EOF
)"
```

---

### Task 2: CAPI HTTP qua job cũ + Purchase lúc cọc

**Files:**
- Create: `services/ptt-crm-api/src/bds/commission/bds-capi.util.ts`
- Create: `services/ptt-crm-api/src/bds/commission/bds-capi.util.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.flags.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.flags.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/commission/bds-commission.types.ts`
- Modify: `services/ptt-crm-api/src/bds/commission/bds-commission.repository.ts`
- Modify: `services/ptt-crm-api/src/bds/commission/bds-capi-hook.service.ts`
- Modify: `services/ptt-crm-api/src/bds/commission/bds-capi-hook.service.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/transactions/bds-tx.service.ts`
- Modify: `services/ptt-crm-api/src/bds/buyers/bds-buyer-lead.service.ts`
- Modify: `services/ptt-crm-api/src/bds/buyers/bds-buyer-visit.service.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.module.ts` (JobQueue nếu hook cần)
- Test: util + hook + flags; không bắt buộc rewrite toàn bộ `bds-tx.service.spec` trừ mock `capi`

**Interfaces:**
- Consumes: `isBdsCapiEnabled()`; `JobQueueRepository.enqueueCapiDispatch`; `InsertCapiInput`; `TxRow.net_price_vnd`
- Produces: `bdsCapiPurchaseAt()`, `bdsCapiClientId()`, `shouldEmitCapiPurchase(stage, at)`, `capiPurchaseValueVnd(tx)`, `buildCapiDispatchPayload(...)`; `onLead` / `onSchedule` / `onPurchase`

- [ ] **Step 1: Write failing flag + util tests**

`bds.flags.spec.ts`:

```ts
it('defaults CAPI purchase at deposit', () => {
  delete process.env.PTT_BDS_CAPI_PURCHASE_AT;
  expect(bdsCapiPurchaseAt()).toBe('deposit');
});

it('reads contracted purchase at', () => {
  process.env.PTT_BDS_CAPI_PURCHASE_AT = 'contracted';
  expect(bdsCapiPurchaseAt()).toBe('contracted');
});

it('defaults CAPI client id empty', () => {
  delete process.env.PTT_BDS_CAPI_CLIENT_ID;
  expect(bdsCapiClientId()).toBe('');
});
```

`bds-capi.util.spec.ts`:

```ts
import {
  buildCapiDispatchPayload,
  capiPurchaseValueVnd,
  shouldEmitCapiPurchase,
  shouldEnqueueCapiHttp,
} from './bds-capi.util';

it('Purchase emits on deposit by default, not contracted', () => {
  expect(shouldEmitCapiPurchase('deposit', 'deposit')).toBe(true);
  expect(shouldEmitCapiPurchase('contracted', 'deposit')).toBe(false);
  expect(shouldEmitCapiPurchase('contracted', 'contracted')).toBe(true);
  expect(shouldEmitCapiPurchase('deposit', 'contracted')).toBe(false);
});

it('Purchase value is net_price_vnd not list', () => {
  expect(capiPurchaseValueVnd({ net_price_vnd: 99, list_price_vnd: 200 })).toBe(99);
  expect(capiPurchaseValueVnd({ net_price_vnd: 0, list_price_vnd: 200 })).toBe(0);
});

it('no HTTP when CAPI off or client missing', () => {
  expect(shouldEnqueueCapiHttp({ capiOn: false, clientId: 'c1' })).toBe(false);
  expect(shouldEnqueueCapiHttp({ capiOn: true, clientId: '' })).toBe(false);
  expect(shouldEnqueueCapiHttp({ capiOn: true, clientId: 'c1' })).toBe(true);
});

it('dispatch payload uses event dict worker already understands', () => {
  const payload = buildCapiDispatchPayload({
    clientId: '11111111-1111-1111-1111-111111111111',
    leadId: 7,
    eventName: 'Purchase',
    valueVnd: 99,
    eventId: 'bds:Purchase:tx1',
  });
  expect(payload).toEqual({
    client_id: '11111111-1111-1111-1111-111111111111',
    lead_id: 7,
    event: {
      event_name: 'Purchase',
      value: 99,
      currency: 'VND',
      event_id: 'bds:Purchase:tx1',
    },
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/bds.flags.spec.ts src/bds/commission/bds-capi.util.spec.ts --runInBand`

Expected: FAIL — exports missing.

- [ ] **Step 3: Implement flags + util**

`bds.flags.ts`:

```ts
export function bdsCapiPurchaseAt(): 'deposit' | 'contracted' {
  const raw = String(process.env.PTT_BDS_CAPI_PURCHASE_AT ?? 'deposit').trim().toLowerCase();
  return raw === 'contracted' ? 'contracted' : 'deposit';
}

export function bdsCapiClientId(): string {
  return String(process.env.PTT_BDS_CAPI_CLIENT_ID ?? '').trim();
}
```

`bds-capi.util.ts`:

```ts
export function shouldEmitCapiPurchase(
  stage: string,
  purchaseAt: 'deposit' | 'contracted',
): boolean {
  return stage === purchaseAt;
}

export function capiPurchaseValueVnd(tx: {
  net_price_vnd?: number;
  list_price_vnd?: number;
}): number {
  return Number(tx.net_price_vnd ?? 0);
}

export function shouldEnqueueCapiHttp(input: { capiOn: boolean; clientId: string }): boolean {
  return Boolean(input.capiOn && String(input.clientId ?? '').trim());
}

export function buildCapiDispatchPayload(input: {
  clientId: string;
  leadId?: number | null;
  eventName: 'Lead' | 'Schedule' | 'Purchase';
  valueVnd: number | null;
  eventId: string;
}): Record<string, unknown> {
  return {
    client_id: input.clientId,
    lead_id: input.leadId ?? undefined,
    event: {
      event_name: input.eventName,
      value: input.valueVnd,
      currency: 'VND',
      event_id: input.eventId,
    },
  };
}
```

Worker `process_capi_dispatch_payload` đã nhận `payload.event` + `client_id` → `dispatch_conversion_capi`. **Không** viết Graph URL trong Nest.

- [ ] **Step 4: Re-run flag + util**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/bds.flags.spec.ts src/bds/commission/bds-capi.util.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Write failing hook tests**

Mở rộng `bds-capi-hook.service.spec.ts` (giữ 2 test cũ):

```ts
it('CAPI=1 Purchase value is net_price_vnd', async () => {
  process.env.PTT_BDS_CAPI = '1';
  const repo = { insertCapiEvent: jest.fn().mockResolvedValue(undefined) };
  const jobs = { enqueueCapiDispatch: jest.fn() };
  const svc = new BdsCapiHookService(repo as never, jobs as never);
  await svc.onPurchase({
    id: 'tx1',
    lead_id: 7,
    net_price_vnd: 99,
    list_price_vnd: 200,
    tenant_id: 't1',
  } as never);
  expect(repo.insertCapiEvent).toHaveBeenCalledWith(
    expect.objectContaining({ eventName: 'Purchase', valueVnd: 99, transactionId: 'tx1' }),
  );
});

it('CAPI=1 without client inserts skipped and does not enqueue', async () => {
  process.env.PTT_BDS_CAPI = '1';
  delete process.env.PTT_BDS_CAPI_CLIENT_ID;
  const repo = { insertCapiEvent: jest.fn().mockResolvedValue(undefined) };
  const jobs = { enqueueCapiDispatch: jest.fn() };
  const svc = new BdsCapiHookService(repo as never, jobs as never);
  await svc.onPurchase({ id: 'tx1', lead_id: 7, net_price_vnd: 99, tenant_id: 't1' } as never);
  expect(repo.insertCapiEvent).toHaveBeenCalledWith(expect.objectContaining({ status: 'skipped' }));
  expect(jobs.enqueueCapiDispatch).not.toHaveBeenCalled();
});

it('CAPI=1 with client enqueues existing capi_dispatch job', async () => {
  process.env.PTT_BDS_CAPI = '1';
  process.env.PTT_BDS_CAPI_CLIENT_ID = '11111111-1111-1111-1111-111111111111';
  const repo = { insertCapiEvent: jest.fn().mockResolvedValue(undefined) };
  const jobs = { enqueueCapiDispatch: jest.fn().mockResolvedValue({ id: 'j1' }) };
  const svc = new BdsCapiHookService(repo as never, jobs as never);
  await svc.onPurchase({ id: 'tx1', lead_id: 7, net_price_vnd: 99, tenant_id: 't1' } as never);
  expect(jobs.enqueueCapiDispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      idempotencyKey: 'bds:capi:Purchase:tx1',
      clientId: '11111111-1111-1111-1111-111111111111',
    }),
  );
});
```

- [ ] **Step 6: Run hook spec to verify new cases fail**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/commission/bds-capi-hook.service.spec.ts --runInBand`

Expected: FAIL — constructor arity / skipped / enqueue.

- [ ] **Step 7: Implement hook**

`InsertCapiInput.transactionId` → `transactionId?: string | null` (Lead/Schedule không có TX). Repo INSERT giữ `$2` null.

`BdsCapiHookService`:

```ts
constructor(
  private readonly repo: BdsCommissionRepository,
  @Optional() private readonly jobs?: JobQueueRepository | null,
) {}

async onLead(input: { tenantId: string; leadId: number }): Promise<void> {
  await this.emit({
    tenantId: input.tenantId,
    leadId: input.leadId,
    eventName: 'Lead',
    valueVnd: null,
    eventId: `bds:Lead:${input.leadId}`,
  });
}

async onSchedule(input: { tenantId: string; leadId: number; visitId: string }): Promise<void> {
  await this.emit({
    tenantId: input.tenantId,
    leadId: input.leadId,
    eventName: 'Schedule',
    valueVnd: null,
    eventId: `bds:Schedule:${input.visitId}`,
  });
}

async onPurchase(tx: TxRow): Promise<void> {
  if (!isBdsCapiEnabled()) return;
  await this.emit({
    tenantId: String(tx.tenant_id ?? ''),
    leadId: tx.lead_id,
    transactionId: tx.id,
    eventName: 'Purchase',
    valueVnd: capiPurchaseValueVnd(tx),
    eventId: `bds:Purchase:${tx.id}`,
  });
}
```

`emit`: nếu `!isBdsCapiEnabled()` return. `clientId = bdsCapiClientId()`. `status = shouldEnqueueCapiHttp(...) ? 'logged' : 'skipped'`. `insertCapiEvent`. Nếu enqueue: `jobs.enqueueCapiDispatch({ payload: buildCapiDispatchPayload(...), idempotencyKey: eventId.replace(/^bds:/, 'bds:capi:'), clientId })`. Enqueue throw → logger, **không** fail caller (TX vẫn commit).

**Cấm:** `fetch('https://graph.facebook.com...')`. **Cấm** hash SĐT trong Nest — worker hash từ `lead_id`. Không log raw phone.

- [ ] **Step 8: Wire TX + lead + visit**

`convertDeposit` — **sau** ticket handoff, trước `return tx`:

```ts
if (shouldEmitCapiPurchase('deposit', bdsCapiPurchaseAt())) {
  try {
    await this.capi?.onPurchase(tx);
  } catch (err) {
    this.logger.warn(`capi purchase hook failed tx=${tx.id}: ${String(err)}`);
  }
}
```

`contract()` — đổi khối `capi?.onPurchase` thành cùng `shouldEmitCapiPurchase('contracted', bdsCapiPurchaseAt())`. Default **không** gửi lúc HĐMB.

`BdsBuyerLeadService.create` — sau `createLead` thành công: `this.capi?.onLead({ tenantId, leadId: lead.id }).catch(...)`. Inject `@Optional() capi`.

`BdsBuyerVisitService.createVisit` — sau `insertVisit`: `this.capi?.onSchedule({ tenantId, leadId, visitId: visit.id }).catch(...)`.

**Cấm:** gọi `onLead` từ `BdsBuyerIngestService.prepareWebhookLeads` (Meta form đã enqueue Python).

`BdsModule`: thêm `WebhooksModule` vào `imports` (đã `exports: [JobQueueRepository]`). Không import `MetaTrackingModule` chỉ để copy Graph.

Cập nhật spec lead/visit: mock `capi` optional — test cũ không gãy.

- [ ] **Step 9: Run CAPI + TX subset**

Run:

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/bds/commission/bds-capi-hook.service.spec.ts \
  src/bds/commission/bds-capi.util.spec.ts \
  src/bds/transactions/bds-tx.service.spec.ts \
  src/bds/buyers/bds-buyer-lead.service.spec.ts \
  src/bds/buyers/bds-buyer-visit.service.spec.ts \
  --runInBand
```

Expected: all PASS. TX deposit/contract **không** throw khi capi mock thiếu.

- [ ] **Step 10: Commit (chỉ khi user yêu cầu)**

```bash
git commit -m "$(cat <<'EOF'
feat(bds): send pack CAPI events through existing Meta tracking

EOF
)"
```

---

### Task 3: FE hub Tài chính + collections strip

**Files:**
- Modify: `services/ops-web/src/lib/bds/types.ts`
- Modify: `services/ops-web/src/lib/bds/api.ts`
- Modify: `services/ops-web/src/app/crm/bds/page.tsx`
- Modify: `services/ops-web/src/app/crm/bds/collections/page.tsx`
- Create: `services/ops-web/src/lib/bds/hdqt-export.spec.ts` (nếu tách helper download)
- Test: types compile; optional vitest helper `financeCopy`

**Interfaces:**
- Consumes: `HubKpi` 8 field; `GET /api/v1/bds/hub/export?kind=hdqt` (cùng `bdsFetch` blob như `downloadCollectionExport`)
- Produces: section `#finance` trên hub; dải copy trên collections; `downloadHdqtExport(token)`

- [ ] **Step 1: Write failing FE helper test**

Tạo `services/ops-web/src/lib/bds/finance-copy.ts` + spec:

```ts
export function financeHubDisclaimer(): string {
  return 'Số điều hành BĐS — không phải hạch toán ERP.';
}

export function adsRoasCopy(mapped: boolean): string {
  return mapped ? 'ROAS căn cần spend Meta đã map.' : 'Chưa gắn ad account';
}
```

```ts
import { adsRoasCopy, financeHubDisclaimer } from './finance-copy';

it('U-09 disclaimer', () => {
  expect(financeHubDisclaimer()).toContain('không phải hạch toán');
});

it('ROAS does not invent spend', () => {
  expect(adsRoasCopy(false)).toBe('Chưa gắn ad account');
});
```

- [ ] **Step 2: Run vitest to verify fail**

Run: `cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds/finance-copy.spec.ts`

Expected: FAIL nếu file chưa có — viết file rồi PASS ngay (helper thuần).

- [ ] **Step 3: Types + API**

`types.ts` `HubKpi` thêm `collected_month_vnd`, `hh_payable_month_vnd`.

`api.ts` — copy pattern `downloadCollectionExport`:

```ts
export async function downloadHdqtExport(token: string): Promise<void> {
  const path = '/api/v1/bds/hub/export?kind=hdqt';
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}`, ...bdsTenantHeader() } });
  // cùng blob + a.download = 'bds-hdqt.csv' như receipts
}
```

Dùng đúng `bdsFetch`/header `x-bds-tenant` hiện có — đọc `downloadCollectionExport` và **lặp pattern**, không invent client.

- [ ] **Step 4: Hub UI**

Trong `page.tsx`, sau grid 6 ô W6, thêm:

```tsx
<section id="finance" style={{ marginTop: '1.5rem' }}>
  <h2>Tài chính tháng</h2>
  <p className="muted">{financeHubDisclaimer()}</p>
  <div className="hub-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
    <Link href="/crm/bds/transactions">
      <p className="muted">GMV HĐMB tháng</p>
      <strong>{formatVnd(hub.kpi.gmv_contracted_month_vnd)}</strong>
    </Link>
    <Link href="/crm/bds/collections">
      <p className="muted">Đã thu tháng</p>
      <strong>{formatVnd(hub.kpi.collected_month_vnd ?? 0)}</strong>
    </Link>
    <Link href="/crm/bds/collections">
      <p className="muted">Quá hạn &gt;30 ngày</p>
      <strong>{hub.kpi.overdue_gt_30d}</strong>
    </Link>
    <Link href="/crm/bds/commissions">
      <p className="muted">HH phải trả kỳ</p>
      <strong>{formatVnd(hub.kpi.hh_payable_month_vnd ?? 0)}</strong>
    </Link>
  </div>
  <p className="muted">{adsRoasCopy(false)}</p>
  {hasCap(user, 'bds_tenant', 'view') ? (
    <button type="button" onClick={() => void downloadHdqtExport(token).catch(() => setLoadError('Xuất HĐQT thất bại'))}>
      Xuất pack HĐQT
    </button>
  ) : null}
</section>
```

**Cấm:** route `/crm/bds/finance`. **Cấm** số ROAS giả. `adsRoasCopy(false)` v1 — spend Meta không query trong W7 (U5 ROAS = copy + GMV đúng; spend = pha sau khi map account).

- [ ] **Step 5: Collections strip**

Đầu `BdsCollectionsPage` (sau title), nếu `token`:

```tsx
<p className="muted">{financeHubDisclaimer()} Chi tiết 4 số tháng ở <Link href="/crm/bds#finance">Tổng quan</Link>.</p>
```

Giữ aging + `downloadCollectionExport` W1. Không đổi POST receipt.

- [ ] **Step 6: Run FE tests**

Run: `cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds/finance-copy.spec.ts src/lib/bds/api.spec.ts`

Expected: PASS. `api.spec.ts` không bắt buộc case mới trừ khi bạn thêm mock export.

- [ ] **Step 7: Commit (chỉ khi user yêu cầu)**

```bash
git commit -m "$(cat <<'EOF'
feat(bds): show CFO strip and HDQT export on existing hub page

EOF
)"
```

---

### Task 4: Verify U4 / U5 + không W8+

**Files:** không file mới trừ sửa nếu build fail.

- [ ] **Step 1: Nest W7 subset**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/bds/bds.flags.spec.ts \
  src/bds/reports \
  src/bds/commission/bds-capi.util.spec.ts \
  src/bds/commission/bds-capi-hook.service.spec.ts \
  src/bds/transactions/bds-tx.service.spec.ts \
  src/bds/buyers/bds-buyer-lead.service.spec.ts \
  src/bds/buyers/bds-buyer-visit.service.spec.ts \
  --runInBand
```

Expected: all PASS.

- [ ] **Step 2: FE W7 subset**

```bash
cd services/ops-web && ./node_modules/.bin/vitest run \
  src/lib/bds/finance-copy.spec.ts \
  src/lib/bds/flags.spec.ts \
  src/lib/bds/nav.spec.ts \
  src/lib/bds/nav-hide.spec.ts
```

Expected: all PASS. Nav W6 **không** thêm `/crm/bds/finance`.

- [ ] **Step 3: Production builds**

```bash
cd services/ptt-crm-api && npm run build
cd services/ops-web && NEXT_PUBLIC_PTT_BDS_UI=1 npm run build
```

Expected: both compile. Mock `HubKpi` thiếu field → thêm `collected_month_vnd: 0`, `hh_payable_month_vnd: 0`.

- [ ] **Step 4: Leak check W8+ / hướng 2–3**

```bash
rg -n "PTT_BDS_OS|PTT_BDS_CSKH_BOARD|PTT_BDS_FINANCE_HUB|finance/hub|bds_spine_events|offboardUser|bds-capi-http|graph.facebook.com" \
  services/ptt-crm-api/src/bds services/ops-web/src/lib/bds services/ops-web/src/app/crm/bds
```

Expected:

| Pattern | Được |
|---------|------|
| `PTT_BDS_CAPI` / `PTT_BDS_CAPI_PURCHASE_AT` / `PTT_BDS_CAPI_CLIENT_ID` | Task 2 |
| `hub/export` | Task 1 |
| `finance/hub` / `PTT_BDS_FINANCE_HUB` / `app/crm/bds/finance` | **0** |
| `bds-capi-http` / `graph.facebook.com` trong `src/bds` | **0** |
| `offboardUser` / `bds_spine_events` / `PTT_BDS_OS` | **0** |

`graph.facebook.com` vẫn được phép trong `src/meta-tracking` (không đụng).

- [ ] **Step 5: Commit verify-only fixes nếu có**

```bash
git commit -m "$(cat <<'EOF'
fix(bds): keep W7 hub types build-safe

EOF
)"
```

Chỉ khi Step 3 bắt buộc sửa.

---

## Coverage vs spec §7 W7

| Tiêu chí | Task |
|----------|------|
| GMV hub = SUM `contracted` tháng | 1 (giữ query W6) |
| Đã thu tháng = SUM receipt | 1 |
| Overdue >30d | 1 (giữ) |
| HH phải trả = accrued − paid − clawback | 1 |
| Export pack HĐQT CSV (TGD-06) | 1 + 3 |
| Không trang `/crm/bds/finance` | 3 + 4 |
| CAPI=0 không HTTP / không insert (U-05) | 2 |
| Purchase value = `net_price_vnd` (U-06) | 2 |
| Purchase mặc định lúc cọc | 2 |
| Lead Nest + Schedule visit | 2 |
| Meta ingest Lead không double | 2 (cấm hook ingest) |
| ROAS không bịa spend | 3 |
| Không offboard / spine / FINANCE_HUB | 4 leak |

## UAT staging (sau deploy Nest + ops-web)

Giữ flag pack. **Không** bật CAPI trừ khi đã có Meta client + job worker.

```
# CFO — không flag mới
# CAPI UAT (tuỳ chọn)
PTT_BDS_CAPI=1
PTT_BDS_CAPI_PURCHASE_AT=deposit
PTT_BDS_CAPI_CLIENT_ID=<uuid client Meta đã map pixel>
PTT_JOBS_ENABLED=1
PTT_CAPI_STUB=1
```

| Persona | Việc |
|---------|------|
| `tgd` / `truong_collection` | `/crm/bds#finance` — 4 số; Xuất HĐQT mở CSV; GMV ≠ GMV cọc |
| `cv_hh` | Ô HH = ledger kỳ; click → `/crm/bds/commissions` |
| `truong_mkt` | CAPI=0: cọc thành công, `bds_capi_events` không thêm hàng |
| `truong_mkt` | CAPI=1 + client: cọc → 1 hàng Purchase `value_vnd=net`; job `capi_dispatch` (stub) |
| `cskh_lead` | Đặt visit Nest → Schedule logged/skipped; board W5 không gãy |
| Broker | Hub 404 như UC-001 — export cũng 404 |

Không DDL. Restart `realosai-api` (+ worker nếu bật CAPI HTTP).
