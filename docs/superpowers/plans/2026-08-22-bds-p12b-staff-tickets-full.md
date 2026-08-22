# P12b Triển khai — Staff tickets đầy đủ (auto §29.5, SLA escalate, UI SCR-BDS-120, export)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện ticket việc sau P12 Hướng 1: nợ kỹ thuật P12 (broker 404 runtime, SLA pause), auto-create/handoff/auto-done §29.5, export CSV, bulk T2 `ops_action`, UI `/crm/work` + nút «Tạo ticket» trên hold/TX, chuông UC-002 khi quá SLA.

**Architecture:** Giữ bounded context **platform** `src/staff-tickets/` — không gộp vào `/api/v1/bds`. Pack BĐS chỉ **hook** qua `@Optional() StaffTicketService` (giống P12 BDS-48). `StaffTicketModule` **không** import `BdsModule`; inject `BdsTenantService` qua `AppModule` factory hoặc token `STAFF_TICKET_TENANT_LOOKUP` export từ `BdsModule`. After-sales `defect`/`title` vẫn **cấm** INSERT `crm_staff_tickets` (BR-BDS-46). Không SSE (poll 5s). Không ticket khách `/crm/tickets`.

**Tech Stack:** NestJS `ptt-crm-api` + Jest; Next.js `ops-web` + Vitest; `pg` Pool; `StaffNotificationsModule` cho UC-002.

**Spec:** [2026-08-21-bds-industry-pack-design.md](../specs/2026-08-21-bds-industry-pack-design.md) §29.4–29.6, §29.5 auto-create.  
**UX:** [2026-08-22-bds-ux-ui-design.md](../specs/2026-08-22-bds-ux-ui-design.md) §4.16 SCR-BDS-120.  
**UC:** [13-BDS-INDUSTRY-PACK.md](../../use-cases/13-BDS-INDUSTRY-PACK.md) UC-055…059, UC-002 (chuông).  
**P12 (xong):** [2026-08-22-bds-p12-staff-tickets.md](./2026-08-22-bds-p12-staff-tickets.md) — cọc BDS-48, convert UC-054, page mỏng.  
**Roadmap:** [2026-08-22-bds-coding-roadmap.md](./2026-08-22-bds-coding-roadmap.md)

**Test ID P12b:**  
**BDS-49** broker GET tickets → **404** (runtime, không chỉ unit mock).  
**BDS-50** hold `pending` (kênh) → ticket `hold_f1_approve`.  
**BDS-51** lead ingest mới → `cskh_first_touch`.  
**BDS-52** TX `vbtt` → `vbtt_check`.  
**BDS-53** paid_pct + legal đủ → `hdmb_gate_legal` + `hdmb_gate_paid` (2 ticket).  
**BDS-54** TX `contracted` → system `done` cả 2 `hdmb_gate_*`; `cancelled` → `cancelled`.  
**BDS-55** `ensureScheduleForTx` → system `done` ticket `collection_schedule` mở.  
**BDS-56** transition `waiting` trên queue `sla_pauses_on_waiting=true` → không mark SLA breach cho tới resume.  
**BDS-57** GET export → CSV; cap `staff_tickets.export`; broker → 404.

| Hướng | Làm | Không | Khi nào chọn |
|-------|-----|-------|----------------|
| **1 (khóa)** | Nợ P12 + auto §29.5 (trừ basket_materialize phức tạp) + auto-done gate/collection + export + bulk T2 + UI SCR-BDS-120 core + UC-002 chuông SLA | SSE, voice/video, Playwright E2E pack, basket job hook, UC-062 offboard | Ship sau P12 prod |
| 2 | Chỉ hooks auto + BDS-49/54/55 | UI đầy đủ, export, chuông | Backend-first staging |
| 3 | Hướng 1 + basket_materialize + milestone 2 ticket After + Playwright BDS-44/49 | — | Demo đầy đủ; rủi ro scope |

---

## Global Constraints

- `PTT_STAFF_TICKETS` / `NEXT_PUBLIC_PTT_STAFF_TICKETS` mặc định `0` — prod **không bật**.
- Hook BĐS: `if (!isStaffTicketsEnabled()) return` — no-op khi flag tắt; **không** fail luồng nghiệp vụ (try/catch + warn).
- `createHandoffTicket` / `systemTransition` idempotent theo `(tenant, entity_type, entity_id, queue_code)`.
- Sàn tenant `mode=broker` → mọi `/api/v1/staff-tickets/*` = **404** (BDS-49).
- `hdmb_gate_*`: staff `done` → 400 `system_only` (P12); P12b thêm **system** close khi TX stage đổi.
- After-sales defect: **0** row `crm_staff_tickets`; có thể `createHandoffTicket` cross trỏ `entity_type=defect` từ UI thủ công (P12b UI), không auto.
- `staff_id` INTEGER; không FK `staff_users` / `crm_departments`.
- `StaffTicketModule` không import `BdsModule`. `BdsModule` import `StaffTicketModule` (đã có P12).
- Không `ScheduleModule.forRoot()` thêm — GtmModule đã forRoot.
- Test: `./node_modules/.bin/jest … --runInBand`; Vitest cho FE.
- Không commit trừ khi user yêu cầu.

---

## 0. Phạm vi

### Làm (Hướng 1)

**A. Nợ P12**

- Wire `BdsTenantService` → `StaffTicketService.assertDeveloper` (BDS-49 runtime).
- SLA **pause** khi `waiting` + `sla_pauses_on_waiting`; resume khi `in_progress`.
- SLA breach: add watcher trưởng `assignee_dept` (position `truong` / fallback listStaffIdsByDepartmentCodes + filter — không fail nếu HR thiếu).
- UC-002: insert `staff_notifications` khi `sla_breach` (title + link `/crm/work`).

**B. Auto-create / auto-done §29.5**

| Hook site | Sự kiện | Queue | Ghi chú |
|-----------|---------|-------|---------|
| `BdsBuyerIngestService` / lead create | Lead mới | `cskh_first_touch` | requester `ban_mkt`, assignee CSKH |
| `BdsHoldService.create` | status `pending` (kênh/F1) | `hold_f1_approve` | requester `ban_kenh` |
| `BdsTxService.vbtt` | sau vbtt ok | `vbtt_check` | requester `ban_kd` |
| `BdsCollectionService` hoặc `BdsTxService.contract` | paid+legal pass lần đầu | `hdmb_gate_legal`, `hdmb_gate_paid` | 2 ticket; GĐKD watcher-only (addWatcher, không assignee) |
| `BdsTxService.contract` / cancel | stage `contracted` / `cancelled` | close 2 hdmb | `systemTransition(..., { system: true })` |
| `BdsCollectionService.ensureScheduleForTx` | schedule created | `collection_schedule` done | BDS-55 complement BDS-48 |
| `BdsProjectOsService` upsert legal doc `so_xd` valid | văn bản Sở XD | `legal_gate_phase` | requester PM |
| `BdsProjectOsService.reachMilestone` | milestone reached | `milestone_unlock` → Collection (**v1: 1 ticket Collection**; After = P12b+ nếu cần ticket thứ 2) |
| `BdsTxService.contract` | contracted | `commission_period` | requester hệ thống; handover_book **defer** (cần mốc BG — hook khi aftersales appointment API sẵn) |
| `BdsLaunchService.open` | launch open | `ops_action` optional | flag `PTT_STAFF_TICKETS_LAUNCH_OPS=1` default 0 |

**C. API mới**

- `GET /api/v1/staff-tickets/export?inbox=&queue=&project_id=` → CSV (cap export).
- `POST /api/v1/staff-tickets/bulk/ops-action` body `{ items: [{ title, body, assignee_staff_id?, project_id? }] }` — tối đa 50, queue `ops_action`, kind `dept`.
- `GET /api/v1/staff-tickets/tickets/:id/comments` + `GET .../events` (audit mỏng cho UI).

**D. UI**

- `/crm/work`: filter overdue / queue / project; form **Tạo ticket** (UC-055/056); blocked/waiting + reason; comment khi done `ops_action`; entity chip link hold/TX; nút **Mở chat** nếu `room_id`.
- `/crm/bds/holds/[id]` + `/crm/bds/transactions/[id]`: nút «Tạo ticket» prefill entity (cap create).
- Chat convert: chọn queue (dropdown queues) thay vì hardcode `dept_backlog`/`ops_action`.

### Không làm (P12c / pack v2)

- `basket_materialize` auto (job async phức tạp).
- `handover_book` auto (cần tích hợp appointment aftersales đầy đủ).
- Milestone ticket thứ 2 cho After (`ban_cskh_after`) — optional follow-up.
- SSE ticket stream; Playwright E2E full pack.
- UC-062 offboard reassign ticket (HR module).
- Voice/video; Jira.

---

## 1. File map

```
services/ptt-crm-api/src/staff-tickets/
  staff-ticket.tenant.ts              # token + factory type
  staff-ticket.service.ts             # + systemTransition, pauseSla, escalate, export, bulk
  staff-ticket.service.spec.ts        # + BDS-56
  staff-ticket.repository.ts          # + listComments, listEvents, exportRows, pause fields
  staff-ticket.controller.ts          # + export, bulk, comments, events
  staff-ticket.controller.spec.ts
  staff-ticket.sla.job.ts             # + notification hook
  staff-ticket.notifications.ts       # UC-002 adapter (optional thin)

services/ptt-crm-api/src/app.module.ts          # factory StaffTicketService + tenant lookup
services/ptt-crm-api/src/bds/hold/bds-hold.service.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer-ingest.service.ts
services/ptt-crm-api/src/bds/transactions/bds-tx.service.ts
services/ptt-crm-api/src/bds/collection/bds-collection.service.ts
services/ptt-crm-api/src/bds/project-os/bds-project-os.service.ts
services/ptt-crm-api/src/bds/launches/bds-launch.service.ts

services/ops-web/src/app/crm/work/page.tsx
services/ops-web/src/lib/staff-tickets/api.ts
services/ops-web/src/app/crm/bds/holds/page.tsx      # or detail — nút tạo ticket
services/ops-web/src/app/crm/bds/transactions/page.tsx
services/ops-web/src/app/crm/chat/page.tsx           # queue picker

docs/superpowers/plans/2026-08-22-bds-coding-roadmap.md   # row P12b
```

Không DDL mới trừ khi cần cột SLA pause — **ưu tiên** lưu `sla_paused_at` / `sla_remaining_ms` trên ticket (migration P12b nhỏ) hoặc tính từ events `waiting`/`in_progress` (YAGNI: dùng events trước, DDL chỉ khi test BDS-56 khó).

---

## 2. Task breakdown

### Task 1: Wire tenant lookup — BDS-49 runtime

**Files:**
- Create: `services/ptt-crm-api/src/staff-tickets/staff-ticket.tenant.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts`, `staff-ticket.module.ts`, `staff-ticket.service.spec.ts`

**Interfaces:**
- Produces: `STAFF_TICKET_TENANT_LOOKUP` token, `{ getMe(id): Promise<{ mode: string }> }`

- [ ] **Step 1: Failing test** — service spec với `tenants.getMe` broker → `listTickets` 404 (đã có; thêm controller integration spec optional).

- [ ] **Step 2: AppModule factory**

```ts
{
  provide: StaffTicketService,
  useFactory: (repo: StaffTicketRepository, tenants: BdsTenantService) =>
    new StaffTicketService(repo, tenants),
  inject: [StaffTicketRepository, BdsTenantService],
}
```

`StaffTicketModule` exports `StaffTicketRepository` only; `AppModule` re-provides `StaffTicketService` OR export `BdsTenantService` từ `BdsModule` và import order: `BdsModule` before `StaffTicketModule` with factory in `StaffTicketModule`:

```ts
// staff-ticket.module.ts — imports: [StaffAuthModule, forwardRef(() => BdsModule)] KHÔNG — tránh cycle
// Prefer AppModule:
providers: [
  StaffTicketRepository,
  {
    provide: StaffTicketService,
    useFactory: (repo, tenants: BdsTenantService) => new StaffTicketService(repo, tenants),
    inject: [StaffTicketRepository, BdsTenantService],
  },
  ...
]
```

- [ ] **Step 3:** Run `jest src/staff-tickets --runInBand` — PASS.

---

### Task 2: SLA pause + escalate watcher + UC-002

**Files:**
- Modify: `staff-ticket.service.ts`, `staff-ticket.repository.ts`, `staff-ticket.sla.job.ts`
- Create: `staff-ticket.notifications.ts` (wrap `StaffNotificationsRepository.create`)

**Interfaces:**
- Produces: `pauseSlaOnWaiting(ticket)`, `resumeSlaOnProgress(ticket)`, `escalateSlaBreaches(row)`

- [ ] **Step 1: Test BDS-56**

```ts
it('BDS-56: waiting on vbtt_check pauses SLA clock', async () => {
  // ticket sla_due_at in past but status waiting + queue sla_pauses_on_waiting
  // markSlaBreaches skips until back in_progress
});
```

- [ ] **Step 2: Implement** — on transition to `waiting`: if queue.sla_pauses_on_waiting, set `sla_due_at = null` or store offset in event payload; on `in_progress`: recompute `sla_due_at = now + remaining`.

- [ ] **Step 3: Escalate** — trong `markSlaBreaches`, sau event `sla_breach`: `listStaffIdsByDepartmentCodes([assignee_dept])` → pick trưởng (position code `truong` via repo helper) → `addWatcher` + `insertEvent kind=escalate`.

- [ ] **Step 4: UC-002** — `@Optional() StaffNotificationsRepository`: create `{ staff_id, kind: 'ticket_sla', title, body, href: '/crm/work?ticket=' + id }`. Flag `PTT_STAFF_TICKETS_NOTIFY=1` default 0 để prod không spam.

- [ ] **Step 5:** Jest PASS.

---

### Task 3: `systemTransition` helper

**Files:**
- Modify: `staff-ticket.service.ts`, `staff-ticket.service.spec.ts`

**Interfaces:**
- Produces: `systemTransition(id, { to, reason? }, tenantId)` — bypass assignee check; `close_requires` with `system: true`.

- [ ] **Step 1:** Test hdmb system done + collection auto-done BDS-55.

- [ ] **Step 2:** Implement reusing `transition(..., { system: true })`.

---

### Task 4: Hook hold F1 — BDS-50

**Files:**
- Modify: `bds-hold.service.ts`, `bds-hold.service.spec.ts`

- [ ] After `insertHold` when `status === 'pending'`: `tickets?.createHandoffTicket(tenantId, { queue_code: 'hold_f1_approve', entity_type: 'hold', entity_id: hold.id, title: ..., requester_dept_code: 'ban_kenh' })`.

- [ ] Test BDS-50 with `PTT_STAFF_TICKETS=1`.

---

### Task 5: Hook lead — BDS-51

**Files:**
- Modify: `bds-buyer-ingest.service.ts` (+ spec) hoặc `bds-buyer-lead.service.ts` sau `createLead`.

- [ ] `createHandoffTicket` queue `cskh_first_touch`, `entity_type: 'lead'`, `requester_dept_code: 'ban_mkt'`.

---

### Task 6: Hook VBTT — BDS-52

**Files:**
- Modify: `bds-tx.service.ts`, `bds-tx.service.spec.ts`

- [ ] Sau `vbtt` success (cạnh commission hook): ticket `vbtt_check`.

---

### Task 7: Hook HDMB gate — BDS-53/54

**Files:**
- Modify: `bds-collection.service.ts` hoặc `bds-tx.service.ts` `contract()`
- Modify: `bds-tx.service.ts` cancel path

**Logic:**
- Khi `evaluateHdmbGate(tx)` chuyển từ fail → pass (lần đầu): tạo 2 ticket nếu chưa có.
- Thêm watcher GĐKD (staff list `ban_kd` position `tgd` readonly — best effort).
- On `contracted`: `systemTransition` both to `done`.
- On `cancelled` while open: `systemTransition` to `cancelled`.

- [ ] Tests BDS-53, BDS-54.

---

### Task 8: Hook collection auto-done — BDS-55

**Files:**
- Modify: `bds-collection.service.ts` `ensureScheduleForTx`

- [ ] Sau schedule created: find open `collection_schedule` ticket → `systemTransition(..., 'done')`.

---

### Task 9: Hook legal + milestone

**Files:**
- Modify: `bds-project-os.service.ts`

- [ ] `upsertLegalDoc` khi `doc_type=so_xd` và status valid → `legal_gate_phase`.
- [ ] `reachMilestone` → `milestone_unlock` (Collection).

---

### Task 10: Launch ops_action (optional flag)

**Files:**
- Modify: `bds-launch.service.ts`, `staff-ticket.flags.ts`

- [ ] `PTT_STAFF_TICKETS_LAUNCH_OPS=1` → sau `open`, `createHandoffTicket` ops_action dept GĐKD.

---

### Task 11: Export + bulk API — BDS-57

**Files:**
- Modify: `staff-ticket.controller.ts`, `staff-ticket.service.ts`, `staff-ticket.repository.ts`

- [ ] `GET export` — CSV columns: number, queue, title, status, assignee_dept, sla_due_at, entity.
- [ ] Cap `staff_tickets.export` on controller.
- [ ] `POST bulk/ops-action` — loop createTicket kind dept.

---

### Task 12: Comments/events API

**Files:**
- Modify: controller + repository

- [ ] `GET tickets/:id/comments`, `GET tickets/:id/events` (limit 100).

---

### Task 13: FE `/crm/work` SCR-BDS-120 core

**Files:**
- Modify: `work/page.tsx`, `staff-tickets/api.ts`

- [ ] Filters: overdue toggle, queue select (`fetchWorkQueues`).
- [ ] Modal/form Tạo ticket (kind, queue, title, body).
- [ ] Actions: Blocked, Waiting (+ reason), Done (+ comment if ops_action).
- [ ] Toast artifact / system_only (copy UX §8).
- [ ] Link entity → `/crm/bds/transactions/:id` or holds.

---

### Task 14: FE hold/TX + chat queue picker

**Files:**
- Modify: holds page, transactions page, chat page

- [ ] Button «Tạo ticket» → `postWorkTicket` with entity prefill.
- [ ] Chat: dropdown queue từ `fetchWorkQueues`.

---

### Task 15: Roadmap + verify

**Files:**
- Modify: `2026-08-22-bds-coding-roadmap.md`

- [ ] Add row **P12b** with link to this plan.

Run:

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/staff-tickets src/bds/hold src/bds/buyers src/bds/transactions src/bds/collection src/bds/project-os src/bds/launches --runInBand
cd services/ops-web && ./node_modules/.bin/vitest run src/lib/staff-tickets src/lib/bds
cd services/ptt-crm-api && npm run build
cd services/ops-web && npm run build
```

---

## 3. Definition of Done (P12b Hướng 1)

- [ ] BDS-49 broker 404 **runtime** với tenant lookup thật
- [ ] BDS-50…55 hooks + tests
- [ ] BDS-56 SLA pause waiting
- [ ] BDS-57 export CSV
- [ ] UC-055/056 form tạo ticket trên `/crm/work`
- [ ] UC-057 blocked/waiting UI
- [ ] UC-059 watcher trưởng + chuông khi `PTT_STAFF_TICKETS_NOTIFY=1`
- [ ] Nút «Tạo ticket» hold/TX
- [ ] Prod vẫn `PTT_STAFF_TICKETS=0`
- [ ] After-sales defect không auto ticket

---

## 4. Flags staging (P12b)

```bash
PTT_STAFF_TICKETS=1
NEXT_PUBLIC_PTT_STAFF_TICKETS=1
PTT_STAFF_TICKETS_NOTIFY=1          # optional UC-002
PTT_STAFF_TICKETS_LAUNCH_OPS=0      # default off
# hooks nghiệp vụ cần:
PTT_BDS_PACK=1
PTT_BDS_TX=1
PTT_BDS_COLLECTION=1                # hdmb + collection auto-done
PTT_BDS_BUYER=1                     # lead hook
PTT_BDS_PROJECT_OS=1                # legal + milestone
PTT_BDS_LAUNCH=1                    # nếu test launch ops
PTT_STAFF_CHAT=1                    # Mở chat link
```

---

## 5. Rollback

Tắt `PTT_STAFF_TICKETS=0` — hooks no-op; UI ẩn. Không DROP bảng. Notification flag off.

---

## 6. Sau P12b

**P12c:** `basket_materialize`, `handover_book` auto, milestone ticket After, UC-062 offboard, Playwright BDS-49 E2E.  
**P11b:** SSE chat (roadmap §7 P11).

---

*P12b thắng: mọi handoff §29.5 chính sinh ticket; HĐMB gate đóng bằng hệ thống; Collection ticket tự done khi có lịch; CĐT làm việc đủ trên SCR-BDS-120; sàn vẫn 404.*
