# P1b Triển khai — Project OS lõi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tòa/khu/layout, cổng `legal_gate`, đợt mở bán, mốc thi công, duyệt kế hoạch — `POST /phases/:id/open` trả 400 `legal_gate` khi cổng blocked (BDS-21); revision `approved` mới tính bước workflow `done` (BR-BDS-25 / BDS-29).

**Architecture:** Bounded context `src/bds/project-os/`. HTTP dưới `/api/v1/bds` sau `StaffOrInternalKeyGuard` + `BdsPackGuard` + `BdsProjectOsGuard` (`PTT_BDS_PACK=1` **và** `PTT_BDS_PROJECT_OS=1`). `crm_re_projects.legal_gate` (đã có từ P0) là nguồn sự thật cổng. Không hold, không CSBH activate, không UI `/crm/bds`.

**Tech Stack:** NestJS `ptt-crm-api`, Jest local binary, `pg` Pool, `psql`.

**Spec:** [2026-08-21-bds-industry-pack-design.md](../specs/2026-08-21-bds-industry-pack-design.md) §21.1–21.5, §10.4, §15 P1b, BR-BDS-16/25.  
**UC:** 006 legal-docs · 007 legal-gate · 008 mở đợt.  
**P1:** [2026-08-22-bds-p1-inventory-os.md](./2026-08-22-bds-p1-inventory-os.md)  
**Roadmap:** [2026-08-22-bds-coding-roadmap.md](./2026-08-22-bds-coding-roadmap.md)

**Test ID:** BDS-21 (mở đợt khi blocked). BDS-29 + BR-BDS-25 (revision approved → bước `business` done). **BDS-25 trong §14 (override hạng)** = P5 — không làm ở P1b.

## Global Constraints

- `PTT_BDS_PACK` mặc định `0` — mọi `POST /api/v1/bds/*` = **404**.
- `PTT_BDS_PROJECT_OS` mặc định `0` — route Project OS = **404** dù PACK=1.
- GET ngoài tenant = 404, không PII (BR-BDS-05). Optional header `x-bds-tenant` giống P1 inventory.
- Không xóa `re-projects/`. Không đụng `crm_b2b_projects`. Không tạo `bds_holds`.
- `POST /phases/:id/open` khi `legal_gate=blocked` → 400 `{ error: 'legal_gate' }` (BDS-21, BR-BDS-16).
- Duyệt KH: bước workflow `business`/`marketing`/`sales` = `done` **chỉ** khi revision `approved` mới nhất (BR-BDS-25) khi PROJECT_OS=1.
- Override cổng: `reason` trim ≥ 10; hết hạn 15 ngày; **không** dùng cho HĐMB (P4b).
- `DATABASE_URL` script: `postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb`.
- Test: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand` (không `npx jest`).
- Không commit trừ khi user yêu cầu.
- Prod VPS: **không** bật PACK hay PROJECT_OS.

---

## 0. Phạm vi / ngoài phạm vi

**Làm**

- Flag `PTT_BDS_PROJECT_OS` + `BdsProjectOsGuard`
- DDL: `bds_towers`, `bds_zones`, `bds_unit_layouts`, `bds_legal_documents`, `bds_launch_phases`, `bds_build_milestones`, `bds_plan_revisions`
- Cột `crm_re_projects`: `current_phase_id`, `legal_gate_override_until`, `legal_gate_override_reason`
- CRUD tòa/khu/layout; legal docs; mở/đóng cổng; mở đợt; mốc `planned|reached`; revision draft→approved
- Hook workflow util khi PROJECT_OS=1

**Không làm**

- Hold / TTL / agency / CSBH activate / collection / HĐMB
- `bds_project_files`, `bds_project_raci`, `bds_phase_units` materialize, nightly expire job
- Object storage upload thật — `file_id` là chuỗi
- UI ops-web
- Layout cascade giá hàng loạt (chỉ lưu `layout_id` trên bảng layout)

---

## 1. File map

```
docs/specs/postgresql-ddl-bds-p1b.sql
scripts/apply_pg_ddl_bds_p1b.sh

services/ptt-crm-api/src/bds/bds.flags.ts          # + isBdsProjectOsEnabled
services/ptt-crm-api/src/config/app-config.service.ts  # bdsProjectOsEnabled
services/ptt-crm-api/src/bds/guards/bds-project-os.guard.ts
services/ptt-crm-api/src/bds/project-os/bds-legal-gate.util.ts
services/ptt-crm-api/src/bds/project-os/bds-legal-gate.util.spec.ts
services/ptt-crm-api/src/bds/project-os/bds-project-os.repository.ts
services/ptt-crm-api/src/bds/project-os/bds-project-os.service.ts
services/ptt-crm-api/src/bds/project-os/bds-project-os.service.spec.ts
services/ptt-crm-api/src/bds/project-os/bds-project-os.controller.ts
services/ptt-crm-api/src/bds/bds.module.ts
services/ptt-crm-api/src/re-projects/re-projects-workflow.util.ts
services/ptt-crm-api/src/re-projects/re-projects-workflow.util.spec.ts  # nếu chưa có: tạo
```

---

### Task 1: Flag PROJECT_OS + guard

**Files:**
- Modify: `services/ptt-crm-api/src/bds/bds.flags.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.flags.spec.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts` — `bdsProjectOsEnabled` cạnh `bdsPgEnabled`
- Create: `services/ptt-crm-api/src/bds/guards/bds-project-os.guard.ts`
- Create: `services/ptt-crm-api/src/bds/guards/bds-project-os.guard.spec.ts`

**Interfaces:**
- Produces: `isBdsProjectOsEnabled(): boolean`, `BdsProjectOsGuard` → 404 unless PACK **và** PROJECT_OS

- [ ] **Step 1: Extend flags spec**

```ts
import { isBdsProjectOsEnabled } from './bds.flags';

it('defaults PROJECT_OS off when unset', () => {
  delete process.env.PTT_BDS_PROJECT_OS;
  expect(isBdsProjectOsEnabled()).toBe(false);
});

it('PROJECT_OS on for 1', () => {
  process.env.PTT_BDS_PROJECT_OS = '1';
  expect(isBdsProjectOsEnabled()).toBe(true);
});
```

Cũng test guard: PACK=0 → 404; PACK=1 PROJECT_OS=0 → 404; cả hai 1 → true.

- [ ] **Step 2: RED rồi implement**

```ts
export function isBdsProjectOsEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_PROJECT_OS);
}
```

Guard:

```ts
import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isBdsPackEnabled, isBdsProjectOsEnabled } from '../bds.flags';

@Injectable()
export class BdsProjectOsGuard implements CanActivate {
  canActivate(): boolean {
    if (!isBdsPackEnabled() || !isBdsProjectOsEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
```

`AppConfigService`: `bdsProjectOsEnabled` cùng kiểu `bdsPgEnabled`.

Jest: `./node_modules/.bin/jest src/bds/bds.flags.spec.ts src/bds/guards/bds-project-os.guard.spec.ts --runInBand`

- [ ] **Step 3: Commit** — chỉ khi user yêu cầu: `feat(bds): P1b PROJECT_OS flag and guard`

---

### Task 2: DDL Project OS

**Files:**
- Create: `docs/specs/postgresql-ddl-bds-p1b.sql`
- Create: `scripts/apply_pg_ddl_bds_p1b.sh` (copy P1 script, đổi file + echo `OK  bds P1b DDL`)

- [ ] **Step 1: Write DDL**

```sql
-- Pack BĐS P1b — Apply: scripts/apply_pg_ddl_bds_p1b.sh
BEGIN;

ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS current_phase_id UUID;
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS legal_gate_override_until TIMESTAMPTZ;
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS legal_gate_override_reason TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS bds_towers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  floor_min INTEGER NOT NULL DEFAULT 1,
  floor_max INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, lower(trim(code)))
);

CREATE TABLE IF NOT EXISTS bds_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, lower(trim(code)))
);

CREATE TABLE IF NOT EXISTS bds_unit_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  area_m2 NUMERIC,
  list_price_vnd BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, lower(trim(code)))
);

CREATE TABLE IF NOT EXISTS bds_legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'missing'
    CHECK (status IN ('missing', 'valid', 'expired', 'rejected')),
  file_id TEXT NOT NULL DEFAULT '',
  issued_on DATE,
  expires_on DATE,
  required_for_sale BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bds_launch_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'closed')),
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  open_to_channel BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, lower(trim(code)))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_launch_phases_one_active
  ON bds_launch_phases (project_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS bds_build_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  target_date DATE,
  actual_date DATE,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'reached', 'delayed')),
  unlocks_installment_index INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, lower(trim(code)))
);

CREATE TABLE IF NOT EXISTS bds_plan_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('business', 'marketing', 'sales')),
  version INTEGER NOT NULL,
  body_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'approved', 'rejected')),
  submitted_by TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, kind, version)
);

COMMIT;
```

Nếu `UNIQUE (project_id, lower(trim(code)))` fail trên PG cũ: dùng unique index `ON (project_id, lower(trim(code)))` thay.

- [ ] **Step 2: Apply local**

```bash
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
bash scripts/apply_pg_ddl_bds_p1b.sh
psql "$DATABASE_URL" -c '\dt bds_*'
```

Expected: 7 bảng `bds_towers` … `bds_plan_revisions`. Idempotent lần 2.

---

### Task 3: Legal gate util + service (mở cổng)

**Files:**
- Create: `bds-legal-gate.util.ts` + spec
- Create: `bds-project-os.repository.ts` (legal + project gate columns)
- Create: `bds-project-os.service.ts` + spec (phần legal)

**Interfaces:**
- `REQUIRED_SALE_DOC_TYPES = ['quy_hoach_1_500','qsd_dat','nghia_vu_tai_chinh','gpxd','nghiem_thu_mong','bao_lanh_nh','so_xd_du_dieu_kien_ban']`
- `computeLegalGate(docs, now, overrideUntil): 'blocked'|'enough_to_sell'|'restricted'`
- `assertOpenPhaseAllowed(legalGate): void` ném `legal_gate` nếu không `enough_to_sell`

Quy tắc compute:
1. Nếu `overrideUntil` > now → `enough_to_sell` (restricted nếu có required doc `expired` **và** không override).
2. Mỗi type trong REQUIRED phải có đúng một doc `valid` (chưa hết hạn). Thiếu → `blocked`.
3. Có required doc `expired` → `restricted` (không đủ mở đợt — `assertOpenPhaseAllowed` cũng fail).

- [ ] **Step 1: Tests**

```ts
describe('computeLegalGate', () => {
  const valid = REQUIRED_SALE_DOC_TYPES.map((doc_type) => ({
    doc_type, status: 'valid', expires_on: null as string | null,
  }));

  it('blocked when a required type is missing', () => {
    expect(computeLegalGate(valid.slice(1), new Date(), null)).toBe('blocked');
  });

  it('enough_to_sell when all required valid', () => {
    expect(computeLegalGate(valid, new Date(), null)).toBe('enough_to_sell');
  });

  it('restricted when required doc expired', () => {
    const docs = valid.map((d) =>
      d.doc_type === 'gpxd' ? { ...d, status: 'expired', expires_on: '2020-01-01' } : d,
    );
    expect(computeLegalGate(docs, new Date('2026-01-01'), null)).toBe('restricted');
  });

  it('override until future → enough_to_sell', () => {
    expect(computeLegalGate([], new Date('2026-01-01'), new Date('2026-01-10'))).toBe('enough_to_sell');
  });
});

describe('assertOpenPhaseAllowed', () => {
  it('BDS-21 throws legal_gate when blocked', () => {
    expect(() => assertOpenPhaseAllowed('blocked')).toThrow(/legal_gate/);
  });
  it('allows enough_to_sell', () => {
    expect(() => assertOpenPhaseAllowed('enough_to_sell')).not.toThrow();
  });
});
```

Service tests (mock repo):
- `upsertLegalDoc` rồi `refreshLegalGate` ghi `crm_re_projects.legal_gate`
- `openLegalGate({ override:true, reason:'x' })` → 400 reason
- `openLegalGate({ override:true, reason:'du long hon muoi' })` set until = now+15d + enough_to_sell

- [ ] **Step 2: Implement util + repo methods** `listLegalDocs`, `upsertLegalDoc`, `getProjectGate`, `setProjectGate(projectId, gate, overrideUntil?, reason?)`

`openLegalGate`: nếu compute = enough → ghi. Nếu override + reason.trim().length>=10 → ghi enough + until. Else `BadRequestException({ error: 'legal_gate' })`.

---

### Task 4: Towers / zones / layouts + phases + BDS-21

**Files:** cùng service/repo + spec

**Interfaces:**
- `createTower/Zone/Layout(projectId, { code, name, ... })`
- `createPhase(projectId, { code, name, open_to_channel })` status `planned`
- `openPhase(phaseId, tenantId?)` → `assertOpenPhaseAllowed` rồi set `active`, close other actives (transaction), set `current_phase_id`
- `closePhase(phaseId)` → `closed`

- [ ] **Step 1: Service tests**

```ts
it('BDS-21 openPhase when blocked → 400 legal_gate', async () => {
  repo.getProjectGate.mockResolvedValue({ legal_gate: 'blocked' });
  repo.getPhase.mockResolvedValue({ id: 'p1', project_id: 7, status: 'planned' });
  await expect(svc.openPhase('p1')).rejects.toMatchObject({ response: { error: 'legal_gate' } });
  // hoặc BadRequestException.getResponse() === { error: 'legal_gate' }
});

it('openPhase when enough_to_sell activates and sets current_phase_id', async () => {
  repo.getProjectGate.mockResolvedValue({ legal_gate: 'enough_to_sell' });
  repo.getPhase.mockResolvedValue({ id: 'p1', project_id: 7, status: 'planned' });
  repo.activatePhase.mockResolvedValue({ id: 'p1', status: 'active' });
  const out = await svc.openPhase('p1');
  expect(repo.activatePhase).toHaveBeenCalledWith('p1', 7);
  expect(out.status).toBe('active');
});
```

`activatePhase` SQL trong transaction:
1. `UPDATE bds_launch_phases SET status='closed' WHERE project_id=$1 AND status='active' AND id<>$2`
2. `UPDATE bds_launch_phases SET status='active' WHERE id=$2`
3. `UPDATE crm_re_projects SET current_phase_id=$2 WHERE id=$1`

Duplicate tower code → 409.

- [ ] **Step 2: Implement + Jest xanh**

---

### Task 5: Plan revisions (BDS-29) + milestones

**Files:** service/repo + `re-projects-workflow.util.ts`

**Interfaces:**
- `createRevision(projectId, { kind, body_json })` version = max+1, status draft
- `approveRevision(id, reviewed_by)` status approved, reviewed_at now; reason không bắt buộc
- `latestApprovedKinds(projectId): ('business'|'marketing'|'sales')[]`
- `markMilestoneReached(id, actual_date)` — **không** đụng installment (P4)

Workflow: thêm optional arg `approvedKinds?: string[]`. Khi `isBdsProjectOsEnabled()` **và** caller truyền `approvedKinds`:
- `business` step = `done` iff `approvedKinds.includes('business')` — **không** lấy `business_plan.approval_status` JSON.
- Tương tự marketing/sales.

Khi PROJECT_OS=0 hoặc `approvedKinds` omitted: hành vi cũ (không phá P0).

Tìm chỗ gọi `buildReProjectWorkflow` / tương đương — truyền `approvedKinds` khi flag on (service RE hoặc project-os đọc revisions). Nếu caller ở `re-projects.service` projectSummary/workflow: `@Optional()` inject project-os repo **hoặc** export hàm `listApprovedKinds` từ project-os và gọi khi flag on. **Không** import `ReProjectsModule` từ `BdsModule`.

- [ ] **Step 1: Tests**

```ts
it('BDS-29 business done only after approved revision when kinds passed', () => {
  const proj = { business_plan: { vision: 'x', approval_status: 'approved' } } as any;
  const steps = buildWorkflow(proj, {}, { approvedKinds: [] });
  expect(steps.find((s) => s.id === 'business').status).toBe('pending'); // hoặc in_progress nếu JSON có content — PHẢI pending/in_progress KHÔNG done
  const done = buildWorkflow(proj, {}, { approvedKinds: ['business'] });
  expect(done.find((s) => s.id === 'business').status).toBe('done');
});
```

**Khóa:** khi `approvedKinds` được truyền (kể cả `[]`), JSON `approval_status` **không** đủ để `done`.

- [ ] **Step 2: Implement + wire một GET workflow path nếu đã có**

Nếu không có hàm export `buildWorkflow`, đổi `businessStepStatus` nhận optional `forceApproved: boolean | undefined` — `undefined` = logic cũ; `false` = không done từ JSON; `true` = done.

---

### Task 6: HTTP controller + module + DoD

**Files:**
- Create: `bds-project-os.controller.ts`
- Modify: `bds.module.ts`
- Update roadmap P1b row → file plan này

**Guards:** `@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsProjectOsGuard)` — auth → pack → project-os.

| Method | Path |
|--------|------|
| GET/POST | `/api/v1/bds/projects/:id/towers` |
| GET/POST | `/api/v1/bds/projects/:id/zones` |
| GET/POST | `/api/v1/bds/projects/:id/layouts` |
| GET/POST | `/api/v1/bds/projects/:id/legal-docs` |
| POST | `/api/v1/bds/projects/:id/legal-gate` body `{ override?: boolean, reason?: string }` |
| GET/POST | `/api/v1/bds/projects/:id/phases` |
| POST | `/api/v1/bds/phases/:id/open` |
| POST | `/api/v1/bds/phases/:id/close` |
| GET/POST | `/api/v1/bds/projects/:id/milestones` |
| POST | `/api/v1/bds/milestones/:id/reach` |
| GET/POST | `/api/v1/bds/projects/:id/plan-revisions` |
| POST | `/api/v1/bds/plan-revisions/:id/approve` |

Optional `x-bds-tenant` như inventory.

- [ ] **Step 1: Register module; `tsc --noEmit` 0; Jest `src/bds --runInBand` xanh**
- [ ] **Step 2: PACK=0 hoặc PROJECT_OS=0 → POST phase open 404 (unit test guard đủ; live curl optional)**
- [ ] **Step 3: Roadmap hàng P1b trỏ file này**

---

## 4. Definition of Done P1b

- [ ] Jest flags/guard + legal-gate + project-os.service + workflow xanh
- [ ] `tsc` build api 0
- [ ] DDL P1b apply idempotent
- [ ] BDS-21: open phase khi blocked → 400 `{ error: 'legal_gate' }`
- [ ] BDS-29 / BR-BDS-25: `approvedKinds` rỗng → business không `done`; có `business` → `done`
- [ ] PACK=0 hoặc PROJECT_OS=0 → HTTP project-os 404
- [ ] Prod không bật hai flag
- [ ] Không hold / không UI `/crm/bds`

---

## 5. Rollback

`PTT_BDS_PROJECT_OS=0` và/hoặc `PTT_BDS_PACK=0`. Không DROP bảng trên prod.

---

## 6. Sau P1b xanh

P2 hold chỉ khi **P1 và P1b** xanh. Không mở P3 CSBH trước P1b.

---

*P1b không phải Agency OS. Thắng: không mở đợt khi cổng blocked; KH chỉ done khi revision approved.*
