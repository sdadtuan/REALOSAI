# PTT Ops DV — Milestone Ops-M0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) hoặc `superpowers:executing-plans` để thực thi từng task. Steps dùng checkbox (`- [ ]`) để tracking.

**Goal:** Triển khai **Ops Layer foundation** — catalog 21 DV + hub payload read-only + tab Ops Hub trên service-delivery — pilot slug `tiep-thi-noi-dung`, `seo-retainer`, ads, email trên staging.

**Architecture:** Module Nest `OpsModule` đọc `ops-dv01-dv21-route-map.json` + persist `ops_service_profile` PostgreSQL; slug resolver map `service_lifecycle.service_slug` → DV profile; ops-web render engine grid deep-link từ profile, không duplicate engine logic.

**Tech stack:** NestJS (`services/ptt-crm-api`), Next.js App Router (`services/ops-web`), PostgreSQL (DDL `ops_*`), env flags (`PTT_OPS_DV_*`), staff RBAC (`StaffCatalogViewGuard`), smoke bash.

**Spec canonical (3 file nguồn):**

| Doc | Path |
|-----|------|
| Design | [`docs/superpowers/specs/2026-08-10-ptt-ops-dv-os-design.md`](../specs/2026-08-10-ptt-ops-dv-os-design.md) |
| Integration | [`docs/specs/2026-08-10-ptt-ops-dv-integration-spec.md`](../../specs/2026-08-10-ptt-ops-dv-integration-spec.md) |
| Phase overview | [`2026-08-10-ptt-ops-dv-phase0-implementation.md`](./2026-08-10-ptt-ops-dv-phase0-implementation.md) |
| Route map | [`docs/specs/ops-dv01-dv21-route-map.json`](../../specs/ops-dv01-dv21-route-map.json) |
| DDL | [`docs/specs/2026-08-10-postgresql-ddl-ptt-ops-dv.sql`](../../specs/2026-08-10-postgresql-ddl-ptt-ops-dv.sql) |
| Status | [`docs/superpowers/specs/2026-08-10-ptt-ops-dv-implementation-status.md`](../specs/2026-08-10-ptt-ops-dv-implementation-status.md) |

## Global Constraints

- **BR-OPS-01:** Mỗi `dv_code` map đúng một `primary_slug`; alias chỉ legacy.
- **BR-OPS-04:** Hub deep-link chỉ enable khi `readiness ∈ {ready, partial}`; `gap` → doc link.
- **BR-OPS-05:** `package_tier` default `standard` khi không có trên lifecycle metadata.
- **BR-OPS-07:** Staff scope filter catalog theo `crm_staff_assign_scope.service_slug`.
- **API prefix:** `api/ops/*` — không đổi sau M0.
- **Env defaults:** `PTT_OPS_DV_ENABLED=0`, `PTT_OPS_WEEKLY_SPAWN=0`, `PTT_OPS_HUB_PILOT_DV=DV02,DV05,DV04,DV20`.
- **M0 scope:** Chỉ GET catalog + GET hub — **không** spawn-week, **không** KPI write (Ops-M1/M2).
- **Không duplicate** Content OS / SEO / Ads business logic trong Ops module.
- **Commit policy:** Chỉ commit khi user yêu cầu; mỗi WS xong chạy test + build trước merge.

---

## 0. Milestone overview

| WS | Tên | Owner | Exit |
|----|-----|-------|------|
| **WS-OPS-00** | DDL + flags + module scaffold | BE | Module boot, DDL tables exist |
| **WS-OPS-01** | Route map loader + slug resolver | BE | ≥8 unit tests PASS |
| **WS-OPS-02** | Profile repo + seed script | BE | 21 rows `ops_service_profile` |
| **WS-OPS-03** | GET `/api/ops/catalog` | BE | Catalog 200, 21 services |
| **WS-OPS-04** | GET `/api/ops/lifecycle/:id/hub` | BE | Hub 200 pilot lifecycles |
| **WS-OPS-05** | FE hub tab + components | FE | Tab render, engine links |
| **WS-OPS-06** | Smoke + staging + status doc | BE/QA | `smoke_ops_dv_hub.sh` PASS |

**Effort:** ~3 dev-days (1 BE + 0.5 FE).

**Done definition Ops-M0:**

- [ ] `GET /api/ops/catalog` → 21 DV
- [ ] `GET /api/ops/lifecycle/:id/hub` → engines + flags (weekly/kpi stub empty)
- [ ] Tab **Ops Hub** trên `/crm/service-delivery/:id?tab=ops-hub`
- [ ] Seed script idempotent
- [ ] ≥12 unit tests ops module
- [ ] `npm run build` ptt-crm-api + ops-web PASS
- [ ] Smoke staging (lifecycle `seo-retainer` tối thiểu)

---

## 1. Baseline tái sử dụng

| Artifact | Path | Dùng cho |
|----------|------|----------|
| Catalog PG bootstrap | `catalog/catalog-pg.repository.ts` | Pattern DDL inline bootstrap |
| Catalog guards | `catalog/guards/staff-catalog.guard.ts` | WS-OPS-03 auth |
| Service lifecycle | `service-lifecycle/` | WS-OPS-04 join lifecycle |
| Content OS flags | `config/app-config.service.ts` | Pattern env flags |
| FE tab pattern | `ops-web/.../service-delivery/[id]/page.tsx` | WS-OPS-05 tab |
| FE API client | `ops-web/src/lib/content-os-api.ts` | WS-OPS-05 `ops-dv-api.ts` |
| DDL apply script | `scripts/apply_pg_ddl_content_marketing.sh` | WS-OPS-00 template |
| Route map | `docs/specs/ops-dv01-dv21-route-map.json` | WS-OPS-01/02 source |

---

## 2. File map (M0 only)

```
services/ptt-crm-api/src/ops/
├── ops.module.ts
├── ops.controller.ts
├── ops.service.ts
├── ops.types.ts
├── ops.constants.ts
├── ops-route-map.loader.ts
├── ops-slug-resolver.util.ts
├── ops-slug-resolver.util.spec.ts
├── ops-profile-pg.repository.ts
├── ops-hub.builder.ts                    # build engines[] from profile + lifecycle
├── ops-hub.builder.spec.ts
├── guards/staff-ops-view.guard.ts

docs/specs/2026-08-10-postgresql-ddl-ptt-ops-dv.sql   # exists
scripts/apply_pg_ddl_ops_dv.sh
scripts/seed_ops_dv_catalog.ts
scripts/smoke_ops_dv_hub.sh

services/ops-web/src/
├── lib/ops-dv-api.ts
├── lib/ops-dv-flags.ts
├── components/ops/OpsServiceHubPanel.tsx
├── components/ops/OpsHubHeader.tsx
├── components/ops/OpsEngineGrid.tsx
```

**Modify:**

- `services/ptt-crm-api/src/app.module.ts` — import `OpsModule`
- `services/ptt-crm-api/src/config/app-config.service.ts` — `PTT_OPS_DV_*`
- `services/ops-web/src/app/crm/service-delivery/[id]/page.tsx` — tab `ops-hub`

**Out of scope M0:** `ops-weekly-spawn.service.ts`, `ops-kpi.service.ts`, `OpsWeeklyPanel`, `OpsKpiSummary`

---

## 3. Workstreams chi tiết

### WS-OPS-00 — DDL + flags + module scaffold

**Files:**

- Create: `scripts/apply_pg_ddl_ops_dv.sh`
- Create: `services/ptt-crm-api/src/ops/ops.module.ts`
- Create: `services/ptt-crm-api/src/ops/ops.controller.ts`
- Create: `services/ptt-crm-api/src/ops/ops.service.ts`
- Create: `services/ptt-crm-api/src/ops/ops.types.ts`
- Create: `services/ptt-crm-api/src/ops/ops.constants.ts`
- Create: `services/ptt-crm-api/src/ops/ops-profile-pg.repository.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts`

**Interfaces:**

- Produces: `OpsModule`, `OpsProfilePgRepository.bootstrapSchema()`, `AppConfigService.opsDvEnabled: boolean`

- [ ] **Step 1: Apply DDL script**

```bash
#!/usr/bin/env bash
# scripts/apply_pg_ddl_ops_dv.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-10-postgresql-ddl-ptt-ops-dv.sql"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK ops DV DDL applied"
```

Run: `chmod +x scripts/apply_pg_ddl_ops_dv.sh && ./scripts/apply_pg_ddl_ops_dv.sh`  
Expected: `OK ops DV DDL applied`

- [ ] **Step 2: Env flags in app-config**

Thêm vào `app-config.service.ts` (pattern giống `contentMarketingEnabled`):

```typescript
readonly opsDvEnabled: boolean;
readonly opsWeeklySpawnEnabled: boolean;
readonly opsHubPilotDv: Set<string>;
readonly opsRouteMapPath: string;

// constructor:
this.opsDvEnabled = truthy(process.env.PTT_OPS_DV_ENABLED ?? '0');
this.opsWeeklySpawnEnabled = truthy(process.env.PTT_OPS_WEEKLY_SPAWN ?? '0');
this.opsHubPilotDv = new Set(
  (process.env.PTT_OPS_HUB_PILOT_DV ?? 'DV02,DV05,DV04,DV20')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean),
);
this.opsRouteMapPath =
  process.env.PTT_OPS_ROUTE_MAP_PATH?.trim() ||
  path.join(process.cwd(), 'docs/specs/ops-dv01-dv21-route-map.json');
```

- [ ] **Step 3: Repository bootstrap**

`ops-profile-pg.repository.ts` — copy pattern `catalog-pg.repository.ts`:

```typescript
@Injectable()
export class OpsProfilePgRepository {
  constructor(private readonly db: PgService) {}

  async onModuleInit(): Promise<void> {
    await this.bootstrapSchema();
  }

  private async bootstrapSchema(): Promise<void> {
    // Paste CREATE TABLE ops_service_profile + indexes from DDL file
    // ALTER crm_catalog_services ADD dv_code IF NOT EXISTS
  }
}
```

- [ ] **Step 4: Module scaffold**

```typescript
// ops.module.ts
@Module({
  imports: [StaffAuthModule, forwardRef(() => ServiceLifecycleModule)],
  controllers: [OpsController],
  providers: [OpsService, OpsProfilePgRepository, StaffOpsViewGuard],
  exports: [OpsService],
})
export class OpsModule {}
```

```typescript
// ops.controller.ts — stub guarded by flag
@Controller('api/ops')
@UseGuards(StaffOrInternalKeyGuard, StaffOpsViewGuard)
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get('health')
  health() {
    return this.ops.health();
  }
}
```

- [ ] **Step 5: Register in app.module.ts**

```typescript
import { OpsModule } from './ops/ops.module';
// imports: [ ..., OpsModule ]
```

- [ ] **Step 6: Verify boot**

Run: `cd services/ptt-crm-api && npm run build`  
Expected: build PASS

- [ ] **Step 7: Commit** (chỉ khi user yêu cầu)

---

### WS-OPS-01 — Route map loader + slug resolver

**Files:**

- Create: `services/ptt-crm-api/src/ops/ops-route-map.loader.ts`
- Create: `services/ptt-crm-api/src/ops/ops-slug-resolver.util.ts`
- Create: `services/ptt-crm-api/src/ops/ops-slug-resolver.util.spec.ts`
- Modify: `services/ptt-crm-api/src/ops/ops.types.ts`

**Interfaces:**

- Consumes: route map JSON `services[].code`, `service_slugs.primary`, `service_slugs.alternates`
- Produces:
  - `loadOpsRouteMap(path: string): OpsRouteMap`
  - `resolveDvByLifecycleSlug(slug: string, map: OpsRouteMap): OpsDvEntry | null`
  - `buildSlugIndex(map: OpsRouteMap): Map<string, string>` — slug → dv_code

- [ ] **Step 1: Write failing tests**

```typescript
// ops-slug-resolver.util.spec.ts
import { buildSlugIndex, resolveDvByLifecycleSlug } from './ops-slug-resolver.util';
import routeMap from '../../../../docs/specs/ops-dv01-dv21-route-map.json';

describe('ops-slug-resolver', () => {
  const index = buildSlugIndex(routeMap as OpsRouteMap);

  it('resolves primary slug tiep-thi-noi-dung → DV02', () => {
    const dv = resolveDvByLifecycleSlug('tiep-thi-noi-dung', routeMap as OpsRouteMap);
    expect(dv?.code).toBe('DV02');
  });

  it('resolves alternate slug for DV01', () => {
    const dv = resolveDvByLifecycleSlug('tiep-thi-noi-dung', routeMap as OpsRouteMap);
    expect(dv?.code).toBe('DV02');
  });

  it('resolves quang-cao-facebook via primary', () => {
    const dv = resolveDvByLifecycleSlug('quang-cao-facebook', routeMap as OpsRouteMap);
    expect(dv?.code).toBeTruthy();
  });

  it('returns null for unknown slug', () => {
    expect(resolveDvByLifecycleSlug('unknown-slug', routeMap as OpsRouteMap)).toBeNull();
  });

  it('index has 21 dv codes', () => {
    const codes = new Set(routeMap.services.map((s) => s.code));
    expect(codes.size).toBe(21);
  });

  it('legacy seo-retainer maps via playbook alias', () => {
    // route map DV05 primary may differ — assert documented mapping
    const dv = resolveDvByLifecycleSlug('dich-vu-seo-tong-the', routeMap as OpsRouteMap);
    expect(dv?.code).toBe('DV05');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd services/ptt-crm-api && npm test -- --testPathPattern=ops-slug-resolver`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement resolver**

```typescript
// ops.types.ts
export type OpsReadiness = 'ready' | 'partial' | 'gap';

export type OpsRouteMapService = {
  code: string;
  name_vi: string;
  readiness: OpsReadiness;
  service_slugs: {
    primary: string;
    alternates?: string[];
    existing_in_valid_slugs?: boolean;
  };
  ops_web: {
    execution?: Array<{ route: string; purpose?: string }>;
    tabs?: string[];
  };
  gaps?: string[];
};

export type OpsRouteMap = {
  schema_version: string;
  services: OpsRouteMapService[];
};

// ops-slug-resolver.util.ts
export function buildSlugIndex(map: OpsRouteMap): Map<string, string> {
  const idx = new Map<string, string>();
  for (const svc of map.services) {
    idx.set(svc.service_slugs.primary, svc.code);
    for (const alt of svc.service_slugs.alternates ?? []) {
      if (!idx.has(alt)) idx.set(alt, svc.code);
    }
  }
  // Legacy aliases not in route map primary
  idx.set('seo-retainer', 'DV05');
  idx.set('meta-lead-gen', 'DV04');
  idx.set('bds-lead-gen', 'DV04');
  return idx;
}

export function resolveDvByLifecycleSlug(
  slug: string,
  map: OpsRouteMap,
): OpsRouteMapService | null {
  const normalized = String(slug ?? '').trim();
  if (!normalized) return null;
  const idx = buildSlugIndex(map);
  const code = idx.get(normalized);
  if (!code) return null;
  return map.services.find((s) => s.code === code) ?? null;
}
```

```typescript
// ops-route-map.loader.ts
export function loadOpsRouteMap(filePath: string): OpsRouteMap {
  const raw = fs.readFileSync(filePath, 'utf8');
  const map = JSON.parse(raw) as OpsRouteMap;
  if (!map.services || map.services.length !== 21) {
    throw new Error(`ops_route_map_invalid: expected 21 services, got ${map.services?.length}`);
  }
  return map;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- --testPathPattern=ops-slug-resolver`  
Expected: PASS (≥6 tests)

- [ ] **Step 5: Commit** (khi user yêu cầu)

---

### WS-OPS-02 — Profile repository + seed script

**Files:**

- Modify: `services/ptt-crm-api/src/ops/ops-profile-pg.repository.ts`
- Create: `scripts/seed_ops_dv_catalog.ts`

**Interfaces:**

- Produces:
  - `upsertProfileFromRouteEntry(entry: OpsRouteMapService): Promise<void>`
  - `listProfiles(): Promise<OpsServiceProfileRow[]>`
  - `getByDvCode(code: string): Promise<OpsServiceProfileRow | null>`

- [ ] **Step 1: Repository CRUD**

```typescript
export type OpsServiceProfileRow = {
  id: number;
  dv_code: string;
  service_slug: string;
  name: string;
  readiness: OpsReadiness;
  service_slugs_json: Record<string, unknown>;
  ops_web_json: Record<string, unknown>;
  nest_api_json: Record<string, unknown>;
  weekly_process_template: unknown[];
  kpi_definitions: unknown[];
  tier_pricing: Record<string, unknown>;
};

async upsertFromRouteEntry(entry: OpsRouteMapService, nestApi?: unknown): Promise<void> {
  await this.db.query(
    `INSERT INTO ops_service_profile
       (dv_code, service_slug, name, readiness, service_slugs_json, ops_web_json, nest_api_json, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (dv_code) DO UPDATE SET
       service_slug = EXCLUDED.service_slug,
       name = EXCLUDED.name,
       readiness = EXCLUDED.readiness,
       service_slugs_json = EXCLUDED.service_slugs_json,
       ops_web_json = EXCLUDED.ops_web_json,
       nest_api_json = EXCLUDED.nest_api_json,
       updated_at = NOW()`,
    [
      entry.code,
      entry.service_slugs.primary,
      entry.name_vi,
      entry.readiness,
      JSON.stringify(entry.service_slugs),
      JSON.stringify(entry.ops_web),
      JSON.stringify(nestApi ?? entry.nest_api ?? {}),
      Number(entry.code.replace('DV', '')),
    ],
  );
}
```

- [ ] **Step 2: Seed script**

```typescript
#!/usr/bin/env npx ts-node
// scripts/seed_ops_dv_catalog.ts
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { loadOpsRouteMap } from '../services/ptt-crm-api/src/ops/ops-route-map.loader';

const mapPath = path.join(__dirname, '../docs/specs/ops-dv01-dv21-route-map.json');
const map = loadOpsRouteMap(mapPath);

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  for (const entry of map.services) {
    await client.query(/* same upsert SQL as repository */, [...]);
    // Also upsert crm_catalog_services slug + dv_code
    await client.query(
      `INSERT INTO crm_catalog_services (slug, name, dv_code, sort_order, active)
       VALUES ($1,$2,$3,$4,TRUE)
       ON CONFLICT (slug) DO UPDATE SET dv_code = EXCLUDED.dv_code, name = EXCLUDED.name`,
      [entry.service_slugs.primary, entry.name_vi, entry.code, Number(entry.code.replace('DV',''))],
    );
  }
  console.log(`OK seeded ${map.services.length} ops profiles`);
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run: `DATABASE_URL=... npx ts-node scripts/seed_ops_dv_catalog.ts`  
Expected: `OK seeded 21 ops profiles`

- [ ] **Step 3: Verify row count**

Run: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM ops_service_profile"`  
Expected: `21`

- [ ] **Step 4: Commit** (khi user yêu cầu)

---

### WS-OPS-03 — GET `/api/ops/catalog`

**Files:**

- Modify: `services/ptt-crm-api/src/ops/ops.controller.ts`
- Modify: `services/ptt-crm-api/src/ops/ops.service.ts`
- Create: `services/ptt-crm-api/src/ops/guards/staff-ops-view.guard.ts`
- Create: `services/ptt-crm-api/src/ops/ops.service.spec.ts`

**Interfaces:**

- Consumes: `OpsProfilePgRepository.listProfiles()`, `AppConfigService.opsDvEnabled`
- Produces:
  - `GET /api/ops/catalog` → `{ schema_version, services: OpsCatalogItem[] }`
  - `GET /api/ops/catalog/:dvCode` → `{ profile }` | 404 `{ error: 'dv_not_found' }`

- [ ] **Step 1: Guard**

```typescript
@Injectable()
export class StaffOpsViewGuard implements CanActivate {
  // Same caps as StaffCatalogViewGuard: crm_leads view
}
```

- [ ] **Step 2: Service — gate by flag**

```typescript
assertEnabled(): void {
  if (!this.config.opsDvEnabled) {
    throw new ServiceUnavailableException({ error: 'ops_dv_disabled' });
  }
}

async getCatalog(): Promise<OpsCatalogResponse> {
  this.assertEnabled();
  const rows = await this.repo.listProfiles();
  return {
    schema_version: '1.0.0',
    services: rows.map((r) => ({
      dv_code: r.dv_code,
      name: r.name,
      service_slug: r.service_slug,
      readiness: r.readiness,
      package_tiers: ['basic', 'standard', 'premium'],
      ops_web: r.ops_web_json,
    })),
  };
}
```

- [ ] **Step 3: Controller routes**

```typescript
@Get('catalog')
getCatalog() {
  return this.ops.getCatalog();
}

@Get('catalog/:dvCode')
getCatalogByCode(@Param('dvCode') dvCode: string) {
  return this.ops.getCatalogByCode(dvCode.toUpperCase());
}
```

- [ ] **Step 4: Unit test disabled flag**

```typescript
it('throws ops_dv_disabled when flag off', async () => {
  config.opsDvEnabled = false;
  await expect(service.getCatalog()).rejects.toMatchObject({ response: { error: 'ops_dv_disabled' } });
});
```

- [ ] **Step 5: Manual curl**

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:3001/api/ops/catalog | jq '.services | length'
# Expected: 21
```

- [ ] **Step 6: Commit** (khi user yêu cầu)

---

### WS-OPS-04 — GET `/api/ops/lifecycle/:id/hub`

**Files:**

- Create: `services/ptt-crm-api/src/ops/ops-hub.builder.ts`
- Create: `services/ptt-crm-api/src/ops/ops-hub.builder.spec.ts`
- Modify: `services/ptt-crm-api/src/ops/ops.service.ts`
- Modify: `services/ptt-crm-api/src/ops/ops.controller.ts`

**Interfaces:**

- Consumes:
  - `ServiceLifecycleService.getDetail(id)` (hoặc repository tương đương)
  - `resolveDvByLifecycleSlug(slug, map)`
  - `OpsProfilePgRepository.getByDvCode(code)`
- Produces:
  - `buildOpsHubPayload(lifecycle, dv, profile, config): OpsHubPayload`
  - `GET /api/ops/lifecycle/:lifecycleId/hub`

- [ ] **Step 1: Hub builder test**

```typescript
describe('ops-hub.builder', () => {
  it('builds content-os engine link for DV02', () => {
    const payload = buildOpsHubPayload(
      { id: 42, service_slug: 'tiep-thi-noi-dung', status: 'active', metadata: {} },
      dv02Entry,
      profileRow,
      { opsDvEnabled: true, opsWeeklySpawnEnabled: false, opsHubPilotDv: new Set(['DV02']) },
    );
    expect(payload.dv.dv_code).toBe('DV02');
    expect(payload.engines.some((e) => e.id === 'content-os')).toBe(true);
    expect(payload.engines[0].href).toContain('lifecycleId=42');
  });

  it('marks gap readiness engines disabled', () => {
    const payload = buildOpsHubPayload(lifecycle, gapDv, profile, config);
    expect(payload.engines.every((e) => e.status === 'gap' || e.badge)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement builder**

```typescript
export function buildEngineHref(template: string, lifecycleId: number): string {
  return template
    .replace('{lifecycleId}', String(lifecycleId))
    .replace(':lifecycleId', String(lifecycleId));
}

export function buildOpsHubPayload(
  lifecycle: LifecycleSummary,
  dv: OpsRouteMapService,
  profile: OpsServiceProfileRow,
  flags: OpsHubFlags,
): OpsHubPayload {
  const tier =
    (lifecycle.metadata?.package_tier as string) ||
    (lifecycle.metadata?.packageTier as string) ||
    'standard';

  const engines = (profile.ops_web_json.execution ?? []).map((ex, i) => {
    const route = String(ex.route ?? '');
    const readiness = dv.readiness;
    const disabled = readiness === 'gap';
    return {
      id: `engine-${i}`,
      label: ex.purpose ?? route,
      href: buildEngineHref(route, lifecycle.id),
      status: disabled ? 'gap' : readiness,
      badge: disabled ? 'Manual' : null,
    };
  });

  return {
    lifecycle: {
      id: lifecycle.id,
      slug: lifecycle.service_slug,
      client_name: lifecycle.client_name ?? '',
      status: lifecycle.status,
      package_tier: tier,
    },
    dv: { dv_code: dv.code, name: dv.name_vi, readiness: dv.readiness },
    engines,
    weekly: { iso_week: currentIsoWeek(), spawned: false, tasks_pending: 0, tasks_done: 0 },
    kpi: { period_key: currentMonthKey(), metrics: [] },
    flags: {
      ops_dv_enabled: flags.opsDvEnabled,
      weekly_spawn_enabled: flags.opsWeeklySpawnEnabled,
      pilot_dv: flags.opsHubPilotDv.has(dv.code),
    },
  };
}
```

- [ ] **Step 3: Service method**

```typescript
async getHub(lifecycleId: number): Promise<OpsHubPayload> {
  this.assertEnabled();
  const lifecycle = await this.lifecycle.getDetail(lifecycleId);
  if (!lifecycle) throw new NotFoundException({ error: 'lifecycle_not_found' });

  const dv = resolveDvByLifecycleSlug(lifecycle.service_slug, this.routeMap);
  if (!dv) throw new UnprocessableEntityException({ error: 'unknown_service_slug', slug: lifecycle.service_slug });

  const profile = await this.repo.getByDvCode(dv.code);
  if (!profile) throw new NotFoundException({ error: 'profile_missing' });

  return buildOpsHubPayload(lifecycle, dv, profile, {
    opsDvEnabled: this.config.opsDvEnabled,
    opsWeeklySpawnEnabled: this.config.opsWeeklySpawnEnabled,
    opsHubPilotDv: this.config.opsHubPilotDv,
  });
}
```

- [ ] **Step 4: Controller**

```typescript
@Get('lifecycle/:lifecycleId/hub')
getHub(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
  return this.ops.getHub(lifecycleId);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- --testPathPattern=ops-hub`  
Expected: PASS

- [ ] **Step 6: Commit** (khi user yêu cầu)

---

### WS-OPS-05 — FE hub tab + components

**Files:**

- Create: `services/ops-web/src/lib/ops-dv-api.ts`
- Create: `services/ops-web/src/lib/ops-dv-flags.ts`
- Create: `services/ops-web/src/components/ops/OpsServiceHubPanel.tsx`
- Create: `services/ops-web/src/components/ops/OpsHubHeader.tsx`
- Create: `services/ops-web/src/components/ops/OpsEngineGrid.tsx`
- Modify: `services/ops-web/src/app/crm/service-delivery/[id]/page.tsx`

**Interfaces:**

- Consumes: `GET /api/ops/lifecycle/:id/hub`
- Produces: Tab `ops-hub`, components render engines

- [ ] **Step 1: FE flags**

```typescript
// ops-dv-flags.ts
export function isOpsDvFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_OPS_DV ?? '0').trim().toLowerCase(),
  );
}
```

- [ ] **Step 2: API client**

```typescript
// ops-dv-api.ts
export type OpsHubPayload = { /* mirror integration spec §3.3 */ };

export class OpsApiError extends ApiError {
  constructor(message: string, status: number, readonly code?: string) {
    super(message, status);
  }
}

export async function fetchOpsHub(token: string, lifecycleId: number): Promise<OpsHubPayload> {
  const res = await fetch(`${API_BASE}/api/ops/lifecycle/${lifecycleId}/hub`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await parseJson<OpsHubPayload & { error?: string }>(res);
  if (!res.ok) throw new OpsApiError(body.error ?? 'Ops hub failed', res.status, body.error);
  return body;
}
```

- [ ] **Step 3: OpsServiceHubPanel**

```tsx
export function OpsServiceHubPanel({ token, lifecycleId }: { token: string; lifecycleId: number }) {
  const [hub, setHub] = useState<OpsHubPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchOpsHub(token, lifecycleId)
      .then(setHub)
      .catch((e) => setError(e instanceof Error ? e.message : 'Tải hub thất bại'));
  }, [token, lifecycleId]);

  if (error) return <p className="error">{error}</p>;
  if (!hub) return <p className="muted">Đang tải Ops Hub…</p>;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <OpsHubHeader lifecycle={hub.lifecycle} dv={hub.dv} />
      <OpsEngineGrid engines={hub.engines} />
      {hub.dv.readiness === 'gap' ? (
        <p className="muted">Dịch vụ này chưa có engine tự động — dùng SOP thủ công.</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Wire tab in service-delivery page**

```typescript
// Extend detailTab union:
'workflow' | ... | 'ops-hub'

// useEffect tab parse:
tab === 'ops-hub'

// showOpsHubTab:
const showOpsHubTab = isOpsDvFeEnabled() && hasCap(user, 'crm_board', 'view');

// Button + panel:
{showOpsHubTab ? (
  <button ... onClick={() => switchTab('ops-hub')}>Ops Hub</button>
) : null}
{detailTab === 'ops-hub' && showOpsHubTab ? (
  <OpsServiceHubPanel token={token} lifecycleId={lifecycleId} />
) : null}
```

- [ ] **Step 5: Build FE**

Run: `cd services/ops-web && npm run build`  
Expected: PASS

- [ ] **Step 6: Commit** (khi user yêu cầu)

---

### WS-OPS-06 — Smoke + staging + status doc

**Files:**

- Create: `scripts/smoke_ops_dv_hub.sh`
- Create: `docs/specs/ops-staging-fixtures.md`
- Modify: `docs/superpowers/specs/2026-08-10-ptt-ops-dv-implementation-status.md`

- [ ] **Step 1: Smoke script**

```bash
#!/usr/bin/env bash
set -euo pipefail
CRM_API="${CRM_API:-http://127.0.0.1:3001}"
TOKEN="${STAFF_TOKEN:?STAFF_TOKEN required}"
LIFECYCLE_ID="${LIFECYCLE_ID:?LIFECYCLE_ID required}"

echo "==> GET /api/ops/catalog"
COUNT=$(curl -sf -H "Authorization: Bearer $TOKEN" "$CRM_API/api/ops/catalog" | jq '.services | length')
test "$COUNT" -eq 21

echo "==> GET /api/ops/lifecycle/$LIFECYCLE_ID/hub"
curl -sf -H "Authorization: Bearer $TOKEN" \
  "$CRM_API/api/ops/lifecycle/$LIFECYCLE_ID/hub" | jq -e '.dv.dv_code != null'

echo "OK smoke_ops_dv_hub"
```

- [ ] **Step 2: Staging fixtures doc**

Ghi `LIFECYCLE_ID` cho:

- `seo-retainer` hoặc `dich-vu-seo-tong-the` (existing)
- `tiep-thi-noi-dung` (cần tạo nếu chưa có)

- [ ] **Step 3: Staging deploy checklist**

```bash
PTT_OPS_DV_ENABLED=1
NEXT_PUBLIC_OPS_DV=1
./scripts/apply_pg_ddl_ops_dv.sh
DATABASE_URL=... npx ts-node scripts/seed_ops_dv_catalog.ts
sudo systemctl restart ptt-crm-api   # VPS
# ops-web restart
LIFECYCLE_ID=... STAFF_TOKEN=... CRM_API=https://rs.pttads.vn/api ./scripts/smoke_ops_dv_hub.sh
```

- [ ] **Step 4: Update implementation status**

Mark Ops-M0 items ✅ trong `2026-08-10-ptt-ops-dv-implementation-status.md`.

- [ ] **Step 5: Commit** (khi user yêu cầu)

---

## 4. Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| BR-OPS-01 slug mapping | WS-OPS-01 |
| BR-OPS-04 readiness gates | WS-OPS-04 builder |
| BR-OPS-05 package_tier default | WS-OPS-04 builder |
| GET `/api/ops/catalog` | WS-OPS-03 |
| GET `/api/ops/catalog/:dvCode` | WS-OPS-03 |
| GET `/api/ops/lifecycle/:id/hub` | WS-OPS-04 |
| Env flags §2 integration | WS-OPS-00 |
| FE hub route + components §5 | WS-OPS-05 |
| Seed §7 integration | WS-OPS-02 |
| Smoke §8 integration | WS-OPS-06 |
| DDL design §3 | WS-OPS-00 |
| Pilot P0 acceptance (hub link only) | WS-OPS-04/05/06 |

**Deferred to Ops-M1/M2:** spawn-week, KPI PUT, OpsWeeklyPanel, OpsKpiSummary, cron.

**Gap fixed in M0 staging:** Document + seed lifecycle `tiep-thi-noi-dung` in `ops-staging-fixtures.md`.

---

## 5. Risks & mitigations (M0)

| Risk | Mitigation |
|------|------------|
| Route map path wrong on VPS | Bundle JSON in `dist/` or env `PTT_OPS_ROUTE_MAP_PATH` |
| `unknown_service_slug` for legacy lifecycles | Legacy aliases in `buildSlugIndex` |
| Tab clutter | Gate `NEXT_PUBLIC_OPS_DV=0` default |
| 21 catalog slugs conflict VALID_SLUGS | M0 không bắt buộc extend VALID_SLUGS — chỉ seed catalog table |

---

**Plan saved.** Execution options:

1. **Subagent-Driven (recommended)** — dispatch subagent per WS, review giữa các WS  
2. **Inline Execution** — thực thi tuần tự trong session này với checkpoint sau WS-OPS-02 và WS-OPS-04

Bạn muốn bắt đầu implement Ops-M0 theo cách nào?
