# P6 Triển khai — Buyer CRM (`re_buyer`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buyer CRM v1 trên PG + SQLite OLTP: ingest lead `re_buyer` từ webhook dự án BĐS, board API, qualify → `bds_buyers`, lịch xem nhà, matching căn; SLA first-touch **15 phút**; Deal Room agency **404** trên lead khách mua (UC-003).

**Architecture:** Bounded context `src/bds/buyers/` (`BdsBuyerLeadService` = spec §8.1 / §10.5). HTTP `/api/v1/bds/leads/*` sau `StaffOrInternalKeyGuard` + `BdsPackGuard` + `BdsBuyerGuard` (`PTT_BDS_PACK=1` **và** `PTT_BDS_BUYER=1`). Ingest webhook: URL `/webhooks/:channel/:projectSlug` **giữ nguyên** — khi slug map `crm_re_project_lead_config` + project có `tenant_id` + BUYER=1 → `BdsBuyerIngestService` thay vì `B2bIngestService`. Lead vẫn ghi SQLite `crm_leads` (OLTP); `bds_buyers` / `bds_site_visits` trên PG. Không import `ReProjectsModule` vào `BdsModule` — đọc project/tenant qua PG repo hoặc service mỏng. Hook nhẹ: hold `active` → lead status `giu_cho` (optional v1).

**Tech Stack:** NestJS `ptt-crm-api`, Jest local binary, `pg` Pool, SQLite `ptt.db`, `psql`.

**Spec:** [2026-08-21-bds-industry-pack-design.md](../specs/2026-08-21-bds-industry-pack-design.md) §6.8, §6.10, §6.11, §7.3, §8.1, §8.2, §9.1, §10.5, §14, BR-BDS-06.  
**UC:** [13-BDS-INDUSTRY-PACK.md](../../use-cases/13-BDS-INDUSTRY-PACK.md) UC-003, UC-031, UC-032, UC-033.  
**P0:** [2026-08-22-bds-p0-trien-khai.md](./2026-08-22-bds-p0-trien-khai.md) — `tenant_id` trên `crm_re_projects`  
**P2:** [2026-08-22-bds-p2-hold-ttl.md](./2026-08-22-bds-p2-hold-ttl.md) — hold `lead_id`  
**P5:** [2026-08-22-bds-p5-agency.md](./2026-08-22-bds-p5-agency.md) — giỏ caller cho matching  
**Roadmap:** [2026-08-22-bds-coding-roadmap.md](./2026-08-22-bds-coding-roadmap.md)

**Test ID P6:** BDS-07 (lead), BDS-08, BDS-17, BDS-18.  
**BDS-07 (inventory CSV sold skip)** = P1 — **không** trùng test ID lead.  
**BDS-19** empty re-projects sàn / nav = **P8**.  
**Ticket `cskh_first_touch` + card `x_mkt_cskh`** = **P11/P12** (P6 chỉ SLA util + `touched_at` field).  
**CAPI `Schedule` lúc visit** = hook stub/log v1; full CAPI = staging sau.  
**UI `/crm/bds/leads`** = **P8**.  
**PWA hold** = ngoài v1.  
**`ban_giao` / `so_hong` lead stage sync** = **P9** after-sales.

## Global Constraints

- `PTT_BDS_PACK` mặc định `0` — mọi `POST /api/v1/bds/*` = **404**.
- `PTT_BDS_BUYER` mặc định `0` — route buyer + ingest RE webhook = **404 / legacy** dù PACK=1.
- `re_buyer` **cấm** `b2b_project_id` cùng lúc (BR-BDS-06) → 400 `{ error: 'b2b_project_forbidden' }`.
- Dedup SĐT **trong** `(bds_tenant_id, re_project_id)` — hai dự án khác nhau = **hai lead** (BDS-08).
- Ngoài scope visibility → **404**, không 403, không PII (BR-BDS-05).
- Deal Room trên `re_buyer` → **404** `{ error: 'not_found' }`, không 400 (UC-003).
- SLA first-touch: **15 phút** từ `received_at`/`created_at` — reuse `CSKH_FIRST_CALL_SLA_MINUTES` (15).
- Không xóa `re-projects/`. Không gộp lead vào `b2b_prospect`. Không UI ops-web.
- Lead OLTP = SQLite; PG `crm_leads` = read replica — dedup ingest đọc SQLite hoặc meta PG tùy path hiện có (Task 4).
- `BdsModule` **không** import `ReProjectsModule`.
- `DATABASE_URL` script: `postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb`.
- Test: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand`.
- Không commit trừ khi user yêu cầu.
- Prod VPS: **không** bật `PTT_BDS_PACK` / `PTT_BDS_BUYER`.

---

## 0. Phạm vi / ngoài phạm vi

**Làm**

- Flag `isBdsBuyerEnabled()` + `BdsBuyerGuard`
- DDL `bds_buyers`, `bds_site_visits`
- Mở rộng `RE_BUYER_STATUSES` theo §7.3 (v1 tới `hdmb`; `ban_giao`/`so_hong` read-only cho P9)
- `assertNoB2bProjectOnReBuyer` (BDS-07)
- Dedup `(tenant, re_project, phone)` (BDS-08)
- Webhook ingest RE project → `re_buyer` + `bds_tenant_id` (BDS-18)
- `GET/POST /api/v1/bds/leads`, `GET .../matches`, `POST .../visits`
- Qualify → upsert `bds_buyers`, gắn `buyer_id` meta/column
- Matching căn `available` ∩ giỏ agency (nếu caller có `x-bds-agency`)
- Visibility lead buyer (BDS-17)
- Deal Room 404 cho `re_buyer`
- SLA 15p applicable cho `re_buyer` trong `LeadSlaCareService`
- Hook hold `active` → lead `giu_cho` (best-effort)

**Không làm**

- Chat card / staff ticket SLA (P11/P12)
- CAPI Purchase/Schedule production wiring
- UI board SCR-BDS-040 (P8)
- Broker empty re-projects (BDS-19, P8)
- Lead dedup cross-tenant 360 buyer (SaaS isolation = P8+)
- RBAC cap `bds_buyers.view_pii` UI mask (P8) — API trả full phone khi cap có
- Commission / TX stage full mirror (`dat_coc`→TX hook = backlog mỏng, test unit only)

---

## 1. File map

```
docs/specs/postgresql-ddl-bds-p6.sql
scripts/apply_pg_ddl_bds_p6.sh

services/ptt-crm-api/src/bds/bds.flags.ts                         # + isBdsBuyerEnabled
services/ptt-crm-api/src/bds/bds.flags.spec.ts
services/ptt-crm-api/src/config/app-config.service.ts             # bdsBuyerEnabled
services/ptt-crm-api/src/bds/guards/bds-buyer.guard.ts
services/ptt-crm-api/src/bds/guards/bds-buyer.guard.spec.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer.types.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer.util.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer.util.spec.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer.repository.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer-lead.repository.ts   # sqlite lead read/write mỏng
services/ptt-crm-api/src/bds/buyers/bds-buyer-ingest.service.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer-ingest.service.spec.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer-lead.service.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer-lead.service.spec.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer-matching.service.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer-matching.service.spec.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer-visit.service.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer-visit.service.spec.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer-lead-scope.service.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer-lead-scope.service.spec.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer-lead.controller.ts
services/ptt-crm-api/src/bds/buyers/bds-buyer-lead.controller.spec.ts
services/ptt-crm-api/src/bds/bds.module.ts
services/ptt-crm-api/src/bds/hold/bds-hold.service.ts               # hook lead status (optional)
services/ptt-crm-api/src/bds/hold/bds-hold.service.spec.ts

services/ptt-crm-api/src/leads-funnel/lead-flow-kind.util.ts        # RE_BUYER_STATUSES §7.3
services/ptt-crm-api/src/leads-funnel/lead-flow-kind.util.spec.ts
services/ptt-crm-api/src/leads/ingest/lead-create-enrichment.service.ts   # nhánh re_buyer
services/ptt-crm-api/src/leads/ingest/lead-create-enrichment.service.spec.ts
services/ptt-crm-api/src/leads/lead-sla-care.service.ts             # applicable re_buyer 15p
services/ptt-crm-api/src/leads/lead-sla-care.service.spec.ts
services/ptt-crm-api/src/deal-room/deal-room.service.ts             # 404 re_buyer
services/ptt-crm-api/src/deal-room/deal-room.service.spec.ts
services/ptt-crm-api/src/webhooks/webhooks.service.ts               # route ingest buyer

docs/superpowers/plans/2026-08-22-bds-coding-roadmap.md             # hàng P6 + flag §4
```

---

## 2. DDL (PostgreSQL)

`docs/specs/postgresql-ddl-bds-p6.sql`:

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS bds_buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES bds_tenants (id),
  full_name TEXT NOT NULL DEFAULT '',
  phone_e164 TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  id_number TEXT NOT NULL DEFAULT '',
  budget_vnd BIGINT,
  need_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_buyers_tenant_phone
  ON bds_buyers (tenant_id, phone_e164)
  WHERE phone_e164 <> '';

CREATE TABLE IF NOT EXISTS bds_site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  lead_id BIGINT NOT NULL,
  product_id BIGINT REFERENCES crm_re_project_products (id),
  staff_id BIGINT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'planned'
    CHECK (outcome IN ('planned', 'showed', 'no_show', 'cancelled')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bds_site_visits_lead ON bds_site_visits (lead_id);

COMMIT;
```

Script: `scripts/apply_pg_ddl_bds_p6.sh` — copy pattern `apply_pg_ddl_bds_p4b.sh`.

---

### Task 1: Flag BUYER + guard + util validation / status

**Files:**
- Modify: `services/ptt-crm-api/src/bds/bds.flags.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.flags.spec.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts`
- Create: `services/ptt-crm-api/src/bds/guards/bds-buyer.guard.ts`
- Create: `services/ptt-crm-api/src/bds/guards/bds-buyer.guard.spec.ts`
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer.types.ts`
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer.util.ts`
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer.util.spec.ts`
- Modify: `services/ptt-crm-api/src/leads-funnel/lead-flow-kind.util.ts`
- Modify: `services/ptt-crm-api/src/leads-funnel/lead-flow-kind.util.spec.ts`

**Interfaces — produces:**

```ts
// bds.flags.ts
export function isBdsBuyerEnabled(): boolean;

// bds-buyer.util.ts
export function assertNoB2bProjectOnReBuyer(input: {
  leadFlowKind?: string;
  b2bProjectId?: string | null;
}): void; // throws BadRequestException { error: 'b2b_project_forbidden' }

export function normalizeNeedJson(raw: unknown): Record<string, unknown>;

export function qualifyBuyerEligible(status: string, phone: string): boolean;
// true when status >= da_lien_he và phone không rỗng
```

**RE_BUYER_STATUSES (§7.3 v1):**

```ts
const RE_BUYER_STATUSES = [
  'moi',
  'da_lien_he',
  'xem_nha',
  'giu_cho',
  'dat_coc',
  'vbtt',
  'hdmb',
  'lost',
  'pending_cleanup',
] as const;
```

- [ ] **Step 1: Flags spec (RED)**

```ts
it('defaults BUYER off when unset', () => {
  delete process.env.PTT_BDS_BUYER;
  expect(isBdsBuyerEnabled()).toBe(false);
});
```

- [ ] **Step 2: Util spec (RED)**

```ts
it('BDS-07 re_buyer + b2b_project_id → 400', () => {
  expect(() =>
    assertNoB2bProjectOnReBuyer({
      leadFlowKind: 're_buyer',
      b2bProjectId: 'uuid-1',
    }),
  ).toThrow(expect.objectContaining({ response: { error: 'b2b_project_forbidden' } }));
});

it('qualify requires da_lien_he + phone', () => {
  expect(qualifyBuyerEligible('moi', '84901234567')).toBe(false);
  expect(qualifyBuyerEligible('da_lien_he', '84901234567')).toBe(true);
});
```

- [ ] **Step 3: Implement flags + guard + util + statuses**

- [ ] **Step 4: Run specs**

Run: `./node_modules/.bin/jest src/bds/bds.flags.spec.ts src/bds/guards/bds-buyer.guard.spec.ts src/bds/buyers/bds-buyer.util.spec.ts src/leads-funnel/lead-flow-kind.util.spec.ts --runInBand`

Expected: PASS

---

### Task 2: DDL + apply script

**Files:**
- Create: `docs/specs/postgresql-ddl-bds-p6.sql`
- Create: `scripts/apply_pg_ddl_bds_p6.sh`

- [ ] **Step 1: Write DDL + script** (nội dung §2)

- [ ] **Step 2: Apply ×2 idempotent**

Run: `bash scripts/apply_pg_ddl_bds_p6.sh && bash scripts/apply_pg_ddl_bds_p6.sh`

Expected: lần 2 chỉ NOTICE skip

---

### Task 3: Repository (`bds_buyers`, visits, lead sqlite)

**Files:**
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer.repository.ts`
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer-lead.repository.ts`

**Interfaces — produces:**

```ts
// bds-buyer.repository.ts
export class BdsBuyerRepository {
  upsertBuyer(input: UpsertBuyerInput): Promise<BuyerRow>;
  getBuyer(id: string, tenantId?: string): Promise<BuyerRow | null>;
  insertVisit(input: InsertVisitInput): Promise<SiteVisitRow>;
  listVisitsByLead(leadId: number): Promise<SiteVisitRow[]>;
}

// bds-buyer-lead.repository.ts
export class BdsBuyerLeadRepository {
  findReBuyerByPhoneProject(input: {
    phone: string;
    reProjectId: number;
    tenantId: string;
  }): Promise<{ lead_id: number } | null>;

  patchLeadMeta(leadId: number, patch: Record<string, unknown>): Promise<void>;
  setLeadStatus(leadId: number, status: string): Promise<void>;
  getLeadForScope(leadId: number): Promise<BuyerLeadRow | null>;
}
```

- [ ] **Step 1: Implement repositories** (pg Pool + sqlite read/write tối thiểu)

- [ ] **Step 2: Smoke query** — `upsertBuyer` + unique phone tenant

---

### Task 4: Ingest webhook RE project (BDS-18)

**Files:**
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer-ingest.service.ts`
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer-ingest.service.spec.ts`
- Modify: `services/ptt-crm-api/src/webhooks/webhooks.service.ts`
- Modify: `services/ptt-crm-api/src/leads/ingest/lead-create-enrichment.service.ts`
- Modify: `services/ptt-crm-api/src/leads/ingest/lead-create-enrichment.service.spec.ts`

**Luồng:**

1. `WebhooksService.enqueuePreparedLeads`: nếu `isBdsBuyerEnabled()` → thử `buyerIngest.prepareWebhookLeads` **trước** `B2bIngestService`.
2. `BdsBuyerIngestService`: resolve `projectSlug` → `crm_re_project_lead_config` (sqlite) → `project_id` → PG `crm_re_projects.tenant_id`. Không có tenant → unmatched (log, không enqueue B2B).
3. Payload lead: `lead_flow_kind: 're_buyer'`, `meta.re_project_id`, `meta.bds_tenant_id`, `client_id: null`, `b2b_project_id: null`.
4. `LeadCreateEnrichmentService`: nhánh `re_buyer` — gọi `assertNoB2bProjectOnReBuyer`; dedup qua `BdsBuyerLeadRepository.findReBuyerByPhoneProject` (BDS-08: khác project → lead mới).

**Interfaces — consumes:** Task 1 `assertNoB2bProjectOnReBuyer`, Task 3 repos.

- [ ] **Step 1: Ingest spec (RED)**

```ts
it('BDS-18 prepares re_buyer with tenant', async () => {
  repo.resolveProjectBySlug.mockResolvedValue({
    projectId: 12,
    tenantId: 't-uuid',
  });
  const out = await svc.prepareWebhookLeads({
    channel: 'meta',
    projectSlug: 'sun-village',
    leads: [{ full_name: 'A', phone: '84901112233', external_lead_id: 'ext1' }],
  });
  expect(out.toEnqueue[0].lead_flow_kind).toBe('re_buyer');
  expect(out.toEnqueue[0].meta?.bds_tenant_id).toBe('t-uuid');
  expect(out.toEnqueue[0].meta?.re_project_id).toBe(12);
});

it('BDS-08 same phone different project is not deduped at ingest', async () => {
  leadRepo.findReBuyerByPhoneProject.mockResolvedValue(null);
  // two calls with different re_project_id → both enqueue
});
```

- [ ] **Step 2: Wire webhooks.service.ts**

```ts
if (this.buyerIngest?.isActive()) {
  const buyerPrepared = await this.buyerIngest.prepareWebhookLeads({ channel, projectSlug, leads });
  if (buyerPrepared.handled) return buyerPrepared.result;
}
```

- [ ] **Step 3: Extend lead-create-enrichment re_buyer branch**

- [ ] **Step 4: Run specs**

Run: `./node_modules/.bin/jest src/bds/buyers/bds-buyer-ingest.service.spec.ts src/leads/ingest/lead-create-enrichment.service.spec.ts --runInBand`

Expected: PASS

---

### Task 5: BdsBuyerLeadService — board + qualify

**Files:**
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer-lead.service.ts`
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer-lead.service.spec.ts`

**API logic:**

- `list(projectId, tenantId, query)` — filter `re_buyer` + `re_project_id`, sort `created_at desc`
- `create(body, tenantId)` — manual POST (internal/staff)
- `qualify(leadId, body, tenantId)` — status → `da_lien_he` hoặc cao hơn; `upsertBuyer`; set `meta.buyer_id`
- `recordTouch(leadId, tenantId)` — set `meta.touched_at` ISO (SLA 15p)

- [ ] **Step 1: Service spec (RED)**

```ts
it('qualify creates bds_buyers and links lead', async () => {
  leadRepo.getLeadForScope.mockResolvedValue({
    id: 1,
    status: 'moi',
    phone: '84901234567',
    re_project_id: 12,
    tenant_id: 't1',
    meta_json: { lead_flow_kind: 're_buyer' },
  });
  buyerRepo.upsertBuyer.mockResolvedValue({ id: 'b1' });
  await svc.qualify(1, { status: 'da_lien_he' }, 't1');
  expect(buyerRepo.upsertBuyer).toHaveBeenCalled();
  expect(leadRepo.patchLeadMeta).toHaveBeenCalledWith(
    1,
    expect.objectContaining({ buyer_id: 'b1' }),
  );
});
```

- [ ] **Step 2: Implement service**

- [ ] **Step 3: Run spec** — PASS

---

### Task 6: Matching + visits (UC-032, UC-033)

**Files:**
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer-matching.service.ts`
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer-matching.service.spec.ts`
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer-visit.service.ts`
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer-visit.service.spec.ts`

**Matching v1:**

- Input: `lead.need_json` (pn, huong, zone, budget) + `re_project_id`
- Query PG products `status='available'` on project
- Nếu header `x-bds-agency` + AGENCY=1 → intersect `bds_basket_units` agency active
- Score đơn giản: +1 mỗi tiêu chí khớp; sort desc, limit 20

**Visits:**

- `POST /leads/:id/visits` body `{ scheduled_at, product_id?, staff_id, note? }`
- Insert `bds_site_visits`; lead status → `xem_nha` nếu ≥ `da_lien_he`
- `outcome` default `planned`; PATCH outcome = backlog (v1 create only)

- [ ] **Step 1: Matching spec**

```ts
it('returns available units scored by need', async () => {
  products.listAvailable.mockResolvedValue([
    { id: 1, unit_code: 'A-01-05', bedrooms: 2, status: 'available' },
  ]);
  const out = await svc.match(1, 't1');
  expect(out[0].product_id).toBe(1);
});
```

- [ ] **Step 2: Visit spec** — create visit + status xem_nha

- [ ] **Step 3: Implement + run specs** — PASS

---

### Task 7: Controller + scope + Deal Room + SLA

**Files:**
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer-lead-scope.service.ts`
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer-lead-scope.service.spec.ts`
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer-lead.controller.ts`
- Create: `services/ptt-crm-api/src/bds/buyers/bds-buyer-lead.controller.spec.ts`
- Modify: `services/ptt-crm-api/src/deal-room/deal-room.service.ts`
- Modify: `services/ptt-crm-api/src/deal-room/deal-room.service.spec.ts`
- Modify: `services/ptt-crm-api/src/leads/lead-sla-care.service.ts`
- Modify: `services/ptt-crm-api/src/leads/lead-sla-care.service.spec.ts`

**Routes (`BdsBuyerLeadController`):**

| Method | Path | Việc |
|--------|------|------|
| GET | `/api/v1/bds/leads?project_id=` | Board |
| POST | `/api/v1/bds/leads` | Tạo tay |
| POST | `/api/v1/bds/leads/:id/qualify` | Qualify + buyer |
| POST | `/api/v1/bds/leads/:id/touch` | SLA touched_at |
| GET | `/api/v1/bds/leads/:id/matches` | Matching |
| POST | `/api/v1/bds/leads/:id/visits` | Lịch xem |

**BDS-17 visibility:**

- CĐT: staff thuộc `crm_re_project_staff` project hoặc GDKD cap view-all
- Sàn: chỉ lead có `meta.channel_partner_id` = agency caller
- Ngoài scope → `NotFoundException`

**Deal Room (UC-003):**

```ts
// deal-room.service.ts — đầu getSnapshot()
if (flowKind === 're_buyer') {
  throw new NotFoundException({ error: 'not_found' });
}
```

**SLA 15p:**

```ts
// lead-sla-care.service.ts
const applicable =
  flowKind === 'spa_operational' ||
  (flowKind === 'b2b_prospect' && hasPresales) ||
  flowKind === 're_buyer';
// tiers: chỉ first_call_15m cho re_buyer (b2/close = na)
```

- [ ] **Step 1: Scope spec BDS-17**

```ts
it('agency not owner → 404', async () => {
  await expect(
    scope.assertVisible({ leadId: 1, agencyId: 'a2', staffId: 9 }),
  ).rejects.toMatchObject({ response: { error: 'not_found' } });
});
```

- [ ] **Step 2: Deal room spec** — re_buyer → 404

- [ ] **Step 3: SLA spec** — re_buyer applicable, first_call_15m

- [ ] **Step 4: Controller delegates**

- [ ] **Step 5: Run specs** — PASS

---

### Task 8: Hold hook + module + roadmap + verify

**Files:**
- Modify: `services/ptt-crm-api/src/bds/hold/bds-hold.service.ts`
- Modify: `services/ptt-crm-api/src/bds/hold/bds-hold.service.spec.ts`
- Modify: `services/ptt-crm-api/src/bds/bds.module.ts`
- Modify: `docs/superpowers/plans/2026-08-22-bds-coding-roadmap.md`

**Hold hook (best-effort):**

```ts
// sau hold active — nếu BUYER=1 && leadRepo
await this.buyerLeads?.syncHoldActive(body.lead_id);
// → set status giu_cho nếu flow re_buyer
```

- [ ] **Step 1: Register module** — guard, repos, services, controller; export `BdsBuyerLeadService`

- [ ] **Step 2: Roadmap** — link plan P6; flag §4 thêm `PTT_BDS_BUYER`

- [ ] **Step 3: Full test suite**

Run: `./node_modules/.bin/jest src/bds --runInBand`

Expected: all pass (baseline + ~25 tests P6)

- [ ] **Step 4: Build**

Run: `npm run build`

Expected: exit 0

---

## 3. Definition of Done

- [ ] BDS-07: POST lead `re_buyer` + `b2b_project_id` → 400 `b2b_project_forbidden`
- [ ] BDS-08: cùng SĐT, hai `re_project_id` → hai lead
- [ ] BDS-17: agency không owner → GET lead 404
- [ ] BDS-18: webhook slug RE → lead `re_buyer` + `bds_tenant_id`
- [ ] UC-003: Deal Room snapshot → 404 trên `re_buyer`
- [ ] UC-031: SLA service applicable + tier 15p
- [ ] UC-032: POST visit tạo row + status `xem_nha`
- [ ] UC-033: GET matches trả căn `available`
- [ ] DDL apply ×2 idempotent
- [ ] `PTT_BDS_BUYER=0` → `/api/v1/bds/leads` 404; webhook không đổi B2B path

---

## 4. Rollback

`PTT_BDS_PACK=0` và/hoặc `PTT_BDS_BUYER=0`. Không DROP `bds_buyers` / `bds_site_visits` trên prod.

---

## 5. Sau P6 xanh

**P8** UI board `/crm/bds/leads` + ẩn Deal Room nav + BDS-19. **P11/P12** ticket `cskh_first_touch`, card `x_mkt_cskh`, `visit_book`. **P7** CAPI closed-loop. Hook TX stage → lead `dat_coc`/`vbtt`/`hdmb` (backlog).

---

*P6 không phải UI pack. Thắng: ingest RE webhook → re_buyer; không lẫn B2B; 15p SLA; Deal Room 404; matching + visit API.*
