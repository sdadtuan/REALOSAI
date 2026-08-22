# B2B Lead Project OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lead B2B thuộc chủ quản PTT và bắt buộc một dự án PTT — kênh 1:N, visibility 3 cổng + A+B+C, gán AI, SLA hop, hoa hồng, AI gọi (A), softphone, báo động, PWA.

**Architecture:** Module Nest `b2b-projects` tách `crm_re_projects`. Domain rules sống ở `*.util.ts` (Jest). Flag `PTT_B2B_PROJECT_OS=0` giữ ingest/list cũ. Bật flag: B2B bắt buộc `owner_company_id` + `b2b_project_id`; list/GET 404 ngoài scope.

**Tech Stack:** PostgreSQL DDL; NestJS `ptt-crm-api`; ops-web Next.js; Jest (`*.spec.ts` cạnh util); flag `PTT_B2B_PROJECT_OS`.

**Spec:** [`docs/superpowers/specs/2026-08-18-b2b-lead-project-os-design.md`](../specs/2026-08-18-b2b-lead-project-os-design.md)

## Global Constraints

- Chủ quản = **một** dòng `crm_operating_company` `code=PTT` id cố định `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11` — không CRUD đa công ty
- **Không** dùng `crm_re_projects` / `re_project_id` cho Lead B2B
- Lead B2B **không** set `agency_client_id` (tránh `resolveLeadFlowKind` → spa)
- Ngoài scope visibility → **404**, JSON không chứa `full_name` / `phone`
- Ngoại lệ xem tất cả: Director roster **hoặc** `crm_gdkd.view_all_leads`
- Cap module: `crm_b2b_projects.view` / `crm_b2b_projects.manage`
- Flag `PTT_B2B_PROJECT_OS` mặc định **tắt** (`0`); tắt = không bắt buộc project
- Unique khi **active**: `page_id`, `form_id`, `oa_id`, webform slug, API key hash — một dự án
- Dedup SĐT **trong dự án**; hai dự án = hai lead
- AI gọi chỉ tại mốc **cảnh báo** nếu NV chưa gọi (Q7=A); không gọi lúc lead vào
- Hoa hồng mặc định first-touch **30** / closer **70**; hop giữa **0**
- SLA mặc định hot 3/5, warm 10/15, cold 25/30 phút; `max_hops=2`
- Analytics timeout **800ms** → `hybrid_timeout`
- Route ML `confidence >= 0.75` mới `ai_analytics`
- Không barge; không SMS NV; không cấu hình kênh trên mobile
- CPaaS v1: adapter interface + mock; vendor (Stringee/Tel4VN/Twilio) cắm sau, không hard-code secret
- Test: `cd services/ptt-crm-api && npx jest --testPathPattern=<file> --no-coverage`

---

## File map

| File | Trách nhiệm |
|------|-------------|
| `docs/specs/2026-08-18-postgresql-ddl-b2b-lead-project-os.sql` | DDL + seed PTT + PTT-LEGACY |
| `scripts/apply_pg_ddl_b2b_lead_project_os.sh` | Apply DDL |
| `scripts/backfill_b2b_leads_ptt_legacy.sql` | Backfill lead B2B cũ → PTT-LEGACY |
| `services/ptt-crm-api/src/b2b-projects/b2b-projects.constants.ts` | UUID PTT, code LEGACY, SLA default |
| `services/ptt-crm-api/src/b2b-projects/b2b-visibility.util.ts` | canSee / list predicate |
| `services/ptt-crm-api/src/b2b-projects/b2b-channel-unique.util.ts` | Unique khóa kênh |
| `services/ptt-crm-api/src/b2b-projects/b2b-assign.util.ts` | First assign AI vs Hybrid |
| `services/ptt-crm-api/src/b2b-projects/b2b-sla.util.ts` | Band, giờ làm, warn/hop/AI |
| `services/ptt-crm-api/src/b2b-projects/b2b-commission.util.ts` | Split 30/70 |
| `services/ptt-crm-api/src/b2b-projects/b2b-alert.util.ts` | Ai nhận alert, mức |
| `services/ptt-crm-api/src/b2b-projects/b2b-projects.types.ts` | DTO / row types |
| `services/ptt-crm-api/src/b2b-projects/b2b-projects.repository.ts` | PG |
| `services/ptt-crm-api/src/b2b-projects/b2b-projects.service.ts` | CRUD dự án/kênh/staff |
| `services/ptt-crm-api/src/b2b-projects/b2b-projects.controller.ts` | `/api/v1/b2b-projects` |
| `services/ptt-crm-api/src/b2b-projects/b2b-ingest.service.ts` | Map kênh → project |
| `services/ptt-crm-api/src/b2b-projects/b2b-sla-tick.service.ts` | Cron SLA |
| `services/ptt-crm-api/src/b2b-projects/b2b-alerts.service.ts` | Persist + fanout |
| `services/ptt-crm-api/src/b2b-projects/b2b-calls.service.ts` | Softphone adapter |
| `services/ops-web/src/app/crm/b2b-projects/` | UI desktop |
| `services/ops-web/src/components/OpsNav.tsx` | Menu Dự án PTT |

Phase **P1 = Task 1–7** (DDL, visibility, unique kênh, CRUD, create-lead gate, backfill). P2–P6 lần lượt Task 8–16. Không nhảy phase khi P1 đỏ.

---

### Task 1: Constants + visibility util (B2B-02…05)

**Files:**
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-projects.constants.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-visibility.util.ts`
- Test: `services/ptt-crm-api/src/b2b-projects/b2b-visibility.util.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `PTT_OPERATING_COMPANY_ID`, `PTT_LEGACY_PROJECT_CODE`, `canSeeB2bLead`, `B2bVisibilityActor`, `B2bLeadScopeRow`, `B2bProjectMembership`

- [ ] **Step 1: Write the failing test**

```ts
import { canSeeB2bLead } from './b2b-visibility.util';

const project = 'proj-a';
const memberOn: { staffId: number; isDirector: boolean; hasViewAllLeads: boolean; isActivePttStaff: boolean } = {
  staffId: 10,
  isDirector: false,
  hasViewAllLeads: false,
  isActivePttStaff: true,
};

describe('canSeeB2bLead', () => {
  it('B2B-02 outsider 404', () => {
    expect(
      canSeeB2bLead(memberOn, { flowKind: 'b2b_prospect', ownerId: 99, projectId: project }, []),
    ).toBe(false);
  });

  it('B2B-03 view_all sees all', () => {
    expect(
      canSeeB2bLead(
        { ...memberOn, hasViewAllLeads: true },
        { flowKind: 'b2b_prospect', ownerId: 99, projectId: project },
        [],
      ),
    ).toBe(true);
  });

  it('B2B-03 director sees all', () => {
    expect(
      canSeeB2bLead(
        { ...memberOn, isDirector: true },
        { flowKind: 'b2b_prospect', ownerId: 99, projectId: project },
        [],
      ),
    ).toBe(true);
  });

  it('B2B-04 owner sees own when assign disabled', () => {
    expect(
      canSeeB2bLead(
        memberOn,
        { flowKind: 'b2b_prospect', ownerId: 10, projectId: project },
        [{ projectId: project, assignEnabled: false }],
      ),
    ).toBe(true);
  });

  it('B2B-05 left project keeps own lead only', () => {
    const own = canSeeB2bLead(
      memberOn,
      { flowKind: 'b2b_prospect', ownerId: 10, projectId: project },
      [],
    );
    const teammate = canSeeB2bLead(
      memberOn,
      { flowKind: 'b2b_prospect', ownerId: 11, projectId: project },
      [],
    );
    const unassigned = canSeeB2bLead(
      memberOn,
      { flowKind: 'b2b_prospect', ownerId: null, projectId: project },
      [],
    );
    expect(own).toBe(true);
    expect(teammate).toBe(false);
    expect(unassigned).toBe(false);
  });

  it('receiver sees project teammate and unassigned', () => {
    const mem = [{ projectId: project, assignEnabled: true }];
    expect(
      canSeeB2bLead(memberOn, { flowKind: 'b2b_prospect', ownerId: 11, projectId: project }, mem),
    ).toBe(true);
    expect(
      canSeeB2bLead(memberOn, { flowKind: 'b2b_prospect', ownerId: null, projectId: project }, mem),
    ).toBe(true);
  });

  it('inactive staff cannot see except view_all', () => {
    expect(
      canSeeB2bLead(
        { ...memberOn, isActivePttStaff: false },
        { flowKind: 'b2b_prospect', ownerId: 10, projectId: project },
        [{ projectId: project, assignEnabled: true }],
      ),
    ).toBe(false);
    expect(
      canSeeB2bLead(
        { ...memberOn, isActivePttStaff: false, hasViewAllLeads: true },
        { flowKind: 'b2b_prospect', ownerId: 10, projectId: project },
        [],
      ),
    ).toBe(true);
  });

  it('spa leads are out of this rule (false)', () => {
    expect(
      canSeeB2bLead(
        { ...memberOn, hasViewAllLeads: true },
        { flowKind: 'spa_operational', ownerId: 10, projectId: null },
        [],
      ),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-visibility.util.spec.ts --no-coverage`

Expected: FAIL cannot find module `./b2b-visibility.util`

- [ ] **Step 3: Write minimal implementation**

`b2b-projects.constants.ts`:

```ts
export const PTT_OPERATING_COMPANY_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
export const PTT_OPERATING_COMPANY_CODE = 'PTT';
export const PTT_LEGACY_PROJECT_CODE = 'PTT-LEGACY';
export const B2B_ASSIGN_CONFIDENCE_MIN = 0.75;
export const B2B_ANALYTICS_TIMEOUT_MS = 800;
export const B2B_MAX_HOPS = 2;
export const B2B_AI_CALL_COOLDOWN_AFTER_ASSIGN_MS = 120_000;
```

`b2b-visibility.util.ts`:

```ts
export type B2bFlowKind = 'b2b_prospect' | 'spa_operational';

export interface B2bVisibilityActor {
  staffId: number;
  isDirector: boolean;
  hasViewAllLeads: boolean;
  isActivePttStaff: boolean;
}

export interface B2bLeadScopeRow {
  flowKind: B2bFlowKind;
  ownerId: number | null;
  projectId: string | null;
}

export interface B2bProjectMembership {
  projectId: string;
  assignEnabled: boolean;
}

export function canSeeB2bLead(
  actor: B2bVisibilityActor,
  lead: B2bLeadScopeRow,
  memberships: B2bProjectMembership[],
): boolean {
  if (lead.flowKind !== 'b2b_prospect') return false;
  if (actor.hasViewAllLeads || actor.isDirector) return true;
  if (!actor.isActivePttStaff) return false;
  if (lead.ownerId != null && Number(lead.ownerId) === Number(actor.staffId)) return true;
  if (!lead.projectId) return false;
  return memberships.some((m) => m.projectId === lead.projectId && m.assignEnabled);
}

export function redactLeadIfDenied<T extends { full_name?: unknown; phone?: unknown }>(
  allowed: boolean,
  body: T,
): T | { error: 'not_found' } {
  if (allowed) return body;
  return { error: 'not_found' };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-visibility.util.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/b2b-projects/b2b-projects.constants.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-visibility.util.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-visibility.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(b2b): visibility rules for PTT project leads

EOF
)"
```

---

### Task 2: Channel uniqueness (form/page/oa/web/api)

**Files:**
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-channel-unique.util.ts`
- Test: `services/ptt-crm-api/src/b2b-projects/b2b-channel-unique.util.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `ChannelKeyKind`, `ChannelKeyRow`, `assertChannelKeyAvailable`

- [ ] **Step 1: Write the failing test**

```ts
import { assertChannelKeyAvailable } from './b2b-channel-unique.util';

describe('assertChannelKeyAvailable', () => {
  const existing = [
    { kind: 'form_id' as const, value: 'F1', projectId: 'p1', active: true },
    { kind: 'page_id' as const, value: 'PG1', projectId: 'p1', active: true },
  ];

  it('allows same form on same project', () => {
    expect(() =>
      assertChannelKeyAvailable(existing, { kind: 'form_id', value: 'F1', projectId: 'p1', active: true }),
    ).not.toThrow();
  });

  it('rejects active form on another project', () => {
    expect(() =>
      assertChannelKeyAvailable(existing, { kind: 'form_id', value: 'F1', projectId: 'p2', active: true }),
    ).toThrow(/form_id/);
  });

  it('allows inactive duplicate', () => {
    expect(() =>
      assertChannelKeyAvailable(existing, { kind: 'form_id', value: 'F1', projectId: 'p2', active: false }),
    ).not.toThrow();
  });

  it('rejects oa_id clash', () => {
    const rows = [{ kind: 'oa_id' as const, value: 'OA9', projectId: 'p1', active: true }];
    expect(() =>
      assertChannelKeyAvailable(rows, { kind: 'oa_id', value: 'OA9', projectId: 'p2', active: true }),
    ).toThrow(/oa_id/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-channel-unique.util.spec.ts --no-coverage`

Expected: FAIL module not found

- [ ] **Step 3: Write minimal implementation**

```ts
export type ChannelKeyKind = 'page_id' | 'form_id' | 'oa_id' | 'webform_slug' | 'api_key_hash';

export interface ChannelKeyRow {
  kind: ChannelKeyKind;
  value: string;
  projectId: string;
  active: boolean;
}

export function assertChannelKeyAvailable(existing: ChannelKeyRow[], next: ChannelKeyRow): void {
  if (!next.active) return;
  const value = String(next.value ?? '').trim();
  if (!value) {
    throw new Error(`${next.kind} empty`);
  }
  const clash = existing.find(
    (row) =>
      row.active &&
      row.kind === next.kind &&
      row.value === value &&
      row.projectId !== next.projectId,
  );
  if (clash) {
    throw new Error(`${next.kind} already bound to project ${clash.projectId}`);
  }
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-channel-unique.util.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/b2b-projects/b2b-channel-unique.util.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-channel-unique.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(b2b): unique active channel keys per project

EOF
)"
```

---

### Task 3: DDL + apply script + flag

**Files:**
- Create: `docs/specs/2026-08-18-postgresql-ddl-b2b-lead-project-os.sql`
- Create: `scripts/apply_pg_ddl_b2b_lead_project_os.sh`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts` — thêm `readonly b2bProjectOs: boolean` cạnh `presalesOnLead` (khoảng dòng 94) và gán từ `PTT_B2B_PROJECT_OS` mặc định `0` cạnh dòng 365
- Test: `services/ptt-crm-api/src/config/app-config.service.spec.ts` — thêm case flag (nếu file chưa có constructor test, tạo `services/ptt-crm-api/src/b2b-projects/b2b-flag.spec.ts` đọc env qua helper)

**Interfaces:**
- Consumes: `PTT_OPERATING_COMPANY_ID` từ Task 1
- Produces: bảng spec §4; `AppConfigService.b2bProjectOs`

- [ ] **Step 1: Write the failing test**

```ts
describe('PTT_B2B_PROJECT_OS', () => {
  it('defaults off', () => {
    const raw = (process.env.PTT_B2B_PROJECT_OS ?? '0').trim().toLowerCase();
    const on = ['1', 'true', 'yes', 'on'].includes(raw);
    expect(on).toBe(false);
  });
});
```

Trong `b2b-flag.spec.ts` — test này PASS sẵn; **failing** phần là SQL chưa apply. Thêm test parse DDL file:

```ts
import { readFileSync } from 'fs';
import { join } from 'path';

describe('b2b ddl', () => {
  it('seeds PTT company and PTT-LEGACY', () => {
    const sql = readFileSync(
      join(__dirname, '../../../../docs/specs/2026-08-18-postgresql-ddl-b2b-lead-project-os.sql'),
      'utf8',
    );
    expect(sql).toContain('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    expect(sql).toContain('PTT-LEGACY');
    expect(sql).toContain('crm_b2b_project_pages');
    expect(sql).toContain('crm_b2b_lead_alerts');
  });
});
```

Jest root `services/ptt-crm-api` → path `join(__dirname, '../../../../docs/specs/...')` từ `src/b2b-projects` lên repo root = `../../../..` (src/b2b-projects → src → ptt-crm-api → services → repo). Dùng:

```ts
join(__dirname, '../../../../../docs/specs/2026-08-18-postgresql-ddl-b2b-lead-project-os.sql')
```

`__dirname` = `services/ptt-crm-api/src/b2b-projects` → 4x `..` = repo root. Correct: `../../../../docs/specs/...`

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-flag.spec.ts --no-coverage`

Expected: FAIL ENOENT ddl file

- [ ] **Step 3: Write DDL + script + flag**

DDL (`docs/specs/2026-08-18-postgresql-ddl-b2b-lead-project-os.sql`) — copy nguyên:

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS crm_operating_company (
    id          UUID PRIMARY KEY,
    code        VARCHAR(32) NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    status      VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO crm_operating_company (id, code, name)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'PTT', 'PTT')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS crm_b2b_projects (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_company_id        UUID NOT NULL REFERENCES crm_operating_company (id),
    code                    VARCHAR(64) NOT NULL UNIQUE,
    name                    VARCHAR(255) NOT NULL,
    status                  VARCHAR(16) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'paused', 'archived')),
    business_hours_json     JSONB NOT NULL DEFAULT '{"tz":"Asia/Ho_Chi_Minh","days":[1,2,3,4,5],"start":"08:00","end":"18:00"}'::jsonb,
    sla_json                JSONB NOT NULL DEFAULT '{"hot":{"warnMin":3,"hopMin":5},"warm":{"warnMin":10,"hopMin":15},"cold":{"warnMin":25,"hopMin":30},"maxHops":2}'::jsonb,
    commission_json         JSONB NOT NULL DEFAULT '{"first_touch_pct":30,"closer_pct":70}'::jsonb,
    ai_call_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    manual_ingest_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO crm_b2b_projects (owner_company_id, code, name, status)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'PTT-LEGACY', 'PTT Legacy (backfill)', 'paused')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS crm_b2b_project_pages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES crm_b2b_projects (id) ON DELETE CASCADE,
    page_id         VARCHAR(64) NOT NULL,
    name            VARCHAR(255) NOT NULL DEFAULT '',
    token_ref       TEXT,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_b2b_page_active
    ON crm_b2b_project_pages (page_id) WHERE active;

CREATE TABLE IF NOT EXISTS crm_b2b_project_page_forms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_row_id     UUID NOT NULL REFERENCES crm_b2b_project_pages (id) ON DELETE CASCADE,
    form_id         VARCHAR(64) NOT NULL,
    name            VARCHAR(255) NOT NULL DEFAULT '',
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_b2b_form_active
    ON crm_b2b_project_page_forms (form_id) WHERE active;

CREATE TABLE IF NOT EXISTS crm_b2b_project_channel_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES crm_b2b_projects (id) ON DELETE CASCADE,
    channel_type    VARCHAR(16) NOT NULL CHECK (channel_type IN ('zalo', 'webform', 'api')),
    external_key    VARCHAR(255) NOT NULL,
    label           VARCHAR(255) NOT NULL DEFAULT '',
    config_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_b2b_channel_active
    ON crm_b2b_project_channel_accounts (channel_type, external_key) WHERE active;

CREATE TABLE IF NOT EXISTS crm_b2b_project_staff (
    project_id      UUID NOT NULL REFERENCES crm_b2b_projects (id) ON DELETE CASCADE,
    staff_id        BIGINT NOT NULL,
    assign_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    sales_level     VARCHAR(8) NOT NULL DEFAULT 'b',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, staff_id)
);

ALTER TABLE crm_leads
    ADD COLUMN IF NOT EXISTS owner_company_id UUID REFERENCES crm_operating_company (id),
    ADD COLUMN IF NOT EXISTS b2b_project_id UUID REFERENCES crm_b2b_projects (id),
    ADD COLUMN IF NOT EXISTS assign_strategy VARCHAR(32),
    ADD COLUMN IF NOT EXISTS assign_reason TEXT,
    ADD COLUMN IF NOT EXISTS assign_confidence NUMERIC(4, 3);

CREATE TABLE IF NOT EXISTS crm_b2b_lead_hops (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         BIGINT NOT NULL,
    from_owner_id   BIGINT,
    to_owner_id     BIGINT,
    hop_kind        VARCHAR(24) NOT NULL,
    reason          TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_b2b_lead_commission_split (
    lead_id             BIGINT PRIMARY KEY,
    first_touch_staff_id BIGINT NOT NULL,
    closer_staff_id     BIGINT,
    first_touch_pct     INT NOT NULL DEFAULT 30,
    closer_pct          INT NOT NULL DEFAULT 70,
    split_on_contract   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS crm_b2b_lead_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         BIGINT NOT NULL,
    staff_id        BIGINT NOT NULL,
    severity        VARCHAR(16) NOT NULL,
    kind            VARCHAR(32) NOT NULL,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_b2b_call_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         BIGINT NOT NULL,
    staff_id        BIGINT,
    provider        VARCHAR(32) NOT NULL DEFAULT 'mock',
    state           VARCHAR(16) NOT NULL,
    kind            VARCHAR(16) NOT NULL DEFAULT 'human',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS crm_b2b_unmatched_ingress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel         VARCHAR(16) NOT NULL,
    project_slug    VARCHAR(64),
    external_key    VARCHAR(255) NOT NULL,
    payload_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-08-18-b2b-lead-project-os', 'operating company, b2b projects, channels, lead columns, hops, alerts')
ON CONFLICT (version) DO NOTHING;

COMMIT;
```

`scripts/apply_pg_ddl_b2b_lead_project_os.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-18-postgresql-ddl-b2b-lead-project-os.sql"
echo "==> Apply B2B Lead Project OS DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  B2B Lead Project OS DDL applied"
```

`chmod +x` script. Trong `app-config.service.ts` thêm field + parse giống `presalesOnLead` với env `PTT_B2B_PROJECT_OS` default `'0'`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-flag.spec.ts --no-coverage`

Expected: PASS

Local apply (dev PG): `bash scripts/apply_pg_ddl_b2b_lead_project_os.sh` → `OK  B2B Lead Project OS DDL applied`

- [ ] **Step 5: Commit**

```bash
git add docs/specs/2026-08-18-postgresql-ddl-b2b-lead-project-os.sql \
  scripts/apply_pg_ddl_b2b_lead_project_os.sh \
  services/ptt-crm-api/src/config/app-config.service.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-flag.spec.ts
git commit -m "$(cat <<'EOF'
feat(b2b): DDL operating company, projects, lead columns

EOF
)"
```

---

### Task 4: Assign + SLA + commission + AI-call gate utils

**Files:**
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-assign.util.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-sla.util.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-commission.util.ts`
- Test: `*.util.spec.ts` cạnh mỗi file

**Interfaces:**
- Consumes: `B2B_ASSIGN_CONFIDENCE_MIN`, `B2B_MAX_HOPS` từ Task 1
- Produces: `decideFirstAssign`, `resolveSlaAction`, `isWithinBusinessHours`, `splitOnSlaHop`, `shouldStartAiCall`

- [ ] **Step 1: Write the failing tests**

`b2b-assign.util.spec.ts`:

```ts
import { decideFirstAssign } from './b2b-assign.util';

describe('decideFirstAssign', () => {
  const pool = [
    { staffId: 1, salesLevel: 's', openFirstTouch: 2, inCall: false },
    { staffId: 2, salesLevel: 'a', openFirstTouch: 0, inCall: false },
  ];

  it('B2B-08 ai_analytics when confidence >= 0.75 and pick in pool', () => {
    const r = decideFirstAssign({
      timedOut: false,
      ml: { staffId: 2, confidence: 0.8, reason: 'ml' },
      pool,
      score: 80,
    });
    expect(r.strategy).toBe('ai_analytics');
    expect(r.ownerId).toBe(2);
  });

  it('B2B-09 hybrid_timeout', () => {
    const r = decideFirstAssign({ timedOut: true, ml: null, pool, score: 80 });
    expect(r.strategy).toBe('hybrid_timeout');
    expect(r.ownerId).toBe(2);
  });

  it('empty pool → null owner', () => {
    const r = decideFirstAssign({ timedOut: false, ml: null, pool: [], score: 50 });
    expect(r.ownerId).toBeNull();
    expect(r.strategy).toBe('hybrid');
  });
});
```

`b2b-sla.util.spec.ts`:

```ts
import { isWithinBusinessHours, resolveSlaAction, slaBand } from './b2b-sla.util';

describe('b2b sla', () => {
  it('bands', () => {
    expect(slaBand(70)).toBe('hot');
    expect(slaBand(40)).toBe('warm');
    expect(slaBand(10)).toBe('cold');
  });

  it('B2B-10 hop hot at 5m without call', () => {
    expect(
      resolveSlaAction({
        score: 80,
        elapsedMin: 5,
        hopCount: 0,
        hasCallActivity: false,
        answered: false,
        inHours: true,
      }),
    ).toBe('hop');
  });

  it('B2B-11 answered blocks hop', () => {
    expect(
      resolveSlaAction({
        score: 80,
        elapsedMin: 6,
        hopCount: 0,
        hasCallActivity: false,
        answered: true,
        inHours: true,
      }),
    ).toBe('none');
  });

  it('B2B-12 third hop → gdkd_queue', () => {
    expect(
      resolveSlaAction({
        score: 80,
        elapsedMin: 5,
        hopCount: 2,
        hasCallActivity: false,
        answered: false,
        inHours: true,
      }),
    ).toBe('gdkd_queue');
  });

  it('B2B-13 warn (ai_call) at 3m hot', () => {
    expect(
      resolveSlaAction({
        score: 80,
        elapsedMin: 3,
        hopCount: 0,
        hasCallActivity: false,
        answered: false,
        inHours: true,
      }),
    ).toBe('ai_call');
  });

  it('outside hours none', () => {
    expect(
      resolveSlaAction({
        score: 80,
        elapsedMin: 10,
        hopCount: 0,
        hasCallActivity: false,
        answered: false,
        inHours: false,
      }),
    ).toBe('none');
  });

  it('business hours weekday', () => {
    const hours = { tz: 'UTC', days: [1, 2, 3, 4, 5], start: '08:00', end: '18:00' };
    const mondayMorning = new Date('2026-08-17T10:00:00Z');
    expect(isWithinBusinessHours(hours, mondayMorning)).toBe(true);
    const saturday = new Date('2026-08-15T10:00:00Z');
    expect(isWithinBusinessHours(hours, saturday)).toBe(false);
  });
});
```

`b2b-commission.util.spec.ts`:

```ts
import { splitOnSlaHop } from './b2b-commission.util';

describe('splitOnSlaHop', () => {
  it('B2B-15 30/70', () => {
    expect(splitOnSlaHop({ firstTouchPct: 30, closerPct: 70 })).toEqual({
      first_touch_pct: 30,
      closer_pct: 70,
    });
  });
});
```

Thêm `shouldStartAiCall` tests trong `b2b-sla.util.spec.ts`:

```ts
import { shouldStartAiCall } from './b2b-sla.util';

it('B2B-13 no AI before warn', () => {
  expect(
    shouldStartAiCall({ action: 'none', hasStaffDialed: false, alreadyAiCalled: false, aiCallEnabled: true }),
  ).toBe(false);
});

it('B2B-14 AI at warn if staff not dialed', () => {
  expect(
    shouldStartAiCall({ action: 'ai_call', hasStaffDialed: false, alreadyAiCalled: false, aiCallEnabled: true }),
  ).toBe(true);
});

it('no AI if staff already dialed', () => {
  expect(
    shouldStartAiCall({ action: 'ai_call', hasStaffDialed: true, alreadyAiCalled: false, aiCallEnabled: true }),
  ).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-assign.util.spec.ts src/b2b-projects/b2b-sla.util.spec.ts src/b2b-projects/b2b-commission.util.spec.ts --no-coverage`

Expected: FAIL module not found

- [ ] **Step 3: Write implementations**

`b2b-assign.util.ts`:

```ts
import { B2B_ASSIGN_CONFIDENCE_MIN } from './b2b-projects.constants';

export interface AssignPoolMember {
  staffId: number;
  salesLevel: string;
  openFirstTouch: number;
  inCall: boolean;
}

export interface DecideFirstAssignInput {
  timedOut: boolean;
  ml: { staffId: number; confidence: number; reason: string } | null;
  pool: AssignPoolMember[];
  score: number | null;
}

export interface DecideFirstAssignResult {
  ownerId: number | null;
  strategy: 'ai_analytics' | 'hybrid' | 'hybrid_timeout';
  reason: string;
  confidence: number | null;
}

function hybridPick(pool: AssignPoolMember[], score: number | null): AssignPoolMember | null {
  const free = pool.filter((p) => !p.inCall);
  if (!free.length) return null;
  const band = score != null && score >= 70 ? 'hot' : score != null && score >= 40 ? 'warm' : 'cold';
  const levelOk = (lv: string) => {
    const l = lv.toLowerCase();
    if (band === 'hot') return l === 's' || l === 'a';
    if (band === 'warm') return l === 'a' || l === 'b';
    return l === 'b' || l === 'c';
  };
  const ranked = [...free].sort((a, b) => {
    const aFit = levelOk(a.salesLevel) ? 0 : 1;
    const bFit = levelOk(b.salesLevel) ? 0 : 1;
    if (aFit !== bFit) return aFit - bFit;
    return a.openFirstTouch - b.openFirstTouch;
  });
  return ranked[0] ?? null;
}

export function decideFirstAssign(input: DecideFirstAssignInput): DecideFirstAssignResult {
  const strategy = input.timedOut ? 'hybrid_timeout' : 'hybrid';
  if (
    !input.timedOut &&
    input.ml &&
    input.ml.confidence >= B2B_ASSIGN_CONFIDENCE_MIN &&
    input.pool.some((p) => p.staffId === input.ml!.staffId && !p.inCall)
  ) {
    return {
      ownerId: input.ml.staffId,
      strategy: 'ai_analytics',
      reason: input.ml.reason,
      confidence: input.ml.confidence,
    };
  }
  const pick = hybridPick(input.pool, input.score);
  return {
    ownerId: pick?.staffId ?? null,
    strategy,
    reason: pick ? `hybrid load=${pick.openFirstTouch}` : 'empty_pool',
    confidence: null,
  };
}
```

`b2b-sla.util.ts`:

```ts
import { B2B_MAX_HOPS } from './b2b-projects.constants';

export type SlaBand = 'hot' | 'warm' | 'cold';
export type SlaAction = 'none' | 'ai_call' | 'hop' | 'gdkd_queue';

export const DEFAULT_SLA = {
  hot: { warnMin: 3, hopMin: 5 },
  warm: { warnMin: 10, hopMin: 15 },
  cold: { warnMin: 25, hopMin: 30 },
  maxHops: B2B_MAX_HOPS,
};

export function slaBand(score: number | null): SlaBand {
  if (score != null && score >= 70) return 'hot';
  if (score != null && score >= 40) return 'warm';
  return 'cold';
}

export function isWithinBusinessHours(
  hours: { tz: string; days: number[]; start: string; end: string },
  now: Date,
): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: hours.tz || 'UTC',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === 'weekday')?.value;
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const day = map[wd ?? ''] ?? -1;
  if (!hours.days.includes(day)) return false;
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const cur = `${hour}:${minute}`;
  return cur >= hours.start && cur < hours.end;
}

export function resolveSlaAction(input: {
  score: number | null;
  elapsedMin: number;
  hopCount: number;
  hasCallActivity: boolean;
  answered: boolean;
  inHours: boolean;
  sla?: typeof DEFAULT_SLA;
}): SlaAction {
  if (!input.inHours || input.hasCallActivity || input.answered) return 'none';
  const sla = input.sla ?? DEFAULT_SLA;
  const band = slaBand(input.score);
  const cfg = sla[band];
  if (input.elapsedMin >= cfg.hopMin) {
    return input.hopCount >= sla.maxHops ? 'gdkd_queue' : 'hop';
  }
  if (input.elapsedMin >= cfg.warnMin) return 'ai_call';
  return 'none';
}

export function shouldStartAiCall(input: {
  action: SlaAction;
  hasStaffDialed: boolean;
  alreadyAiCalled: boolean;
  aiCallEnabled: boolean;
}): boolean {
  return (
    input.aiCallEnabled &&
    input.action === 'ai_call' &&
    !input.hasStaffDialed &&
    !input.alreadyAiCalled
  );
}
```

`b2b-commission.util.ts`:

```ts
export function splitOnSlaHop(input: { firstTouchPct: number; closerPct: number }): {
  first_touch_pct: number;
  closer_pct: number;
} {
  return { first_touch_pct: input.firstTouchPct, closer_pct: input.closerPct };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-assign.util.spec.ts src/b2b-projects/b2b-sla.util.spec.ts src/b2b-projects/b2b-commission.util.spec.ts --no-coverage`

Expected: PASS. Nếu `isWithinBusinessHours` fail vì weekday UTC, chỉnh fixture date — 2026-08-17 là Monday.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/b2b-projects/b2b-assign.util.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-assign.util.spec.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-sla.util.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-sla.util.spec.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-commission.util.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-commission.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(b2b): assign, SLA hop, and commission utils

EOF
)"
```

---

### Task 5: Alert recipient util (B2B-16, B2B-17)

**Files:**
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-alert.util.ts`
- Test: `services/ptt-crm-api/src/b2b-projects/b2b-alert.util.spec.ts`

**Interfaces:**
- Consumes: `canSeeB2bLead` từ Task 1
- Produces: `planLeadArrivalAlerts`, `AlertSeverity`, `AlertKind`

- [ ] **Step 1: Write the failing test**

```ts
import { planLeadArrivalAlerts } from './b2b-alert.util';

describe('planLeadArrivalAlerts', () => {
  const project = 'p1';
  const lead = { flowKind: 'b2b_prospect' as const, ownerId: 10, projectId: project, score: 80 };

  it('B2B-16 hot assigned → urgent to owner', () => {
    const out = planLeadArrivalAlerts({
      lead,
      inHours: true,
      receivers: [{ staffId: 10, assignEnabled: true, isDirector: false, hasViewAllLeads: false, isActivePttStaff: true }],
    });
    expect(out).toEqual([{ staffId: 10, severity: 'urgent', kind: 'assigned_hot' }]);
  });

  it('B2B-17 outsider gets none', () => {
    const out = planLeadArrivalAlerts({
      lead,
      inHours: true,
      receivers: [{ staffId: 99, assignEnabled: false, isDirector: false, hasViewAllLeads: false, isActivePttStaff: true }],
    });
    expect(out).toEqual([]);
  });

  it('unassigned → inbox to assign_enabled members', () => {
    const out = planLeadArrivalAlerts({
      lead: { ...lead, ownerId: null, score: 40 },
      inHours: true,
      receivers: [
        { staffId: 10, assignEnabled: true, isDirector: false, hasViewAllLeads: false, isActivePttStaff: true },
      ],
    });
    expect(out[0]).toMatchObject({ staffId: 10, severity: 'inbox', kind: 'unassigned' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-alert.util.spec.ts --no-coverage`

Expected: FAIL module not found

- [ ] **Step 3: Write implementation**

```ts
import { canSeeB2bLead, type B2bLeadScopeRow } from './b2b-visibility.util';

export type AlertSeverity = 'urgent' | 'normal' | 'inbox' | 'ops';
export type AlertKind = 'assigned_hot' | 'assigned' | 'unassigned' | 'sla' | 'ai_call' | 'max_hops';

export interface AlertReceiver {
  staffId: number;
  assignEnabled: boolean;
  isDirector: boolean;
  hasViewAllLeads: boolean;
  isActivePttStaff: boolean;
}

export function planLeadArrivalAlerts(input: {
  lead: B2bLeadScopeRow & { score: number | null };
  inHours: boolean;
  receivers: AlertReceiver[];
}): Array<{ staffId: number; severity: AlertSeverity; kind: AlertKind }> {
  const out: Array<{ staffId: number; severity: AlertSeverity; kind: AlertKind }> = [];
  for (const r of input.receivers) {
    const see = canSeeB2bLead(
      r,
      input.lead,
      input.lead.projectId
        ? [{ projectId: input.lead.projectId, assignEnabled: r.assignEnabled }]
        : [],
    );
    if (!see) continue;
    if (input.lead.ownerId != null && input.lead.ownerId === r.staffId) {
      const hot = (input.lead.score ?? 0) >= 70;
      out.push({
        staffId: r.staffId,
        severity: hot && input.inHours ? 'urgent' : 'normal',
        kind: hot ? 'assigned_hot' : 'assigned',
      });
      continue;
    }
    if (input.lead.ownerId == null && r.assignEnabled) {
      out.push({ staffId: r.staffId, severity: 'inbox', kind: 'unassigned' });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-alert.util.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/b2b-projects/b2b-alert.util.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-alert.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(b2b): lead-arrival alert recipient planner

EOF
)"
```

---

### Task 6: Nest module CRUD dự án + RBAC caps

**Files:**
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-projects.types.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-projects.repository.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-projects.service.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-projects.controller.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-projects.module.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-projects.service.spec.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts` — import `B2bProjectsModule` cạnh `ReProjectsModule` (dòng ~68/~136)
- Modify: `scripts/rbac_permissions_pg.py` — seed section `crm_b2b_projects` actions `view`, `manage` cho `KD-01` (view) và `SUPER-ADMIN` (cả hai)

**Interfaces:**
- Consumes: `assertChannelKeyAvailable`, `PTT_OPERATING_COMPANY_ID`
- Produces: HTTP `/api/v1/b2b-projects` GET/POST, `GET/PATCH :id`, `PUT :id/pages`, `PUT :id/channels`, `PUT :id/staff`

- [ ] **Step 1: Write the failing service spec**

```ts
import { B2bProjectsService } from './b2b-projects.service';
import { PTT_OPERATING_COMPANY_ID } from './b2b-projects.constants';

describe('B2bProjectsService.create', () => {
  it('stamps owner_company_id PTT', async () => {
    const repo = {
      insertProject: jest.fn(async (row: { owner_company_id: string; code: string }) => ({
        id: 'new',
        ...row,
        status: 'draft',
      })),
    };
    const svc = new B2bProjectsService(repo as never);
    const created = await svc.create({ code: 'seo-hn', name: 'SEO HN' });
    expect(repo.insertProject).toHaveBeenCalledWith(
      expect.objectContaining({ owner_company_id: PTT_OPERATING_COMPANY_ID, code: 'seo-hn' }),
    );
    expect(created.owner_company_id).toBe(PTT_OPERATING_COMPANY_ID);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-projects.service.spec.ts --no-coverage`

Expected: FAIL cannot find `B2bProjectsService`

- [ ] **Step 3: Write types, repo, service, controller, module**

`b2b-projects.types.ts` — export:

```ts
export interface B2bProjectRow {
  id: string;
  owner_company_id: string;
  code: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  business_hours_json: Record<string, unknown>;
  sla_json: Record<string, unknown>;
  commission_json: { first_touch_pct: number; closer_pct: number };
  ai_call_enabled: boolean;
  manual_ingest_enabled: boolean;
}

export interface CreateB2bProjectBody {
  code: string;
  name: string;
}
```

Service `create`:

```ts
async create(body: CreateB2bProjectBody): Promise<B2bProjectRow> {
  const code = body.code.trim().toLowerCase();
  if (!code || !body.name.trim()) throw new BadRequestException({ error: 'invalid_project' });
  return this.repo.insertProject({
    owner_company_id: PTT_OPERATING_COMPANY_ID,
    code,
    name: body.name.trim(),
  });
}
```

`replacePages` / `replaceChannels` gọi `assertChannelKeyAvailable` trên snapshot active keys toàn hệ thống rồi UPSERT. Trùng → `BadRequestException({ error: 'channel_key_taken' })`.

Controller: `@Controller('api/v1/b2b-projects')` + staff guards hiện có (copy pattern `re-projects.controller.ts`: `StaffAuthGuard` + cap check `crm_b2b_projects`).

Repo: `pg` query `INSERT INTO crm_b2b_projects ...`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-projects.service.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/b2b-projects services/ptt-crm-api/src/app.module.ts scripts/rbac_permissions_pg.py
git commit -m "$(cat <<'EOF'
feat(b2b): projects API module and RBAC caps

EOF
)"
```

---

### Task 7: Create-lead gate + list visibility + backfill (B2B-01, C)

**Files:**
- Modify: `services/ptt-crm-api/src/leads/leads.types.ts` — `CreateLeadV1Body` thêm `b2b_project_id?: string`; `LeadV1` thêm `b2b_project_id`, `owner_company_id`, `assign_strategy`
- Modify: `services/ptt-crm-api/src/leads/ingest/lead-create-enrichment.service.ts` — khi `appConfig.b2bProjectOs` và flow B2B: thiếu `b2b_project_id` → throw; set `owner_company_id = PTT_OPERATING_COMPANY_ID`; **không** set `client_id`
- Modify: `services/ptt-crm-api/src/leads/leads.service.ts` (list/get) — nếu flag on và lead B2B, `canSeeB2bLead`; deny → NotFoundException `{ error: 'not_found' }` không `full_name`
- Modify: `services/ptt-crm-api/src/leads/leads-io.service.ts` — cùng filter trước export (B2B-18)
- Create: `scripts/backfill_b2b_leads_ptt_legacy.sql`
- Test: `services/ptt-crm-api/src/leads/ingest/lead-create-enrichment.service.spec.ts` (tạo mới nếu chưa) case B2B-01

**Interfaces:**
- Consumes: `PTT_OPERATING_COMPANY_ID`, `canSeeB2bLead`, `appConfig.b2bProjectOs`
- Produces: 400 `b2b_project_required`; GET 404 ngoài scope

- [ ] **Step 1: Write the failing test**

```ts
describe('B2B create gate', () => {
  it('B2B-01 missing project when flag on', async () => {
    const enrich = {
      async enrich(body: { lead_flow_kind?: string; b2b_project_id?: string }) {
        const flag = true;
        const b2b = body.lead_flow_kind === 'b2b_prospect' || !body.lead_flow_kind;
        if (flag && b2b && !String(body.b2b_project_id ?? '').trim()) {
          const err = new Error('b2b_project_required');
          (err as Error & { error: string }).error = 'b2b_project_required';
          throw err;
        }
        return body;
      },
    };
    await expect(enrich.enrich({ lead_flow_kind: 'b2b_prospect' })).rejects.toMatchObject({
      error: 'b2b_project_required',
    });
  });
});
```

Đặt logic thật trong `LeadCreateEnrichmentService.enrich`: đọc `this.appConfig.b2bProjectOs`. Inject `AppConfigService` nếu chưa có. Throw `BadRequestException({ error: 'b2b_project_required' })`.

`backfill_b2b_leads_ptt_legacy.sql`:

```sql
UPDATE crm_leads l
SET owner_company_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    b2b_project_id = (SELECT id FROM crm_b2b_projects WHERE code = 'PTT-LEGACY')
WHERE l.agency_client_id IS NULL
  AND l.b2b_project_id IS NULL;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/leads/ingest/lead-create-enrichment.service.spec.ts --no-coverage`

Expected: FAIL until service throws

- [ ] **Step 3: Implement gate + visibility on get/list/export**

`assertB2bVisible(actor, leadRow)`: spa → skip; B2B + flag → `canSeeB2bLead` else `NotFoundException({ error: 'not_found' })`.

List SQL thêm:

```sql
AND (
  $view_all OR
  l.owner_id = $staff_id OR
  l.b2b_project_id IN (
    SELECT project_id FROM crm_b2b_project_staff
    WHERE staff_id = $staff_id AND assign_enabled
  )
)
```

chỉ khi `b2bProjectOs && flow=b2b`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd services/ptt-crm-api && npx jest src/leads/ingest/lead-create-enrichment.service.spec.ts src/b2b-projects/b2b-visibility.util.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/leads services/ptt-crm-api/src/b2b-projects \
  scripts/backfill_b2b_leads_ptt_legacy.sql
git commit -m "$(cat <<'EOF'
feat(b2b): require project on create and filter list by scope

EOF
)"
```

---

### Task 8: Ingest map kênh (B2B-06, B2B-07)

**Files:**
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-ingest.util.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-ingest.service.ts`
- Test: `services/ptt-crm-api/src/b2b-projects/b2b-ingest.util.spec.ts`
- Modify: webhook Nest Facebook/Zalo — khi flag on, resolve project bằng `form_id`/`oa_id` trước `create_lead`; unmatched → insert `crm_b2b_unmatched_ingress`, HTTP 200, `created_count=0`
- Modify: `LeadDedupRepository.findContactDuplicates` — thêm `b2bProjectId`; SQL `AND b2b_project_id IS NOT DISTINCT FROM $project`

**Interfaces:**
- Consumes: channel tables Task 3
- Produces: `resolveIngressProject({ channel, formId, pageId, oaId, webformSlug, apiKeyHash, projectSlug })` → `{ projectId } | { unmatched: true }`

- [ ] **Step 1: Write the failing test**

```ts
import { resolveIngressProject } from './b2b-ingest.util';

describe('resolveIngressProject', () => {
  const forms = [{ formId: 'F1', pageId: 'PG1', projectId: 'p1', projectSlug: 'seo', active: true }];
  const pages = [{ pageId: 'PG1', projectId: 'p1', projectSlug: 'seo', active: true }];

  it('maps form to project', () => {
    expect(resolveIngressProject({ channel: 'facebook', formId: 'F1', projectSlug: 'seo' }, { forms, pages })).toEqual({
      projectId: 'p1',
    });
  });

  it('B2B-07 unmapped form', () => {
    expect(resolveIngressProject({ channel: 'facebook', formId: 'FX', projectSlug: 'seo' }, { forms, pages })).toEqual({
      unmatched: true,
      reason: 'form_unmapped',
    });
  });

  it('slug mismatch → unmatched', () => {
    expect(resolveIngressProject({ channel: 'facebook', formId: 'F1', projectSlug: 'other' }, { forms, pages })).toEqual({
      unmatched: true,
      reason: 'slug_mismatch',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-ingest.util.spec.ts --no-coverage`

Expected: FAIL module not found

- [ ] **Step 3: Implement `resolveIngressProject`**

```ts
export type IngressChannel = 'facebook' | 'zalo' | 'webform' | 'api';

export function resolveIngressProject(
  input: {
    channel: IngressChannel;
    formId?: string;
    pageId?: string;
    oaId?: string;
    webformSlug?: string;
    apiKeyHash?: string;
    projectSlug: string;
  },
  catalog: {
    forms: Array<{ formId: string; pageId: string; projectId: string; projectSlug: string; active: boolean }>;
    pages: Array<{ pageId: string; projectId: string; projectSlug: string; active: boolean }>;
    accounts?: Array<{
      channel: 'zalo' | 'webform' | 'api';
      externalKey: string;
      projectId: string;
      projectSlug: string;
      active: boolean;
    }>;
  },
): { projectId: string } | { unmatched: true; reason: string } {
  if (input.channel === 'facebook') {
    const form = catalog.forms.find((f) => f.active && f.formId === input.formId);
    if (!form) return { unmatched: true, reason: 'form_unmapped' };
    if (form.projectSlug !== input.projectSlug) return { unmatched: true, reason: 'slug_mismatch' };
    return { projectId: form.projectId };
  }
  const key =
    input.channel === 'zalo'
      ? input.oaId
      : input.channel === 'webform'
        ? input.webformSlug
        : input.apiKeyHash;
  const row = (catalog.accounts ?? []).find(
    (a) => a.active && a.channel === input.channel && a.externalKey === key,
  );
  if (!row) return { unmatched: true, reason: 'account_unmapped' };
  if (row.projectSlug !== input.projectSlug) return { unmatched: true, reason: 'slug_mismatch' };
  return { projectId: row.projectId };
}
```

API key: hash SHA-256 hex trước khi lookup. Body `project_code` khác dự án của key → `403 { error: 'project_mismatch' }`.

Dedup: cùng phone project A và B → 2 lead (B2B-06) — thêm spec trên `findContactDuplicates` với `b2bProjectId`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-ingest.util.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/b2b-projects/b2b-ingest.util.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-ingest.util.spec.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-ingest.service.ts \
  services/ptt-crm-api/src/leads/ingest
git commit -m "$(cat <<'EOF'
feat(b2b): ingress channel-to-project mapping

EOF
)"
```

---

### Task 9: Desktop UI `/crm/b2b-projects` + cột lead

**Files:**
- Create: `services/ops-web/src/app/crm/b2b-projects/page.tsx`
- Create: `services/ops-web/src/app/crm/b2b-projects/[id]/page.tsx`
- Create: `services/ops-web/src/lib/b2b-projects-api.ts` — fetch `/api/v1/b2b-projects`
- Modify: `services/ops-web/src/components/OpsNav.tsx` — sau re-projects: `{ href: '/crm/b2b-projects', label: 'Dự án PTT' }` khi `hasCap(user, 'crm_b2b_projects', 'view')`
- Modify: `services/ops-web/src/lib/rbac-routes.ts` — thêm `{ section: 'crm_b2b_projects', action: 'view' }` vào zone crm
- Modify: `services/ops-web/src/app/crm/leads/page.tsx` — cột Dự án; form tạo bắt buộc `b2b_project_id` khi flag (đọc `GET /api/v1/b2b-projects` status=active mà user nhận lead)
- Test: `services/ops-web/src/lib/b2b-projects-api.spec.ts` — mock fetch list shape

**Interfaces:**
- Consumes: Task 6 JSON `{ id, code, name, status, ... }`
- Produces: 5 tab Tổng quan / Kênh / Nhân viên / SLA & gọi / Hoa hồng

- [ ] **Step 1: Write the failing test**

```ts
import { parseB2bProjectList } from './b2b-projects-api';

it('parses list', () => {
  const rows = parseB2bProjectList({
    items: [{ id: '1', code: 'seo', name: 'SEO', status: 'active' }],
  });
  expect(rows[0].code).toBe('seo');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && npx vitest run src/lib/b2b-projects-api.spec.ts`

Expected: FAIL module not found

- [ ] **Step 3: Implement API helper + pages**

`parseB2bProjectList`:

```ts
export interface B2bProjectListItem {
  id: string;
  code: string;
  name: string;
  status: string;
}

export function parseB2bProjectList(body: unknown): B2bProjectListItem[] {
  const items = (body as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  return items.map((row) => {
    const r = row as B2bProjectListItem;
    return { id: String(r.id), code: String(r.code), name: String(r.name), status: String(r.status) };
  });
}
```

Pages: table + tab forms PUT pages/channels/staff. Chủ quản PTT **chỉ đọc**. Không import component re-projects.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd services/ops-web && npx vitest run src/lib/b2b-projects-api.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/app/crm/b2b-projects services/ops-web/src/lib/b2b-projects-api.ts \
  services/ops-web/src/lib/b2b-projects-api.spec.ts services/ops-web/src/components/OpsNav.tsx \
  services/ops-web/src/lib/rbac-routes.ts services/ops-web/src/app/crm/leads/page.tsx
git commit -m "$(cat <<'EOF'
feat(b2b): ops-web PTT project module and lead project column

EOF
)"
```

---

### Task 10: First-assign AI trên ingest (B2B-08, B2B-09)

**Files:**
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-first-assign.service.ts`
- Test: `services/ptt-crm-api/src/b2b-projects/b2b-first-assign.service.spec.ts`
- Modify: `lead-create-enrichment.service.ts` — sau khi có `b2b_project_id`, gọi `firstAssign.assign(projectId, scoreCtx)` thay RR global khi flag on
- Modify: `lead-route.types.ts` — `LeadRouteContext` thêm `b2bProjectId: string | null` (không dùng `reProjectId` cho B2B)

**Interfaces:**
- Consumes: `decideFirstAssign`, `computeLeadRouteMlV1`, `B2B_ANALYTICS_TIMEOUT_MS`
- Produces: `{ owner_id, assign_strategy, assign_reason, assign_confidence }`

- [ ] **Step 1: Write the failing test**

```ts
import { B2bFirstAssignService } from './b2b-first-assign.service';

it('uses hybrid_timeout when ml exceeds 800ms', async () => {
  const svc = new B2bFirstAssignService(
    { loadPool: async () => [{ staffId: 2, salesLevel: 'a', openFirstTouch: 0, inCall: false }] } as never,
    {
      routeMl: () => new Promise(() => undefined),
    } as never,
  );
  const r = await svc.assign({ projectId: 'p', score: 80, now: Date.now() });
  expect(r.strategy).toBe('hybrid_timeout');
});
```

Implement `assign` bằng `Promise.race([ml, sleep(800)])` rồi `decideFirstAssign`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-first-assign.service.spec.ts --no-coverage`

Expected: FAIL

- [ ] **Step 3: Implement service; wire enrichment**

Pool SQL: staff in `crm_b2b_project_staff` where `assign_enabled` and staff active. ML candidates map `staff_id`. Nếu ML trả người ngoài pool → bỏ, Hybrid.

Ghi hop `hop_kind=first_assign`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-first-assign.service.spec.ts src/b2b-projects/b2b-assign.util.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/b2b-projects/b2b-first-assign.service.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-first-assign.service.spec.ts \
  services/ptt-crm-api/src/leads/ingest/lead-create-enrichment.service.ts \
  services/ptt-crm-api/src/ai-intelligence/lead-route.types.ts
git commit -m "$(cat <<'EOF'
feat(b2b): AI analytics first-assign with hybrid timeout

EOF
)"
```

---

### Task 11: SLA tick + hop + commission persist (B2B-10…12, B2B-15)

**Files:**
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-sla-tick.service.ts`
- Test: `services/ptt-crm-api/src/b2b-projects/b2b-sla-tick.service.spec.ts`
- Modify: jobs Nest cron / existing worker — mỗi phút gọi `tick(now)` khi flag on

**Interfaces:**
- Consumes: `resolveSlaAction`, `decideFirstAssign` (pool trừ owner cũ), `splitOnSlaHop`
- Produces: update `owner_id`, insert `crm_b2b_lead_hops`, upsert `crm_b2b_lead_commission_split`

- [ ] **Step 1: Write the failing test**

```ts
it('hops hot lead at 5m', async () => {
  const repo = {
    listOpenB2b: async () => [
      {
        leadId: 1,
        ownerId: 10,
        score: 80,
        assignedAt: new Date(Date.now() - 6 * 60_000),
        hopCount: 0,
        hasCallActivity: false,
        answered: false,
        projectId: 'p',
      },
    ],
    inHours: async () => true,
    loadPool: async () => [
      { staffId: 10, salesLevel: 'a', openFirstTouch: 1, inCall: false },
      { staffId: 11, salesLevel: 'a', openFirstTouch: 0, inCall: false },
    ],
    applyHop: jest.fn(),
    markGdkd: jest.fn(),
  };
  const tick = new B2bSlaTickService(repo as never);
  await tick.tick(new Date());
  expect(repo.applyHop).toHaveBeenCalledWith(
    expect.objectContaining({ leadId: 1, toOwnerId: 11, hopKind: 'sla_reassign' }),
  );
});
```

`applyHop` ghi split `first_touch_staff_id` = owner **đầu tiên** (từ hop `first_assign` hoặc current nếu chưa có split), `closer_staff_id` = owner mới, pct từ `commission_json` dự án.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-sla-tick.service.spec.ts --no-coverage`

Expected: FAIL

- [ ] **Step 3: Implement tick; exclude previous owner; in_call skip; max hops → gdkd queue flag trên lead meta `b2b_gdkd_queue=true`**

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-sla-tick.service.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/b2b-projects/b2b-sla-tick.service.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-sla-tick.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(b2b): SLA first-touch hop and commission split

EOF
)"
```

---

### Task 12: Call sessions adapter (realtime states)

**Files:**
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-calls.types.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-calls.service.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-cpaas.adapter.ts` — interface `startCall`, `onWebhook`
- Test: `services/ptt-crm-api/src/b2b-projects/b2b-calls.service.spec.ts`
- Modify: controller `POST /api/v1/leads/:id/calls` (cùng `B2bProjectsController` hoặc `LeadsController`) — visibility rồi `startCall`
- Modify: lead detail ops-web — nút Gọi gọi API; fallback `<a href="tel:">` nếu `startCall` throws `cpaas_down`

**Interfaces:**
- Consumes: visibility Task 1
- Produces: session states `queued|ringing|answered|no_answer|ended`; `kind=human|ai`

- [ ] **Step 1: Write the failing test**

```ts
it('answered marks first-touch', async () => {
  const repo = { insertSession: jest.fn(async () => ({ id: 's1' })), updateState: jest.fn() };
  const svc = new B2bCallsService(repo as never, { startCall: async () => ({ providerCallId: 'c1' }) });
  await svc.applyWebhook({ providerCallId: 'c1', state: 'answered' });
  expect(repo.updateState).toHaveBeenCalledWith(expect.objectContaining({ state: 'answered' }));
});

it('cpaas down surfaces tel fallback', async () => {
  const svc = new B2bCallsService({ insertSession: jest.fn() } as never, {
    startCall: async () => {
      throw Object.assign(new Error('down'), { code: 'cpaas_down' });
    },
  });
  await expect(svc.startHumanCall({ leadId: 1, staffId: 10, phone: '090' })).rejects.toMatchObject({
    code: 'cpaas_down',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-calls.service.spec.ts --no-coverage`

Expected: FAIL

- [ ] **Step 3: Mock adapter default `PTT_B2B_CPAAS=mock`** ghi state machine; `in_call` = state in `queued|ringing|answered`

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-calls.service.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/b2b-projects/b2b-calls.types.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-calls.service.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-cpaas.adapter.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-calls.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(b2b): call session adapter with mock CPaaS

EOF
)"
```

---

### Task 13: AI auto-call at warn (B2B-13, B2B-14)

**Files:**
- Modify: `b2b-sla-tick.service.ts` — khi `shouldStartAiCall` → `calls.startAiCall` (một lần / lead: `kind=ai` đã tồn tại → skip)
- Test: extend `b2b-sla-tick.service.spec.ts`

**Interfaces:**
- Consumes: `shouldStartAiCall`, `B2bCallsService`
- Produces: tối đa 1 AI session / lead; `answered` → dừng hop (`answered=true` trên lead)

- [ ] **Step 1: Write the failing test**

```ts
it('B2B-14 starts AI at warn if staff never dialed', async () => {
  const calls = { startAiCall: jest.fn(), hasHumanDial: async () => false, hasAiCall: async () => false };
  const repo = {
    listOpenB2b: async () => [
      {
        leadId: 1,
        ownerId: 10,
        score: 80,
        assignedAt: new Date(Date.now() - 3 * 60_000),
        hopCount: 0,
        hasCallActivity: false,
        answered: false,
        projectId: 'p',
        aiCallEnabled: true,
      },
    ],
    inHours: async () => true,
    loadPool: async () => [],
    applyHop: jest.fn(),
  };
  const tick = new B2bSlaTickService(repo as never, calls as never);
  await tick.tick(new Date());
  expect(calls.startAiCall).toHaveBeenCalledWith(expect.objectContaining({ leadId: 1 }));
  expect(repo.applyHop).not.toHaveBeenCalled();
});

it('B2B-13 does not AI-call before warn', async () => {
  const calls = { startAiCall: jest.fn(), hasHumanDial: async () => false, hasAiCall: async () => false };
  const repo = {
    listOpenB2b: async () => [
      {
        leadId: 1,
        ownerId: 10,
        score: 80,
        assignedAt: new Date(Date.now() - 60_000),
        hopCount: 0,
        hasCallActivity: false,
        answered: false,
        projectId: 'p',
        aiCallEnabled: true,
      },
    ],
    inHours: async () => true,
    loadPool: async () => [],
    applyHop: jest.fn(),
  };
  const tick = new B2bSlaTickService(repo as never, calls as never);
  await tick.tick(new Date());
  expect(calls.startAiCall).not.toHaveBeenCalled();
});
```

Trong `tick`, sau `resolveSlaAction`: nếu `shouldStartAiCall({ action, hasStaffDialed: await calls.hasHumanDial(leadId), alreadyAiCalled: await calls.hasAiCall(leadId), aiCallEnabled })` thì `startAiCall`; nuốt lỗi AI, không throw.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-sla-tick.service.spec.ts --no-coverage`

Expected: FAIL `startAiCall` (constructor 1-arg)

- [ ] **Step 3: Wire AI call into tick**

`startAiCall` tạo `crm_b2b_call_sessions.kind='ai'`. Script template từ `assign_reason` + band. `no_answer` không set `answered`. `hasAiCall` true → skip.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-sla-tick.service.spec.ts src/b2b-projects/b2b-sla.util.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/b2b-projects/b2b-sla-tick.service.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-sla-tick.service.spec.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-calls.service.ts
git commit -m "$(cat <<'EOF'
feat(b2b): AI first-call only at SLA warning

EOF
)"
```

---

### Task 14: Persist alerts + GET inbox (B2B-16, B2B-17)

**Files:**
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-alerts.service.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-alerts.controller.ts` — `GET /api/v1/b2b-lead-alerts`
- Test: `services/ptt-crm-api/src/b2b-projects/b2b-alerts.service.spec.ts`
- Modify: `b2b-first-assign.service.ts` — sau gán gọi `alerts.fanoutArrival(lead)`
- Modify: `b2b-projects.module.ts` — đăng ký controller

**Interfaces:**
- Consumes: `planLeadArrivalAlerts`
- Produces: `crm_b2b_lead_alerts`; GET `staff_id = me` (GDKD `?scope=all` nếu `view_all_leads`)

- [ ] **Step 1: Write the failing test**

```ts
it('B2B-17 does not insert for outsider', async () => {
  const repo = { insertAlerts: jest.fn() };
  const svc = new B2bAlertsService(repo as never);
  await svc.fanoutArrival({
    lead: { flowKind: 'b2b_prospect', ownerId: 10, projectId: 'p', score: 80 },
    inHours: true,
    receivers: [
      { staffId: 99, assignEnabled: false, isDirector: false, hasViewAllLeads: false, isActivePttStaff: true },
    ],
  });
  expect(repo.insertAlerts).toHaveBeenCalledWith([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-alerts.service.spec.ts --no-coverage`

Expected: FAIL module not found

- [ ] **Step 3: Implement fanout = planLeadArrivalAlerts → insertAlerts**

Push: `StaffPushSender.send({ staffId, title, severity })` — no-op mock nếu chưa FCM staff. **Không** gọi `PortalPushSenderService`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-alerts.service.spec.ts src/b2b-projects/b2b-alert.util.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/b2b-projects/b2b-alerts.service.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-alerts.controller.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-alerts.service.spec.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-projects.module.ts
git commit -m "$(cat <<'EOF'
feat(b2b): lead-arrival alerts inbox API

EOF
)"
```

---

### Task 15: PWA mobile inbox + chuông Hot

**Files:**
- Create: `services/ops-web/src/app/crm/b2b-inbox/page.tsx`
- Create: `services/ops-web/src/components/crm/B2bHotAlarm.tsx`
- Create: `services/ops-web/src/lib/b2b-hot-alarm.ts`
- Test: `services/ops-web/src/lib/b2b-hot-alarm.spec.ts`
- Modify: chi tiết lead — CTA **Gọi** sticky, `min-height: 44px`; không form kênh trên mobile

**Interfaces:**
- Consumes: `GET /api/v1/b2b-lead-alerts`, `POST /api/v1/leads/:id/calls`
- Produces: inbox PWA; chuông urgent ≤30s

- [ ] **Step 1: Write the failing test**

```ts
import { shouldRingHotAlarm } from './b2b-hot-alarm';

it('rings urgent in hours unread', () => {
  expect(shouldRingHotAlarm({ severity: 'urgent', inHours: true, leadOpen: false, elapsedMs: 0 })).toBe(true);
});

it('stops after 30s', () => {
  expect(shouldRingHotAlarm({ severity: 'urgent', inHours: true, leadOpen: false, elapsedMs: 31_000 })).toBe(false);
});

it('silent outside hours', () => {
  expect(shouldRingHotAlarm({ severity: 'urgent', inHours: false, leadOpen: false, elapsedMs: 0 })).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && npx vitest run src/lib/b2b-hot-alarm.spec.ts`

Expected: FAIL

- [ ] **Step 3: Implement**

```ts
export function shouldRingHotAlarm(input: {
  severity: string;
  inHours: boolean;
  leadOpen: boolean;
  elapsedMs: number;
}): boolean {
  if (input.leadOpen || !input.inHours) return false;
  if (input.severity !== 'urgent') return false;
  return input.elapsedMs < 30_000;
}
```

`B2bHotAlarm` poll alerts 15s; `OscillatorNode` 880Hz. Tắt: `localStorage.b2bHotSound=0`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd services/ops-web && npx vitest run src/lib/b2b-hot-alarm.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/b2b-hot-alarm.ts services/ops-web/src/lib/b2b-hot-alarm.spec.ts \
  services/ops-web/src/components/crm/B2bHotAlarm.tsx services/ops-web/src/app/crm/b2b-inbox
git commit -m "$(cat <<'EOF'
feat(b2b): mobile inbox and hot arrival alarm

EOF
)"
```

---

### Task 16: Visibility C trên intake + review-queue + smoke

**Files:**
- Modify: `services/ptt-crm-api/src/intake/` — `assertB2bVisible`
- Modify: review-queue list — SQL scope Task 7
- Modify: `services/ptt-crm-api/src/ai-intelligence/ai-tools/tools/list-leads.tool.ts` — filter trước trả tên
- Create: `scripts/smoke_b2b_project_os.sh`
- Test: thêm case `redactLeadIfDenied` vào `b2b-visibility.util.spec.ts`

**Interfaces:**
- Consumes: `canSeeB2bLead`, `redactLeadIfDenied`
- Produces: cùng filter C trên intake / queue / AI / export

- [ ] **Step 1: Write the failing test**

```ts
import { redactLeadIfDenied } from './b2b-visibility.util';

it('redacts name on deny', () => {
  const out = redactLeadIfDenied(false, { full_name: 'Secret', phone: '090' });
  expect(JSON.stringify(out)).not.toContain('Secret');
  expect(JSON.stringify(out)).not.toContain('090');
  expect(out).toEqual({ error: 'not_found' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-visibility.util.spec.ts --no-coverage`

Expected: PASS nếu Task 1 đã export `redactLeadIfDenied` — vẫn thêm assertion. Intake chưa filter = work Task 16 Step 3.

- [ ] **Step 3: Apply `assertB2bVisible`**

`scripts/smoke_b2b_project_os.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
API="${API_URL:-http://127.0.0.1:3000}"
code=$(curl -s -o /tmp/b2b400.json -w '%{http_code}' -X POST "$API/api/v1/leads" \
  -H "Authorization: Bearer $STAFF_TOKEN" -H 'Content-Type: application/json' \
  -d '{"full_name":"X","phone":"0900000000","lead_flow_kind":"b2b_prospect"}')
test "$code" = "400"
grep -q b2b_project_required /tmp/b2b400.json
echo OK
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects --no-coverage`

Expected: all `src/b2b-projects` PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/intake \
  services/ptt-crm-api/src/ai-intelligence/ai-tools \
  services/ptt-crm-api/src/leads-funnel \
  scripts/smoke_b2b_project_os.sh \
  services/ptt-crm-api/src/b2b-projects/b2b-visibility.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(b2b): apply visibility C to intake, queue, and AI list

EOF
)"
```

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| §4 DDL, PTT, PTT-LEGACY, kênh, hops, alerts, calls | 3 |
| §5 visibility A+B+C, 404 | 1, 7, 16 |
| §6 ingest map, unmatched, dedup trong dự án | 8 |
| §7.1 AI assign + timeout 800ms | 4, 10 |
| §7.2–7.3 SLA hop / gdkd / hours | 4, 11 |
| §7.4 CPaaS / answered | 12 |
| §7.5 commission 30/70 | 4, 11 |
| §7.6 AI gọi tại cảnh báo (A) | 4, 13 |
| §8.1 desktop dự án | 6, 9 |
| §8.2–8.3 mobile + báo động | 14, 15 |
| §9 API | 6, 7, 12, 14 |
| §10 errors | 7, 8, 12 |
| §11 B2B-01…18 | Tasks 1–16 |
| Flag off giữ cũ | 3, 7 |

Tên hàm thống nhất: `canSeeB2bLead`, `decideFirstAssign`, `resolveSlaAction`, `shouldStartAiCall`, `planLeadArrivalAlerts`, `splitOnSlaHop`, `resolveIngressProject`.
