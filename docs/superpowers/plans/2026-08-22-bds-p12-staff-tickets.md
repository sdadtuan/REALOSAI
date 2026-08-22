# P12 Triển khai — Staff tickets (queue ban/liên phòng, artifact, convert chat)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ticket việc platform trên PG: seed queue §29.3, tạo `dept`/`cross`, claim/gán/transition, `close_requires` (BDS-47), auto-create cọc → `collection_schedule` (BDS-48), convert tin chat (UC-054), SLA quá hạn. UI mỏng `/crm/work` (SCR-BDS-120).

**Architecture:** Bounded context **platform** `src/staff-tickets/` (`StaffTicketService` = spec §29) — **không** nằm dưới `/api/v1/bds`, **không** dùng `tickets` khách (`/crm/tickets`). HTTP sau `StaffOrInternalKeyGuard` + `StaffTicketGuard` (`PTT_STAFF_TICKETS=1`). Tenant `x-bds-tenant`. Sàn / ngoài scope → **404** (không 403, BR-BDS-05; BDS-44). Pack BĐS chỉ **hook**: `BdsTxService.convertDeposit` tạo ticket `collection_schedule` khi TICKETS=1 — `@Optional()` cuối constructor, **no-op** khi flag tắt. `StaffTicketModule` **không** import `BdsModule`. After-sales `defect` **cấm** INSERT `crm_staff_tickets` (BR-BDS-46). Không SSE (poll 5s).

**Tech Stack:** NestJS `ptt-crm-api` + Jest; Next.js `ops-web` + Vitest; `pg` Pool; `psql`.

**Spec:** [2026-08-21-bds-industry-pack-design.md](../specs/2026-08-21-bds-industry-pack-design.md) §10.7, §15 P12, §29, BR-BDS-42…46.  
**UX:** [2026-08-22-bds-ux-ui-design.md](../specs/2026-08-22-bds-ux-ui-design.md) §4.16 SCR-BDS-120.  
**UC:** [13-BDS-INDUSTRY-PACK.md](../../use-cases/13-BDS-INDUSTRY-PACK.md) UC-054…059.  
**P11:** [2026-08-22-bds-p11-staff-chat.md](./2026-08-22-bds-p11-staff-chat.md) — convert UC-054 **cố ý** để P12; card cọc đã có.  
**P4 / P4b:** [2026-08-22-bds-p4-transaction.md](./2026-08-22-bds-p4-transaction.md) · [2026-08-22-bds-p4b-collection.md](./2026-08-22-bds-p4b-collection.md) — `convertDeposit` + `ensureScheduleForTx`.  
**P9:** [2026-08-22-bds-p9-aftersales.md](./2026-08-22-bds-p9-aftersales.md) — defect ≠ staff ticket.  
**P8:** [2026-08-22-bds-p8-ui-rbac.md](./2026-08-22-bds-p8-ui-rbac.md) — nav; **chưa** có «Việc».  
**Roadmap:** [2026-08-22-bds-coding-roadmap.md](./2026-08-22-bds-coding-roadmap.md)

**Test ID P12:** BDS-44 (sàn GET `/staff-tickets/tickets` → 404).  
**BDS-45** cross cùng một ban requester=assignee → 400.  
**BDS-46** gán staff khác `assignee_dept` → 400.  
**BDS-47** `done` `collection_schedule` khi TX chưa có installment → 400 `artifact`.  
**BDS-48** cọc + TICKETS=1 → ticket `collection_schedule` (idempotent).  
**UC-054** nút «Chuyển thành ticket» khi FE flag on.  
**UC-055/056** tạo `dept` / `cross`.  
**UC-057** claim / assign / transition.  
**UC-058** `close_requires`.  
**UC-059** job `sla_breached` (escalate 1 bậc = event; không chuông push v1).

**Hướng khóa: 1** — API đủ cổng + seed queue + BDS-44…48 + UC-054 + page `/crm/work` 4 inbox poll 5s. Không auto-create đủ §29.5, không họp T2 hàng loạt, không export, không SSE.

| Hướng | Làm | Không | Khi nào chọn |
|-------|-----|-------|----------------|
| **1 (khóa)** | Flag + DDL + queues + create/assign/transition + artifact cọc + auto ticket cọc + convert chat + page mỏng + SLA job mark | Mọi auto §29.5 (lead/hold/VBTT/HĐMB/milestone…), T2 bulk `ops_action`, nút «Tạo ticket» trên hold/TX, export, SSE | Đúng cổng P0+P8+P11→P12 |
| 2 | Chỉ API + BDS-44…48, không FE | Nav «Việc», UC-054 nút | Tách UI sang P12b |
| 3 | Mọi auto-create §29.5 + T2 + export + watchers UI + hold/TX create | — | Quá rộng; P12b |

---

## Global Constraints

- `PTT_STAFF_TICKETS` mặc định `0` — mọi `/api/v1/staff-tickets/*` = **404**. Hook BĐS **no-op**.
- `NEXT_PUBLIC_PTT_STAFF_TICKETS` mặc định `0` — không hiện nav «Việc»; `/crm/work` → «Việc nội bộ chưa bật»; chat **không** nút convert.
- Ticket **không** yêu cầu `PTT_BDS_PACK` (platform). Auto cọc chỉ chạy khi TICKETS=1 **và** `convertDeposit` thành công.
- GET/POST ngoài scope hoặc tenant `broker` = **404**, không 403, không PII (BR-BDS-05; BDS-44; UC-060 E1).
- `kind=cross` bắt buộc `assignee_dept_code` ≠ `requester_dept_code` (BR-BDS-42 / BDS-45).
- Gán `assignee_staff_id` phải thuộc `assignee_dept` (BDS-46).
- `done` kiểm `close_requires` (BR-BDS-44). `hdmb_gate_*` **không** `done` tay — chỉ hệ thống khi TX `contracted`/`cancelled` (P12b hook; v1 transition → 400 `system_only`).
- After-sales `defect`/`title` **không** ghi `crm_staff_tickets` (BR-BDS-46).
- Ticket **không** thay inbox hold / phiếu thu / cổng HĐMB.
- `staff_id` = `parseNumericStaffSub(jwt.sub)` — INTEGER, **không** FK `staff_users` (UUID).
- `department_id` INTEGER **không** FK `crm_departments` (prod VPS có thể chưa có bảng — bài học P11). Queue lưu `assignee_dept_code` TEXT.
- Header tenant: `x-bds-tenant`.
- `StaffTicketModule` **không** import `BdsModule`. Hook từ BĐS → tickets. Không import `TicketsModule` (khách) / `ReProjectsModule`.
- Tiếng Việt UI: Việc · Của tôi · Queue ban · Inbound · Outbound · Hồ sơ ẩn. Không «Jira / sprint».
- `DATABASE_URL` script: `postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb`.
- Test API: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand`.
- Test FE: `cd services/ops-web && ./node_modules/.bin/vitest run <file>`.
- Không commit trừ khi user yêu cầu.
- Prod VPS: **không** bật `PTT_STAFF_TICKETS` / `NEXT_PUBLIC_PTT_STAFF_TICKETS`.

---

## 0. Phạm vi / ngoài phạm vi

**Làm**

- Flag `isStaffTicketsEnabled()` + `StaffTicketGuard` + `NEXT_PUBLIC_PTT_STAFF_TICKETS`
- Cap `staff_tickets` view/create/assign/close/export (catalog + stub khi TICKETS=1)
- DDL 5 bảng `crm_staff_ticket_*` + counter số `T-n`
- Seed 15 queue (gồm `hdmb_gate_legal` + `hdmb_gate_paid`) idempotent theo `tenant_id` + `code`
- `GET/POST /tickets` · `GET/PATCH /tickets/:id` · `POST .../assign` · `POST .../transition` · `POST .../watch` · `GET /queues` · `GET /board`
- Tạo `dept` (`dept_backlog` hoặc queue ban) và `cross` (queue seed)
- Claim self / assign trong ban; transition máy §29.4
- `close_requires`: `installments_exist` (BDS-47), `system_only` (`hdmb_gate_*`), `comment_min` (`ops_action`)
- Auto-create cọc → `collection_schedule` (BDS-48), idempotent `(entity_type, entity_id, queue_code)` khi status `open|in_progress`
- UC-054: POST ticket từ chat (`room_id` + body tin)
- Job cron 5 phút: `sla_due_at` quá → `sla_breached` + event `sla_breach` (escalate watcher trưởng nếu resolve được — không fail nếu không có HR)
- Page + nav «Việc» **chỉ CĐT/hybrid** (sàn 404 API; không nav)
- Poll board 5s khi mở `/crm/work`

**Không làm**

- Auto-create lead / hold F1 / VBTT / `hdmb_gate_*` / legal / milestone / handover / commission / launch `ops_action` (P12b; cùng pattern hook)
- Họp T2 tạo `ops_action` hàng loạt
- Nút «Tạo ticket» trên trang hold/TX (P12b)
- `GET /export` CSV
- SSE
- Push/chuông UC-002
- Comment UI đầy đủ ngoài 1 ô đóng `ops_action` (API comment có thể có cho `comment_min`)
- Gắn `room_id` case/project mới (chỉ nhận `room_id` từ chat có sẵn)
- Voice/video / Jira / `/crm/tickets` khách

---

## 1. File map

```
docs/specs/postgresql-ddl-bds-p12.sql
scripts/apply_pg_ddl_bds_p12.sh

services/ptt-crm-api/src/staff-tickets/staff-ticket.flags.ts
services/ptt-crm-api/src/staff-tickets/staff-ticket.flags.spec.ts
services/ptt-crm-api/src/staff-tickets/staff-ticket.guard.ts
services/ptt-crm-api/src/staff-tickets/staff-ticket.guard.spec.ts
services/ptt-crm-api/src/staff-tickets/staff-ticket.types.ts
services/ptt-crm-api/src/staff-tickets/staff-ticket.util.ts
services/ptt-crm-api/src/staff-tickets/staff-ticket.util.spec.ts
services/ptt-crm-api/src/staff-tickets/staff-ticket.caps.ts
services/ptt-crm-api/src/staff-tickets/staff-ticket.repository.ts
services/ptt-crm-api/src/staff-tickets/staff-ticket.service.ts
services/ptt-crm-api/src/staff-tickets/staff-ticket.service.spec.ts
services/ptt-crm-api/src/staff-tickets/staff-ticket.controller.ts
services/ptt-crm-api/src/staff-tickets/staff-ticket.controller.spec.ts
services/ptt-crm-api/src/staff-tickets/staff-ticket.sla.job.ts
services/ptt-crm-api/src/staff-tickets/staff-ticket.module.ts
services/ptt-crm-api/src/config/app-config.service.ts             # staffTicketsEnabled
services/ptt-crm-api/src/staff-auth/staff-auth.service.ts         # + STAFF_TICKET_CAP_CATALOG
services/ptt-crm-api/src/app.module.ts                            # import StaffTicketModule
services/ptt-crm-api/src/bds/bds.module.ts                        # imports: [StaffTicketModule]
services/ptt-crm-api/src/bds/transactions/bds-tx.service.ts        # BDS-48
services/ptt-crm-api/src/bds/transactions/bds-tx.service.spec.ts

services/ops-web/src/lib/staff-tickets/flags.ts
services/ops-web/src/lib/staff-tickets/flags.spec.ts
services/ops-web/src/lib/staff-tickets/api.ts
services/ops-web/src/lib/bds/nav.ts                               # + Việc (CĐT/hybrid)
services/ops-web/src/lib/bds/nav.spec.ts
services/ops-web/src/components/layout/nav-icons.tsx
services/ops-web/src/app/crm/work/page.tsx
services/ops-web/src/app/crm/chat/page.tsx                        # nút convert nếu TICKETS FE

docs/superpowers/plans/2026-08-22-bds-coding-roadmap.md
```

Khóa flag: `staff-ticket.flags.ts` gọi `envFlagOn(process.env.PTT_STAFF_TICKETS)` — không phụ thuộc PACK/CHAT.

---

### Task 1: Flag + util transition / close_requires + caps

**Files:**
- Create: `services/ptt-crm-api/src/staff-tickets/staff-ticket.flags.ts`
- Create: `services/ptt-crm-api/src/staff-tickets/staff-ticket.flags.spec.ts`
- Create: `services/ptt-crm-api/src/staff-tickets/staff-ticket.guard.ts`
- Create: `services/ptt-crm-api/src/staff-tickets/staff-ticket.guard.spec.ts`
- Create: `services/ptt-crm-api/src/staff-tickets/staff-ticket.types.ts`
- Create: `services/ptt-crm-api/src/staff-tickets/staff-ticket.util.ts`
- Create: `services/ptt-crm-api/src/staff-tickets/staff-ticket.util.spec.ts`
- Create: `services/ptt-crm-api/src/staff-tickets/staff-ticket.caps.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts`
- Modify: `services/ptt-crm-api/src/staff-auth/staff-auth.service.ts`

**Interfaces:**
- Consumes: `envFlagOn` từ `../bds/bds.flags`
- Produces: `isStaffTicketsEnabled()`, `canTransition()`, `QUEUE_SEEDS`, `isRestrictedQueue()`

- [ ] **Step 1: Write failing tests**

`staff-ticket.flags.spec.ts` — restore `PTT_STAFF_TICKETS` trong `afterEach`:

```ts
it('defaults TICKETS off when unset', () => {
  delete process.env.PTT_STAFF_TICKETS;
  expect(isStaffTicketsEnabled()).toBe(false);
});

it('TICKETS on for 1', () => {
  process.env.PTT_STAFF_TICKETS = '1';
  expect(isStaffTicketsEnabled()).toBe(true);
});
```

`staff-ticket.guard.spec.ts` — copy `staff-chat.guard.spec.ts`: TICKETS off → 404; on → true. **Không** check PACK.

`staff-ticket.util.spec.ts`:

```ts
import { canTransition, isRestrictedQueue } from './staff-ticket.util';

describe('staff-ticket.util', () => {
  it('open → in_progress and cancelled', () => {
    expect(canTransition('open', 'in_progress')).toBe(true);
    expect(canTransition('open', 'cancelled')).toBe(true);
    expect(canTransition('open', 'done')).toBe(false);
  });

  it('in_progress → done | blocked | waiting', () => {
    expect(canTransition('in_progress', 'done')).toBe(true);
    expect(canTransition('in_progress', 'blocked')).toBe(true);
    expect(canTransition('blocked', 'in_progress')).toBe(true);
    expect(canTransition('done', 'open')).toBe(false);
  });

  it('restricted queue codes', () => {
    expect(isRestrictedQueue('hdmb_gate_legal')).toBe(true);
    expect(isRestrictedQueue('collection_schedule')).toBe(true);
    expect(isRestrictedQueue('dept_backlog')).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/staff-tickets --runInBand`

Expected: FAIL — files missing.

- [ ] **Step 3: Minimal implementation**

```ts
// staff-ticket.flags.ts
import { envFlagOn } from '../bds/bds.flags';
export function isStaffTicketsEnabled(): boolean {
  return envFlagOn(process.env.PTT_STAFF_TICKETS);
}
```

`app-config.service.ts` cạnh `staffChatEnabled`:

```ts
readonly staffTicketsEnabled: boolean;
this.staffTicketsEnabled = ['1', 'true', 'yes', 'on'].includes(
  (process.env.PTT_STAFF_TICKETS ?? '0').trim().toLowerCase(),
);
```

`staff-ticket.types.ts` — khóa:

```ts
export type TicketKind = 'dept' | 'cross';
export type TicketStatus = 'open' | 'in_progress' | 'blocked' | 'waiting' | 'done' | 'cancelled';
export type TicketPriority = 'p0' | 'p1' | 'p2' | 'p3';

export type CloseRequires =
  | { type: 'none' }
  | { type: 'installments_exist' }
  | { type: 'system_only' }
  | { type: 'comment_min'; min: number };

export type QueueSeed = {
  code: string;
  name: string;
  kind_default: TicketKind;
  assignee_dept_code: string | null;
  sla_minutes: number | null;
  sla_pauses_on_waiting: boolean;
  close_requires: CloseRequires;
  sensitivity: 'normal' | 'restricted';
};

export const QUEUE_SEEDS: readonly QueueSeed[] = [
  { code: 'cskh_first_touch', name: 'Chạm lead lần đầu', kind_default: 'cross', assignee_dept_code: 'ban_cskh_presales', sla_minutes: 15, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'normal' },
  { code: 'visit_book', name: 'Đặt lịch thăm', kind_default: 'cross', assignee_dept_code: 'ban_kd', sla_minutes: 48 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'normal' },
  { code: 'hold_f1_approve', name: 'Duyệt hold F1', kind_default: 'cross', assignee_dept_code: 'ban_kd', sla_minutes: 8 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'normal' },
  { code: 'collection_schedule', name: 'Lập lịch công nợ', kind_default: 'cross', assignee_dept_code: 'ban_tc_collection', sla_minutes: 4 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'installments_exist' }, sensitivity: 'restricted' },
  { code: 'vbtt_check', name: 'Checklist VBTT', kind_default: 'cross', assignee_dept_code: 'ban_phap_che', sla_minutes: 4 * 60, sla_pauses_on_waiting: true, close_requires: { type: 'none' }, sensitivity: 'restricted' },
  { code: 'hdmb_gate_legal', name: 'Cổng HĐMB — PC', kind_default: 'cross', assignee_dept_code: 'ban_phap_che', sla_minutes: 24 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'system_only' }, sensitivity: 'restricted' },
  { code: 'hdmb_gate_paid', name: 'Cổng HĐMB — Công nợ', kind_default: 'cross', assignee_dept_code: 'ban_tc_collection', sla_minutes: 24 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'system_only' }, sensitivity: 'restricted' },
  { code: 'legal_gate_phase', name: 'Cổng pháp lý đợt', kind_default: 'cross', assignee_dept_code: 'ban_phap_che', sla_minutes: 24 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'restricted' },
  { code: 'milestone_unlock', name: 'Mốc mở khóa', kind_default: 'cross', assignee_dept_code: 'ban_tc_collection', sla_minutes: 24 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'restricted' },
  { code: 'handover_book', name: 'Hẹn bàn giao', kind_default: 'cross', assignee_dept_code: 'ban_cskh_after', sla_minutes: 15 * 24 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'normal' },
  { code: 'commission_period', name: 'Bảng kê HH', kind_default: 'cross', assignee_dept_code: 'ban_tc_hh', sla_minutes: 3 * 24 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'restricted' },
  { code: 'claim_review', name: 'Duyệt claim MKT', kind_default: 'cross', assignee_dept_code: 'ban_phap_che', sla_minutes: 2 * 24 * 60, sla_pauses_on_waiting: true, close_requires: { type: 'none' }, sensitivity: 'restricted' },
  { code: 'basket_materialize', name: 'Materialize giỏ', kind_default: 'cross', assignee_dept_code: 'ban_san_pham', sla_minutes: 24 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'normal' },
  { code: 'ops_action', name: 'Việc họp / ops', kind_default: 'dept', assignee_dept_code: null, sla_minutes: 5 * 24 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'comment_min', min: 10 }, sensitivity: 'normal' },
  { code: 'dept_backlog', name: 'Backlog ban', kind_default: 'dept', assignee_dept_code: null, sla_minutes: null, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'normal' },
];
```

`TicketRow` / `QueueRow` / `CreateTicketBody` khai báo cùng file (id string, staff_id number, dept_code string | null).

`staff-ticket.util.ts`:

```ts
const EDGES: Record<string, readonly string[]> = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['done', 'blocked', 'waiting', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  waiting: ['in_progress', 'cancelled'],
  done: [],
  cancelled: [],
};

export function canTransition(from: string, to: string): boolean {
  return (EDGES[from] ?? []).includes(to);
}

export function isRestrictedQueue(code: string): boolean {
  return [
    'collection_schedule', 'vbtt_check', 'hdmb_gate_legal', 'hdmb_gate_paid',
    'legal_gate_phase', 'milestone_unlock', 'commission_period', 'claim_review',
  ].includes(code);
}
```

`staff-ticket.caps.ts`:

```ts
export const STAFF_TICKET_CAP_CATALOG = [
  { section: 'staff_tickets', action: 'view' },
  { section: 'staff_tickets', action: 'create' },
  { section: 'staff_tickets', action: 'assign' },
  { section: 'staff_tickets', action: 'close' },
  { section: 'staff_tickets', action: 'export' },
] as const;
```

`stubCapsFallback`: nếu `isStaffTicketsEnabled()` thì `caps.push(...STAFF_TICKET_CAP_CATALOG)` cạnh CHAT.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu.

---

### Task 2: DDL P12 + apply script

**Files:**
- Create: `docs/specs/postgresql-ddl-bds-p12.sql`
- Create: `scripts/apply_pg_ddl_bds_p12.sh`

**Interfaces:**
- Consumes: `bds_tenants`
- Produces: queues / tickets / events / watchers / comments / counters

- [ ] **Step 1: Write SQL**

Không FK `staff_users` / `crm_departments`. `tenant_id` REFERENCES `bds_tenants`. `room_id` UUID không FK (chat có thể off).

```sql
-- Pack BĐS P12 / platform staff-tickets — Apply: scripts/apply_pg_ddl_bds_p12.sh
BEGIN;

CREATE TABLE IF NOT EXISTS crm_staff_ticket_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES bds_tenants (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  kind_default TEXT NOT NULL CHECK (kind_default IN ('dept', 'cross')),
  assignee_dept_code TEXT,
  assignee_dept_id INTEGER,
  sla_minutes INTEGER,
  sla_pauses_on_waiting BOOLEAN NOT NULL DEFAULT FALSE,
  close_requires JSONB NOT NULL DEFAULT '{"type":"none"}'::jsonb,
  sensitivity TEXT NOT NULL DEFAULT 'normal'
    CHECK (sensitivity IN ('normal', 'restricted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS crm_staff_ticket_counters (
  tenant_id UUID PRIMARY KEY REFERENCES bds_tenants (id) ON DELETE CASCADE,
  last_n INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crm_staff_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES bds_tenants (id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('dept', 'cross')),
  queue_code TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'blocked', 'waiting', 'done', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'p2'
    CHECK (priority IN ('p0', 'p1', 'p2', 'p3')),
  requester_staff_id INTEGER NOT NULL,
  requester_dept_code TEXT,
  assignee_staff_id INTEGER,
  assignee_dept_code TEXT,
  project_id INTEGER,
  entity_type TEXT,
  entity_id TEXT,
  room_id UUID,
  parent_id UUID,
  sla_due_at TIMESTAMPTZ,
  sla_breached BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_reason TEXT NOT NULL DEFAULT '',
  waiting_on TEXT NOT NULL DEFAULT '',
  completed_at TIMESTAMPTZ,
  cancelled_reason TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, number)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_staff_tickets_open_entity
  ON crm_staff_tickets (tenant_id, entity_type, entity_id, queue_code)
  WHERE entity_id IS NOT NULL AND status IN ('open', 'in_progress');

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_staff_tickets_idem
  ON crm_staff_tickets (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_staff_tickets_tenant_status
  ON crm_staff_tickets (tenant_id, status, sla_due_at);

CREATE TABLE IF NOT EXISTS crm_staff_ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES crm_staff_tickets (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  actor_staff_id INTEGER,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_staff_ticket_watchers (
  ticket_id UUID NOT NULL REFERENCES crm_staff_tickets (id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL,
  PRIMARY KEY (ticket_id, staff_id)
);

CREATE TABLE IF NOT EXISTS crm_staff_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES crm_staff_tickets (id) ON DELETE CASCADE,
  author_staff_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
```

`scripts/apply_pg_ddl_bds_p12.sh` — copy P11, đổi `p11` → `p12`.

- [ ] **Step 2: Apply local nếu PG :5433 chạy**

Run: `DATABASE_URL=postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb bash scripts/apply_pg_ddl_bds_p12.sh`

Expected: `OK  bds P12 DDL`. Nếu PG tắt: không chặn Task 3.

- [ ] **Step 3: Commit** — chỉ khi user yêu cầu.

---

### Task 3: Repository

**Files:**
- Create: `services/ptt-crm-api/src/staff-tickets/staff-ticket.repository.ts`

**Interfaces:**
- Produces (Pool + map giống `staff-chat.repository.ts`):

```ts
upsertQueue(input: QueueSeed & { tenant_id: string }): Promise<QueueRow>
listQueues(tenantId: string): Promise<QueueRow[]>
getQueue(tenantId: string, code: string): Promise<QueueRow | null>

nextNumber(tenantId: string): Promise<string>  // UPDATE counters SET last_n = last_n+1 RETURNING last_n → `T-${n}`

insertTicket(row): Promise<TicketRow>
getById(id: string): Promise<TicketRow | null>
getOpenByEntity(tenantId, entityType, entityId, queueCode): Promise<TicketRow | null>
listTickets(tenantId, filter: {
  inbox?: 'mine' | 'dept_queue' | 'inbound' | 'outbound';
  staffId: number;
  deptCode: string | null;
  queue?: string;
  overdue?: boolean;
  projectId?: number;
}): Promise<TicketRow[]>
updateTicket(id, patch): Promise<TicketRow | null>
insertEvent(ticketId, kind, actorStaffId, payload): Promise<void>
addWatcher(ticketId, staffId): Promise<void>
listWatchers(ticketId): Promise<number[]>
insertComment(ticketId, staffId, body): Promise<void>
latestCommentLen(ticketId): Promise<number>
countInstallments(txId: string): Promise<number>
  // SELECT COUNT(*) FROM bds_payment_installments WHERE transaction_id = $1
  // table missing → 0 (không 500)
getStaffDepartmentCode(staffId: number): Promise<string | null>
  // copy SQL staff-chat.repository (crm_staff + positions)
listStaffIdsByDepartmentCodes(codes: string[]): Promise<number[]>
markSlaBreachedDue(now: Date): Promise<TicketRow[]>
```

`listTickets` **không** trả ticket tenant khác — gốc BDS-44 khi service chặn broker trước.

- [ ] **Step 1:** Không bắt buộc test repo (mock ở service).

- [ ] **Step 2: Commit** — chỉ khi user yêu cầu.

---

### Task 4: Service create / list / scope — BDS-44/45/46

**Files:**
- Create: `services/ptt-crm-api/src/staff-tickets/staff-ticket.service.ts`
- Create: `services/ptt-crm-api/src/staff-tickets/staff-ticket.service.spec.ts`

**Interfaces:**
- Consumes: `StaffTicketRepository`, optional `{ getMe(id): Promise<{ mode: string }> }`
- Produces: `ensureSeeded`, `listQueues`, `listTickets`, `getTicket`, `createTicket`, `assign`, `transition`, `watch`, `createHandoffTicket`

- [ ] **Step 1: Write failing service tests**

```ts
describe('StaffTicketService', () => {
  const repo = {
    upsertQueue: jest.fn(),
    listQueues: jest.fn().mockResolvedValue([]),
    getQueue: jest.fn(),
    nextNumber: jest.fn().mockResolvedValue('T-1'),
    insertTicket: jest.fn(),
    getById: jest.fn(),
    getOpenByEntity: jest.fn().mockResolvedValue(null),
    listTickets: jest.fn(),
    updateTicket: jest.fn(),
    insertEvent: jest.fn(),
    addWatcher: jest.fn(),
    listWatchers: jest.fn().mockResolvedValue([]),
    insertComment: jest.fn(),
    latestCommentLen: jest.fn().mockResolvedValue(0),
    countInstallments: jest.fn().mockResolvedValue(0),
    getStaffDepartmentCode: jest.fn().mockResolvedValue('ban_kd'),
    listStaffIdsByDepartmentCodes: jest.fn().mockResolvedValue([]),
    markSlaBreachedDue: jest.fn().mockResolvedValue([]),
  };
  const tenants = { getMe: jest.fn().mockResolvedValue({ mode: 'developer', id: 't1' }) };
  let svc: StaffTicketService;

  beforeEach(() => {
    jest.clearAllMocks();
    tenants.getMe.mockResolvedValue({ mode: 'developer', id: 't1' });
    repo.getStaffDepartmentCode.mockResolvedValue('ban_kd');
    svc = new StaffTicketService(repo as never, tenants as never);
  });

  it('BDS-44: broker listTickets → 404', async () => {
    tenants.getMe.mockResolvedValue({ mode: 'broker' });
    await expect(svc.listTickets(7, 't1', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('BDS-45: cross same dept → 400', async () => {
    repo.getQueue.mockResolvedValue({
      code: 'dept_backlog', kind_default: 'dept', assignee_dept_code: null,
    });
    await expect(
      svc.createTicket(7, 't1', { kind: 'cross', queue_code: 'dept_backlog', title: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('BDS-46: assign staff outside assignee_dept → 400', async () => {
    repo.getById.mockResolvedValue({
      id: 'tk1', tenant_id: 't1', status: 'open', assignee_dept_code: 'ban_tc_collection',
    });
    repo.getStaffDepartmentCode.mockResolvedValueOnce('ban_tc_collection'); // actor trưởng
    repo.getStaffDepartmentCode.mockResolvedValueOnce('ban_kenh'); // target
    await expect(svc.assign('tk1', 1, { staff_id: 99 }, 't1')).rejects.toMatchObject({
      response: { error: 'assignee_dept' },
    });
  });
});
```

Sai `tenant_id` trên row → 404.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

`assertDeveloper(tenantId)`: `getMe.mode === 'broker'` → 404. Thiếu tenants → coi như developer (test inject mock).

`ensureSeeded`: với mỗi `QUEUE_SEEDS` `upsertQueue`. Không 500 nếu `assignee_dept_id` null.

`createTicket`:

- `kind=dept`: queue `dept_backlog` hoặc queue `kind_default=dept`; `assignee_dept_code` = requester dept (từ `getStaffDepartmentCode`).
- `kind=cross`: queue seed `kind_default=cross`; `assignee_dept_code` từ queue; nếu bằng requester → 400 `{ error: 'assignee_dept' }` (BDS-45).
- title trim ≥ 1 else 400 `{ error: 'title' }`.
- `sla_due_at` = now + `sla_minutes` nếu không null.
- Watcher: requester. Number `T-n`.
- `Idempotency-Key` → trả ticket cũ nếu trùng.

`listTickets` / `getTicket`: broker 404; ticket khác tenant 404. Restricted queue + staff dept ≠ assignee_dept → `body` = `''`, flag `hidden: true` (giống BDS-42).

`assign`: target `getStaffDepartmentCode` phải = `assignee_dept_code` else 400 `assignee_dept`. Self-claim: staff dept = assignee dept. Actor không cùng ban và không `canAssign` (truyền `opts.canAssign` từ controller) → 404.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu.

---

### Task 5: Transition + close_requires BDS-47 + SLA job

**Files:**
- Modify: `staff-ticket.service.ts` + spec
- Create: `staff-ticket.sla.job.ts`

**Interfaces:**
- Produces: `transition(id, staffId, { to, reason?, comment? }, tenantId, opts?: { system?: boolean })`, `markSlaBreaches(now)`

- [ ] **Step 1: Tests**

```ts
  it('BDS-47: done collection_schedule without installment → 400 artifact', async () => {
    repo.getById.mockResolvedValue({
      id: 'tk1', tenant_id: 't1', status: 'in_progress',
      queue_code: 'collection_schedule', entity_type: 'tx', entity_id: 'tx1',
    });
    repo.getQueue.mockResolvedValue({
      code: 'collection_schedule',
      close_requires: { type: 'installments_exist' },
    });
    repo.countInstallments.mockResolvedValue(0);
    await expect(
      svc.transition('tk1', 7, { to: 'done' }, 't1'),
    ).rejects.toMatchObject({ response: { error: 'artifact' } });
  });

  it('hdmb_gate cannot done by staff', async () => {
    repo.getById.mockResolvedValue({
      id: 'tk1', tenant_id: 't1', status: 'in_progress', queue_code: 'hdmb_gate_legal',
    });
    repo.getQueue.mockResolvedValue({
      close_requires: { type: 'system_only' },
    });
    await expect(svc.transition('tk1', 7, { to: 'done' }, 't1')).rejects.toMatchObject({
      response: { error: 'system_only' },
    });
  });
```

- [ ] **Step 2: Implement `transition`**

`canTransition` else 409 `{ error: 'status' }`.  
`to=done`: đọc `close_requires` của queue:

- `installments_exist`: `countInstallments(entity_id) < 1` → 400 `artifact`
- `system_only`: `opts.system !== true` → 400 `system_only`
- `comment_min`: `latestCommentLen` < min (hoặc `body.comment` vừa insert) → 400 `artifact`

`to=blocked` cần `reason` trim ≥ 1 else 400 `{ error: 'reason' }`.

Event `transition`. `done` set `completed_at`.

`markSlaBreaches`: `repo.markSlaBreachedDue` + event `sla_breach` từng row. Job:

```ts
@Cron('*/5 * * * *')
async tick() {
  if (!isStaffTicketsEnabled()) return;
  await this.tickets.markSlaBreaches(new Date());
}
```

Đăng ký job trong `StaffTicketModule` providers.

- [ ] **Step 3: Run service spec — PASS**

- [ ] **Step 4: Commit** — chỉ khi user yêu cầu.

---

### Task 6: Auto-create BDS-48 + convert chat

**Files:**
- Modify: `staff-ticket.service.ts` + spec
- Modify: `bds-tx.service.ts` + spec

**Interfaces:**

```ts
createHandoffTicket(tenantId: string, input: {
  queue_code: string;
  title: string;
  body: string;
  entity_type: string;
  entity_id: string;
  requester_staff_id?: number | null;
  requester_dept_code?: string | null;
}): Promise<TicketRow | null>
```

- [ ] **Step 1: Chat/service tests**

```ts
  it('createHandoffTicket is idempotent on open entity+queue', async () => {
    repo.getQueue.mockResolvedValue({ code: 'collection_schedule', sla_minutes: 240, assignee_dept_code: 'ban_tc_collection' });
    repo.getOpenByEntity.mockResolvedValue({ id: 'tk1', queue_code: 'collection_schedule' });
    const out = await svc.createHandoffTicket('t1', {
      queue_code: 'collection_schedule', title: 'Cọc', body: '', entity_type: 'tx', entity_id: 'tx1',
    });
    expect(out?.id).toBe('tk1');
    expect(repo.insertTicket).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: TX hook**

`BdsTxService` constructor thêm `@Optional() private readonly tickets?: StaffTicketService | null` **sau** `chat` (không phá test positional hiện có: 9 args = chat, 10 = tickets).

Sau hook chat (đã có), nếu `isStaffTicketsEnabled()`:

```ts
try {
  await this.tickets?.createHandoffTicket(String(tx.tenant_id ?? opts.tenantId ?? ''), {
    queue_code: 'collection_schedule',
    title: `Cọc TX ${String(tx.id).slice(0, 8)} — lập lịch 4h`,
    body: `Cọc TX ${tx.id}`,
    entity_type: 'tx',
    entity_id: tx.id,
    requester_dept_code: 'ban_kd',
  });
} catch (err) {
  this.logger.warn(`handoff ticket deposit tx=${tx.id}: ${String(err)}`);
}
```

Không fail convert nếu tickets lỗi. `createHandoffTicket` gọi `ensureSeeded` rồi `getOpenByEntity` / insert. Không queue → log + null.

Test:

```ts
it('BDS-48 creates collection_schedule ticket on deposit when TICKETS on', async () => {
  process.env.PTT_STAFF_TICKETS = '1';
  const tickets = { createHandoffTicket: jest.fn().mockResolvedValue({ id: 'tk1' }) };
  // ... same convertDeposit mocks as BDS-41 ...
  const svc = new BdsTxService(
    repo, holds, inventory, products, policies, collection,
    undefined, undefined, undefined, tickets as never,
  );
  await svc.convertDeposit(...);
  expect(tickets.createHandoffTicket).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ queue_code: 'collection_schedule', entity_type: 'tx' }),
  );
});
```

Restore `PTT_STAFF_TICKETS` trong `afterEach` tx spec (cạnh `PTT_STAFF_CHAT`).

CHAT=0 + TICKETS=0: convert P4 **không** đổi.

- [ ] **Step 3: Run**

`cd services/ptt-crm-api && ./node_modules/.bin/jest src/staff-tickets src/bds/transactions/bds-tx.service.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 4: Commit** — chỉ khi user yêu cầu.

---

### Task 7: Controller + module

**Files:**
- Create: `staff-ticket.controller.ts` + spec
- Create: `staff-ticket.module.ts`
- Modify: `app.module.ts`, `bds.module.ts`

**Interfaces:**
- Guards: `StaffOrInternalKeyGuard`, `StaffTicketGuard`
- `staff_id` từ `parseNumericStaffSub(req.staffUser.sub)` — thiếu → 404

| Method | Path | Body / query | Lỗi |
|--------|------|----------------|-----|
| GET | `/api/v1/staff-tickets/queues` | | 404 flag/broker |
| GET | `/api/v1/staff-tickets/tickets` | `?inbox=&queue=&overdue=&project_id=` | 404 |
| POST | `/api/v1/staff-tickets/tickets` | `{ kind, queue_code, title, body?, room_id?, entity_type?, entity_id?, priority? }` | 400 |
| GET | `/api/v1/staff-tickets/tickets/:id` | | 404 |
| PATCH | `/api/v1/staff-tickets/tickets/:id` | `{ title?, body?, priority? }` | 404 |
| POST | `/api/v1/staff-tickets/tickets/:id/assign` | `{ staff_id? }` (omit = self-claim) | 400 `assignee_dept` |
| POST | `/api/v1/staff-tickets/tickets/:id/transition` | `{ to, reason?, comment? }` | 400 `artifact` |
| POST | `/api/v1/staff-tickets/tickets/:id/watch` | | 404 |
| GET | `/api/v1/staff-tickets/board` | `?inbox=` | 404 |

`Idempotency-Key` trên POST create.

Controller spec:

```ts
it('create delegates tenant + staff', async () => {
  const svc = { createTicket: jest.fn().mockResolvedValue({ id: 'tk1' }) };
  const staffAuth = { hasCapForPosition: jest.fn() };
  const ctl = new StaffTicketController(svc as never, staffAuth as never);
  await ctl.create({ kind: 'dept', queue_code: 'dept_backlog', title: 'hi' }, 't1', {
    staffUser: { sub: '7', position_id: 1 },
  } as never);
  expect(svc.createTicket).toHaveBeenCalledWith(
    7, 't1', expect.objectContaining({ title: 'hi' }),
  );
});
```

`StaffTicketModule`: `imports: [StaffAuthModule]`, `exports: [StaffTicketService]`.  
`BdsModule` `imports: [..., StaffTicketModule]` (đã có `StaffChatModule`).  
`AppModule` import `StaffTicketModule`.

- [ ] **Step 1–3:** implement + jest `src/staff-tickets src/bds/transactions/bds-tx.service.spec.ts`

- [ ] **Step 4: Commit** — chỉ khi user yêu cầu.

---

### Task 8: UI `/crm/work` + nav + convert chat + roadmap

**Files:**
- Create: `services/ops-web/src/lib/staff-tickets/flags.ts` (+ spec)
- Create: `services/ops-web/src/lib/staff-tickets/api.ts`
- Modify: `nav.ts` + `nav.spec.ts` + `nav-icons.tsx`
- Create: `services/ops-web/src/app/crm/work/page.tsx`
- Modify: `services/ops-web/src/app/crm/chat/page.tsx`
- Modify: roadmap

**Interfaces:**
- FE flag: `isStaffTicketsFeEnabled()` = `NEXT_PUBLIC_PTT_STAFF_TICKETS` (copy 8 dòng `staff-chat/flags.ts`).

- [ ] **Step 1: Nav tests**

```ts
it('CĐT with staff_tickets view shows Việc when FE flag on', () => {
  process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
  process.env.NEXT_PUBLIC_PTT_STAFF_TICKETS = '1';
  const links =
    buildBdsNavSections(
      user([
        { section: 'bds_tenant', action: 'view' },
        { section: 'staff_tickets', action: 'view' },
      ]),
      'developer',
    )[0]?.links ?? [];
  expect(links.some((l) => l.href === '/crm/work' && l.label === 'Việc')).toBe(true);
});

it('broker never shows Việc even with cap + FE flag', () => {
  process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
  process.env.NEXT_PUBLIC_PTT_STAFF_TICKETS = '1';
  const links =
    buildBdsNavSections(
      user([
        { section: 'bds_tenant', action: 'view' },
        { section: 'staff_tickets', action: 'view' },
      ]),
      'broker',
    )[0]?.links ?? [];
  expect(links.some((l) => l.href === '/crm/work')).toBe(false);
});
```

`buildDeveloperLinks` (và hybrid) cuối list, **sau** Chat:

```ts
if (isStaffTicketsFeEnabled() && hasCap(user, 'staff_tickets', 'view')) {
  links.push({ href: '/crm/work', label: 'Việc' });
}
```

**Không** thêm vào `buildBrokerLinks`.

`nav-icons.tsx`: `'/crm/work': 'ticket'` (icon `ticket` đã có cho `/crm/tickets`).

Restore `NEXT_PUBLIC_PTT_STAFF_TICKETS` trong `nav.spec.ts` `afterEach`.

- [ ] **Step 2: API helpers**

Copy header `Authorization` + `x-bds-tenant` từ `lib/staff-chat/api.ts` (nhân bản, không import `bdsMutate`).

```ts
export type WorkTicket = {
  id: string;
  number: string;
  kind: 'dept' | 'cross';
  queue_code: string;
  title: string;
  body: string;
  hidden?: boolean;
  status: string;
  priority: string;
  sla_due_at: string | null;
  sla_breached: boolean;
};

export async function fetchWorkTickets(token: string, inbox: string): Promise<WorkTicket[]>
export async function fetchWorkQueues(token: string)
export function postWorkTicket(token, body)
export function postWorkTransition(token, id, to, extra?)
export function postWorkAssign(token, id, staffId?)
```

- [ ] **Step 3: Page** `app/crm/work/page.tsx`

Auth: **không** `useBdsPageAuth`. Copy `crm/chat/page.tsx` (staff session). `!isStaffTicketsFeEnabled()` hoặc API 404 → «Việc nội bộ chưa bật».

4 tab inbox: Của tôi · Queue ban · Inbound · Outbound.  
List: number, title, queue, SLA (đỏ nếu `sla_breached` hoặc quá hạn).  
Chi tiết: status + nút Claim / `in_progress` / `done` (`staff_tickets.assign` / `close`). Toast `artifact` / `system_only`.  
`hidden` → «Hồ sơ ẩn».  
Poll `fetchWorkTickets` 5000ms.  
Không trộn `/crm/tickets`. Không nút defect after-sales.

Chat page: nếu `isStaffTicketsFeEnabled() && hasCap(staff_tickets, create)` và room chọn + tin chọn (hoặc tin cuối): nút «Chuyển thành ticket» → `postWorkTicket({ kind: 'cross' | 'dept', queue_code: 'dept_backlog' hoặc 'ops_action', title: slice body, body, room_id })`. Không hiện khi TICKETS=0.

- [ ] **Step 4: Roadmap**

Bảng pha: P12 → `[bds-p12-staff-tickets.md](./2026-08-22-bds-p12-staff-tickets.md)` · BDS-44.  
§3 P12: queues §29.3 / card+ticket cọc / convert chat / flag `PTT_STAFF_TICKETS`.  
§4 hàng 18: `PTT_STAFF_TICKETS | mặc định 0; queue việc + artifact. Bật khi P0 org + P8 nav. Không bật prod.`

- [ ] **Step 5: Verify**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/staff-tickets src/staff-chat src/bds --runInBand
cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds src/lib/staff-chat src/lib/staff-tickets
cd services/ptt-crm-api && npm run build
cd services/ops-web && npm run build
```

Expected: Jest xanh; Vitest xanh; 2 build exit 0.

- [ ] **Step 6: Commit** — chỉ khi user yêu cầu.

---

## 4. Definition of Done

- [ ] BDS-44: sàn GET tickets → **404**
- [ ] BDS-45: cross cùng ban → **400**
- [ ] BDS-46: gán ngoài `assignee_dept` → **400**
- [ ] BDS-47: `done` `collection_schedule` không installment → **400 `artifact`**
- [ ] BDS-48: `convertDeposit` + TICKETS=1 → ticket `collection_schedule` (trùng → không tạo mới)
- [ ] TICKETS=0: route **404**; convert/launch/chat P4/P10/P11 **không** đổi
- [ ] Seed 15 queue idempotent
- [ ] `hdmb_gate_*` staff `done` → 400 `system_only`
- [ ] Nav CĐT «Việc»; sàn **không** có
- [ ] Chat: nút convert chỉ khi FE TICKETS=1
- [ ] Poll 5s, không SSE
- [ ] After-sales defect **0** row `crm_staff_tickets`
- [ ] Prod không bật `PTT_STAFF_TICKETS`

---

## 5. Rollback

`PTT_STAFF_TICKETS=0` (+ `NEXT_PUBLIC_PTT_STAFF_TICKETS=0`). Route 404. Hook no-op. Không DROP bảng.

---

## 6. Deploy VPS (khi user yêu cầu)

1. `bash scripts/apply_pg_ddl_bds_p12.sh` trên VPS (không FK `crm_departments`).
2. rsync `ptt-crm-api/dist/` + `ops-web/.next/standalone/`.
3. `sudo -n systemctl restart realosai-api` rồi `realosai-ops-web` (tách lệnh).
4. **Không** ghi `.env` `PTT_STAFF_TICKETS=1` trên prod.

Staging:

```bash
PTT_STAFF_TICKETS=1
NEXT_PUBLIC_PTT_STAFF_TICKETS=1
# convert chat cần:
PTT_STAFF_CHAT=1
NEXT_PUBLIC_PTT_STAFF_CHAT=1
# auto ticket cọc cần:
PTT_BDS_PACK=1
PTT_BDS_TX=1
```

---

## 7. Sau P12 xanh

**P12b:** auto-create còn lại §29.5 (lead, hold F1, VBTT, `hdmb_gate_*` khi paid+legal, milestone, handover, commission, launch `ops_action`), T2 bulk, nút tạo từ hold/TX, export, escalate watcher đầy đủ, chuông UC-002.  
**P11b:** SSE chat, card §27.4 còn lại, FTS.

---

*P12 thắng: CĐT có việc trong ban và liên phòng; sàn 404; cọc sinh ticket công nợ; đóng thiếu lịch → artifact; chat chuyển được thành ticket khi flag on.*
