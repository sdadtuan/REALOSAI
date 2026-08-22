# P2 Triển khai — Hold + TTL

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phiếu giữ chỗ trên PG: hai POST cùng căn/`row_version` → một 201 + một 409 (BDS-02); inhouse auto `active` (BDS-06); kênh `pending` (BDS-05); job TTL → `expired` + căn `available` (BDS-03).

**Architecture:** Bounded context `src/bds/hold/`. HTTP `/api/v1/bds` sau `StaffOrInternalKeyGuard` + `BdsPackGuard`. `BdsHoldService` là cổng duy nhất tạo/duyệt/hủy hold; đổi `status` căn chỉ qua `BdsInventoryService.transition` (`hold` / `ttl` / `cancel`). Job `@Cron` mỗi 5 phút khi `PTT_BDS_PACK=1` **và** `PTT_BDS_HOLD_TTL=1`. Không Agency OS, không CSBH, không TX.

**Tech Stack:** NestJS `ptt-crm-api`, Jest local binary, `pg` Pool, `@nestjs/schedule` (đã `forRoot` trong `GtmModule` — **không** gọi `ScheduleModule.forRoot()` lần nữa).

**Spec:** [2026-08-21-bds-industry-pack-design.md](../specs/2026-08-21-bds-industry-pack-design.md) §6.4, §7.2, §10.3, §12 `PTT_BDS_HOLD_TTL`, BR-BDS-01/11/13.  
**UC:** 013 inhouse · 014 pending · 015 duyệt/từ chối · 016 TTL.  
**P1:** [2026-08-22-bds-p1-inventory-os.md](./2026-08-22-bds-p1-inventory-os.md)  
**P1b:** [2026-08-22-bds-p1b-project-os.md](./2026-08-22-bds-p1b-project-os.md)  
**Roadmap:** [2026-08-22-bds-coding-roadmap.md](./2026-08-22-bds-coding-roadmap.md)

**Test ID P2:** BDS-02, BDS-03, BDS-05, BDS-06.  
**BDS-11** (convert cọc dưới `deposit_min`) = **P4** — không làm ở P2 dù roadmap từng liệt kê.

## Global Constraints

- `PTT_BDS_PACK` mặc định `0` — mọi `POST /api/v1/bds/*` = **404**.
- `PTT_BDS_HOLD_TTL` mặc định `0` — job expire **no-op**. Spec §12 nói «1 khi PACK»; **code mặc định tắt** (an toàn prod). Bật tay trên staging khi PACK=1.
- GET ngoài tenant = 404, không PII (BR-BDS-05). Optional `x-bds-tenant` giống inventory.
- Không xóa `re-projects/`. Không đụng `crm_b2b_projects`. Không tạo `bds_agencies` / `bds_transactions` / `bds_sales_policies`.
- Một căn tối đa một hold `pending` **hoặc** `active` (BR-BDS-01). Unique partial index.
- Inhouse (`channel_partner_id` trim rỗng): auto `active` nếu `auto_approve_internal_hold !== false` (mặc định true) — BDS-06.
- Kênh (`channel_partner_id` trim ≠ ''): luôn `pending` (BR-BDS-11, BDS-05). **Không** 404 giỏ / quota / exclusive (P5).
- `row_version` lệch hoặc đã có hold mở → 409 `{ error: 'unit_locked' }` (BDS-02, BR-BDS-14).
- `Idempotency-Key` trùng trong 24h trên cùng route → trả đúng response đầu (BR-BDS-13). Thiếu header: vẫn tạo hold.
- Khi PROJECT_OS=1: hold **kênh** cần đợt `active` + `open_to_channel=true` — không thì 400 `{ error: 'phase_closed' }`. Hold inhouse **không** cần đợt.
- `legal_gate=blocked` **không** chặn hold (UC-007: vẫn giữ chỗ; cổng chặn **mở đợt** ở P1b).
- Không `convert-deposit`, không phí giữ chỗ, không launch TTL 180s, không UI `/crm/bds`.
- `DATABASE_URL` script: `postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb`.
- Test: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand` (không `npx jest`).
- Không commit trừ khi user yêu cầu.
- Prod VPS: **không** bật `PTT_BDS_PACK` / `PTT_BDS_HOLD_TTL`. Không đụng `ngoinhahomnay.vn` / :3000.

---

## 0. Phạm vi / ngoài phạm vi

**Làm**

- DDL `bds_holds`, `bds_idempotency_keys`; unique one-open-hold
- `BdsHoldService.create` / `approve` / `reject` / `cancel` / `expireDue`
- Ghi đồng thời `hold_id` + `hold_lead_id` + `hold_at` trên căn khi active; xóa khi hết/hủy
- Cron 5 phút + hàm `expireDue(now)` gọi được từ test
- HTTP: POST units holds, approve, reject, cancel; GET hold + list theo project
- Flag `isBdsHoldTtlEnabled()`

**Không làm**

- `POST /holds/:id/convert-deposit` (P4, BDS-11)
- Reservation fee / căn `reserved` từ hold (P4 UC-017)
- Agency / giỏ / hạng / quota / F2 / inhouse 404 (P5: BDS-04, 22, 23, 28, 34)
- Launch 180s / khóa giá (P10)
- Chat card / ticket `hold_f1_approve` (P11/P12)
- Auto-promote pending sau TTL (spec nhắc; P2 chỉ `available`)
- `bds_buyers` / FK lead PG (lead_id là integer, không FK)
- UI ops-web
- BR-BDS-12 (`presale`/`selling`) — `crm_re_projects.status` hiện `planning`; không chặn hold

---

## 1. File map

```
docs/specs/postgresql-ddl-bds-p2.sql
scripts/apply_pg_ddl_bds_p2.sh

services/ptt-crm-api/src/bds/bds.flags.ts                    # + isBdsHoldTtlEnabled
services/ptt-crm-api/src/config/app-config.service.ts        # bdsHoldTtlEnabled
services/ptt-crm-api/src/bds/hold/bds-hold.types.ts
services/ptt-crm-api/src/bds/hold/bds-hold.util.ts
services/ptt-crm-api/src/bds/hold/bds-hold.util.spec.ts
services/ptt-crm-api/src/bds/hold/bds-hold.repository.ts
services/ptt-crm-api/src/bds/hold/bds-hold.service.ts
services/ptt-crm-api/src/bds/hold/bds-hold.service.spec.ts
services/ptt-crm-api/src/bds/hold/bds-hold.controller.ts
services/ptt-crm-api/src/bds/hold/bds-hold-ttl.job.ts
services/ptt-crm-api/src/bds/hold/bds-hold-ttl.job.spec.ts
services/ptt-crm-api/src/bds/inventory/bds-re-product-pg.repository.ts  # setHoldPointers
services/ptt-crm-api/src/bds/bds.module.ts
```

---

### Task 1: Flag HOLD_TTL + util hold

**Files:**
- Modify: `services/ptt-crm-api/src/bds/bds.flags.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.flags.spec.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts` — `bdsHoldTtlEnabled` cạnh `bdsProjectOsEnabled`
- Create: `services/ptt-crm-api/src/bds/hold/bds-hold.types.ts`
- Create: `services/ptt-crm-api/src/bds/hold/bds-hold.util.ts`
- Create: `services/ptt-crm-api/src/bds/hold/bds-hold.util.spec.ts`

**Interfaces:**
- Produces: `isBdsHoldTtlEnabled(): boolean`
- Produces: `decideHoldActor(channelPartnerId?: string): 'inhouse' | 'channel'`
- Produces: `initialHoldStatus(actor, autoApproveInternal): 'pending' | 'active'`
- Produces: `ttlMinutes(projectStatus, tenantTtlMinutes?: number): number` — tenant override nếu số hữu hạn > 0; else `selling` → 1440; else → 30
- Produces: `computeExpiresAt(now, minutes): Date`

- [ ] **Step 1: Flags spec + util spec (RED)**

```ts
// bds.flags.spec.ts — restore PTT_BDS_HOLD_TTL in afterEach (delete if prev undefined)
it('defaults HOLD_TTL off when unset', () => {
  delete process.env.PTT_BDS_HOLD_TTL;
  expect(isBdsHoldTtlEnabled()).toBe(false);
});

it('HOLD_TTL on for 1', () => {
  process.env.PTT_BDS_HOLD_TTL = '1';
  expect(isBdsHoldTtlEnabled()).toBe(true);
});
```

```ts
// bds-hold.util.spec.ts
it('empty channel_partner_id → inhouse', () => {
  expect(decideHoldActor('')).toBe('inhouse');
  expect(decideHoldActor('  ')).toBe('inhouse');
  expect(decideHoldActor(undefined)).toBe('inhouse');
});

it('non-empty channel_partner_id → channel', () => {
  expect(decideHoldActor('ag-1')).toBe('channel');
});

it('BDS-06 inhouse auto-approve → active', () => {
  expect(initialHoldStatus('inhouse', true)).toBe('active');
});

it('inhouse when autoApprove false → pending', () => {
  expect(initialHoldStatus('inhouse', false)).toBe('pending');
});

it('BDS-05 channel always pending', () => {
  expect(initialHoldStatus('channel', true)).toBe('pending');
});

it('ttl 30 presale / 1440 selling / tenant override', () => {
  expect(ttlMinutes('planning', undefined)).toBe(30);
  expect(ttlMinutes('selling', undefined)).toBe(1440);
  expect(ttlMinutes('selling', 15)).toBe(15);
});
```

- [ ] **Step 2: Implement**

```ts
export function isBdsHoldTtlEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_HOLD_TTL);
}

export function decideHoldActor(channelPartnerId?: string): 'inhouse' | 'channel' {
  return String(channelPartnerId ?? '').trim() ? 'channel' : 'inhouse';
}

export function initialHoldStatus(
  actor: 'inhouse' | 'channel',
  autoApproveInternal: boolean,
): 'pending' | 'active' {
  if (actor === 'channel') return 'pending';
  return autoApproveInternal ? 'active' : 'pending';
}

export function ttlMinutes(projectStatus: string, tenantTtlMinutes?: number): number {
  if (Number.isFinite(tenantTtlMinutes) && Number(tenantTtlMinutes) > 0) {
    return Number(tenantTtlMinutes);
  }
  return String(projectStatus) === 'selling' ? 1440 : 30;
}

export function computeExpiresAt(now: Date, minutes: number): Date {
  return new Date(now.getTime() + minutes * 60_000);
}
```

`AppConfigService`: parse `PTT_BDS_HOLD_TTL` giống `bdsPgEnabled`.

Jest: `./node_modules/.bin/jest src/bds/bds.flags.spec.ts src/bds/hold/bds-hold.util.spec.ts --runInBand`

- [ ] **Step 3: Commit** — chỉ khi user yêu cầu: `feat(bds): P2 HOLD_TTL flag and hold actor util`

---

### Task 2: DDL holds + idempotency

**Files:**
- Create: `docs/specs/postgresql-ddl-bds-p2.sql`
- Create: `scripts/apply_pg_ddl_bds_p2.sh` (copy `scripts/apply_pg_ddl_bds_p1b.sh`, đổi file + echo `OK  bds P2 DDL`)

- [ ] **Step 1: Write DDL**

```sql
-- Pack BĐS P2 — Apply: scripts/apply_pg_ddl_bds_p2.sh
BEGIN;

CREATE TABLE IF NOT EXISTS bds_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES crm_re_project_products (id) ON DELETE CASCADE,
  lead_id INTEGER NOT NULL,
  buyer_id UUID,
  requested_by_staff_id INTEGER,
  channel_partner_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'cancelled', 'converted', 'rejected')),
  expires_at TIMESTAMPTZ,
  note TEXT NOT NULL DEFAULT '',
  approved_by TEXT NOT NULL DEFAULT '',
  approved_at TIMESTAMPTZ,
  cancelled_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_holds_one_open
  ON bds_holds (product_id)
  WHERE status IN ('pending', 'active');

CREATE INDEX IF NOT EXISTS idx_bds_holds_expires
  ON bds_holds (expires_at)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS bds_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL DEFAULT '',
  status_code INTEGER NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route, key)
);

COMMIT;
```

`hold_id` trên `crm_re_project_products` đã có từ P1 — **không** thêm FK (tránh vòng khi xóa). Service giữ đồng bộ.

- [ ] **Step 2: Apply local (idempotent ×2)**

```bash
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
bash scripts/apply_pg_ddl_bds_p2.sh
bash scripts/apply_pg_ddl_bds_p2.sh
psql "$DATABASE_URL" -c '\d bds_holds'
```

Expected: bảng + `uq_bds_holds_one_open`; lần 2 NOTICE / OK.

---

### Task 3: Repo hold + pointer căn

**Files:**
- Create: `services/ptt-crm-api/src/bds/hold/bds-hold.repository.ts`
- Modify: `services/ptt-crm-api/src/bds/inventory/bds-re-product-pg.repository.ts`

**Interfaces:**
- Consumes: bảng Task 2
- Produces repo: `insertHold`, `getHold`, `listByProject`, `listOpenByProduct`, `setHoldStatus`, `listActiveDue(now)`, `getProjectHoldContext(projectId)`, `getIdempotency(route, key)`, `putIdempotency(...)`
- Produces product repo: `setHoldPointers(productId, { hold_id, hold_lead_id, hold_at })` — `hold_id=null` xóa cả ba

Pool pattern copy `BdsReProductPgRepository`:

```ts
constructor(private readonly config: AppConfigService) {}
private get db(): Pool { ... this.config.databaseUrl ... }
```

`insertHold` bắt `23505` → ném object `{ code: '23505' }` (service map 409).

```ts
async setHoldPointers(
  productId: number,
  ptr: { hold_id: string | null; hold_lead_id: number | null; hold_at: string },
): Promise<void> {
  await this.db.query(
    `UPDATE crm_re_project_products
     SET hold_id = $2, hold_lead_id = $3, hold_at = $4, updated_at = NOW()
     WHERE id = $1`,
    [productId, ptr.hold_id, ptr.hold_lead_id, ptr.hold_at],
  );
}
```

`hold_at` khi xóa = `''` (cột TEXT P1).

Không bắt buộc Jest repo (service mock). Implement đủ SQL để Task 4 gọi.

- [ ] **Step 1: Implement repo + `setHoldPointers`**
- [ ] **Step 2: `./node_modules/.bin/tsc -p tsconfig.build.json --noEmit`** exit 0

---

### Task 4: Service create — BDS-02 / BDS-06 + idempotency

**Files:**
- Create: `services/ptt-crm-api/src/bds/hold/bds-hold.service.ts`
- Create: `services/ptt-crm-api/src/bds/hold/bds-hold.service.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.module.ts` — providers `BdsHoldRepository`, `BdsHoldService`; export service. **Không** controller ở task này.

**Interfaces:**
- Consumes: `BdsInventoryService.getOrThrow` / `transition`; product `setHoldPointers`; hold repo; `BdsProjectOsService.listPhases` (chỉ Task 5)
- Produces: `create(productId, body, opts): HoldRow` với 201-shape

`CreateHoldBody`:

```ts
{
  lead_id: number;
  row_version: number;
  channel_partner_id?: string;
  note?: string;
  requested_by_staff_id?: number;
}
```

`CreateHoldOpts`: `{ tenantId?: string; idempotencyKey?: string; now?: Date }`

Quy tắc `create`:

1. `lead_id` phải integer > 0 — không thì 400 `{ error: 'lead_id' }`. `row_version` không finite → 400 `{ error: 'row_version' }`.
2. Nếu `idempotencyKey` trim ≠ '': `getIdempotency('POST /units/:id/holds', key)` — nếu có và `created_at > now-24h` → **return** `response_json` đã lưu (không tạo mới). Không so khớp body (YAGNI).
3. `inventory.getOrThrow(productId, tenantId)` — 404 nếu sai tenant / thiếu căn.
4. Status căn phải `available` — không thì 409 `{ error: 'unit_locked' }`.
5. Đọc `project.status` + tenant `settings_json` qua repo `getProjectHoldContext(projectId)` (thêm method: `SELECT p.status, p.current_phase_id, t.settings_json FROM crm_re_projects p LEFT JOIN bds_tenants t ON t.id = p.tenant_id WHERE p.id=$1`). `auto_approve_internal_hold` = `settings.auto_approve_internal_hold !== false`.
6. `actor = decideHoldActor(channel_partner_id)`; `status = initialHoldStatus(...)`.
7. **Kênh + PROJECT_OS on:** Task 5 bổ sung phase check. Task 4 chỉ inhouse path trong test; để hook `assertChannelPhase(projectId)` là no-op hoặc method rỗng — implement thật Task 5.
8. `expires_at`: chỉ set khi `status==='active'` (`computeExpiresAt(now, ttlMinutes(...))`). Pending: `expires_at=null`.
9. `insertHold`. `23505` → 409 `{ error: 'unit_locked' }`.
10. Nếu `active`: `inventory.transition(productId, 'hold', row_version, tenantId)` rồi `setHoldPointers`. Transition fail → `setHoldStatus(id, 'cancelled', 'conflict')` rồi rethrow 409 (không để hold active mồ côi).
11. Nếu `pending`: **không** đổi status căn, **không** ghi `hold_id`.
12. Lưu idempotency `{ status_code: 201, response_json: hold }` nếu có key.

- [ ] **Step 1: Service tests (RED)**

```ts
function make() {
  const inventory = {
    getOrThrow: jest.fn().mockResolvedValue({
      id: 9, project_id: 1, status: 'available', row_version: 1, tenant_id: null,
    }),
    transition: jest.fn().mockResolvedValue({ id: 9, status: 'hold', row_version: 2 }),
  };
  const products = { setHoldPointers: jest.fn() };
  const repo = {
    getProjectHoldContext: jest.fn().mockResolvedValue({
      status: 'planning', current_phase_id: null, settings_json: {},
    }),
    insertHold: jest.fn().mockImplementation(async (_p, row) => ({ id: 'h1', ...row })),
    getIdempotency: jest.fn().mockResolvedValue(null),
    putIdempotency: jest.fn(),
    setHoldStatus: jest.fn(),
  };
  const svc = new BdsHoldService(inventory as never, products as never, repo as never, /* projectOs */ null as never);
  return { svc, inventory, products, repo };
}

it('BDS-06 inhouse create → active + transition hold + pointers', async () => {
  const { svc, inventory, products } = make();
  const out = await svc.create(9, { lead_id: 44, row_version: 1 }, {});
  expect(out.status).toBe('active');
  expect(inventory.transition).toHaveBeenCalledWith(9, 'hold', 1, undefined);
  expect(products.setHoldPointers).toHaveBeenCalledWith(9, expect.objectContaining({
    hold_id: 'h1', hold_lead_id: 44,
  }));
});

it('BDS-02 second create when unit already hold → 409 unit_locked', async () => {
  const { svc, inventory } = make();
  inventory.getOrThrow.mockResolvedValue({ id: 9, project_id: 1, status: 'hold', row_version: 2 });
  try {
    await svc.create(9, { lead_id: 1, row_version: 2 }, {});
    throw new Error('expected');
  } catch (e) {
    expect(e).toBeInstanceOf(ConflictException);
    expect((e as ConflictException).getResponse()).toEqual({ error: 'unit_locked' });
  }
});

it('BDS-02 transitionOptimistic miss → 409 and cancels inserted hold', async () => {
  const { svc, inventory, repo } = make();
  inventory.transition.mockRejectedValue(new ConflictException({ error: 'unit_locked' }));
  await expect(svc.create(9, { lead_id: 1, row_version: 1 }, {})).rejects.toBeInstanceOf(ConflictException);
  expect(repo.setHoldStatus).toHaveBeenCalledWith('h1', 'cancelled', expect.anything());
});

it('idempotent replay returns first body', async () => {
  const { svc, repo, inventory } = make();
  repo.getIdempotency.mockResolvedValue({
    created_at: new Date(),
    response_json: { id: 'old', status: 'active' },
  });
  const out = await svc.create(9, { lead_id: 1, row_version: 1 }, { idempotencyKey: 'k1' });
  expect(out.id).toBe('old');
  expect(inventory.transition).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Implement + Jest** `src/bds/hold --runInBand` xanh (cùng util)

---

### Task 5: Channel pending + approve / reject (BDS-05)

**Files:** cùng service/spec + gọi `BdsProjectOsService` (đã export từ `BdsModule`)

**Interfaces:**
- `assertChannelPhase(projectId): Promise<void>` — nếu `!isBdsProjectOsEnabled()` return. Else `listPhases(projectId)`; phải có `status==='active' && open_to_channel===true` — không thì `BadRequestException({ error: 'phase_closed' })`.
- `approve(holdId, approvedBy, tenantId?)` — chỉ `pending` → `active`; set `expires_at`, `approved_by`, `approved_at`; `transition(..., 'hold', current row_version)`; pointers. Căn không `available` → 409.
- `reject(holdId, reason, tenantId?)` — `pending` → `rejected`; `reason.trim().length < 3` → 400 `{ error: 'reason' }`. Căn không đổi.

`create` kênh: gọi `assertChannelPhase` **trước** insert. `expires_at` null. Không `transition`.

- [ ] **Step 1: Tests**

```ts
it('BDS-05 channel create → pending, no unit transition', async () => {
  const { svc, inventory, products } = make();
  const out = await svc.create(9, { lead_id: 2, row_version: 1, channel_partner_id: 'ag-1' }, {});
  expect(out.status).toBe('pending');
  expect(inventory.transition).not.toHaveBeenCalled();
  expect(products.setHoldPointers).not.toHaveBeenCalled();
});

it('channel + PROJECT_OS without open_to_channel phase → 400 phase_closed', async () => {
  process.env.PTT_BDS_PROJECT_OS = '1';
  const { svc, projectOs } = make(); // mock listPhases → [{ status:'active', open_to_channel:false }]
  try {
    await svc.create(9, { lead_id: 2, row_version: 1, channel_partner_id: 'ag-1' }, {});
    throw new Error('expected');
  } catch (e) {
    expect((e as BadRequestException).getResponse()).toEqual({ error: 'phase_closed' });
  }
});

it('approve pending → active + hold transition', async () => {
  const { svc, repo, inventory } = make();
  repo.getHold.mockResolvedValue({
    id: 'h2', product_id: 9, project_id: 1, status: 'pending', lead_id: 2,
  });
  const out = await svc.approve('h2', 'gdkd');
  expect(out.status).toBe('active');
  expect(inventory.transition).toHaveBeenCalled();
});

it('reject pending does not transition unit', async () => {
  const { svc, repo, inventory } = make();
  repo.getHold.mockResolvedValue({ id: 'h2', product_id: 9, status: 'pending' });
  await svc.reject('h2', 'het hang');
  expect(inventory.transition).not.toHaveBeenCalled();
});
```

Restore `PTT_BDS_PROJECT_OS` trong `afterEach`.

- [ ] **Step 2: Implement + Jest xanh**

---

### Task 6: Cancel + TTL job (BDS-03)

**Files:**
- Modify: service `cancel` / `expireDue`
- Create: `services/ptt-crm-api/src/bds/hold/bds-hold-ttl.job.ts`
- Create: `services/ptt-crm-api/src/bds/hold/bds-hold-ttl.job.spec.ts`

**Interfaces:**
- `cancel(holdId, reason, tenantId?)`:
  - `reason.trim().length < 3` → 400 `{ error: 'reason' }`
  - `pending` → `cancelled` (căn không đổi)
  - `active` → `cancelled` + `inventory.transition(productId, 'cancel', row_version)` + `setHoldPointers` null. Đọc `row_version` hiện tại từ `getOrThrow` (không bắt client gửi version lúc hủy).
  - `expired|rejected|converted|cancelled` → 409 `{ error: 'hold_closed' }`
- `expireDue(now = new Date()): Promise<number>` — `listActiveDue(now)`; mỗi phiếu: `setHoldStatus(id, 'expired')`; nếu căn `status==='hold'` **và** `hold_id===phiếu` → `transition(..., 'ttl', row_version)` + clear pointers. Đếm số phiếu expired. Lỗi một phiếu: log, tiếp tục (không abort batch).
- Job:

```ts
@Injectable()
export class BdsHoldTtlJob {
  constructor(private readonly holds: BdsHoldService) {}

  @Cron('*/5 * * * *')
  async tick(): Promise<void> {
    if (!isBdsPackEnabled() || !isBdsHoldTtlEnabled()) return;
    await this.holds.expireDue(new Date());
  }
}
```

Không `ScheduleModule.forRoot()` trong `BdsModule`.

- [ ] **Step 1: Tests**

```ts
it('BDS-03 expireDue active past expires_at → expired + ttl transition', async () => {
  const { svc, repo, inventory, products } = make();
  repo.listActiveDue.mockResolvedValue([
    { id: 'h1', product_id: 9, status: 'active' },
  ]);
  inventory.getOrThrow.mockResolvedValue({
    id: 9, status: 'hold', hold_id: 'h1', row_version: 3,
  });
  const n = await svc.expireDue(new Date('2026-08-22T12:00:00Z'));
  expect(n).toBe(1);
  expect(inventory.transition).toHaveBeenCalledWith(9, 'ttl', 3, undefined);
  expect(products.setHoldPointers).toHaveBeenCalledWith(9, {
    hold_id: null, hold_lead_id: null, hold_at: '',
  });
});

it('job tick no-ops when HOLD_TTL off', async () => {
  process.env.PTT_BDS_PACK = '1';
  delete process.env.PTT_BDS_HOLD_TTL;
  const holds = { expireDue: jest.fn() };
  await new BdsHoldTtlJob(holds as never).tick();
  expect(holds.expireDue).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Implement + Jest `src/bds/hold --runInBand` xanh**

---

### Task 7: HTTP + module + DoD

**Files:**
- Create: `services/ptt-crm-api/src/bds/hold/bds-hold.controller.ts`
- Create: `services/ptt-crm-api/src/bds/hold/bds-hold.controller.spec.ts` (thin: instantiate + create delegates)
- Modify: `bds.module.ts` — controller + `BdsHoldTtlJob` provider
- Modify: roadmap hàng P2 → `[bds-p2-hold-ttl.md](./2026-08-22-bds-p2-hold-ttl.md)`

**Guards:** `@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard)` — **không** `BdsProjectOsGuard` (hold chạy khi PACK=1, PROJECT_OS có thể 0).

| Method | Path | HttpCode |
|--------|------|----------|
| POST | `/api/v1/bds/units/:id/holds` | **201** (default) |
| GET | `/api/v1/bds/holds/:id` | 200 |
| GET | `/api/v1/bds/projects/:id/holds` | 200 |
| POST | `/api/v1/bds/holds/:id/approve` | 200 |
| POST | `/api/v1/bds/holds/:id/reject` | 200 |
| POST | `/api/v1/bds/holds/:id/cancel` | 200 |

`:id` unit/project = `ParseIntPipe`. Hold id = UUID string.

```ts
@Post('units/:id/holds')
create(
  @Param('id', ParseIntPipe) id: number,
  @Body() body: { lead_id?: number; row_version?: number; channel_partner_id?: string; note?: string },
  @Headers('x-bds-tenant') tenantId?: string,
  @Headers('idempotency-key') idempotencyKey?: string,
) {
  return this.holds.create(id, {
    lead_id: Number(body.lead_id),
    row_version: Number(body.row_version),
    channel_partner_id: body.channel_partner_id,
    note: body.note,
  }, { tenantId, idempotencyKey });
}
```

`x-bds-tenant` + `assert` đã nằm trong `getOrThrow`. Header `Idempotency-Key` Nest normalize thành `idempotency-key`.

Không route `convert-deposit`.

- [x] **Step 1: Register; `tsc --noEmit` 0; Jest `src/bds --runInBand` xanh**
- [x] **Step 2: PACK=0 POST hold → 404 (sau auth). Guard spec hiện có đủ; controller thin test `create` gọi service**
- [x] **Step 3: Roadmap P2** — cột plan file trỏ `./2026-08-22-bds-p2-hold-ttl.md`; cột thắng đổi thành `BDS-02, 03, 05, 06` (bỏ BDS-11 — P4)

---

## 4. Definition of Done P2

- [x] Jest flags + hold util + hold service + ttl job xanh
- [x] `tsc` build api 0
- [x] DDL P2 apply idempotent
- [x] BDS-02: căn đã hold / miss version → 409 `{ error: 'unit_locked' }`
- [x] BDS-06: inhouse → `active` + căn `hold` + pointers
- [x] BDS-05: `channel_partner_id` → `pending`, không đổi căn
- [x] BDS-03: `expireDue` → hold `expired`, căn `available` (event `ttl`)
- [x] PACK=0 → HTTP hold 404; HOLD_TTL=0 → job no-op
- [x] Prod không bật PACK / HOLD_TTL
- [x] Không convert-deposit / không UI `/crm/bds` / không agency tables

---

## 5. Rollback

`PTT_BDS_PACK=0` và/hoặc `PTT_BDS_HOLD_TTL=0`. Không DROP `bds_holds` trên prod.

---

## 6. Sau P2 xanh

P3 CSBH (cần P1b). P4 TX + BDS-11 convert. P5 mới 404 giỏ / quota. P10 mới TTL 180s.

---

*P2 không phải Agency OS. Thắng: một căn một hold mở; inhouse khóa ngay; kênh chờ duyệt; hết hạn trả căn.*
