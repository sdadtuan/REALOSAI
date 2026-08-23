# W8 — Offboard TVV: mở hold chưa cọc, giữ hold đã cọc

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `hr_bp` bấm **Offboard** trên card user hiện có (`POST /api/v1/staff/org/users/:id/offboard`) thì hold **chưa cọc** về `available` (U-08), hold **đã cọc** + TX **không** mở căn (U-07); ticket `open`/`in_progress` chuyển trưởng ban; JWT cũ chết vì `auth_token_version` đã +1.

**Architecture:** Reuse-first (hướng 1). Một `BdsOffboardHookService` gọi `BdsHoldService.cancel` **đã có** — không `POST /bds/staff/offboard`, không `POST /staff/:id/offboard`, không spine `staff.offboarded`. `StaffOrgService.offboardUser` **sau COMMIT** gọi hook qua `ModuleRef.get(..., { strict: false })` — **cấm** `StaffOrgModule` import `BdsModule` (Bds đã import StaffOrg; giống W7 không import Webhooks). Ticket dùng `StaffTicketRepository` + `listStaffIdsByDeptAndPosition` đã có. Chat = JWT revoke sẵn — không API chat mới.

**Tech Stack:** NestJS + Jest (`ptt-crm-api`); Next.js + Vitest (`ops-web`).

**Spec:** [2026-08-23-bds-role-feature-execution.md](../specs/2026-08-23-bds-role-feature-execution.md) HR-05, §6–7 W8  
**Unification:** [2026-08-23-bds-crm-os-unification-design.md](../specs/2026-08-23-bds-crm-os-unification-design.md) U6 (phần hold), U-07, U-08  
**Journeys:** [13-BDS-ROLE-JOURNEYS.md](../../use-cases/13-BDS-ROLE-JOURNEYS.md) UC-074  
**OS plan:** [2026-08-23-bds-os-coding.md](./2026-08-23-bds-os-coding.md) Task 20–21  
**W7 (xong):** [2026-08-23-bds-w7-capi-finance.md](./2026-08-23-bds-w7-capi-finance.md)

## Global Constraints

- Không thay Q1–Q48. Không `app/crm/bds-v2`. Không `Bds2Module`.
- **Cấm** Kafka, **cấm** `bds_spine_events`, **cấm** `PTT_BDS_OS` / `PTT_BDS_HR_ROSTER` / `PTT_BDS_CSKH_BOARD` / `PTT_BDS_FINANCE_HUB`.
- **Cấm** `POST /api/v1/bds/staff/offboard` và `POST /api/v1/staff/:id/offboard`. Giữ `POST /api/v1/staff/org/users/:id/offboard`.
- **Cấm** sửa contract `BdsHoldService.cancel` / `BdsTxService` / inventory transition. Hook **gọi** `cancel`, không copy SQL mở căn.
- **Cấm** import `BdsModule` vào `StaffOrgModule`. Hook resolve bằng `ModuleRef` `strict: false` (W7: không import module ngược).
- Không flag mới. Gate hold = `PTT_BDS_PACK`. Gate ticket = `PTT_STAFF_TICKETS` đã có. PACK=0 → hook no-op (0/0/0), offboard user **vẫn OK**.
- Deposit lock = TX `hold_id` có `stage` ∈ `deposit|vbtt|contracted|handed_over|title_issued`. `reservation` / `cancelled` / `lost` / không TX = **chưa cọc** → release.
- Query TX lỗi (bảng chưa có) → **giữ hold** (fail-closed U-07). `cancel` ném `ConflictException` → giữ hold, sang căn kế.
- Hook lỗi **không** rollback user đã disable. Log `warn`. Response vẫn 200 + count.
- Chat cắt = `staff_users.auth_token_version + 1` **đã có** trong `offboardUser`. Không `revokeChat` / kick room.
- Không payroll (`PTT_BDS_PAYROLL_MAP`). Không KPI 3 mã. Không banner G0 (W8b). Không DDL.
- Test Nest: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand`
- Test FE: `cd services/ops-web && ./node_modules/.bin/vitest run <file>`
- Không commit trừ khi user yêu cầu.

### Gap hôm nay (khóa — đúng code)

| Chỗ | Thực tế |
|-----|---------|
| `StaffOrgUsersRepository.offboardUser` | Disable `crm_staff` + `staff_users`, reassign `crm_leads`, `auth_token_version++`, audit. **Không** đụng `bds_holds`. |
| `BdsHoldService.cancel` | Mở căn nếu `active` + unit `hold`. **Không** kiểm TX cọc. |
| `BdsHoldRepository` | Có `listByProject` / `listOpenByProduct`. **Không** `listOpenByStaff`. |
| `BdsTxRepository` | Có `getTx` / `listByProject`. **Không** `hasDepositForHold`. |
| Ticket | `assign()` đòi cùng dept + cap. HR offboard **khác** ban → không dùng `assign()`. Chưa `listOpenByStaff`. |
| `listStaffIdsByDeptAndPosition(dept, 'truong')` | Seed BĐS dùng `truong_inhouse` / `truong_kenh` — **không** code `truong`. |
| FE `UserIdentityCard` | Modal offboard sống. Copy chỉ «Chuyển lead». Không U-07/U-08. |
| Chat | Không API revoke. JWT version đã cắt session. |

### Cap / flag W8

| Bề mặt | Gate |
|--------|------|
| HTTP offboard | cap org users **đã có** (`StaffOrg` configure / roster) — không cap mới |
| Release hold | `PTT_BDS_PACK=1`; không thì skip hold |
| Reassign ticket | `PTT_STAFF_TICKETS=1`; không thì skip ticket |
| Chat | sẵn trong repo offboard (mọi flag) |
| FE modal | trang org users hiện có; không route mới |

### Ngoài W8 (cấm trong PR này)

- `PTT_BDS_OS`, `PTT_BDS_HR_ROSTER`, `POST /staff/:id/offboard`, `bds_spine_events`, Kafka.
- KPI pack 3 mã (`HR-06`) + `/crm/staff-kpi`. Banner G0 5 A (`HR-03`) + chặn Mở đợt. → **W8b**.
- Payroll map. Roster ca `ban_kd`. Cấm gán PC+Collection cùng DA (HR-07 — seed W0 đủ).
- Đổi contract hold/TX/receipt. Sửa `BdsHoldService.cancel` thêm check cọc (check nằm ở **hook**, không trong cancel — cancel vẫn dùng tay TVV).
- Client agency offboard (`/clients/:id/offboard`) — không đụng.

### Ba hướng (đã chọn 1)

| # | Cách | Trade-off |
|---|------|-----------|
| **1 (chọn)** | Nâng `offboardUser` + hook gọi `cancel` + ticket repo | Ship U-07/U-08 trên UI HR đã có; không endpoint / flag / spine |
| 2 | `POST /api/v1/bds/staff/offboard` + `PTT_BDS_HR_ROSTER` | Trùng HTTP staff-org; OS plan **cấm** |
| 3 | Outbox `staff.offboarded` + job fan-out | `bds_spine_events` / Kafka — unification W4 leftover; OS **cấm** trừ U-12 fail |

---

## File map

```
services/ptt-crm-api/src/bds/hold/bds-offboard.util.ts              CREATE — shouldRelease + lead position
services/ptt-crm-api/src/bds/hold/bds-offboard.util.spec.ts         CREATE
services/ptt-crm-api/src/bds/hold/bds-hold.repository.ts            NÂNG — listOpenByStaff
services/ptt-crm-api/src/bds/transactions/bds-tx.repository.ts      NÂNG — hasDepositForHold
services/ptt-crm-api/src/bds/hold/bds-offboard-hook.service.ts      CREATE
services/ptt-crm-api/src/bds/hold/bds-offboard-hook.service.spec.ts CREATE
services/ptt-crm-api/src/bds/bds.module.ts                          NÂNG — provide hook
services/ptt-crm-api/src/staff-tickets/staff-ticket.repository.ts   NÂNG — listOpenByStaff
services/ptt-crm-api/src/staff-tickets/staff-ticket.service.ts      NÂNG — reassignOpenTicketsOnOffboard
services/ptt-crm-api/src/staff-tickets/staff-ticket.service.spec.ts NÂNG
services/ptt-crm-api/src/staff-org/staff-org.types.ts               NÂNG — 3 count
services/ptt-crm-api/src/staff-org/staff-offboard-bds.util.ts       CREATE — gọi hook sau COMMIT (testable)
services/ptt-crm-api/src/staff-org/staff-offboard-bds.util.spec.ts  CREATE
services/ptt-crm-api/src/staff-org/staff-org.service.ts             NÂNG — ModuleRef sau COMMIT

services/ops-web/src/lib/bds/offboard-copy.ts                      CREATE
services/ops-web/src/lib/bds/offboard-copy.spec.ts                 CREATE
services/ops-web/src/lib/api.ts                                    NÂNG — type count
services/ops-web/src/components/rbac/UserIdentityCard.tsx           NÂNG — copy U-07/U-08
```

**Không tạo:** `BdsOffboardController`, `app/crm/bds/hr`, `bds-offboard.module.ts`.

---

### Task 1: Util U-07/U-08 + query list

**Files:**
- Create: `services/ptt-crm-api/src/bds/hold/bds-offboard.util.ts`
- Create: `services/ptt-crm-api/src/bds/hold/bds-offboard.util.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/hold/bds-hold.repository.ts`
- Modify: `services/ptt-crm-api/src/bds/transactions/bds-tx.repository.ts`

**Interfaces:**
- Consumes: `HoldRecordStatus`; `TxStage`
- Produces:
  - `shouldReleaseHoldOnOffboard({ holdStatus, txStage }): boolean`
  - `offboardLeadPositionCode(deptCode): string`
  - `BdsHoldRepository.listOpenByStaff(staffId: number): Promise<HoldRow[]>`
  - `BdsTxRepository.hasDepositForHold(holdId: string): Promise<boolean>`

- [ ] **Step 1: Write the failing test**

```ts
// services/ptt-crm-api/src/bds/hold/bds-offboard.util.spec.ts
import {
  offboardLeadPositionCode,
  shouldReleaseHoldOnOffboard,
} from './bds-offboard.util';

describe('shouldReleaseHoldOnOffboard', () => {
  it('U-08 pending / active without deposit', () => {
    expect(shouldReleaseHoldOnOffboard({ holdStatus: 'pending', txStage: null })).toBe(true);
    expect(shouldReleaseHoldOnOffboard({ holdStatus: 'active', txStage: 'reservation' })).toBe(true);
    expect(shouldReleaseHoldOnOffboard({ holdStatus: 'active', txStage: 'cancelled' })).toBe(true);
    expect(shouldReleaseHoldOnOffboard({ holdStatus: 'active', txStage: 'lost' })).toBe(true);
  });

  it('U-07 keeps hold after deposit or later', () => {
    for (const txStage of ['deposit', 'vbtt', 'contracted', 'handed_over', 'title_issued']) {
      expect(shouldReleaseHoldOnOffboard({ holdStatus: 'active', txStage })).toBe(false);
    }
  });

  it('ignores already-closed holds', () => {
    expect(shouldReleaseHoldOnOffboard({ holdStatus: 'cancelled', txStage: null })).toBe(false);
    expect(shouldReleaseHoldOnOffboard({ holdStatus: 'converted', txStage: 'deposit' })).toBe(false);
    expect(shouldReleaseHoldOnOffboard({ holdStatus: 'expired', txStage: null })).toBe(false);
  });
});

describe('offboardLeadPositionCode', () => {
  it('maps BĐS dept to trưởng — not generic truong', () => {
    expect(offboardLeadPositionCode('ban_kd')).toBe('truong_inhouse');
    expect(offboardLeadPositionCode('ban_kenh')).toBe('truong_kenh');
    expect(offboardLeadPositionCode('ban_phap_che')).toBe('truong_pc');
    expect(offboardLeadPositionCode('ban_tc_collection')).toBe('truong_collection');
    expect(offboardLeadPositionCode('unknown_dept')).toBe('truong');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/hold/bds-offboard.util.spec.ts --runInBand
```

Expected: FAIL — `Cannot find module './bds-offboard.util'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// services/ptt-crm-api/src/bds/hold/bds-offboard.util.ts
const OPEN_HOLD = new Set(['pending', 'active']);
const DEPOSIT_LOCK = new Set([
  'deposit',
  'vbtt',
  'contracted',
  'handed_over',
  'title_issued',
]);

const LEAD_POSITION: Record<string, string> = {
  ban_tgd: 'tgd',
  ban_du_an: 'pm_du_an',
  ban_san_pham: 'truong_sp',
  ban_kd: 'truong_inhouse',
  ban_kenh: 'truong_kenh',
  ban_cskh_presales: 'cskh_lead',
  ban_mkt: 'truong_mkt',
  ban_phap_che: 'truong_pc',
  ban_tc_collection: 'truong_collection',
  ban_tc_hh: 'cv_hh',
  ban_cskh_after: 'truong_after',
  ban_hr: 'hr_bp',
};

export function shouldReleaseHoldOnOffboard(input: {
  holdStatus: string;
  txStage: string | null | undefined;
}): boolean {
  if (!OPEN_HOLD.has(String(input.holdStatus))) return false;
  if (DEPOSIT_LOCK.has(String(input.txStage ?? ''))) return false;
  return true;
}

export function offboardLeadPositionCode(deptCode: string): string {
  return LEAD_POSITION[String(deptCode ?? '').trim()] ?? 'truong';
}

export const OFFBOARD_HOLD_REASON = 'offboard hold';
```

Thêm đúng 2 method repo (không đổi method cũ):

```ts
// BdsHoldRepository
async listOpenByStaff(staffId: number): Promise<HoldRow[]> {
  const res = await this.db.query(
    `SELECT * FROM bds_holds
     WHERE requested_by_staff_id = $1 AND status IN ('pending', 'active')
     ORDER BY created_at DESC`,
    [staffId],
  );
  return (res.rows as Record<string, unknown>[]).map((row) => this.mapHold(row));
}

// BdsTxRepository
async hasDepositForHold(holdId: string): Promise<boolean> {
  const res = await this.db.query(
    `SELECT 1 FROM bds_transactions
     WHERE hold_id = $1
       AND stage IN ('deposit', 'vbtt', 'contracted', 'handed_over', 'title_issued')
     LIMIT 1`,
    [holdId],
  );
  return Boolean(res.rows[0]);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/bds/hold/bds-offboard.util.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit** (chỉ khi user yêu cầu)

```bash
git commit -m "$(cat <<'EOF'
feat(bds): decide which holds to release on staff offboard

EOF
)"
```

---

### Task 2: Hook + ticket trưởng + gọi sau COMMIT

**Files:**
- Create: `services/ptt-crm-api/src/bds/hold/bds-offboard-hook.service.ts`
- Create: `services/ptt-crm-api/src/bds/hold/bds-offboard-hook.service.spec.ts`
- Create: `services/ptt-crm-api/src/staff-org/staff-offboard-bds.util.ts`
- Create: `services/ptt-crm-api/src/staff-org/staff-offboard-bds.util.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.module.ts`
- Modify: `services/ptt-crm-api/src/staff-tickets/staff-ticket.repository.ts`
- Modify: `services/ptt-crm-api/src/staff-tickets/staff-ticket.service.ts`
- Modify: `services/ptt-crm-api/src/staff-tickets/staff-ticket.service.spec.ts`
- Modify: `services/ptt-crm-api/src/staff-org/staff-org.types.ts`
- Modify: `services/ptt-crm-api/src/staff-org/staff-org.service.ts`

**Interfaces:**
- Consumes: `shouldReleaseHoldOnOffboard`, `offboardLeadPositionCode`, `OFFBOARD_HOLD_REASON`, `BdsHoldService.cancel`, `listOpenByStaff`, `hasDepositForHold`
- Produces:
  - `BdsOffboardHookResult = { holds_released: number; holds_kept: number; tickets_reassigned: number }`
  - `BdsOffboardHookService.onStaffOffboarded({ crmStaffId, tenantId? }): Promise<BdsOffboardHookResult>`
  - `runStaffOffboardBdsSideEffect(getHook, crmStaffId): Promise<BdsOffboardHookResult>`
  - `StaffTicketService.reassignOpenTicketsOnOffboard(fromStaffId): Promise<number>`
  - `OffboardStaffOrgUserResponse` thêm 3 field (default 0)
  - `StaffOrgUserDetail.crm_staff_id` **đã có** — `getUserById` sau COMMIT trả số này; không ALTER

- [ ] **Step 1: Write the failing hook test**

```ts
// services/ptt-crm-api/src/bds/hold/bds-offboard-hook.service.spec.ts
import { ConflictException } from '@nestjs/common';
import { BdsOffboardHookService } from './bds-offboard-hook.service';

function makeHook(overrides?: {
  pack?: boolean;
  ticketsOn?: boolean;
  holds?: Array<{ id: string; status: string; tenant_id?: string | null }>;
  deposit?: Record<string, boolean>;
  cancel?: jest.Mock;
  reassign?: jest.Mock;
}) {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevTk = process.env.PTT_STAFF_TICKETS;
  process.env.PTT_BDS_PACK = overrides?.pack === false ? '0' : '1';
  process.env.PTT_STAFF_TICKETS = overrides?.ticketsOn === false ? '0' : '1';
  const cancel = overrides?.cancel ?? jest.fn().mockImplementation(async (id: string) => ({ id }));
  const svc = new BdsOffboardHookService(
    { listOpenByStaff: jest.fn().mockResolvedValue(overrides?.holds ?? []) } as never,
    {
      hasDepositForHold: jest
        .fn()
        .mockImplementation(async (id: string) => Boolean(overrides?.deposit?.[id])),
    } as never,
    { cancel } as never,
    {
      reassignOpenTicketsOnOffboard:
        overrides?.reassign ?? jest.fn().mockResolvedValue(2),
    } as never,
  );
  return {
    svc,
    cancel,
    restore() {
      process.env.PTT_BDS_PACK = prevPack;
      process.env.PTT_STAFF_TICKETS = prevTk;
    },
  };
}

describe('BdsOffboardHookService', () => {
  it('PACK=0 does not list or cancel', async () => {
    const ctx = makeHook({ pack: false, holds: [{ id: 'h1', status: 'active' }] });
    try {
      await expect(ctx.svc.onStaffOffboarded({ crmStaffId: 9 })).resolves.toEqual({
        holds_released: 0,
        holds_kept: 0,
        tickets_reassigned: 0,
      });
      expect(ctx.cancel).not.toHaveBeenCalled();
    } finally {
      ctx.restore();
    }
  });

  it('U-08 cancels undeposited hold via BdsHoldService.cancel', async () => {
    const ctx = makeHook({
      holds: [{ id: 'h-empty', status: 'active', tenant_id: 't1' }],
      deposit: { 'h-empty': false },
    });
    try {
      const out = await ctx.svc.onStaffOffboarded({ crmStaffId: 9 });
      expect(out.holds_released).toBe(1);
      expect(out.holds_kept).toBe(0);
      expect(ctx.cancel).toHaveBeenCalledWith('h-empty', 'offboard hold', 't1');
    } finally {
      ctx.restore();
    }
  });

  it('U-07 does not cancel hold with deposit TX', async () => {
    const ctx = makeHook({
      holds: [{ id: 'h-dep', status: 'active' }],
      deposit: { 'h-dep': true },
    });
    try {
      const out = await ctx.svc.onStaffOffboarded({ crmStaffId: 9 });
      expect(out.holds_released).toBe(0);
      expect(out.holds_kept).toBe(1);
      expect(ctx.cancel).not.toHaveBeenCalled();
    } finally {
      ctx.restore();
    }
  });

  it('keeps hold when cancel conflicts', async () => {
    const ctx = makeHook({
      holds: [{ id: 'h1', status: 'active' }],
      deposit: { h1: false },
      cancel: jest.fn().mockRejectedValue(new ConflictException({ error: 'hold_closed' })),
    });
    try {
      const out = await ctx.svc.onStaffOffboarded({ crmStaffId: 9 });
      expect(out.holds_kept).toBe(1);
      expect(out.holds_released).toBe(0);
    } finally {
      ctx.restore();
    }
  });

  it('keeps hold when deposit lookup throws (fail-closed)', async () => {
    const holds = { listOpenByStaff: jest.fn().mockResolvedValue([{ id: 'h1', status: 'active' }]) };
    const prev = process.env.PTT_BDS_PACK;
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_STAFF_TICKETS = '0';
    const svc = new BdsOffboardHookService(
      holds as never,
      { hasDepositForHold: jest.fn().mockRejectedValue(new Error('no table')) } as never,
      { cancel: jest.fn() } as never,
      { reassignOpenTicketsOnOffboard: jest.fn() } as never,
    );
    try {
      const out = await svc.onStaffOffboarded({ crmStaffId: 9 });
      expect(out).toEqual({ holds_released: 0, holds_kept: 1, tickets_reassigned: 0 });
    } finally {
      process.env.PTT_BDS_PACK = prev;
    }
  });
});
```

Ticket service — thêm case (cùng file spec hiện có):

```ts
it('reassignOpenTicketsOnOffboard moves open tickets to dept lead', async () => {
  repo.listOpenByStaff.mockResolvedValue([{ id: 'tk1', status: 'open' }]);
  repo.getStaffDepartmentCode.mockResolvedValue('ban_kd');
  repo.listStaffIdsByDeptAndPosition.mockResolvedValue([44]);
  const n = await svc.reassignOpenTicketsOnOffboard(9);
  expect(n).toBe(1);
  expect(repo.updateTicket).toHaveBeenCalledWith('tk1', { assignee_staff_id: 44 });
  expect(repo.listStaffIdsByDeptAndPosition).toHaveBeenCalledWith('ban_kd', 'truong_inhouse');
});

it('reassignOpenTicketsOnOffboard no-ops without lead', async () => {
  repo.listOpenByStaff.mockResolvedValue([{ id: 'tk1' }]);
  repo.getStaffDepartmentCode.mockResolvedValue('ban_kd');
  repo.listStaffIdsByDeptAndPosition.mockResolvedValue([]);
  await expect(svc.reassignOpenTicketsOnOffboard(9)).resolves.toBe(0);
  expect(repo.updateTicket).not.toHaveBeenCalled();
});
```

Staff-org **không** new `StaffOrgService` trong test (repo lazy trong getter). Test helper thuần:

```ts
// services/ptt-crm-api/src/staff-org/staff-offboard-bds.util.spec.ts
import { runStaffOffboardBdsSideEffect } from './staff-offboard-bds.util';

describe('runStaffOffboardBdsSideEffect', () => {
  it('returns zeros when crmStaffId missing', async () => {
    const getHook = jest.fn();
    await expect(runStaffOffboardBdsSideEffect(getHook, undefined)).resolves.toEqual({
      holds_released: 0,
      holds_kept: 0,
      tickets_reassigned: 0,
    });
    expect(getHook).not.toHaveBeenCalled();
  });

  it('merges hook counts', async () => {
    const hook = {
      onStaffOffboarded: jest.fn().mockResolvedValue({
        holds_released: 1,
        holds_kept: 1,
        tickets_reassigned: 3,
      }),
    };
    const out = await runStaffOffboardBdsSideEffect(() => hook, 9);
    expect(hook.onStaffOffboarded).toHaveBeenCalledWith({ crmStaffId: 9 });
    expect(out).toEqual({ holds_released: 1, holds_kept: 1, tickets_reassigned: 3 });
  });

  it('returns zeros when getHook throws', async () => {
    await expect(
      runStaffOffboardBdsSideEffect(() => {
        throw new Error('not registered');
      }, 9),
    ).resolves.toEqual({ holds_released: 0, holds_kept: 0, tickets_reassigned: 0 });
  });

  it('returns zeros when onStaffOffboarded throws', async () => {
    await expect(
      runStaffOffboardBdsSideEffect(
        () => ({ onStaffOffboarded: jest.fn().mockRejectedValue(new Error('hold down')) }),
        9,
      ),
    ).resolves.toEqual({ holds_released: 0, holds_kept: 0, tickets_reassigned: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/bds/hold/bds-offboard-hook.service.spec.ts \
  src/staff-tickets/staff-ticket.service.spec.ts \
  src/staff-org/staff-offboard-bds.util.spec.ts \
  --runInBand
```

Expected: FAIL — hook class / util / `reassignOpenTicketsOnOffboard` missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// services/ptt-crm-api/src/bds/hold/bds-offboard-hook.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { isBdsPackEnabled } from '../bds.flags';
import { isStaffTicketsEnabled } from '../../staff-tickets/staff-ticket.flags';
import { StaffTicketService } from '../../staff-tickets/staff-ticket.service';
import { BdsTxRepository } from '../transactions/bds-tx.repository';
import { BdsHoldRepository } from './bds-hold.repository';
import { BdsHoldService } from './bds-hold.service';
import { OFFBOARD_HOLD_REASON, shouldReleaseHoldOnOffboard } from './bds-offboard.util';

export type BdsOffboardHookResult = {
  holds_released: number;
  holds_kept: number;
  tickets_reassigned: number;
};

@Injectable()
export class BdsOffboardHookService {
  private readonly logger = new Logger(BdsOffboardHookService.name);

  constructor(
    private readonly holds: BdsHoldRepository,
    private readonly txs: BdsTxRepository,
    private readonly holdService: BdsHoldService,
    private readonly tickets: StaffTicketService,
  ) {}

  async onStaffOffboarded(input: { crmStaffId: number; tenantId?: string }): Promise<BdsOffboardHookResult> {
    const out: BdsOffboardHookResult = {
      holds_released: 0,
      holds_kept: 0,
      tickets_reassigned: 0,
    };
    if (!Number.isFinite(input.crmStaffId) || input.crmStaffId <= 0) return out;

    if (isBdsPackEnabled()) {
      const rows = await this.holds.listOpenByStaff(input.crmStaffId);
      for (const hold of rows) {
        let hasDeposit = false;
        try {
          hasDeposit = await this.txs.hasDepositForHold(hold.id);
        } catch (err) {
          this.logger.warn(
            `offboard deposit lookup ${hold.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
          out.holds_kept += 1;
          continue;
        }
        if (!shouldReleaseHoldOnOffboard({ holdStatus: hold.status, txStage: hasDeposit ? 'deposit' : null })) {
          out.holds_kept += 1;
          continue;
        }
        try {
          await this.holdService.cancel(
            hold.id,
            OFFBOARD_HOLD_REASON,
            hold.tenant_id ?? input.tenantId,
          );
          out.holds_released += 1;
        } catch (err) {
          this.logger.warn(
            `offboard cancel ${hold.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
          out.holds_kept += 1;
        }
      }
    }

    if (isStaffTicketsEnabled()) {
      try {
        out.tickets_reassigned = await this.tickets.reassignOpenTicketsOnOffboard(input.crmStaffId);
      } catch (err) {
        this.logger.warn(
          `offboard tickets ${input.crmStaffId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return out;
  }
}
```

Ticket repo + service:

```ts
// StaffTicketRepository.listOpenByStaff
async listOpenByStaff(staffId: number): Promise<TicketRow[]> {
  const res = await this.db.query(
    `SELECT * FROM crm_staff_tickets
     WHERE (assignee_staff_id = $1 OR requester_staff_id = $1)
       AND status IN ('open', 'in_progress')
     ORDER BY created_at`,
    [staffId],
  );
  return res.rows.map((row) => this.mapTicket(row as Record<string, unknown>));
}

// StaffTicketService.reassignOpenTicketsOnOffboard
async reassignOpenTicketsOnOffboard(fromStaffId: number): Promise<number> {
  const tickets = await this.repo.listOpenByStaff(fromStaffId);
  if (!tickets.length) return 0;
  const dept = await this.repo.getStaffDepartmentCode(fromStaffId);
  if (!dept) return 0;
  const { offboardLeadPositionCode } = await import('../bds/hold/bds-offboard.util');
  let leadIds = await this.repo.listStaffIdsByDeptAndPosition(dept, offboardLeadPositionCode(dept));
  if (!leadIds.length) {
    leadIds = await this.repo.listStaffIdsByDeptAndPosition(dept, 'truong');
  }
  const to = leadIds.find((id) => id !== fromStaffId);
  if (!to) return 0;
  let n = 0;
  for (const ticket of tickets) {
    const updated = await this.repo.updateTicket(ticket.id, { assignee_staff_id: to });
    if (!updated) continue;
    await this.repo.insertEvent(ticket.id, 'assigned', to, {
      reason: 'offboard',
      from_staff_id: fromStaffId,
    });
    n += 1;
  }
  return n;
}
```

**Cấm** `await import` nếu eslint cấm — `import { offboardLeadPositionCode } from '../bds/hold/bds-offboard.util'` tĩnh ở đầu file. `staff-tickets` → `bds/hold/util` (pure, không Nest) **được**. Không import `BdsModule`.

Helper + `StaffOrgService` (constructor hiện: `config, staffAuth, jobFunctions, permissionSets, breakGlass, userClients` — thêm `moduleRef: ModuleRef` **cuối**):

```ts
// services/ptt-crm-api/src/staff-org/staff-offboard-bds.util.ts
export type OffboardBdsCounts = {
  holds_released: number;
  holds_kept: number;
  tickets_reassigned: number;
};

const EMPTY: OffboardBdsCounts = {
  holds_released: 0,
  holds_kept: 0,
  tickets_reassigned: 0,
};

export async function runStaffOffboardBdsSideEffect(
  getHook: () => { onStaffOffboarded: (input: { crmStaffId: number }) => Promise<OffboardBdsCounts> },
  crmStaffId: number | undefined | null,
): Promise<OffboardBdsCounts> {
  const id = Number(crmStaffId);
  if (!Number.isFinite(id) || id <= 0) return { ...EMPTY };
  try {
    const hook = getHook();
    return await hook.onStaffOffboarded({ crmStaffId: id });
  } catch {
    return { ...EMPTY };
  }
}
```

```ts
// StaffOrgService.offboardUser — sau usersRepository.offboardUser (đã COMMIT)
import { ModuleRef } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { BdsOffboardHookService } from '../bds/hold/bds-offboard-hook.service';
import { runStaffOffboardBdsSideEffect } from './staff-offboard-bds.util';

private readonly logger = new Logger(StaffOrgService.name);

const result = await this.usersRepository.offboardUser(user.id, body, actorEmail);
const functions = await this.jobFunctions.loadUserFunctionCodes(result.user.id);
const bds = await runStaffOffboardBdsSideEffect(
  () => this.moduleRef.get(BdsOffboardHookService, { strict: false }),
  result.user.crm_staff_id,
);
return {
  user: { ...result.user, job_functions: functions },
  leads_reassigned: result.leads_reassigned,
  ...bds,
};
```

`crm_staff_id` lấy từ `result.user` — `getUserById` **đã map** field này. Hook nhận **số `crm_staff.id`**, không UUID `staff_users.id`. Thiếu id → 0/0/0, user vẫn disable.

`OffboardStaffOrgUserResponse`:

```ts
export type OffboardStaffOrgUserResponse = {
  user: StaffOrgUserDetail;
  leads_reassigned: number;
  holds_released: number;
  holds_kept: number;
  tickets_reassigned: number;
};
```

`bds.module.ts` — thêm `BdsOffboardHookService` vào `providers` + `exports` (để `ModuleRef` thấy). Không đổi `imports`.

`StaffOrgModule` — **không** thêm `BdsModule`. `ModuleRef` là `@nestjs/core` — không cần import module.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/bds/hold/bds-offboard.util.spec.ts \
  src/bds/hold/bds-offboard-hook.service.spec.ts \
  src/bds/hold/bds-hold.service.spec.ts \
  src/staff-tickets/staff-ticket.service.spec.ts \
  src/staff-org/staff-offboard-bds.util.spec.ts \
  --runInBand
```

Expected: PASS. `bds-hold.service.spec` **không** đổi hành vi `cancel` tay TVV.

- [ ] **Step 5: Commit** (chỉ khi user yêu cầu)

```bash
git commit -m "$(cat <<'EOF'
feat(bds): release undeposited holds inside existing staff offboard

EOF
)"
```

---

### Task 3: Copy U-07/U-08 trên modal offboard hiện có

**Files:**
- Create: `services/ops-web/src/lib/bds/offboard-copy.ts`
- Create: `services/ops-web/src/lib/bds/offboard-copy.spec.ts`
- Modify: `services/ops-web/src/lib/api.ts` (`offboardStaffOrgUser` return type)
- Modify: `services/ops-web/src/components/rbac/UserIdentityCard.tsx`

**Interfaces:**
- Consumes: response `holds_released` / `holds_kept` / `tickets_reassigned` (optional — old API thiếu field vẫn chạy)
- Produces: `offboardHoldDisclaimer()`, `offboardHoldSummary(counts)`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { offboardHoldDisclaimer, offboardHoldSummary } from './offboard-copy';

describe('offboard-copy', () => {
  it('warns U-07 / U-08 before confirm', () => {
    const text = offboardHoldDisclaimer();
    expect(text).toMatch(/chưa cọc/i);
    expect(text).toMatch(/đã cọc/i);
    expect(text).not.toMatch(/xóa căn/i);
  });

  it('summarizes counts after success', () => {
    expect(
      offboardHoldSummary({ holds_released: 1, holds_kept: 2, tickets_reassigned: 3 }),
    ).toMatch(/1.*mở/);
    expect(
      offboardHoldSummary({ holds_released: 1, holds_kept: 2, tickets_reassigned: 3 }),
    ).toMatch(/2.*giữ/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds/offboard-copy.spec.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// services/ops-web/src/lib/bds/offboard-copy.ts
export function offboardHoldDisclaimer(): string {
  return 'Hold chưa cọc sẽ mở căn (available). Hold đã cọc + giao dịch giữ căn — không mở.';
}

export function offboardHoldSummary(input: {
  holds_released?: number;
  holds_kept?: number;
  tickets_reassigned?: number;
}): string {
  const released = Number(input.holds_released ?? 0);
  const kept = Number(input.holds_kept ?? 0);
  const tickets = Number(input.tickets_reassigned ?? 0);
  return `Hold mở ${released} · giữ ${kept} · việc chuyển trưởng ${tickets}.`;
}
```

`UserIdentityCard` — dưới `<p className="muted">Chuyển lead...`:

```tsx
<p className="muted">{offboardHoldDisclaimer()}</p>
```

Sau `offboardStaffOrgUser` thành công, nếu có count thì `setError('')` + hiện `offboardHoldSummary(out)` (một dòng muted trong modal trước đóng, hoặc toast hiện có). Không route mới.

`offboardStaffOrgUser` type:

```ts
Promise<{
  user: StaffOrgUserSummary;
  leads_reassigned: number;
  holds_released?: number;
  holds_kept?: number;
  tickets_reassigned?: number;
}>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd services/ops-web && ./node_modules/.bin/vitest run src/lib/bds/offboard-copy.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit** (chỉ khi user yêu cầu)

```bash
git commit -m "$(cat <<'EOF'
feat(ops-web): warn hold deposit rules on existing offboard modal

EOF
)"
```

---

### Task 4: Verify U-07 / U-08 + không W8b / hướng 2–3

**Files:** không file mới trừ sửa nếu build fail.

- [ ] **Step 1: Nest W8 subset**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/bds/hold/bds-offboard.util.spec.ts \
  src/bds/hold/bds-offboard-hook.service.spec.ts \
  src/bds/hold/bds-hold.service.spec.ts \
  src/staff-tickets/staff-ticket.service.spec.ts \
  src/staff-org/staff-offboard-bds.util.spec.ts \
  --runInBand
```

Expected: all PASS.

- [ ] **Step 2: FE W8 subset**

```bash
cd services/ops-web && ./node_modules/.bin/vitest run \
  src/lib/bds/offboard-copy.spec.ts \
  src/lib/bds/nav.spec.ts
```

Expected: PASS. Nav **không** thêm `/crm/bds/hr` hay `/crm/staff-kpi`.

- [ ] **Step 3: Production builds**

```bash
cd services/ptt-crm-api && npm run build
cd services/ops-web && NEXT_PUBLIC_PTT_BDS_UI=1 npm run build
```

Expected: both compile. Mock `OffboardStaffOrgUserResponse` thiếu 3 field → thêm `0`.

- [ ] **Step 4: Leak check hướng 2–3 / W8b**

```bash
rg -n "PTT_BDS_OS|PTT_BDS_HR_ROSTER|PTT_BDS_CSKH_BOARD|PTT_BDS_FINANCE_HUB|bds_spine_events|/bds/staff/offboard|/staff/.*/offboard|BdsOffboardController|staff.offboarded|PTT_BDS_PAYROLL_MAP" \
  services/ptt-crm-api/src/bds \
  services/ptt-crm-api/src/staff-org \
  services/ops-web/src/lib/bds \
  services/ops-web/src/app/crm/bds \
  services/ops-web/src/components/rbac
```

Expected:

| Pattern | Được |
|---------|------|
| `offboard hold` / `BdsOffboardHookService` / `shouldReleaseHoldOnOffboard` | Task 1–2 |
| `POST .../staff/org/users/:id/offboard` | **đã có** — giữ |
| `/bds/staff/offboard` / `BdsOffboardController` / `POST /staff/:id/offboard` | **0** |
| `PTT_BDS_OS` / `PTT_BDS_HR_ROSTER` / `bds_spine_events` / `staff.offboarded` | **0** |
| `PTT_BDS_PAYROLL_MAP` / banner G0 / `staff-kpi` trong PR | **0** |

`StaffOrgModule` import list **không** chứa `BdsModule`.

- [ ] **Step 5: Commit verify-only fixes nếu có**

```bash
git commit -m "$(cat <<'EOF'
fix(bds): keep W8 offboard types build-safe

EOF
)"
```

Chỉ khi Step 3 bắt buộc sửa.

---

## Coverage vs spec §7 W8

| Tiêu chí | Task |
|----------|------|
| U-08 hold chưa cọc → `cancel` → căn available | 1 + 2 |
| U-07 hold đã cọc → không `cancel` | 1 + 2 |
| Disable user + reassign `crm_leads` + JWT +1 | giữ repo — không đụng |
| Ticket open → trưởng ban (`truong_inhouse` không `truong`) | 2 |
| Chat cắt | giữ `auth_token_version` — không API mới |
| Không `POST /bds/staff/offboard` | 4 leak |
| Không spine / OS / HR_ROSTER | 4 leak |
| Copy U-07/U-08 trên modal HR có sẵn | 3 |
| KPI 3 mã + banner G0 | **W8b — không làm** |
| Không payroll | 4 leak |

## UAT staging (sau deploy Nest + ops-web)

Giữ flag pack. Không flag mới. Không bật CAPI / OS / payroll.

| # | Persona | Việc | Kỳ vọng |
|---|---------|------|---------|
| 1 | `tvv_inhouse` | Hold căn trống `active` | Hàng hold |
| 2 | `hr_bp` | Offboard TVV → `reassign_to` = `crm_staff` trưởng | User `active=false` |
| 3 | — | Cùng căn bước 1 | status unit `available` (U-08) |
| 4 | `tvv_inhouse` B | Hold + `convertDeposit` | TX `deposit` |
| 5 | `hr_bp` | Offboard TVV B | Hold **còn**; unit **không** `available` (U-07) |
| 6 | — | Ticket `open` của TVV B | `assignee` = `truong_inhouse` cùng `ban_kd` |
| 7 | TVV B | Login JWT cũ | 401 (version) |
| 8 | `hr_bp` | Offboard khi `PTT_BDS_PACK=0` (nếu thử local) | User disable; không 500 |
| 9 | GĐKD | `cancel` hold tay (không offboard) | Vẫn như W1 — không regression |
| 10 | `tgd` | Hub `/crm/bds` | 4 số W7 còn |

10 case journeys §E: chỉ **UC-074 / BDS-D-12** là cửa W8. Các case W1–W7 không claim lại.

---

## Self-review

| Spec | Task |
|------|------|
| OS Task 20 GIỮ `offboardUser` | 2 |
| OS Task 20 NÂNG `cancel` hold chưa cọc | 1–2 |
| OS Task 20 không cancel nếu TX deposit | 1–2 |
| OS Task 20 ticket → trưởng | 2 |
| OS Task 20 CẤM POST BĐS mới | 4 |
| §7 W8 xong = U-07/U-08 | 1–2 + UAT |
| UC-074 chat cắt | token_version sẵn |
| HR-03/HR-06 | ngoài — W8b |
| Q35 không fork payroll | 4 |

Không placeholder. Tên hàm `onStaffOffboarded` / `shouldReleaseHoldOnOffboard` / `reassignOpenTicketsOnOffboard` thống nhất Task 1–4.
