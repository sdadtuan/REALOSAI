# Market Research OS — Kế hoạch coding P0 (Vertical slices)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) hoặc `superpowers:executing-plans` để thực thi **từng milestone**. Mỗi M có exit criteria, unit spec, smoke script và trace UC/EC.
>
> **P1–P4 không nằm trong file này** — plan riêng sau khi P0 smoke PASS.

**Goal:** Ship module Nest `MarketResearchModule` + route `/crm/research` sao cho AM/Analyst/Lead **làm DV12 CB thật**: brief → desk/evidence → insight có gate → DOCX — không scaffold rỗng.

**Architecture:** Evidence OS. Nest API `api/v1/research` (flag + caps). PG `crm_research_*`. Desk/Deep Research = job `ptt_worker` (Tavily / OpenAI-or-Gemini). Insight/report copilot = Nest Claude (pattern LMP LLM). FE `StaffPageShell` + nhóm nav **Lên kế hoạch**. Không ghi `crm_sales_market_research`.

**Tech Stack:** NestJS `services/ptt-crm-api`, Next.js `services/ops-web`, PostgreSQL, Python `ptt_worker` + `ptt_jobs/handlers`, Anthropic + Tavily, bash smoke, Jest (`*.spec.ts`) + pytest.

**Spec canonical:**
- Design [`../specs/2026-08-14-market-research-os-design.md`](../specs/2026-08-14-market-research-os-design.md)
- SRS [`../../specs/2026-08-14-market-research-os-srs.md`](../../specs/2026-08-14-market-research-os-srs.md)
- UX [`../../specs/2026-08-14-market-research-os-ui-ux.md`](../../specs/2026-08-14-market-research-os-ui-ux.md)
- UC [`../../specs/modules/RNOSAI-BA-RES-UseCases.md`](../../specs/modules/RNOSAI-BA-RES-UseCases.md)
- Actions [`../../use-cases/actions/12-RES-ACTIONS.md`](../../use-cases/actions/12-RES-ACTIONS.md)

## Global Constraints

- **BR-RES-01:** Không `approved_*` / `published` khi thiếu evidence `verified`.
- **BR-RES-05:** Sửa report đã approve = version mới.
- **BR-RES-06 / BR-RES-08:** AI draft ≠ published; Deep Research chỉ source nháp.
- **BR-RES-07:** Không tự approve object mình tạo (`cannot_self_approve`).
- **BR-RES-10:** Tavily credits / project ≤ `MAX_TAVILY_CREDITS_PER_RESEARCH` (default 12).
- **BR-RES-11:** Prompt desk/deep **cấm** SĐT/email/tên người từ CRM lead.
- **BR-RES-12:** Cross-tenant GET → **403**, body **không** có `title`.
- **BR-RES-13:** GDKD `crm_leads.assign` **không** hiện nút duyệt method.
- **API prefix:** `api/v1/research` — khớp SRS §5; **không** nhét dưới service-lifecycle.
- **Flag:** `PTT_MARKET_RESEARCH_ENABLED` (API) / `NEXT_PUBLIC_MARKET_RESEARCH` (FE). Off → API 404 `market_research_disabled`, nav ẩn.
- **Copy VI** theo UX §10. Design tokens PTT — không palette mới.
- **Cấm anti-pattern:** health `{ok:true}` không side-effect coi là “xong module”; FE “Coming soon”; Deep Research tự tạo insight.
- **Commit:** chỉ khi user yêu cầu (user rule). Mỗi M xong chạy smoke trước khi sang M tiếp.
- **Không** đụng `/crm/sales?tab=market` và `/seo/research`.

### Definition of Done (mọi task)

| # | Tiêu chí | Verify |
|---|----------|--------|
| 1 | User-visible | UI hoặc curl smoke |
| 2 | Persisted | F5 / SQL còn data |
| 3 | Guarded | thiếu cap → 403; flag off → 404; gate → 400 `insight_gate` |
| 4 | Tested | `*.spec.ts` util + smoke JSON |

### Thứ tự file (bắt buộc)

```
DDL → repository SQL → pure util + spec (TDD) → service → controller + guards
→ ops-web api client → pages/components → smoke
```

---

## 0. Milestone map (P0 = M0–M7)

| M | User outcome | UC | EC | Ước lượng |
|---|--------------|----|----|-----------|
| **M0** | Schema + flag + cap + `GET /health` | — | — | 0.5 ngày |
| **M1** | Nav Lên kế hoạch + list + wizard G0 + RQ | 001–003, 013, 015 | 01, 02, 07, 08 | 2 ngày |
| **M2** | Nguồn thủ công + evidence verify + lock | 006, 014, 017, 019 | 10 | 1.5 ngày |
| **M3** | Insight + gate + SoD approve + Activity reviews | 007, 008, 018 | 04, 11 | 2 ngày |
| **M4** | Desk Tavily async → source AI | 004, 016, 020 | 03, 12 | 1.5 ngày |
| **M5** | Deep Research async — **không** tạo insight | 005 | 09 | 1 ngày |
| **M6** | Copilot insight/report (Claude, grounded) | 011, 012 | — | 1 ngày |
| **M7** | Report version + DOCX + tenancy UAT + deploy script | 009, 010 | 05, 06 | 1.5 ngày |

**P0 sign-off = M7 smoke PASS + Actions 27 bước (hoặc nhánh E-Tavily).**  
Effort: 1 BE + 1 FE ~ 3–4 tuần calendar (spec P0).

```mermaid
gantt
  title Market Research OS P0
  dateFormat YYYY-MM-DD
  section Infra
  M0 DDL flags caps     :m0, 2026-08-14, 1d
  section Core CRUD
  M1 Nav wizard list    :m1, after m0, 2d
  M2 Evidence ledger    :m2, after m1, 2d
  M3 Insight gate SoD   :m3, after m2, 2d
  section AI jobs
  M4 Desk Tavily        :m4, after m2, 2d
  M5 Deep Research      :m5, after m4, 1d
  M6 Copilot Claude     :m6, after m3, 1d
  section Deliver
  M7 DOCX tenancy UAT   :m7, after m6, 2d
```

M4 có thể song song M3 sau khi M2 xong (cùng source table).

---

## 1. Baseline copy (đọc trước khi code)

| Pattern | File nguồn | Áp dụng |
|---------|------------|---------|
| Enabled guard 404 | `lead-meeting-prep/guards/lead-meeting-prep-enabled.guard.ts` | `market-research-enabled.guard.ts` |
| Cap guards | `content-marketing/guards/staff-content-marketing.guard.ts` | `staff-market-research.guard.ts` |
| Flag config | `config/app-config.service.ts` `leadMeetingPrepEnabled` | `marketResearchEnabled` |
| FE flag | `ops-web/src/lib/mkt-ai-planner-flags.ts` | `market-research-flags.ts` |
| Job enqueue | `webhooks/job-queue.repository.ts` `enqueueLeadMeetingPrepJob` | `enqueueResearchDeskJob` / `enqueueResearchDeepJob` |
| Worker dispatch | `ptt_worker/__main__.py` `lead_meeting_prep` | `research_desk_collect`, `research_deep_research` |
| Tavily | `ptt_crm/lead_meeting_prep/collect.py` | `ptt_crm/market_research/desk_collect.py` — env cap **khác** |
| LLM Nest | `lead-meeting-prep-llm.service.ts` | `market-research-llm.service.ts` (Claude) |
| DOCX zip | `marketing-ai-planner/marketing-ai-docx.util.ts` | `market-research-docx.util.ts` |
| Client scope | `staff-client-scope/staff-client-scope.service.ts` | mọi GET/PATCH project |
| Nav | `OpsNav.tsx` delivery block ~341–356 | nhóm mới **trước** Triển khai |
| RBAC catalog | `staff-permissions/rbac-admin-catalog.json` | section `crm_research` |
| DDL apply | `scripts/apply_pg_ddl_mkt_ai_planner.sh` | `apply_pg_ddl_market_research.sh` |
| Seed caps | `scripts/seed_mkt_ai_pilot_rbac.sh` | `seed_crm_research_rbac.sh` |

---

## 2. File map (tạo mới P0)

```
docs/specs/2026-08-14-postgresql-ddl-market-research.sql
scripts/apply_pg_ddl_market_research.sh
scripts/seed_crm_research_rbac.sh
scripts/smoke_market_research_m0.sh … m7.sh
scripts/smoke_market_research_p0.sh          # chạy lần lượt M0–M7
scripts/market_research_gate.sh              # EC-RES-01…12
scripts/deploy_market_research_vps.sh

services/ptt-crm-api/src/market-research/
  market-research.module.ts
  market-research.controller.ts
  market-research-internal.controller.ts
  market-research.service.ts
  market-research.repository.ts
  market-research.types.ts
  market-research.constants.ts
  market-research-enqueue.service.ts
  market-research-llm.service.ts
  market-research-docx.util.ts
  market-research-docx.util.spec.ts
  insight-gate.util.ts
  insight-gate.util.spec.ts
  project-state.util.ts
  project-state.util.spec.ts
  evidence-immutable.util.ts
  evidence-immutable.util.spec.ts
  guards/market-research-enabled.guard.ts
  guards/staff-market-research.guard.ts

ptt_crm/market_research/
  desk_collect.py
  deep_research.py
  repository.py
  pii_guard.py
tests/test_market_research_desk.py
tests/test_market_research_deep.py
ptt_jobs/handlers/research_desk.py
ptt_jobs/handlers/research_deep.py

services/ops-web/src/lib/market-research-flags.ts
services/ops-web/src/lib/market-research-api.ts
services/ops-web/src/lib/auth.ts                    # canViewMarketResearch helpers
services/ops-web/src/components/research/*
services/ops-web/src/app/crm/research/page.tsx
services/ops-web/src/app/crm/research/new/page.tsx
services/ops-web/src/app/crm/research/[id]/page.tsx
services/ops-web/src/app/crm/research/[id]/report/[versionId]/page.tsx
```

**Modify:**

- `services/ptt-crm-api/src/app.module.ts` — import `MarketResearchModule`
- `services/ptt-crm-api/src/config/app-config.service.ts` — flags
- `services/ptt-crm-api/src/webhooks/job-queue.repository.ts` — enqueue research jobs
- `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json`
- `services/ptt-crm-api/src/staff-auth/staff-auth.service.ts` — `DEFAULT_STUB_CAPS` thêm `crm_research.*` (dev stub)
- `admin_page_permissions.py` — section `crm_research` (label **khác** `crm_sales_market`)
- `ptt_worker/__main__.py` — 2 job types
- `services/ops-web/src/components/OpsNav.tsx`
- `services/ops-web/src/components/layout/nav-icons.tsx`
- `services/ops-web/.env.example`

---

## 3. Interfaces khóa (mọi task sau M0 phải dùng đúng tên)

```typescript
// market-research.constants.ts
export const PRODUCT_TYPES = [
  'CAT_REVIEW','COMP_LAND','CONSUMER','SEG_STP','BRAND_HEALTH',
  'PRICE_OFFER','CAMPAIGN','TREND_SCAN','GTM','TRACKER',
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PROJECT_STATUSES = [
  'intake','designed','collecting','qc','analyzing','synthesizing',
  'drafting','in_review','approved','distributed','archived','cancelled',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const INSIGHT_STATUSES = [
  'draft','evidence_attached','analyst_verified','peer_reviewed',
  'approved_internal','approved_client_facing','published',
  'superseded','expired','rejected',
] as const;
export type InsightStatus = (typeof INSIGHT_STATUSES)[number];

export type InsightGateCode =
  | 'missing_verified_evidence'
  | 'missing_confidence_rationale';

export type ResearchJobType =
  | 'desk_tavily'
  | 'deep_research'
  | 'insight_draft'
  | 'report_draft'
  | 'pii_scan';
```

**Queue job_type (ptt_jobs):** `research_desk_collect` | `research_deep_research`  
**Idempotency:** `research:{project_id}:{job_type}:{question_id}:{input_hash}`

**HTTP errors (đúng string SRS §5.5):**  
`market_research_disabled` | `not_found` | `forbidden` | `validation_error` | `insight_gate` | `evidence_immutable` | `invalid_transition` | `job_in_flight` | `cannot_self_approve` | `tavily_unconfigured`

---

## Milestone M0 — DDL + flags + caps + health

**User outcome:** Staging có bảng; flag off → 404; flag on → `{ ok: true, enabled: true }`.

### Task M0-1: DDL

**Files:** Create `docs/specs/2026-08-14-postgresql-ddl-market-research.sql`  
**Nguồn:** copy nguyên SRS §4.4 (10 bảng P0). Thêm:

```sql
INSERT INTO schema_migrations (filename) VALUES ('2026-08-14-market-research')
ON CONFLICT DO NOTHING;
```

(Nếu repo chưa có `schema_migrations`, bỏ dòng này — giữ comment trong SQL.)

- [ ] **M0-1a:** Paste DDL; CHECK constraints khớp enum SRS.
- [ ] **M0-1b:** Create `scripts/apply_pg_ddl_market_research.sh` clone `apply_pg_ddl_mkt_ai_planner.sh`, trỏ file SQL trên.

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-14-postgresql-ddl-market-research.sql"
echo "==> Apply Market Research DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  market research DDL"
```

- [ ] **M0-1c:** `bash scripts/apply_pg_ddl_market_research.sh`  
  Expected: `OK  market research DDL`; `\dt crm_research_*` = 10 tables.

### Task M0-2: Flags + module health

**Files:**
- Modify: `app-config.service.ts` (cạnh `leadMeetingPrepEnabled`)
- Create: module, controller, enabled guard
- Modify: `app.module.ts`

```typescript
// app-config.service.ts — constructor
this.marketResearchEnabled = ['1', 'true', 'yes', 'on'].includes(
  (process.env.PTT_MARKET_RESEARCH_ENABLED ?? '0').trim().toLowerCase(),
);
this.maxTavilyCreditsPerResearch = Math.max(
  1,
  Number((process.env.MAX_TAVILY_CREDITS_PER_RESEARCH ?? '12').trim()) || 12,
);
this.researchDeepProvider = (process.env.RESEARCH_DEEP_PROVIDER ?? 'openai').trim().toLowerCase();
this.researchDeepTimeoutSec = Math.max(
  60,
  Number((process.env.RESEARCH_DEEP_TIMEOUT_SEC ?? '900').trim()) || 900,
);
```

```typescript
// guards/market-research-enabled.guard.ts
if (!this.config.marketResearchEnabled) {
  throw new NotFoundException({ error: 'market_research_disabled' });
}
```

```typescript
@Controller('api/v1/research')
@UseGuards(MarketResearchEnabledGuard)
export class MarketResearchController {
  @Get('health')
  health() {
    return { ok: true, enabled: true };
  }
}
```

- [ ] **M0-2a:** Flag default `0`. Module import `app.module.ts`.
- [ ] **M0-2b:** Curl flag off → HTTP 404 `{ "error": "market_research_disabled" }`.
- [ ] **M0-2c:** Flag on → 200 `{ "ok": true, "enabled": true }` (cần JWT nếu guard staff; health P0 cho phép StaffOrInternalKey giống LMP — **nếu** health không auth, chỉ bật khi enabled).

**Chốt:** `GET /api/v1/research/health` dùng `MarketResearchEnabledGuard` **không** bắt cap (ops probe). Mọi route khác bắt staff + cap.

### Task M0-3: Caps catalog + seed

**Files:** `rbac-admin-catalog.json`, `admin_page_permissions.py`, `scripts/seed_crm_research_rbac.sh`

`crm_research` actions: `view`, `create`, `edit`, `run`, `approve`, `export`, `configure`.

Catalog page: `/crm/research`. Label: **«Nghiên cứu thị trường (DV12)»** — **không** trùng label «KD — Nghiên cứu thị trường» của `crm_sales_market`.

Seed positions (clone `seed_mkt_ai_pilot_rbac.sh`):
- SUPER-ADMIN: all
- Analyst/SP-like: view/create/edit/run/export
- AM (KD-01): view/create/edit/export
- Lead: + approve
- GDKD: view only

- [ ] **M0-3:** `--apply` staging; query `staff_section_permissions` thấy `crm_research`.

### Task M0-4: Smoke M0

Create `scripts/smoke_market_research_m0.sh`: assert tables exist + health 404 khi flag 0 (nếu API local).

**Exit M0:** DDL + catalog + health 404/200 theo flag.

---

## Milestone M1 — Nav + list + wizard + RQ + state

**User outcome:** AM tạo project CB + ≥1 RQ; sidebar **Lên kế hoạch**; Marketing plan **không** còn trong Triển khai.

### Task M1-1: TDD project-state.util

**Files:** Create `project-state.util.ts` + `project-state.util.spec.ts`

```typescript
export function canTransitionProject(
  from: ProjectStatus,
  to: ProjectStatus,
  ctx: { rqCount: number; verifiedInsightCount: number },
): { ok: true } | { ok: false; error: 'invalid_transition'; reason: string } {
  if (to === 'cancelled') return { ok: true };
  if (from === 'approved' && to !== 'distributed' && to !== 'archived') {
    return { ok: false, error: 'invalid_transition', reason: 'cannot_revert_approved' };
  }
  if (from === 'intake' && to === 'designed' && ctx.rqCount < 1) {
    return { ok: false, error: 'invalid_transition', reason: 'need_rq' };
  }
  // happy P0: intake→designed→collecting→synthesizing→drafting→in_review→approved→distributed
  const edges: Record<string, ProjectStatus[]> = {
    intake: ['designed', 'cancelled'],
    designed: ['collecting', 'cancelled'],
    collecting: ['synthesizing', 'qc', 'cancelled'],
    qc: ['analyzing', 'synthesizing', 'cancelled'],
    analyzing: ['synthesizing', 'cancelled'],
    synthesizing: ['drafting', 'cancelled'],
    drafting: ['in_review', 'cancelled'],
    in_review: ['approved', 'drafting', 'cancelled'],
    approved: ['distributed', 'archived'],
    distributed: ['archived'],
    archived: [],
    cancelled: [],
  };
  if (to === 'drafting' && from === 'synthesizing' && ctx.verifiedInsightCount < 1) {
    return { ok: false, error: 'invalid_transition', reason: 'need_verified_insight' };
  }
  if (!(edges[from] || []).includes(to)) {
    return { ok: false, error: 'invalid_transition', reason: `${from}->${to}` };
  }
  return { ok: true };
}
```

- [ ] **M1-1a:** Spec: `intake→designed` fail khi `rqCount=0`; `approved→collecting` fail; `*→cancelled` ok.
- [ ] **M1-1b:** `npx jest project-state.util.spec.ts` PASS (cwd `services/ptt-crm-api`).

### Task M1-2: Repository + POST/GET projects

**Produces:**
- `createProject(input): Promise<ProjectRow>`
- `listProjects(scope, filters)`
- `getProject(id)` — **không** trả title nếu caller sẽ 403 trước đó
- `addQuestion` / `patchQuestion` / `deleteQuestion` (409 nếu evidence tồn tại)

Validation POST (service):
- `client_id` non-empty
- `product_type` ∈ PRODUCT_TYPES
- `decision_statement.trim().length >= 20`
- `title.trim().length >= 8`
- `questions.length >= 1` mỗi phần tử `question_vi` non-empty
- 400 `{ error: 'validation_error', messages: string[] }`

Tenancy: `StaffClientScopeService` — list filter `client_id IN allowed`; get ngoài scope `ForbiddenException({ error: 'forbidden' })` **không** include project fields.

- [ ] **M1-2:** Controller routes SRS §5.1: `GET/POST /projects`, `GET/PATCH /projects/:id`, questions CRUD. Guards: view/create/edit.

### Task M1-3: FE flags + OpsNav

**Files:** `market-research-flags.ts`, `OpsNav.tsx`, `nav-icons.tsx`, `auth.ts`

```typescript
export function isMarketResearchFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_MARKET_RESEARCH ?? '0').trim().toLowerCase(),
  );
}
```

`OpsNav.tsx` — **trước** block `delivery`:

```typescript
const plan: NavLink[] = [];
if (isMarketResearchFeEnabled() && hasCap(user, 'crm_research', 'view')) {
  plan.push({ href: '/crm/research', label: 'Nghiên cứu thị trường' });
}
if (hasCap(user, 'crm_board', 'view')) {
  plan.push({ href: '/crm/marketing-plan', label: 'Kế hoạch marketing' });
}
if (plan.length) {
  sections.push({ label: 'Lên kế hoạch', links: plan, defaultOpen: true });
}
```

**Gỡ** dòng `delivery.push({ href: '/crm/marketing-plan', ... })` khỏi nhóm Triển khai.

Icon: `'/crm/research': 'search'` (hoặc `'insight'`).

Deep link flag off: page `/crm/research` empty *«Module nghiên cứu thị trường chưa bật.»* — không crash.

- [ ] **M1-3:** UAT visual: 2 link PLAN; 0 marketing-plan trong Triển khai; `/crm/sales?tab=market` nguyên (EC-RES-07 — regression click tay).

### Task M1-4: Pages list + wizard

**Files:** `app/crm/research/page.tsx`, `new/page.tsx`, `[id]/page.tsx` (tab=brief tối thiểu), `lib/market-research-api.ts`, components `ResearchStatusChip`, `ProductTypeCard`, `RqListEditor`.

Wizard 5 bước UX §7.2. Submit `POST /projects`.

Workspace header: title, type, tier, status dropdown (chỉ transition `canTransitionProject.ok`).

- [ ] **M1-4:** Tạo 1 project Acme trên staging; F5 còn; list hiện row.

**Smoke M1:** `scripts/smoke_market_research_m1.sh` — POST project + GET list chứa id + POST designed fail nếu xóa hết RQ (nếu test DB cho phép).

**Exit M1:** EC-RES-01, EC-RES-02, EC-RES-08 (nav ẩn khi flag 0).

---

## Milestone M2 — Sources + Evidence + immutability

**User outcome:** Analyst thêm nguồn tay, verify evidence, không sửa excerpt đã lock.

### Task M2-1: TDD evidence-immutable.util

```typescript
export function assertEvidenceMutable(qcStatus: string): void {
  if (qcStatus === 'verified') {
    const err = new Error('evidence_immutable');
    (err as Error & { code: string }).code = 'evidence_immutable';
    throw err;
  }
}

export function piiHint(excerpt: string): boolean {
  return /(\+?84|0)\d{8,10}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(excerpt);
}
```

Spec: verified → throw; pending → ok; excerpt có email → `piiHint` true.

- [ ] **M2-1:** Jest PASS.

### Task M2-2: API sources + evidence

Routes: `POST /projects/:id/sources`, `PATCH /sources/:id` `{ keep }`, `POST /projects/:id/evidence`, `POST /evidence/:id/verify`.

Verify: set `qc_status=verified`, `checksum = sha256(locator|excerpt|value_num|unit|period_note|geography)`.

PATCH evidence khi verified → 409 `{ error: 'evidence_immutable' }`.  
Supersede: POST evidence mới + PATCH old `{ qc_status: 'superseded', superseded_by }`.

Claim số: nếu `value_num` set thì bắt `unit`, `value_base`, `period_note`, `geography` (BR-RES-02).

- [ ] **M2-2:** Curl create source → evidence → verify → PATCH excerpt 409.

### Task M2-3: FE tabs Sources + Evidence

Components: `SourceKeepTable`, `EvidenceFormDrawer`, `EvidenceIdChip`.  
Nút **+ Nguồn thủ công**, **Tạo evidence**, **Verify**. Keep checkbox. Lock icon verified.

- [ ] **M2-3:** UI tạo EV, refresh lock còn.

**Exit M2:** EC-RES-10.

---

## Milestone M3 — Insight + gate + SoD

**User outcome:** Không duyệt insight 0 evidence; creator không tự duyệt.

### Task M3-1: TDD insight-gate.util

**Files:** `insight-gate.util.ts` + spec

```typescript
export function evaluateInsightGate(input: {
  verifiedEvidenceCount: number;
  confidenceRationale: string | null | undefined;
}): { ok: true } | { ok: false; error: 'insight_gate'; messages: InsightGateCode[] } {
  const messages: InsightGateCode[] = [];
  if (input.verifiedEvidenceCount < 1) messages.push('missing_verified_evidence');
  if (!String(input.confidenceRationale || '').trim()) messages.push('missing_confidence_rationale');
  if (messages.length) return { ok: false, error: 'insight_gate', messages };
  return { ok: true };
}

export function assertNotSelfApprove(createdBy: string | null, reviewer: string): void {
  if (createdBy && createdBy.trim().toLowerCase() === reviewer.trim().toLowerCase()) {
    const err = new Error('cannot_self_approve');
    (err as Error & { code: string }).code = 'cannot_self_approve';
    throw err;
  }
}

export function canApproveTarget(
  from: InsightStatus,
  target: InsightStatus,
  riskClass: string,
): boolean {
  if (target === 'approved_internal') {
    return from === 'analyst_verified' || from === 'peer_reviewed' ||
      (from === 'analyst_verified' && riskClass === 'low') ||
      from === 'analyst_verified';
  }
  if (target === 'approved_client_facing') return from === 'approved_internal';
  if (target === 'rejected') return true;
  return false;
}
```

- [ ] **M3-1a:** Spec: 0 evidence → messages chứa `missing_verified_evidence`; rationale rỗng → `missing_confidence_rationale`; cả hai cùng lúc.
- [ ] **M3-1b:** `assertNotSelfApprove('a@x','a@x')` throws; khác email ok.
- [ ] **M3-1c:** Jest PASS.

### Task M3-2: API insights + approve

`POST /projects/:id/insights`  
`POST /insights/:id/attach-evidence` `{ evidence_ids: number[] }`  
`POST /insights/:id/submit-review` — gọi `evaluateInsightGate`  
`POST /insights/:id/approve` `{ target_status, comments }` — cap `approve`; `assertNotSelfApprove`; insert `crm_research_reviews`.

400:

```json
{ "error": "insight_gate", "messages": ["missing_verified_evidence"] }
```

403: `{ "error": "cannot_self_approve" }`

- [ ] **M3-2:** Curl approve 0 EV → 400; hai user approve → 200 `approved_internal`.

### Task M3-3: FE Insights + Gate dialog + SoD banner

`InsightCard`, `InsightDrawer`, `InsightGateDialog` (map messages → copy UX §10).  
Nút Gửi duyệt disabled + `title` khi 0 EV. Click Approve khi 400 → dialog không silent.  
Nếu `user.email === created_by`: ẩn Duyệt nội bộ + banner SoD.

- [ ] **M3-3:** UAT dialog + SoD.

**Exit M3:** EC-RES-04, EC-RES-11.

---

## Milestone M4 — Desk Tavily (async)

**User outcome:** Chạy Desk → source `ai_generated`; thiếu key → failed vàng, project không chết.

### Task M4-1: Enqueue + worker Python

**Modify:** `job-queue.repository.ts`

```typescript
async enqueueResearchDeskJob(input: {
  projectId: number;
  questionId: number;
  runId: number;
  clientId?: string | null;
  idempotencyKey: string;
}): Promise<EnqueuedJob | null> {
  if (!this.config.jobsEnabled) return null;
  return this.enqueueJobRecord({
    jobType: 'research_desk_collect',
    payload: {
      project_id: input.projectId,
      question_id: input.questionId,
      run_id: input.runId,
    },
    idempotencyKey: input.idempotencyKey,
    clientId: this.normalizeClientUuid(input.clientId ?? undefined),
    maxAttempts: 2,
  });
}
```

**Python:** `ptt_crm/market_research/desk_collect.py`  
- Copy search/extract từ `collect.py`  
- Cap `MAX_TAVILY_CREDITS_PER_RESEARCH`  
- Query = `question_vi` (+ geo) — **cấm** ghép SĐT/email từ CRM  
- Không key → return `{ ok: false, error: "tavily_unconfigured" }` (không raise)  
- Insert `crm_research_sources` (`ai_generated=true`, `keep=null`)  
- Update `crm_research_ai_runs` status succeeded/failed + `credits_used`

`ptt_jobs/handlers/research_desk.py` — mark_job_done/failed.

`ptt_worker/__main__.py`:

```python
elif job_type == "research_desk_collect":
    from ptt_jobs.handlers.research_desk import run_research_desk_job
    run_research_desk_job(job)
```

**API:** `POST /projects/:id/run-desk` `{ question_id }`  
- Cap `run`  
- Nếu run pending/running cùng question → 409 `job_in_flight`  
- Insert `crm_research_ai_runs` `job_type=desk_tavily` `status=pending`  
- Enqueue; 202 `{ ok: true, run_id, status: "pending" }`  
- `GET /projects/:id/jobs/:runId`

pytest `tests/test_market_research_desk.py`: mock Tavily; no key → `tavily_unconfigured`.

- [ ] **M4-1:** Unit pytest PASS; enqueue trên staging (hoặc mock).

### Task M4-2: FE JobChip

Poll 2s → 5s. Banner vàng `tavily_unconfigured`. Credit `n/12`. Retry = POST run-desk lại khi failed.

- [ ] **M4-2:** UI chip succeeded + row AI trên Sources.

**Exit M4:** EC-RES-03, EC-RES-12 (ai_runs row).

---

## Milestone M5 — Deep Research

**User outcome:** Job tạo source nháp + outline trong `output_json`; **0 insight mới**.

### Task M5-1: Provider adapter

`ptt_crm/market_research/deep_research.py`:
- `RESEARCH_DEEP_PROVIDER=off` → Nest ẩn nút; nếu gọi API → 400 `deep_research_disabled`
- `openai`: gọi API Deep Research / Responses (theo key `OPENAI_API_KEY` đã có). Timeout `RESEARCH_DEEP_TIMEOUT_SEC`. Parse URL list → sources `ai_generated=true`.
- `gemini`: `GEMINI_API_KEY` / Google DR tương đương.
- Fail/timeout → `crm_research_ai_runs.status=failed`, **không** treo worker (NFR-AI-05).
- Prompt: “Return candidate source URLs only. Do not invent statistics.” + cấm PII.

Nếu OpenAI DR chưa wire được trong 1 ngày: **fallback P0** = Tavily `search_depth=advanced` + LLM outline (Claude/GPT) **vẫn** chỉ insert sources — ghi `provider=openai_fallback_tavily` trong run. **Không** đổi BR-RES-08.

Enqueue `research_deep_research`. Modal FE UX §7.6 bắt buộc.

- [ ] **M5-1:** pytest: output không có `insight_insert`.
- [ ] **M5-2:** UAT: sau job, `SELECT count(*) FROM crm_research_insights WHERE project_id=?` không tăng (EC-RES-09).

**Exit M5:** EC-RES-09.

---

## Milestone M6 — Copilot Claude (grounded)

**User outcome:** Gợi ý insight **chỉ** từ evidence_ids; gợi ý report từ insight đã duyệt.

### Task M6-1: Nest LLM

`market-research-llm.service.ts` — Anthropic pattern LMP (`ANTHROPIC_API_KEY`). Temperature ≤ 0.3.

**Insight draft:** prompt chứa **chỉ** `{id, locator, excerpt, value, unit, period, geo}` của IDs đã chọn. Cấm “fill gaps”. Output JSON 4 khối + statement. Insert insight `ai_generated=true` `draft`.

**Report draft:** insight `approved_internal+` → `content_snapshot` JSON (cover, exec, findings[], recs[], methodology stub, evidence_index). Không set published.

Log `crm_research_ai_runs`. Redact nếu `pii_class != none` (NFR-SEC-04).

Routes (P0 gộp vào service, POST):
- `POST /projects/:id/insights/copilot` `{ evidence_ids: number[] }` cap `run`
- `POST /projects/:id/reports/copilot` `{ insight_ids: number[] }` cap `run`

- [ ] **M6-1:** Spec: copilot với 0 evidence → 400.  
- [ ] **M6-2:** FE nút **Gợi ý insight** / **Gợi ý dàn báo cáo**.

**Exit M6:** BR-RES-06 trên UI (badge AI).

---

## Milestone M7 — Report DOCX + tenancy UAT + deploy

**User outcome:** Xuất DOCX có appendix + evidence index; user client B 403.

### Task M7-1: Snapshot + DOCX

`POST /projects/:id/reports` `{ insight_ids }` — chỉ insight ≥ `approved_internal`.  
Insert `crm_research_reports` + `crm_research_report_versions` (`version` tăng, `content_hash` sha256 JSON).

`GET /reports/:id/versions/:versionId/export` cap `export` → `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.

Copy `buildMarketingPlanDocx` → `buildResearchReportDocx(sections)` với sections:

1. Cover (client, confidential, version, as_of)  
2. Executive answer  
3. Findings (1 heading / RQ)  
4. Recommendations  
5. Methodology (stub P0 CB)  
6. Evidence index (`EV-id → locator`)

- [ ] **M7-1a:** Jest: snapshot có key `evidence_index` length ≥ 1 khi insight có EV.  
- [ ] **M7-1b:** File DOCX unzip được `word/document.xml` chứa `Evidence`.

Sửa sau approve: PATCH content cấm; POST version mới (BR-RES-05). Banner FE.

### Task M7-2: Tenancy test

Hai user: Acme vs Beta. GET project Acme bằng token Beta → 403, JSON **không** có `title`.

- [ ] **M7-2:** Nằm trong `scripts/market_research_gate.sh` EC-RES-06.

### Task M7-3: Gate script + deploy

`scripts/market_research_gate.sh` assert:
- EC-01 nav (manual checkbox in script echo)
- EC-02 POST project
- EC-03 desk graceful (mock hoặc skip if no key)
- EC-04 insight_gate 400
- EC-05 DOCX contains Evidence
- EC-06 403
- EC-08 flag 404
- EC-09 deep không insert insight (nếu provider off, skip + note)
- EC-10 409 immutable
- EC-11 self-approve 403
- EC-12 ai_runs exists after desk (or skip)

`scripts/deploy_market_research_vps.sh`:
- `npm ci` (không `--omit=dev` — bài học LMP M3)
- apply DDL
- restart `ptt-crm-api` `ptt-ops-web` `ptt-worker`
- env: `PTT_MARKET_RESEARCH_ENABLED=1` `NEXT_PUBLIC_MARKET_RESEARCH=1` trên VPS **sau** smoke local
- **không** bật flag prod trước PO sign-off

- [ ] **M7-3:** `bash scripts/smoke_market_research_p0.sh` PASS staging.

**Exit M7 = P0 sign-off.** UAT Actions 27 bước.

---

## 4. Env checklist (staging)

| Biến | P0 |
|------|-----|
| `PTT_MARKET_RESEARCH_ENABLED` | `1` khi UAT |
| `NEXT_PUBLIC_MARKET_RESEARCH` | `1` |
| `MAX_TAVILY_CREDITS_PER_RESEARCH` | `12` |
| `RESEARCH_DEEP_PROVIDER` | `openai` hoặc `off` |
| `RESEARCH_DEEP_TIMEOUT_SEC` | `900` |
| `TAVILY_API_KEY` | optional (E-Tavily) |
| `OPENAI_API_KEY` | Deep |
| `ANTHROPIC_API_KEY` | Copilot |
| `JOBS_ENABLED` / jobs flag hiện có | `1` |

---

## 5. P1–P4 (không code trong plan này)

| Phase | Plan file (tạo sau P0) | Phạm vi |
|-------|------------------------|---------|
| P1 | `2026-08-14-market-research-os-p1.md` | Rubric, competitor, insert insight→plan, methodology TC/CS, DV12 CTA, dual-DR, consult prefill |
| P2 | `…-p2.md` | Studies, pulse agent, EN exec, analytics |
| P3 | `…-p3.md` | Portal watermark, waves, decision log |
| P4 | bake-off | Qualtrics/RAG/forecast |

---

## 6. Spec coverage (self-review)

| SRS / UC | Task |
|----------|------|
| FR-NAV-01…05, US-NAV-01, EC-01/07/08 | M1-3 |
| FR-PRJ-01…05, US-AM-01/02, EC-02 | M1-2, M1-4 |
| FR-SRC-01/04, UC-014/019 | M2 |
| FR-EVD-01/02/05, EC-10 | M2 |
| FR-INS, FR-REV, BR-01/07, EC-04/11 | M3 |
| FR-SRC-02, FR-AI-01, EC-03/12 | M4 |
| FR-SRC-03, BR-08, EC-09 | M5 |
| FR-AI-03/04, NFR-AI-03 | M6 |
| FR-RPT, EC-05 | M7-1 |
| FR-RBAC-03, EC-06 | M7-2 |
| FR-CI / Studies / Portal | **P1–P3 — out of this plan** |

Gap cố ý: dual-provider, competitor tables, portal — không P0.

---

## 7. Rủi ro thực thi

| Rủi ro | Xử lý trong plan |
|--------|------------------|
| OpenAI Deep Research API chưa sẵn | M5 fallback Tavily advanced + outline, vẫn chỉ sources |
| Tavily chưa có trên VPS | E-Tavily + nguồn thủ công; EC-03 graceful bắt buộc |
| `npm ci --omit=dev` thiếu Nest CLI | Deploy script dùng `npm ci` đủ devDeps build |
| Nhầm cap với `crm_sales_market` | Label catalog khác; test Sales Market regression |
| Worker không pick job mới | `__main__.py` elif bắt buộc M4 |

---

*Hết plan P0. Không viết code cho đến khi user chọn cách thực thi.*
