# P11 Triển khai — Staff chat (room dept/cross, system card, huddle launch)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chat nội bộ platform trên PG: seed room `dept` (12 ban) + `cross` (11 cặp handoff), post/sửa/tombstone, membership theo vị trí HR, system card cọc → `x_kd_collection` (BDS-41), entity card ẩn khi không quyền (BDS-42), huddle `launch_*` khi P10 mở/đóng ra quân. UI mỏng `/crm/chat` (SCR-BDS-110).

**Architecture:** Bounded context **platform** `src/staff-chat/` (`StaffChatService` = spec §27) — **không** nằm dưới `/api/v1/bds`. HTTP sau `StaffOrInternalKeyGuard` + `StaffChatGuard` (`PTT_STAFF_CHAT=1`). Tenant qua header `x-bds-tenant`. Không member → **404** (không 403, BR-BDS-05/36). Pack BĐS chỉ **hook**: `BdsTxService.convertDeposit` bắn card; `BdsLaunchService.open/close` tạo/archive huddle — cả hai `@Optional()` và **no-op** khi CHAT=0. Không import `ReProjectsModule`. Không ticket việc (P12). Không SSE (poll 5s, giống P10).

**Tech Stack:** NestJS `ptt-crm-api` + Jest; Next.js `ops-web` + Vitest; `pg` Pool; `psql`.

**Spec:** [2026-08-21-bds-industry-pack-design.md](../specs/2026-08-21-bds-industry-pack-design.md) §10.6, §15 P11, §27, BR-BDS-36…40.  
**UX:** [2026-08-22-bds-ux-ui-design.md](../specs/2026-08-22-bds-ux-ui-design.md) §4.15 SCR-BDS-110.  
**UC:** [13-BDS-INDUSTRY-PACK.md](../../use-cases/13-BDS-INDUSTRY-PACK.md) UC-051…053; UC-054 nút ẩn khi `PTT_STAFF_TICKETS=0`.  
**P0:** [2026-08-22-bds-p0-trien-khai.md](./2026-08-22-bds-p0-trien-khai.md) — 12 phòng `BDS_DEPARTMENT_SEEDS`.  
**P8:** [2026-08-22-bds-p8-ui-rbac.md](./2026-08-22-bds-p8-ui-rbac.md) — nav; **chưa** có «Chat».  
**P10:** [2026-08-22-bds-p10-launch.md](./2026-08-22-bds-p10-launch.md) — open/close; huddle **cố ý** để P11.  
**P4:** [2026-08-22-bds-p4-transaction.md](./2026-08-22-bds-p4-transaction.md) — `convertDeposit`.  
**Roadmap:** [2026-08-22-bds-coding-roadmap.md](./2026-08-22-bds-coding-roadmap.md)

**Test ID P11:** BDS-39 (sàn GET room `ban_kd` CĐT → 404).  
**BDS-40** TVV post `ban_phap_che` khi không member → 404.  
**BDS-41** cọc xong có system card `x_kd_collection`.  
**BDS-42** entity card TX không quyền → `hidden`, không mã căn.  
**BDS-43** sửa tin sau 15 phút → 400 `edit_window`.  
**UC-051** room `dept` + restricted banner.  
**UC-053** huddle `launch_*` + `expires_at`; archive khi đóng launch.  
**UC-054 / SSE / ticket `ops_action` / AI tóm tắt** = **P12 / P11b**.  
**Voice/video / `crm_b2b_conversation_*` / `/crm/tickets` khách** = ngoài v1.

**Hướng khóa: 1** — API đủ cổng + seed 12+11 + card BDS-41/42 + huddle P10 + page `/crm/chat` poll 5s. Không SSE, không convert→ticket, không FTS, không file upload mới.

| Hướng | Làm | Không | Khi nào chọn |
|-------|-----|-------|----------------|
| **1 (khóa)** | Flag + DDL + rooms/messages + seed + card cọc + huddle launch + page mỏng | SSE, UC-054, announce/project/case đầy đủ, search FTS, chat sàn riêng sâu | Đúng cổng P0+P8+P10→P11 |
| 2 | Chỉ API + huddle, không FE | Nav «Chat» | Tách UI sang P11b |
| 3 | SSE + mọi card §27.4 + announce + FTS + case/project + convert ticket | — | Quá rộng; ticket = P12; SSE = P11b |

---

## Global Constraints

- `PTT_STAFF_CHAT` mặc định `0` — mọi `/api/v1/staff-chat/*` = **404**. Hook BĐS **no-op**.
- `NEXT_PUBLIC_PTT_STAFF_CHAT` mặc định `0` — không hiện nav «Chat»; `/crm/chat` → «Chat nội bộ chưa bật».
- Chat **không** yêu cầu `PTT_BDS_PACK` (platform). Huddle launch chỉ chạy khi CHAT=1 **và** launch open/close thành công.
- GET/POST ngoài membership hoặc sai tenant = **404**, không 403, không PII (BR-BDS-05/36).
- User không member room (kể cả sàn nhìn `ban_kd` CĐT) = **404** (BDS-39).
- Restricted (`ban_phap_che`, `ban_tc_collection`, `ban_tc_hh`): không forward; search v1 = member only (không FTS global).
- Sửa tin thường ≤ 15 phút (tác giả). Moderate: tombstone + lý do. Không hard-delete (BR-BDS-40).
- System card **không** thay inbox hold / phiếu thu (BR-BDS-39).
- `staff_id` = `parseNumericStaffSub(jwt.sub)` → `staff_users.id`.
- Header tenant: `x-bds-tenant` (cùng P0–P10).
- `BdsModule` **không** import `ReProjectsModule`. `StaffChatModule` **không** import `BdsModule` (tránh vòng). Hook từ BĐS → chat.
- Tiếng Việt UI: Chat · Phòng tôi · Liên phòng · Huddle · Hồ sơ ẩn. Không «Slack / channel».
- `DATABASE_URL` script: `postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb`.
- Test API: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand`.
- Test FE: `cd services/ops-web && ./node_modules/.bin/vitest run <file>`.
- Không commit trừ khi user yêu cầu.
- Prod VPS: **không** bật `PTT_STAFF_CHAT` / `NEXT_PUBLIC_PTT_STAFF_CHAT`.

---

## 0. Phạm vi / ngoài phạm vi

**Làm**

- Flag `isStaffChatEnabled()` + `StaffChatGuard` + `NEXT_PUBLIC_PTT_STAFF_CHAT`
- Cap `staff_chat` view/post/moderate/export (catalog + stub khi CHAT=1)
- DDL `crm_staff_rooms` / `crm_staff_room_members` / `crm_staff_messages` / `crm_staff_message_mentions`
- Seed 12 `dept` + 11 `cross` (idempotent theo `tenant_id` + `code`)
- Membership: staff `position.department_id` ∈ room dept (hoặc union cross); `tgd` → `readonly` mọi `dept`/`cross`
- `GET/POST /rooms` · `GET /rooms/:id` · `GET/POST .../messages` · `PATCH /messages/:id` · `POST .../tombstone` · `POST .../read`
- Tạo `dm` (đúng 2 staff cùng tenant) và `huddle` (moderate / hook launch)
- Hook cọc → card `x_kd_collection` (BDS-41)
- Entity card `hidden` (BDS-42)
- Hook launch open → huddle `launch_{id}`; close → `archived`
- Page + nav «Chat» (CĐT/hybrid + sàn — room **của tenant đó**)
- Poll thread 5s khi room chọn

**Không làm**

- `GET /stream` SSE (P11b; UI poll)
- `GET /search` FTS
- UC-054 convert tin → ticket (P12)
- Auto card còn lại §27.4 (lead 15p, hold F1, legal_gate, paid_pct, contracted, milestone) — P11b
- Room `announce` / `project` / `case` đầy đủ (POST create chỉ `dm` + `huddle`)
- Job sync membership 1 phút khi HR đổi vị trí (seed + sync lúc `list`/`post` là đủ v1)
- File upload object storage mới (nhận `file_ids` jsonb, không endpoint upload)
- AI tóm tắt huddle
- Chat Zalo `crm_b2b_conversation_*`
- Voice/video

---

## 1. File map

```
docs/specs/postgresql-ddl-bds-p11.sql
scripts/apply_pg_ddl_bds_p11.sh

services/ptt-crm-api/src/bds/bds.flags.ts                         # + isStaffChatEnabled (hoặc file flags riêng — khóa: cùng bds.flags + env PTT_STAFF_CHAT)
services/ptt-crm-api/src/bds/bds.flags.spec.ts
services/ptt-crm-api/src/config/app-config.service.ts             # staffChatEnabled
services/ptt-crm-api/src/staff-auth/staff-auth.service.ts         # + STAFF_CHAT_CAP_CATALOG khi CHAT=1
services/ptt-crm-api/src/staff-chat/staff-chat.flags.ts           # re-export isStaffChatEnabled
services/ptt-crm-api/src/staff-chat/staff-chat.guard.ts
services/ptt-crm-api/src/staff-chat/staff-chat.guard.spec.ts
services/ptt-crm-api/src/staff-chat/staff-chat.types.ts
services/ptt-crm-api/src/staff-chat/staff-chat.util.ts
services/ptt-crm-api/src/staff-chat/staff-chat.util.spec.ts
services/ptt-crm-api/src/staff-chat/staff-chat.caps.ts
services/ptt-crm-api/src/staff-chat/staff-chat.repository.ts
services/ptt-crm-api/src/staff-chat/staff-chat.service.ts
services/ptt-crm-api/src/staff-chat/staff-chat.service.spec.ts
services/ptt-crm-api/src/staff-chat/staff-chat.controller.ts
services/ptt-crm-api/src/staff-chat/staff-chat.controller.spec.ts
services/ptt-crm-api/src/staff-chat/staff-chat.module.ts
services/ptt-crm-api/src/app.module.ts                            # import StaffChatModule
services/ptt-crm-api/src/bds/bds.module.ts                        # không import StaffChatModule nếu circular; inject optional token
services/ptt-crm-api/src/bds/transactions/bds-tx.service.ts        # BDS-41
services/ptt-crm-api/src/bds/transactions/bds-tx.service.spec.ts
services/ptt-crm-api/src/bds/launches/bds-launch.service.ts        # huddle
services/ptt-crm-api/src/bds/launches/bds-launch.service.spec.ts

services/ops-web/src/lib/staff-chat/flags.ts
services/ops-web/src/lib/staff-chat/api.ts
services/ops-web/src/lib/bds/nav.ts                               # + Chat
services/ops-web/src/lib/bds/nav.spec.ts
services/ops-web/src/components/layout/nav-icons.tsx
services/ops-web/src/app/crm/chat/page.tsx

docs/superpowers/plans/2026-08-22-bds-coding-roadmap.md
```

Khóa flag: `isStaffChatEnabled()` sống trong `bds.flags.ts` cạnh các flag pack **hoặc** `staff-chat/staff-chat.flags.ts` import `envFlagOn` từ `bds.flags`. **Khóa:** file `staff-chat/staff-chat.flags.ts` gọi `envFlagOn(process.env.PTT_STAFF_CHAT)` — không phụ thuộc PACK. `bds.flags.spec.ts` **không** bắt buộc cover CHAT nếu spec riêng `staff-chat.flags.spec.ts`.

---

### Task 1: Flag CHAT + util membership / edit window

**Files:**
- Create: `services/ptt-crm-api/src/staff-chat/staff-chat.flags.ts`
- Create: `services/ptt-crm-api/src/staff-chat/staff-chat.flags.spec.ts`
- Create: `services/ptt-crm-api/src/staff-chat/staff-chat.guard.ts`
- Create: `services/ptt-crm-api/src/staff-chat/staff-chat.guard.spec.ts`
- Create: `services/ptt-crm-api/src/staff-chat/staff-chat.types.ts`
- Create: `services/ptt-crm-api/src/staff-chat/staff-chat.util.ts`
- Create: `services/ptt-crm-api/src/staff-chat/staff-chat.util.spec.ts`
- Create: `services/ptt-crm-api/src/staff-chat/staff-chat.caps.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts`
- Modify: `services/ptt-crm-api/src/staff-auth/staff-auth.service.ts`

**Interfaces:**
- Consumes: `envFlagOn` từ `../bds/bds.flags`
- Produces: `isStaffChatEnabled()`, `EDIT_WINDOW_MS`, `canEditMessage()`, `isRestrictedCode()`, `launchHuddleCode()`, `CROSS_ROOM_SEEDS`

- [ ] **Step 1: Write failing tests**

`staff-chat.flags.spec.ts` — restore `PTT_STAFF_CHAT` trong `afterEach`:

```ts
it('defaults CHAT off when unset', () => {
  delete process.env.PTT_STAFF_CHAT;
  expect(isStaffChatEnabled()).toBe(false);
});

it('CHAT on for 1', () => {
  process.env.PTT_STAFF_CHAT = '1';
  expect(isStaffChatEnabled()).toBe(true);
});
```

`staff-chat.guard.spec.ts` — copy `bds-aftersales.guard.spec.ts`: CHAT off → 404; CHAT on → true. **Không** check PACK.

`staff-chat.util.spec.ts`:

```ts
import {
  EDIT_WINDOW_MS,
  canEditMessage,
  isRestrictedCode,
  launchHuddleCode,
} from './staff-chat.util';

describe('staff-chat.util', () => {
  it('BDS-43: edit allowed within 15 minutes', () => {
    const created = new Date('2026-08-22T10:00:00Z');
    const now = new Date('2026-08-22T10:14:59Z');
    expect(canEditMessage(created, now)).toBe(true);
  });

  it('BDS-43: edit after 15 minutes denied', () => {
    const created = new Date('2026-08-22T10:00:00Z');
    const now = new Date('2026-08-22T10:15:01Z');
    expect(canEditMessage(created, now)).toBe(false);
    expect(EDIT_WINDOW_MS).toBe(15 * 60 * 1000);
  });

  it('restricted seed codes', () => {
    expect(isRestrictedCode('ban_phap_che')).toBe(true);
    expect(isRestrictedCode('ban_kd')).toBe(false);
  });

  it('huddle code from launch id', () => {
    expect(launchHuddleCode('L1')).toBe('launch_L1');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/staff-chat --runInBand`

Expected: FAIL — files missing.

- [ ] **Step 3: Minimal implementation**

```ts
// staff-chat.flags.ts
import { envFlagOn } from '../bds/bds.flags';
export function isStaffChatEnabled(): boolean {
  return envFlagOn(process.env.PTT_STAFF_CHAT);
}
```

`app-config.service.ts` cạnh `bdsLaunchEnabled`:

```ts
readonly staffChatEnabled: boolean;
this.staffChatEnabled = ['1', 'true', 'yes', 'on'].includes(
  (process.env.PTT_STAFF_CHAT ?? '0').trim().toLowerCase(),
);
```

`staff-chat.guard.ts` — CHAT off → `NotFoundException`.

`staff-chat.types.ts`:

```ts
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

export type RoomKind = 'dept' | 'cross' | 'dm' | 'huddle';
export type RoomStatus = 'active' | 'archived';
export type RoomSensitivity = 'normal' | 'restricted';
export type MemberRole = 'owner' | 'member' | 'readonly';
export type MessageKind = 'text' | 'system' | 'entity_card';

export type RoomRow = {
  id: string;
  tenant_id: string;
  kind: RoomKind;
  code: string;
  name: string;
  department_id: number | null;
  project_id: number | null;
  sensitivity: RoomSensitivity;
  status: RoomStatus;
  created_by: number | null;
  expires_at: Date | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: Date;
};

export type MemberRow = {
  room_id: string;
  staff_id: number;
  role: MemberRole;
  joined_at: Date;
  muted: boolean;
  last_read_message_id: string | null;
};

export type MessageRow = {
  id: string;
  room_id: string;
  author_staff_id: number | null;
  kind: MessageKind;
  body: string;
  reply_to_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  hidden: boolean;
  file_ids: unknown;
  edited_at: Date | null;
  tombstoned_at: Date | null;
  tombstone_reason: string;
  created_at: Date;
};

export const RESTRICTED_DEPT_CODES = ['ban_phap_che', 'ban_tc_collection', 'ban_tc_hh'] as const;

export const CROSS_ROOM_SEEDS: ReadonlyArray<{
  code: string;
  name: string;
  dept_codes: readonly string[];
}> = [
  { code: 'x_mkt_cskh', name: 'MKT × CSKH', dept_codes: ['ban_mkt', 'ban_cskh_presales'] },
  { code: 'x_cskh_kd', name: 'CSKH × KD', dept_codes: ['ban_cskh_presales', 'ban_kd', 'ban_kenh'] },
  { code: 'x_kenh_gdkd', name: 'Kênh × GĐKD', dept_codes: ['ban_kenh', 'ban_kd'] },
  { code: 'x_kd_collection', name: 'KD × Công nợ', dept_codes: ['ban_kd', 'ban_kenh', 'ban_tc_collection'] },
  { code: 'x_pc_kd', name: 'PC × KD', dept_codes: ['ban_phap_che', 'ban_kd'] },
  { code: 'x_pc_collection', name: 'PC × Công nợ', dept_codes: ['ban_phap_che', 'ban_tc_collection'] },
  { code: 'x_pm_ops', name: 'PM ops', dept_codes: ['ban_du_an', 'ban_kd', 'ban_phap_che', 'ban_tc_collection', 'ban_mkt', 'ban_cskh_after'] },
  { code: 'x_pm_after', name: 'PM × After', dept_codes: ['ban_du_an', 'ban_cskh_after'] },
  { code: 'x_after_collection', name: 'After × Công nợ', dept_codes: ['ban_cskh_after', 'ban_tc_collection'] },
  { code: 'x_kenh_hh', name: 'Kênh × HH', dept_codes: ['ban_kenh', 'ban_tc_hh'] },
  { code: 'x_mkt_pc', name: 'MKT × PC', dept_codes: ['ban_mkt', 'ban_phap_che'] },
];
```

`hidden` trên `MessageRow` là **computed** lúc read (không cột DB) — map trong service.

`staff-chat.util.ts`:

```ts
import { EDIT_WINDOW_MS, RESTRICTED_DEPT_CODES } from './staff-chat.types';

export { EDIT_WINDOW_MS };

export function canEditMessage(createdAt: Date, now = new Date()): boolean {
  return now.getTime() - createdAt.getTime() <= EDIT_WINDOW_MS;
}

export function isRestrictedCode(code: string): boolean {
  return (RESTRICTED_DEPT_CODES as readonly string[]).includes(code);
}

export function launchHuddleCode(launchId: string): string {
  return `launch_${String(launchId).replace(/[^a-zA-Z0-9_-]/g, '')}`;
}
```

`staff-chat.caps.ts`:

```ts
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';

export const STAFF_CHAT_CAP_CATALOG: ReadonlyArray<StaffSectionCap> = [
  { section: 'staff_chat', action: 'view' },
  { section: 'staff_chat', action: 'post' },
  { section: 'staff_chat', action: 'moderate' },
  { section: 'staff_chat', action: 'export' },
];
```

`staff-auth.service.ts` `stubCaps()` (cạnh BDS UI):

```ts
if (isStaffChatEnabled()) caps.push(...STAFF_CHAT_CAP_CATALOG);
```

Import `isStaffChatEnabled` từ `staff-chat.flags`.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu.

---

### Task 2: DDL P11 + apply script

**Files:**
- Create: `docs/specs/postgresql-ddl-bds-p11.sql`
- Create: `scripts/apply_pg_ddl_bds_p11.sh`

**Interfaces:**
- Consumes: `bds_tenants`, `staff_users`, `crm_departments`
- Produces: 4 bảng `crm_staff_*`

- [ ] **Step 1: Write SQL**

```sql
-- Pack BĐS P11 / platform staff-chat — Apply: scripts/apply_pg_ddl_bds_p11.sh
BEGIN;

CREATE TABLE IF NOT EXISTS crm_staff_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES bds_tenants (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('dept', 'cross', 'dm', 'huddle')),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  department_id INTEGER REFERENCES crm_departments (id),
  project_id INTEGER,
  sensitivity TEXT NOT NULL DEFAULT 'normal'
    CHECK (sensitivity IN ('normal', 'restricted')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_by INTEGER REFERENCES staff_users (id),
  expires_at TIMESTAMPTZ,
  entity_type TEXT,
  entity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_crm_staff_rooms_tenant_kind
  ON crm_staff_rooms (tenant_id, kind, status);

CREATE TABLE IF NOT EXISTS crm_staff_room_members (
  room_id UUID NOT NULL REFERENCES crm_staff_rooms (id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL REFERENCES staff_users (id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'member', 'readonly')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  last_read_message_id UUID,
  PRIMARY KEY (room_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_staff_room_members_staff
  ON crm_staff_room_members (staff_id);

CREATE TABLE IF NOT EXISTS crm_staff_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES crm_staff_rooms (id) ON DELETE CASCADE,
  author_staff_id INTEGER REFERENCES staff_users (id),
  kind TEXT NOT NULL DEFAULT 'text'
    CHECK (kind IN ('text', 'system', 'entity_card')),
  body TEXT NOT NULL DEFAULT '',
  reply_to_id UUID REFERENCES crm_staff_messages (id),
  entity_type TEXT,
  entity_id TEXT,
  file_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  edited_at TIMESTAMPTZ,
  tombstoned_at TIMESTAMPTZ,
  tombstone_reason TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_staff_messages_idem
  ON crm_staff_messages (room_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_staff_messages_room_created
  ON crm_staff_messages (room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS crm_staff_message_mentions (
  message_id UUID NOT NULL REFERENCES crm_staff_messages (id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES staff_users (id),
  department_id INTEGER REFERENCES crm_departments (id),
  CHECK (staff_id IS NOT NULL OR department_id IS NOT NULL)
);

COMMIT;
```

`scripts/apply_pg_ddl_bds_p11.sh` — copy P10, đổi `p10` → `p11`.

- [ ] **Step 2: Apply local nếu PG :5433 chạy**

Run: `DATABASE_URL=postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb bash scripts/apply_pg_ddl_bds_p11.sh`

Expected: `OK  bds P11 DDL`. Nếu PG tắt: không chặn Task 3.

- [ ] **Step 3: Commit** — chỉ khi user yêu cầu.

---

### Task 3: Repository

**Files:**
- Create: `services/ptt-crm-api/src/staff-chat/staff-chat.repository.ts`

**Interfaces:**
- Produces:

```ts
upsertRoom(input: {
  tenant_id: string;
  kind: RoomKind;
  code: string;
  name: string;
  department_id: number | null;
  sensitivity: RoomSensitivity;
  status?: RoomStatus;
  created_by?: number | null;
  expires_at?: Date | null;
  entity_type?: string | null;
  entity_id?: string | null;
}): Promise<RoomRow>  // ON CONFLICT (tenant_id, code) DO UPDATE name/expires/status

getById(id: string): Promise<RoomRow | null>
getByCode(tenantId: string, code: string): Promise<RoomRow | null>
listForStaff(tenantId: string, staffId: number): Promise<RoomRow[]>
  // JOIN members WHERE staff_id AND rooms.tenant_id AND status IN ('active','archived')

upsertMember(roomId: string, staffId: number, role: MemberRole): Promise<void>
getMember(roomId: string, staffId: number): Promise<MemberRow | null>
listMembers(roomId: string): Promise<MemberRow[]>
setLastRead(roomId: string, staffId: number, messageId: string): Promise<void>

insertMessage(input: {
  room_id: string;
  author_staff_id: number | null;
  kind: MessageKind;
  body: string;
  reply_to_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  file_ids?: unknown;
  idempotency_key?: string | null;
}): Promise<MessageRow>
getMessage(id: string): Promise<MessageRow | null>
listMessages(roomId: string, beforeId?: string, limit?: number): Promise<MessageRow[]>
  // ORDER BY created_at DESC LIMIT 50; nếu beforeId: created_at < that row
updateMessageBody(id: string, body: string, editedAt: Date): Promise<MessageRow | null>
tombstone(id: string, reason: string, at: Date): Promise<MessageRow | null>

listStaffIdsByDepartmentCodes(codes: string[]): Promise<number[]>
  // staff_users JOIN crm_positions p ON p.id = position_id
  // JOIN crm_departments d ON d.id = p.department_id
  // WHERE d.code = ANY($1) AND u.active
getStaffDepartmentCode(staffId: number): Promise<string | null>
getStaffPositionCode(staffId: number): Promise<string | null>
```

`listForStaff` **không** trả room user không member — đây là gốc BDS-39.

- [ ] **Step 1:** Không bắt buộc test repo (mock ở service).

- [ ] **Step 2: Commit** — chỉ khi user yêu cầu.

---

### Task 4: Service rooms / post / edit — BDS-39/40/43

**Files:**
- Create: `services/ptt-crm-api/src/staff-chat/staff-chat.service.ts`
- Create: `services/ptt-crm-api/src/staff-chat/staff-chat.service.spec.ts`

**Interfaces:**
- Consumes: `StaffChatRepository`, `BdsTenantService.getMe`
- Produces: `ensureSeeded`, `listRooms`, `getRoom`, `createRoom`, `postMessage`, `editMessage`, `tombstone`, `markRead`, `postHandoffCard`, `ensureLaunchHuddle`, `archiveLaunchHuddle`

- [ ] **Step 1: Write failing service tests**

```ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { StaffChatService } from './staff-chat.service';

describe('StaffChatService', () => {
  const repo = {
    upsertRoom: jest.fn(),
    getById: jest.fn(),
    getByCode: jest.fn(),
    listForStaff: jest.fn(),
    upsertMember: jest.fn(),
    getMember: jest.fn(),
    listMembers: jest.fn(),
    setLastRead: jest.fn(),
    insertMessage: jest.fn(),
    getMessage: jest.fn(),
    listMessages: jest.fn(),
    updateMessageBody: jest.fn(),
    tombstone: jest.fn(),
    listStaffIdsByDepartmentCodes: jest.fn().mockResolvedValue([]),
    getStaffDepartmentCode: jest.fn().mockResolvedValue('ban_kd'),
    getStaffPositionCode: jest.fn().mockResolvedValue('tvv_inhouse'),
  };
  const tenants = { getMe: jest.fn().mockResolvedValue({ mode: 'developer', id: 't1' }) };
  let svc: StaffChatService;

  beforeEach(() => {
    jest.clearAllMocks();
    tenants.getMe.mockResolvedValue({ mode: 'developer', id: 't1' });
    svc = new StaffChatService(repo as never, tenants as never);
  });

  it('BDS-39: non-member getRoom → 404', async () => {
    repo.getById.mockResolvedValue({ id: 'r1', tenant_id: 't1', code: 'ban_kd', kind: 'dept' });
    repo.getMember.mockResolvedValue(null);
    await expect(svc.getRoom('r1', 99, 't1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('BDS-40: non-member post → 404', async () => {
    repo.getById.mockResolvedValue({
      id: 'r1', tenant_id: 't1', code: 'ban_phap_che', kind: 'dept', status: 'active',
    });
    repo.getMember.mockResolvedValue(null);
    await expect(svc.postMessage('r1', 7, { body: 'xin so' }, 't1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('BDS-43: edit after 15m → 400 edit_window', async () => {
    repo.getMessage.mockResolvedValue({
      id: 'm1',
      room_id: 'r1',
      author_staff_id: 7,
      kind: 'text',
      created_at: new Date('2026-08-22T10:00:00Z'),
      tombstoned_at: null,
    });
    repo.getById.mockResolvedValue({ id: 'r1', tenant_id: 't1', status: 'active' });
    repo.getMember.mockResolvedValue({ staff_id: 7, role: 'member' });
    await expect(
      svc.editMessage('m1', 7, 'sua', 't1', new Date('2026-08-22T10:16:00Z')),
    ).rejects.toMatchObject({ response: { error: 'edit_window' } });
  });

  it('readonly member cannot post', async () => {
    repo.getById.mockResolvedValue({ id: 'r1', tenant_id: 't1', status: 'active' });
    repo.getMember.mockResolvedValue({ staff_id: 1, role: 'readonly' });
    await expect(svc.postMessage('r1', 1, { body: 'hi' }, 't1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
```

`getRoom` / `postMessage`: sai `tenant_id` trên row → 404.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement list / get / post / edit / tombstone / read**

`assertMember(roomId, staffId, tenantId)`: `getById` + tenant khớp + `getMember` else 404.

`postMessage`: member role `owner|member`; `readonly` → 404; room `archived` → 409 `{ error: 'room_archived' }`; body trim length ≥ 1 (text) else 400 `{ error: 'body' }`.

`editMessage`: author only; `canEditMessage` else 400 `edit_window`; tombstoned → 409 `{ error: 'tombstoned' }`.

`tombstone`: author trong 15p **hoặc** cap moderate (truyền `canModerate` từ controller). v1 service nhận `opts.canModerate`. Không hard-delete.

`listRooms`: `ensureSeeded(tenantId)` rồi `listForStaff`.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu.

---

### Task 5: Seed 12+11 + membership + create dm/huddle

**Files:**
- Modify: `services/ptt-crm-api/src/staff-chat/staff-chat.service.ts`
- Modify: `services/ptt-crm-api/src/staff-chat/staff-chat.service.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/org/bds-org-seed.ts` — **không** seed chat ở đây (CHAT có thể off). Seed trong `ensureSeeded`.

**Interfaces:**
- Consumes: `BDS_DEPARTMENT_SEEDS` từ `../bds/org/bds-org-seed`
- Produces: `ensureSeeded(tenantId)`, `createRoom`

- [ ] **Step 1: Tests**

```ts
  it('ensureSeeded upserts dept + cross codes', async () => {
    await svc.ensureSeeded('t1');
    expect(repo.upsertRoom).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 't1', kind: 'dept', code: 'ban_kd' }),
    );
    expect(repo.upsertRoom).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 't1', kind: 'cross', code: 'x_kd_collection' }),
    );
  });

  it('create dm requires two staff ids', async () => {
    await expect(svc.createRoom({ kind: 'dm' }, 7, 't1')).rejects.toBeInstanceOf(BadRequestException);
  });
```

Broker `getMe.mode === 'broker'`: vẫn `ensureSeeded` (room nội bộ sàn cùng schema, khác `tenant_id`). Không copy room CĐT.

- [ ] **Step 2: Implement `ensureSeeded`**

Với mỗi `BDS_DEPARTMENT_SEEDS`: `upsertRoom` kind `dept`, `sensitivity` = `isRestrictedCode(code) ? 'restricted' : 'normal'`, `department_id` từ org list (repo: thêm `getDepartmentIdByCode(code)` hoặc query trong `listStaffIdsByDepartmentCodes` path).

Nếu không resolve `department_id` (chưa seed P0): **skip** dept đó, không 500.

Cross: `upsertRoom` kind `cross`, `department_id` null, `sensitivity` normal (trừ khi mọi dept restricted — v1 luôn normal).

Membership:

```
const ids = await repo.listStaffIdsByDepartmentCodes([code]);
for (const id of ids) await repo.upsertMember(room.id, id, 'member');
```

Cross: union `dept_codes`.

`tgd` (`getStaffPositionCode === 'tgd'`): `upsertMember` mọi dept/cross với `readonly` (không ghi đè `owner`).

`createRoom`:

- `kind=dm`: body `{ peer_staff_id }` integer > 0 ≠ self; code `dm_{min}_{max}`; upsert; members owner+member.
- `kind=huddle`: body `{ name, expires_at?, member_staff_ids? }`; code caller-supplied hoặc `huddle_{uuid slice}`; creator `owner`.
- `kind=dept|cross` → 400 `{ error: 'kind' }` (chỉ seed).

- [ ] **Step 3: Run service spec — PASS**

- [ ] **Step 4: Commit** — chỉ khi user yêu cầu.

---

### Task 6: System card BDS-41/42 + huddle P10

**Files:**
- Modify: `services/ptt-crm-api/src/staff-chat/staff-chat.service.ts`
- Modify: `services/ptt-crm-api/src/staff-chat/staff-chat.service.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/transactions/bds-tx.service.ts`
- Modify: `services/ptt-crm-api/src/bds/transactions/bds-tx.service.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/launches/bds-launch.service.ts`
- Modify: `services/ptt-crm-api/src/bds/launches/bds-launch.service.spec.ts`

**Interfaces:**
- Produces:

```ts
postHandoffCard(tenantId: string, roomCode: string, card: {
  entity_type: string;
  entity_id: string;
  body: string;
}): Promise<MessageRow | null>

ensureLaunchHuddle(input: {
  tenantId: string;
  launchId: string;
  projectId: number;
  expiresAt?: Date | null;
  memberStaffIds?: number[];
}): Promise<RoomRow | null>

archiveLaunchHuddle(tenantId: string, launchId: string): Promise<void>
```

`listMessages` / `get` map card: nếu `kind=entity_card` và `!canViewEntity(staffId, entity_type)` → `{ ...msg, hidden: true, body: 'Hồ sơ ẩn', entity_id: '' }`.

v1 `canViewEntity`: `entity_type === 'tx'` → caller truyền `hasTxView` vào `listMessages(..., { hasTxView })`. Controller: `staffAuth.hasCapForPosition(positionId, 'bds_transactions', 'view')`.

- [ ] **Step 1: Chat tests**

```ts
  it('BDS-42 hides entity card without tx view', async () => {
    repo.getById.mockResolvedValue({ id: 'r1', tenant_id: 't1', status: 'active' });
    repo.getMember.mockResolvedValue({ staff_id: 7, role: 'member' });
    repo.listMessages.mockResolvedValue([
      { id: 'm1', kind: 'entity_card', body: 'TX A-1204', entity_type: 'tx', entity_id: 'tx1' },
    ]);
    const out = await svc.listMessages('r1', 7, 't1', { hasTxView: false });
    expect(out[0].hidden).toBe(true);
    expect(out[0].body).toBe('Hồ sơ ẩn');
    expect(out[0].entity_id).toBe('');
  });

  it('ensureLaunchHuddle upserts launch_* huddle', async () => {
    repo.upsertRoom.mockResolvedValue({ id: 'h1', code: 'launch_L1', kind: 'huddle' });
    await svc.ensureLaunchHuddle({ tenantId: 't1', launchId: 'L1', projectId: 7 });
    expect(repo.upsertRoom).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'huddle', code: 'launch_L1', entity_type: 'launch', entity_id: 'L1' }),
    );
  });
```

- [ ] **Step 2: TX hook**

`BdsTxService` constructor thêm `@Optional() private readonly chat?: StaffChatService` **cuối** (không phá test positional hiện có).

Sau `convertDeposit` thành công (đã có `tx.id`), nếu `isStaffChatEnabled()`:

```ts
try {
  await this.chat?.postHandoffCard(String(tx.tenant_id ?? opts.tenantId ?? ''), 'x_kd_collection', {
    entity_type: 'tx',
    entity_id: tx.id,
    body: `Cọc TX ${tx.id.slice(0, 8)} — lập lịch 4h`,
  });
} catch (err) {
  this.logger.warn(`handoff card deposit tx=${tx.id}: ${String(err)}`);
}
```

Không fail convert nếu chat lỗi.

Test:

```ts
it('BDS-41 posts system card on deposit when CHAT on', async () => {
  process.env.PTT_STAFF_CHAT = '1';
  const chat = { postHandoffCard: jest.fn().mockResolvedValue({ id: 'm1' }) };
  // ... existing convertDeposit mocks ...
  const svc = new BdsTxService(..., chat as never);
  await svc.convertDeposit(...);
  expect(chat.postHandoffCard).toHaveBeenCalledWith(
    expect.any(String),
    'x_kd_collection',
    expect.objectContaining({ entity_type: 'tx' }),
  );
});
```

Restore `PTT_STAFF_CHAT` trong `afterEach` tx spec.

`postHandoffCard`: `getByCode` + `insertMessage` kind `entity_card`, `author_staff_id` null. Không room → log + return null (không 500; seed chưa chạy).

- [ ] **Step 3: Launch hook**

`BdsLaunchService` constructor thêm `@Optional() chat?: StaffChatService` **cuối**.

`open` sau `setStatusIf` thành công:

```ts
if (isStaffChatEnabled()) {
  try {
    await this.chat?.ensureLaunchHuddle({
      tenantId,
      launchId: updated.id,
      projectId: updated.project_id,
      expiresAt: updated.ends_at,
    });
  } catch (err) {
    this.logger.warn(`ensureLaunchHuddle ${updated.id}: ${String(err)}`);
  }
}
```

`close` sau close thành công: `archiveLaunchHuddle(tenantId, row.id)` — `getByCode` + `upsertRoom` status `archived`.

Test launch spec: mock `chat.ensureLaunchHuddle` / `archiveLaunchHuddle`; CHAT=0 → không gọi.

- [ ] **Step 4: Run**

`cd services/ptt-crm-api && ./node_modules/.bin/jest src/staff-chat src/bds/transactions/bds-tx.service.spec.ts src/bds/launches/bds-launch.service.spec.ts --runInBand`

Expected: PASS (P4/P10 không regress khi CHAT=0).

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu.

---

### Task 7: Controller + module

**Files:**
- Create: `services/ptt-crm-api/src/staff-chat/staff-chat.controller.ts`
- Create: `services/ptt-crm-api/src/staff-chat/staff-chat.controller.spec.ts`
- Create: `services/ptt-crm-api/src/staff-chat/staff-chat.module.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.module.ts` — **không** import `StaffChatModule` nếu Nest circular. Khóa: `StaffChatModule` `exports: [StaffChatService]`; `BdsModule` `imports: [StaffChatModule]`. Nếu circular (hold/tx đã phức tạp): đăng ký `StaffChatService` trong `BdsModule` providers **cấm** — giữ module riêng + `forwardRef`.

**Interfaces:**
- Guards: `StaffOrInternalKeyGuard`, `StaffChatGuard`
- `staff_id` từ `req.staffUser.sub` qua `parseNumericStaffSub`

| Method | Path | Body / query | Lỗi |
|--------|------|----------------|-----|
| GET | `/api/v1/staff-chat/rooms` | | 404 CHAT off / no tenant |
| POST | `/api/v1/staff-chat/rooms` | `{ kind, peer_staff_id?, name?, expires_at?, member_staff_ids? }` | 400 `kind` |
| GET | `/api/v1/staff-chat/rooms/:id` | | 404 |
| GET | `/api/v1/staff-chat/rooms/:id/messages` | `?before_id=` | 404 |
| POST | `/api/v1/staff-chat/rooms/:id/messages` | `{ body, reply_to_id?, entity_type?, entity_id? }` | 400 `body` |
| PATCH | `/api/v1/staff-chat/messages/:id` | `{ body }` | 400 `edit_window` |
| POST | `/api/v1/staff-chat/messages/:id/tombstone` | `{ reason }` | 404 |
| POST | `/api/v1/staff-chat/rooms/:id/read` | `{ message_id }` | 404 |

`Idempotency-Key` header → `postMessage`.

Controller spec: `postMessage` delegate room id + staff + tenant.

- [ ] **Step 1: Controller spec + implement**

```ts
it('open post delegates room + tenant + staff', async () => {
  const svc = { postMessage: jest.fn().mockResolvedValue({ id: 'm1' }) };
  const staffAuth = { hasCapForPosition: jest.fn() };
  const ctl = new StaffChatController(svc as never, staffAuth as never);
  await ctl.postMessage('r1', { body: 'hi' }, 't1', {
    staffUser: { sub: '7', position_id: 1 },
  } as never);
  expect(svc.postMessage).toHaveBeenCalledWith('r1', 7, expect.objectContaining({ body: 'hi' }), 't1');
});
```

Internal key: `sub` thiếu → 404 (không giả staff).

- [ ] **Step 2: Register `StaffChatModule` trong `app.module.ts` (imports array).**

- [ ] **Step 3: Run**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/staff-chat src/bds/launches src/bds/transactions/bds-tx.service.spec.ts --runInBand
```

- [ ] **Step 4: Commit** — chỉ khi user yêu cầu.

---

### Task 8: UI `/crm/chat` + nav + roadmap

**Files:**
- Create: `services/ops-web/src/lib/staff-chat/flags.ts`
- Create: `services/ops-web/src/lib/staff-chat/flags.spec.ts`
- Create: `services/ops-web/src/lib/staff-chat/api.ts`
- Modify: `services/ops-web/src/lib/bds/nav.ts`
- Modify: `services/ops-web/src/lib/bds/nav.spec.ts`
- Modify: `services/ops-web/src/components/layout/nav-icons.tsx`
- Create: `services/ops-web/src/app/crm/chat/page.tsx`
- Modify: `docs/superpowers/plans/2026-08-22-bds-coding-roadmap.md`

**Interfaces:**
- FE flag: `isStaffChatFeEnabled()` = `NEXT_PUBLIC_PTT_STAFF_CHAT` qua cùng `envFlagOn` pattern `lib/bds/flags.ts` (copy 8 dòng).

- [ ] **Step 1: Nav tests**

```ts
it('CĐT with staff_chat view shows Chat when FE flag on', () => {
  process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
  process.env.NEXT_PUBLIC_PTT_STAFF_CHAT = '1';
  const links =
    buildBdsNavSections(
      user([
        { section: 'bds_tenant', action: 'view' },
        { section: 'staff_chat', action: 'view' },
      ]),
      'developer',
    )[0]?.links ?? [];
  expect(links.some((l) => l.href === '/crm/chat' && l.label === 'Chat')).toBe(true);
});

it('CHAT FE off hides Chat even with cap', () => {
  process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
  process.env.NEXT_PUBLIC_PTT_STAFF_CHAT = '0';
  const links =
    buildBdsNavSections(
      user([
        { section: 'bds_tenant', action: 'view' },
        { section: 'staff_chat', action: 'view' },
      ]),
      'developer',
    )[0]?.links ?? [];
  expect(links.some((l) => l.href === '/crm/chat')).toBe(false);
});
```

`buildDeveloperLinks` **và** `buildBrokerLinks` — cuối list:

```ts
if (isStaffChatFeEnabled() && hasCap(user, 'staff_chat', 'view')) {
  links.push({ href: '/crm/chat', label: 'Chat' });
}
```

Import `isStaffChatFeEnabled` từ `@/lib/staff-chat/flags`.

`nav-icons.tsx`: `'/crm/chat': 'inbox'` (hoặc icon chat có sẵn — **không** bịa tên icon mới nếu không có; dùng `'inbox'`).

Restore `NEXT_PUBLIC_PTT_STAFF_CHAT` trong `nav.spec.ts` `afterEach`.

- [ ] **Step 2: API helpers**

```ts
export type ChatRoom = {
  id: string;
  kind: 'dept' | 'cross' | 'dm' | 'huddle';
  code: string;
  name: string;
  sensitivity: 'normal' | 'restricted';
  status: 'active' | 'archived';
};

export type ChatMessage = {
  id: string;
  kind: string;
  body: string;
  hidden?: boolean;
  author_staff_id: number | null;
  created_at: string;
};

export async function fetchChatRooms(token: string): Promise<ChatRoom[]> {
  return staffChatFetch(token, '/api/v1/staff-chat/rooms');
}
export async function fetchChatMessages(token: string, roomId: string): Promise<ChatMessage[]> {
  return staffChatFetch(token, `/api/v1/staff-chat/rooms/${roomId}/messages`);
}
export function postChatMessage(token: string, roomId: string, body: string) {
  return staffChatMutate(token, `/api/v1/staff-chat/rooms/${roomId}/messages`, { body });
}
```

Copy header `Authorization` + `x-bds-tenant` từ `lib/bds/api.ts` `bdsFetch` / `bdsMutate` (nhân bản private helper trong `staff-chat/api.ts` — không export `bdsMutate`).

- [ ] **Step 3: Page** `app/crm/chat/page.tsx`

Auth: **không** dùng `useBdsPageAuth` (phụ thuộc `NEXT_PUBLIC_PTT_BDS_UI`). Copy pattern `crm/customers/page.tsx` (staff session) + nếu `!isStaffChatFeEnabled()` hoặc 404 API → «Chat nội bộ chưa bật».

3 cột (grid):

1. Room nhóm: Phòng tôi (`dept`) · Liên phòng (`cross`) · Huddle · DM  
2. Thread: list body; `hidden` → «Hồ sơ ẩn»; restricted banner «Không chuyển tiếp»  
3. Composer: input + Gửi (`staff_chat.post`); poll `fetchChatMessages` 5000ms khi chọn room `active`

Không nút «Chuyển thành ticket». Không SSE.

- [ ] **Step 4: Roadmap**

Bảng pha: P11 → `[bds-p11-staff-chat.md](./2026-08-22-bds-p11-staff-chat.md)` · BDS-39.  
§3 P11: `crm_staff_rooms` / card cọc / huddle `launch_*` / flag `PTT_STAFF_CHAT`.  
§4 hàng 17: `PTT_STAFF_CHAT | mặc định 0; chat nội bộ + huddle. Bật khi P0 org + P8 nav. Không bật prod.`

- [ ] **Step 5: Verify**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/staff-chat src/bds --runInBand
cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds src/lib/staff-chat
cd services/ptt-crm-api && npm run build
cd services/ops-web && npm run build
```

Expected: Jest xanh; Vitest xanh; 2 build exit 0.

- [ ] **Step 6: Commit** — chỉ khi user yêu cầu.

---

## 4. Definition of Done

- [ ] BDS-39: sàn không member `ban_kd` CĐT → GET room **404**
- [ ] BDS-40: không member `ban_phap_che` → POST **404**
- [ ] BDS-41: `convertDeposit` + CHAT=1 → card `x_kd_collection`
- [ ] BDS-42: không `bds_transactions.view` → card `hidden` / «Hồ sơ ẩn»
- [ ] BDS-43: sửa sau 15 phút → 400 `edit_window`
- [ ] CHAT=0: route staff-chat **404**; convert/launch P4/P10 **không** đổi
- [ ] Seed 12 dept + 11 cross idempotent
- [ ] Launch open → huddle `launch_{id}`; close → `archived`
- [ ] Nav CĐT + sàn «Chat» khi FE flag + cap
- [ ] Poll 5s, không SSE
- [ ] Prod không bật `PTT_STAFF_CHAT`

---

## 5. Rollback

`PTT_STAFF_CHAT=0` (+ `NEXT_PUBLIC_PTT_STAFF_CHAT=0`). Route 404. Hook no-op. Không DROP bảng.

---

## 6. Deploy VPS (khi user yêu cầu)

1. `bash scripts/apply_pg_ddl_bds_p11.sh` trên VPS.
2. rsync `ptt-crm-api/dist/` + `ops-web/.next/standalone/`.
3. `systemctl restart realosai-api realosai-ops-web`.
4. **Không** ghi `.env` `PTT_STAFF_CHAT=1` trên prod.

Staging:

```bash
PTT_BDS_PACK=1
PTT_STAFF_CHAT=1
PTT_BDS_UI=1
NEXT_PUBLIC_PTT_BDS_UI=1
NEXT_PUBLIC_PTT_STAFF_CHAT=1
# huddle launch cần thêm:
PTT_BDS_LAUNCH=1
PTT_BDS_TX=1
```

---

## 7. Sau P11 xanh

**P12** ticket việc + UC-054 convert + BDS-44…48.  
**P11b:** SSE `/stream`, card handoff còn lại §27.4, FTS, room project/case, job sync HR 1 phút.

---

*P11 thắng: staff CĐT nói trong phòng/liên phòng; sàn không thấy room CĐT; cọc hiện card công nợ; mở ra quân có huddle; đóng thì archive.*
