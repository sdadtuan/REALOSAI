# Zero SQLite Wave 0 — Nest Hard-Ban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nest `ptt-crm-api` không mở `ptt.db` khi `PTT_SQLITE_DISABLED=1`; dual-module CRM + BĐS + payroll đi PostgreSQL; `/health` báo `sqlite: false` mà API vẫn `ok`.

**Architecture:** Thêm `assertSqliteAllowed()` gọi trước mọi `new DatabaseSync` production. `AppConfigService` đọc `PTT_SQLITE_DISABLED`, ép `leadsReadSource='pg'` và `crmPayrollPg=true`. Module dual-write giữ router flag hiện có — hard-ban chặn fallback, không xóa `*-sqlite.repository.ts`. Một straggler dual-module (`lifecycle-finance-confirm`) chưa có PG: thêm bảng + repo mỏng để handover→retain không 503.

**Tech Stack:** NestJS 10, Jest, `node:sqlite` (chỉ còn khi flag off), PostgreSQL `rnosaidb`, `psql` apply script.

**Spec:** [2026-08-23-zero-sqlite-full-stack-design.md](../specs/2026-08-23-zero-sqlite-full-stack-design.md) §4 Wave 0 + §5.

## Global Constraints

- Wave 0 **không** migrate 12 module sqlite-only (customers, cases, tickets, proposals, marketing-plans, crm-config, orders, invoices, sales, owner-weekly, deal-room, AI context). Route đó **503** `sqlite_disabled` cho đến Wave 1/2.
- Wave 0 **không** xóa `*-sqlite.repository.ts`, **không** đụng Flask, **không** xóa `ptt.db` trên VPS (chỉ backup + chứng minh API sống khi file vắng mặt nếu user đồng ý).
- Guard ném `ServiceUnavailableException` `{ error: 'sqlite_disabled', hint: '...' }` — không dùng `throw new Error(...)` kiểu BĐS.
- Test: `cd services/ptt-crm-api && ./node_modules/.bin/jest <file> --runInBand`
- Unit test **không** set `PTT_SQLITE_DISABLED=1` ở `jest.setup` global — chỉ trong file spec Wave 0, restore env trong `afterEach`.
- Không commit trừ khi user yêu cầu.
- Không hardcode password VPS; dùng `source /var/www/realosai/.env`.

---

## File map

```
services/ptt-crm-api/src/common/sqlite-guard.util.ts              CREATE
services/ptt-crm-api/src/common/sqlite-guard.util.spec.ts         CREATE
services/ptt-crm-api/src/config/app-config.service.ts             NÂNG sqliteDisabled + payroll/leads
services/ptt-crm-api/src/config/app-config.sqlite-disabled.spec.ts CREATE
services/ptt-crm-api/src/health/health.controller.ts              NÂNG sqlite + sqlite_disabled
services/ptt-crm-api/src/health/health.controller.spec.ts         CREATE
services/ptt-crm-api/src/**/*sqlite*.ts + inline DatabaseSync    NÂNG assertSqliteAllowed()
services/ptt-crm-api/src/service-lifecycle/lifecycle-finance-confirm-pg.repository.ts  CREATE
docs/specs/postgresql-ddl-zero-sqlite-w0.sql                     CREATE
scripts/apply_pg_ddl_zero_sqlite_w0.sh                           CREATE
docs/runbooks/zero-sqlite-wave-0-vps.md                          CREATE
docs/superpowers/specs/2026-08-23-zero-sqlite-full-stack-design.md  NÂNG status Wave 0 planned
```

---

## Phạm vi / ngoài phạm vi

| Trong Wave 0 | Ngoài (Wave 1–4) |
|--------------|------------------|
| Guard + config + health | PG repo customers/cases/tickets/… |
| Bật / ép `PTT_CRM_*_PG` + payroll | AI context repos → PG |
| Wire guard mọi chỗ mở SQLite | Xóa `*-sqlite.repository.ts` |
| `crm_lifecycle_finance_confirm` PG | Flask retired, e2e `PTT_SQLITE_PATH` |
| VPS flags + smoke dual-module | `rm ptt.db` bắt buộc |

### Route còn 503 sau Wave 0 (cố ý)

- SQLite-only: `/crm/customers`, `/crm/cases`, `/crm/tickets` (board cũ), proposals, marketing-plans, orders, invoices, sales, owner-weekly, crm-config
- AI intelligence context (deal-score / churn / forecast / nl-query / upsell / renewal) nếu chúng đọc SQLite
- `lifecycle-launch-qa` / `lifecycle-onboarding` chỗ còn gọi `this.sqlite` trực tiếp (Wave 2)

### Route phải sống trên VPS sau Wave 0

- `/health` → `ok: true`, `sqlite: false`, `postgres: true`
- Leads read/write PG, funnel, intake, contract, staff, finance, kpi, sop, service-lifecycle (trừ confirm đã migrate)
- Payroll (sau DDL + flag)
- BĐS re-projects P1–P5, hub (nhánh PG)

---

### Task 1: `assertSqliteAllowed()`

**Files:**
- Create: `services/ptt-crm-api/src/common/sqlite-guard.util.ts`
- Create: `services/ptt-crm-api/src/common/sqlite-guard.util.spec.ts`

**Interfaces:**
- Consumes: `process.env.PTT_SQLITE_DISABLED`
- Produces: `isSqliteDisabled(): boolean`, `assertSqliteAllowed(): void`, `SQLITE_DISABLED_ERROR = 'sqlite_disabled'`

- [ ] **Step 1: Write the failing test**

```typescript
import { ServiceUnavailableException } from '@nestjs/common';
import { assertSqliteAllowed, isSqliteDisabled, SQLITE_DISABLED_ERROR } from './sqlite-guard.util';

describe('sqlite-guard', () => {
  const KEY = 'PTT_SQLITE_DISABLED';
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env[KEY];
  });

  afterEach(() => {
    if (prev === undefined) delete process.env[KEY];
    else process.env[KEY] = prev;
  });

  it('isSqliteDisabled false by default', () => {
    delete process.env[KEY];
    expect(isSqliteDisabled()).toBe(false);
  });

  it('isSqliteDisabled true for 1/true/yes/on', () => {
    for (const v of ['1', 'true', 'YES', 'on']) {
      process.env[KEY] = v;
      expect(isSqliteDisabled()).toBe(true);
    }
  });

  it('assertSqliteAllowed is no-op when unset', () => {
    delete process.env[KEY];
    expect(() => assertSqliteAllowed()).not.toThrow();
  });

  it('assertSqliteAllowed throws 503 body when disabled', () => {
    process.env[KEY] = '1';
    try {
      assertSqliteAllowed();
      fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      const body = (err as ServiceUnavailableException).getResponse() as {
        error: string;
        hint: string;
      };
      expect(body.error).toBe(SQLITE_DISABLED_ERROR);
      expect(body.hint).toMatch(/PostgreSQL/i);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/common/sqlite-guard.util.spec.ts --runInBand`

Expected: FAIL — `Cannot find module './sqlite-guard.util'`

- [ ] **Step 3: Write minimal implementation**

```typescript
import { ServiceUnavailableException } from '@nestjs/common';

export const SQLITE_DISABLED_ERROR = 'sqlite_disabled';

export function isSqliteDisabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.PTT_SQLITE_DISABLED ?? '0').trim().toLowerCase(),
  );
}

export function assertSqliteAllowed(): void {
  if (!isSqliteDisabled()) return;
  throw new ServiceUnavailableException({
    error: SQLITE_DISABLED_ERROR,
    hint: 'OLTP uses PostgreSQL only. Set PTT_CRM_*_PG=1 or apply missing DDL.',
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/common/sqlite-guard.util.spec.ts --runInBand`

Expected: PASS

- [ ] **Step 5: Commit (chỉ khi user yêu cầu)**

```bash
git add services/ptt-crm-api/src/common/sqlite-guard.util.ts \
        services/ptt-crm-api/src/common/sqlite-guard.util.spec.ts
git commit -m "$(cat <<'EOF'
feat: add Nest SQLite hard-ban guard

EOF
)"
```

---

### Task 2: `AppConfigService` — flag + ép PG

**Files:**
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts`
- Create: `services/ptt-crm-api/src/config/app-config.sqlite-disabled.spec.ts`

**Interfaces:**
- Consumes: `isSqliteDisabled()` từ Task 1
- Produces: `readonly sqliteDisabled: boolean`; `sqliteAvailable()` luôn `false` khi disabled; `leadsReadSource` không bao giờ `'sqlite'` khi disabled; `crmPayrollPg === true` khi disabled dù `PTT_CRM_PAYROLL_PG=0`

- [ ] **Step 1: Write the failing test**

```typescript
import { AppConfigService } from './app-config.service';

describe('AppConfigService sqliteDisabled', () => {
  const keys = [
    'PTT_SQLITE_DISABLED',
    'PTT_CRM_PAYROLL_PG',
    'PTT_LEADS_READ_SOURCE',
  ] as const;
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of keys) prev[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it('sqliteDisabled false by default; payroll still default off', () => {
    delete process.env.PTT_SQLITE_DISABLED;
    delete process.env.PTT_CRM_PAYROLL_PG;
    const cfg = new AppConfigService();
    expect(cfg.sqliteDisabled).toBe(false);
    expect(cfg.crmPayrollPg).toBe(false);
  });

  it('disabled forces sqliteAvailable false even if path exists', () => {
    process.env.PTT_SQLITE_DISABLED = '1';
    const cfg = new AppConfigService();
    expect(cfg.sqliteDisabled).toBe(true);
    expect(cfg.sqliteAvailable()).toBe(false);
  });

  it('disabled forces leadsReadSource pg', () => {
    process.env.PTT_SQLITE_DISABLED = '1';
    process.env.PTT_LEADS_READ_SOURCE = 'sqlite';
    const cfg = new AppConfigService();
    expect(cfg.leadsReadSource).toBe('pg');
  });

  it('disabled forces crmPayrollPg true', () => {
    process.env.PTT_SQLITE_DISABLED = '1';
    process.env.PTT_CRM_PAYROLL_PG = '0';
    const cfg = new AppConfigService();
    expect(cfg.crmPayrollPg).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/config/app-config.sqlite-disabled.spec.ts --runInBand`

Expected: FAIL — `sqliteDisabled` undefined / payroll still false / leads still `'sqlite'`

- [ ] **Step 3: Write minimal implementation**

1. Import:

```typescript
import { isSqliteDisabled } from '../common/sqlite-guard.util';
```

2. Thêm field cạnh `sqlitePath` (khoảng dòng 29):

```typescript
readonly sqliteDisabled: boolean;
```

3. Trong `constructor()`, ngay sau `this.sqlitePath = this.resolveSqlitePath();`:

```typescript
this.sqliteDisabled = isSqliteDisabled();
```

4. Đổi `this.leadsReadSource = this.resolveLeadsReadSource();` — `resolveLeadsReadSource` phải tôn trọng hard-ban:

```typescript
private resolveLeadsReadSource(): LeadsReadSource {
  if (isSqliteDisabled()) return 'pg';
  const explicit = (process.env.PTT_LEADS_READ_SOURCE ?? '').trim().toLowerCase();
  if (explicit === 'sqlite' || explicit === 'pg') {
    return explicit;
  }
  return 'pg';
}
```

5. Đổi payroll (khoảng dòng 375–377):

```typescript
this.crmPayrollPg =
  isSqliteDisabled() ||
  ['1', 'true', 'yes', 'on'].includes(
    (process.env.PTT_CRM_PAYROLL_PG ?? '0').trim().toLowerCase(),
  );
```

6. Đổi `sqliteAvailable()`:

```typescript
sqliteAvailable(): boolean {
  if (this.sqliteDisabled) return false;
  try {
    return fs.existsSync(this.sqlitePath);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/config/app-config.sqlite-disabled.spec.ts --runInBand`

Expected: PASS

- [ ] **Step 5: Commit (chỉ khi user yêu cầu)**

```bash
git add services/ptt-crm-api/src/config/app-config.service.ts \
        services/ptt-crm-api/src/config/app-config.sqlite-disabled.spec.ts
git commit -m "$(cat <<'EOF'
feat: honor PTT_SQLITE_DISABLED in app config

EOF
)"
```

---

### Task 3: `/health` — sqlite false không fail

**Files:**
- Modify: `services/ptt-crm-api/src/health/health.controller.ts`
- Create: `services/ptt-crm-api/src/health/health.controller.spec.ts`

**Interfaces:**
- Consumes: `AppConfigService.sqliteDisabled`, `sqliteAvailable()`, `databaseUrl`
- Produces: JSON thêm `sqlite_disabled: boolean`; `ok` vẫn `true` khi `sqlite === false`

- [ ] **Step 1: Write the failing test**

```typescript
import { HealthController } from './health.controller';
import type { AppConfigService } from '../config/app-config.service';
import type { PolicyService } from '../policy/policy.service';

describe('HealthController sqliteDisabled', () => {
  it('ok true when sqlite disabled and file missing', () => {
    const config = {
      leadsReadSource: 'pg',
      leadsWriteEnabled: true,
      leadsCreateIdMode: 'prod',
      portalStubUsers: [],
      staffAuthMode: 'nest',
      staffSsoConfigured: () => false,
      staffPolicyOpaEnabled: false,
      sqliteAvailable: () => false,
      sqliteDisabled: true,
      databaseUrl: 'postgresql://x',
    } as unknown as AppConfigService;
    const policy = { loadManifestVersion: () => null } as unknown as PolicyService;
    const body = new HealthController(config, policy).getHealth();
    expect(body.ok).toBe(true);
    expect(body.sqlite).toBe(false);
    expect(body.sqlite_disabled).toBe(true);
    expect(body.postgres).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/health/health.controller.spec.ts --runInBand`

Expected: FAIL — `sqlite_disabled` undefined

- [ ] **Step 3: Write minimal implementation**

Trong `getHealth()` return type và object, thêm:

```typescript
sqlite_disabled: boolean;
```

```typescript
sqlite: this.config.sqliteAvailable(),
sqlite_disabled: this.config.sqliteDisabled,
postgres: Boolean(this.config.databaseUrl),
```

`ok` **không** phụ thuộc `sqlite`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/health/health.controller.spec.ts --runInBand`

Expected: PASS

- [ ] **Step 5: Commit (chỉ khi user yêu cầu)**

```bash
git add services/ptt-crm-api/src/health/health.controller.ts \
        services/ptt-crm-api/src/health/health.controller.spec.ts
git commit -m "$(cat <<'EOF'
feat: expose sqlite_disabled on /health

EOF
)"
```

---

### Task 4: Wire guard vào mọi chỗ mở SQLite production

**Files (mỗi file: `assertSqliteAllowed()` là dòng đầu tiên trước `new DatabaseSync`):**

Getter `private get database()` / `sqliteDb()`:

- `src/re-projects/re-projects-sqlite.repository.ts` — gọi **trước** `isReProjectsPgPrimary()` throw (hoặc thay throw cũ bằng `assertSqliteAllowed()` rồi giữ throw BĐS nếu muốn message cũ; **ưu tiên** `assertSqliteAllowed()` thống nhất)
- `src/re-projects/re-projects-accounting.repository.ts`
- `src/marketing-plans/marketing-plans-sqlite.repository.ts`
- `src/service-lifecycle/service-lifecycle-sqlite.repository.ts`
- `src/service-lifecycle/lifecycle-finance-confirm.repository.ts`
- `src/service-lifecycle/lifecycle-tasks.repository.ts`
- `src/proposals/proposals-sqlite.repository.ts`
- `src/leads-funnel/leads-funnel-sqlite.repository.ts`
- `src/payroll/payroll-sqlite.repository.ts`
- `src/leads/sqlite-leads.repository.ts` — trong `openDb()`
- `src/crm-config/crm-config-sqlite.repository.ts`
- `src/kpi/kpi-sqlite.repository.ts`
- `src/intake/intake-sqlite.repository.ts`
- `src/crm-leads-legacy/crm-leads-sqlite.repository.ts`
- `src/leads-contract/leads-contract-sqlite.repository.ts`
- `src/svc-finance/svc-finance-sqlite.repository.ts`
- `src/orders/orders-sqlite.repository.ts`
- `src/invoices/invoices-sqlite.repository.ts`
- `src/tickets/tickets-sqlite.repository.ts`
- `src/customers/customers-sqlite.repository.ts`
- `src/finance/finance-sqlite.repository.ts`
- `src/sales/sales-sqlite.repository.ts`
- `src/sop/sop-sqlite.repository.ts`
- `src/catalog/catalog-sqlite.repository.ts`
- `src/owner-weekly/owner-weekly-sqlite.repository.ts`
- `src/crm-staff/crm-staff-sqlite.repository.ts`
- `src/cases/cases-sqlite.repository.ts`
- `src/bds/buyers/bds-buyer-lead.repository.ts`

Inline `new DatabaseSync(this.config.sqlitePath)`:

- `src/bds/buyers/bds-buyer-ingest.service.ts`
- `src/bds/reports/bds-hub.repository.ts`
- `src/leads/lead-sla-care.service.ts` (`sqliteDb`)
- `src/leads/lead-status-gate.service.ts` (`sqliteDb`)
- `src/ai-intelligence/ai-forecast.service.ts`
- `src/ai-intelligence/deal-score-context.repository.ts`
- `src/ai-intelligence/nl-query-context.repository.ts`
- `src/ai-intelligence/upsell-context.repository.ts`
- `src/ai-intelligence/renewal-contract-context.repository.ts`
- `src/ai-intelligence/churn-health-context.repository.ts`
- `src/seo-admin/seo-admin.repository.ts` — trước `new DatabaseSync` trong `sqliteDb`

**Không** thêm guard vào spec dùng `:memory:` (`billing-schema.spec.ts`, `business-dashboard.util.spec.ts`).

**Interfaces:**
- Consumes: `assertSqliteAllowed()` từ Task 1
- Produces: mọi production open ném 503 khi `PTT_SQLITE_DISABLED=1`

- [ ] **Step 1: Write the failing test** (một đại diện sqlite-only + một dual-module)

Tạo `services/ptt-crm-api/src/common/sqlite-guard.wire.spec.ts`:

```typescript
import { ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { CustomersSqliteRepository } from '../customers/customers-sqlite.repository';
import { PayrollSqliteRepository } from '../payroll/payroll-sqlite.repository';

describe('sqlite guard wire', () => {
  const KEY = 'PTT_SQLITE_DISABLED';
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env[KEY];
    process.env[KEY] = '1';
  });

  afterEach(() => {
    if (prev === undefined) delete process.env[KEY];
    else process.env[KEY] = prev;
  });

  it('customers sqlite repo throws 503', () => {
    const repo = new CustomersSqliteRepository(new AppConfigService());
    expect(() => repo.listCustomers()).toThrow(ServiceUnavailableException);
  });

  it('payroll sqlite repo throws 503', () => {
    const repo = new PayrollSqliteRepository(new AppConfigService());
    expect(() => repo.getPolicy()).toThrow(ServiceUnavailableException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/common/sqlite-guard.wire.spec.ts --runInBand`

Expected: FAIL — repo mở file hoặc lỗi fs, không phải `ServiceUnavailableException`

- [ ] **Step 3: Wire guard**

Mỗi file:

```typescript
import { assertSqliteAllowed } from '../common/sqlite-guard.util';
// path depth: bds/* dùng '../../common/sqlite-guard.util'
```

```typescript
private get database(): DatabaseSync {
  assertSqliteAllowed();
  if (!this.db) {
    this.db = new DatabaseSync(this.config.sqlitePath);
    // ... existing
  }
  return this.db;
}
```

Inline:

```typescript
assertSqliteAllowed();
const sqlite = new DatabaseSync(this.config.sqlitePath);
```

`re-projects-sqlite.repository.ts` — thay khối throw BĐS bằng:

```typescript
private get database(): DatabaseSync {
  assertSqliteAllowed();
  if (isReProjectsPgPrimary()) {
    throw new ServiceUnavailableException({
      error: 'sqlite_disabled',
      hint: 'SQLite OLTP đã tắt — pack BĐS dùng PostgreSQL.',
    });
  }
  // existing open
}
```

Import `ServiceUnavailableException` nếu file chưa có. Khi `PTT_SQLITE_DISABLED=1` dòng đầu đã throw — nhánh BĐS chỉ còn khi flag off nhưng `PTT_BDS_PG=1`.

- [ ] **Step 4: Chứng minh coverage**

Run:

```bash
rg -n "new DatabaseSync" services/ptt-crm-api/src --glob '!*.spec.ts'
```

Mỗi hit production phải có `assertSqliteAllowed()` trong cùng function (cách ≤ 8 dòng). Sửa sót nếu còn.

- [ ] **Step 5: Run tests**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/common/sqlite-guard.util.spec.ts \
  src/common/sqlite-guard.wire.spec.ts \
  src/config/app-config.sqlite-disabled.spec.ts \
  src/health/health.controller.spec.ts \
  --runInBand
```

Expected: PASS

- [ ] **Step 6: Commit (chỉ khi user yêu cầu)**

```bash
git add services/ptt-crm-api/src
git commit -m "$(cat <<'EOF'
feat: block all Nest SQLite opens when disabled

EOF
)"
```

---

### Task 5: Straggler — `lifecycle_finance_confirm` → PG

**Vì sao Wave 0:** `service-lifecycle.service.ts` đã `usePg` cho advance stage nhưng `financeConfirmRepo.insertConfirm` **luôn SQLite**. Hard-ban làm `handover → retain` + `finance_confirm` 503 dù lifecycle PG-primary.

**Files:**
- Create: `docs/specs/postgresql-ddl-zero-sqlite-w0.sql`
- Create: `scripts/apply_pg_ddl_zero_sqlite_w0.sh`
- Create: `services/ptt-crm-api/src/service-lifecycle/lifecycle-finance-confirm-pg.repository.ts`
- Create: `services/ptt-crm-api/src/service-lifecycle/lifecycle-finance-confirm-pg.repository.spec.ts`
- Modify: `services/ptt-crm-api/src/service-lifecycle/service-lifecycle.module.ts`
- Modify: `services/ptt-crm-api/src/service-lifecycle/service-lifecycle.service.ts` (~dòng 176–189, 281)

**Interfaces:**
- Consumes: `LifecycleFinanceConfirmRow`, `insertConfirm` input hiện có
- Produces: `LifecycleFinanceConfirmPgRepository.insertConfirm(...)` / `listForLifecycle(...)` async; service gọi PG khi `config.crmServiceLifecyclePg || config.sqliteDisabled`

- [ ] **Step 1: Write the failing test** (map + SQL shape, không cần PG sống)

```typescript
import { mapLifecycleFinanceConfirmRow } from './lifecycle-finance-confirm-pg.repository';

describe('lifecycle finance confirm pg mapper', () => {
  it('maps pg row', () => {
    const row = mapLifecycleFinanceConfirmRow({
      id: '3',
      lifecycle_id: '9',
      staff_id: null,
      staff_email: 'a@b.c',
      outstanding_vnd: '1000',
      ar_pending_vnd: '0',
      ar_overdue_vnd: '0',
      strict_mode: true,
      note: null,
      created_at: '2026-08-23T00:00:00.000Z',
    });
    expect(row.id).toBe(3);
    expect(row.lifecycle_id).toBe(9);
    expect(row.staff_id).toBeNull();
    expect(row.strict_mode).toBe(true);
    expect(row.outstanding_vnd).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/service-lifecycle/lifecycle-finance-confirm-pg.repository.spec.ts --runInBand`

Expected: FAIL — module / export missing

- [ ] **Step 3: DDL + apply script**

`docs/specs/postgresql-ddl-zero-sqlite-w0.sql`:

```sql
-- Zero SQLite Wave 0 — dual-module straggler
BEGIN;

CREATE TABLE IF NOT EXISTS crm_lifecycle_finance_confirm (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    lifecycle_id    INTEGER NOT NULL,
    staff_id        INTEGER,
    staff_email     TEXT NOT NULL DEFAULT '',
    outstanding_vnd BIGINT NOT NULL DEFAULT 0,
    ar_pending_vnd  BIGINT NOT NULL DEFAULT 0,
    ar_overdue_vnd  BIGINT NOT NULL DEFAULT 0,
    strict_mode     BOOLEAN NOT NULL DEFAULT FALSE,
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_lifecycle_finance_confirm_lc
    ON crm_lifecycle_finance_confirm (lifecycle_id, created_at DESC);

COMMIT;
```

`scripts/apply_pg_ddl_zero_sqlite_w0.sh` — copy pattern `scripts/apply_pg_ddl_wave_b6_finance.sh` (`source .env`, `psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"`). Echo: `OK  Zero SQLite W0 DDL (crm_lifecycle_finance_confirm)`.

- [ ] **Step 4: PG repository**

Export `mapLifecycleFinanceConfirmRow` + class `LifecycleFinanceConfirmPgRepository` (`Pool` từ `this.config.databaseUrl`), methods:

```typescript
async insertConfirm(input: {
  lifecycleId: number;
  staffId?: number | null;
  staffEmail: string;
  outstandingVnd: number;
  arPendingVnd: number;
  arOverdueVnd: number;
  strictMode: boolean;
  note?: string | null;
}): Promise<LifecycleFinanceConfirmRow>

async listForLifecycle(lifecycleId: number, limit = 20): Promise<LifecycleFinanceConfirmRow[]>
```

SQL:

```sql
INSERT INTO crm_lifecycle_finance_confirm
  (lifecycle_id, staff_id, staff_email, outstanding_vnd, ar_pending_vnd, ar_overdue_vnd, strict_mode, note)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *
```

```sql
SELECT * FROM crm_lifecycle_finance_confirm
WHERE lifecycle_id = $1
ORDER BY created_at DESC, id DESC
LIMIT $2
```

Mapper copy semantics `lifecycle-finance-confirm.repository.ts` `mapRow`.

- [ ] **Step 5: Wire service**

`service-lifecycle.module.ts`: thêm provider `LifecycleFinanceConfirmPgRepository`.

`service-lifecycle.service.ts`:

```typescript
private get useFinanceConfirmPg(): boolean {
  return this.config.crmServiceLifecyclePg || this.config.sqliteDisabled;
}
```

Chỗ `insertConfirm` (khoảng 176): `await` nếu PG.

Chỗ `listForLifecycle` (khoảng 281): `return { rows: await this.financeConfirmPg.listForLifecycle(id) }` khi PG.

Giữ sqlite repo khi cả hai flag off (local/dev).

- [ ] **Step 6: Run tests**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/service-lifecycle/lifecycle-finance-confirm-pg.repository.spec.ts \
  src/service-lifecycle/lifecycle-payment-gate.util.spec.ts \
  --runInBand
```

Expected: PASS

- [ ] **Step 7: Commit (chỉ khi user yêu cầu)**

```bash
git add docs/specs/postgresql-ddl-zero-sqlite-w0.sql \
        scripts/apply_pg_ddl_zero_sqlite_w0.sh \
        services/ptt-crm-api/src/service-lifecycle
git commit -m "$(cat <<'EOF'
feat: store lifecycle finance confirm on PostgreSQL

EOF
)"
```

---

### Task 6: Payroll PG sẵn sàng (không đổi engine)

**Files:**
- Verify only: `docs/specs/2026-08-07-postgresql-ddl-payroll.sql`
- Verify only: `scripts/apply_pg_ddl_payroll_r2_hr.sh`
- Modify: `docs/runbooks/zero-sqlite-wave-0-vps.md` (tạo ở Task 7; Task 6 chỉ ghi checklist payroll)

`PayrollService` đã `return this.config.crmPayrollPg ? this.pg : this.sqlite`. Task 2 ép `crmPayrollPg` khi hard-ban. Việc còn lại: **DDL phải có trên VPS** trước khi bật flag.

- [ ] **Step 1: Local smoke script exists**

Run: `test -f docs/specs/2026-08-07-postgresql-ddl-payroll.sql && test -f scripts/apply_pg_ddl_payroll_r2_hr.sh && echo OK`

Expected: `OK`

- [ ] **Step 2: Document VPS apply (chưa SSH nếu chưa được phép deploy)**

Trong runbook Task 7, mục Payroll:

```bash
ssh deploy@real.gomira.vn 'bash -s' <<'EOF'
set -euo pipefail
cd /var/www/realosai
set -a && source .env && set +a
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "SELECT to_regclass('public.crm_payroll_policy') AS payroll_policy;"
EOF
```

Nếu `payroll_policy` null → `./scripts/apply_pg_ddl_payroll_r2_hr.sh` trên VPS (script default port 5433 — **bắt buộc** `source .env` trước, giống P2 DDL).

- [ ] **Step 3: Không đổi default `PTT_CRM_PAYROLL_PG` trong CI** (vẫn `0`) trừ khi `PTT_SQLITE_DISABLED=1`. Local jest payroll sqlite vẫn chạy.

---

### Task 7: Runbook VPS + cập nhật spec

**Files:**
- Create: `docs/runbooks/zero-sqlite-wave-0-vps.md`
- Modify: `docs/superpowers/specs/2026-08-23-zero-sqlite-full-stack-design.md` — Status: `Wave 0 plan ready`

- [ ] **Step 1: Write runbook** với nội dung khóa sau (copy nguyên):

```markdown
# Zero SQLite Wave 0 — VPS

## Flags bắt buộc (append nếu thiếu, không xóa flag khác)

PTT_SQLITE_DISABLED=1
PTT_LEADS_READ_SOURCE=pg
PTT_LEADS_WRITE_ENABLED=1
PTT_CRM_LEADS_FUNNEL_PG=1
PTT_CRM_INTAKE_PG=1
PTT_CRM_CONTRACT_PG=1
PTT_CRM_STAFF_PG=1
PTT_CRM_PAYROLL_PG=1
PTT_CRM_KPI_PG=1
PTT_CRM_LEADS_LEGACY_PG=1
PTT_CRM_SERVICE_LIFECYCLE_PG=1
PTT_CRM_FINANCE_PG=1
PTT_CRM_SVC_FINANCE_PG=1
PTT_CRM_SOP_PG=1
PTT_BDS_PACK=1
PTT_BDS_PG=1

## DDL

./scripts/apply_pg_ddl_zero_sqlite_w0.sh
# payroll nếu to_regclass null:
./scripts/apply_pg_ddl_payroll_r2_hr.sh   # sau source .env

## Deploy code

rsync services/ptt-crm-api/dist/ → /var/www/realosai/services/ptt-crm-api/dist/
sudo systemctl restart realosai-api

## Smoke

curl -sS http://127.0.0.1:3010/health
# ok true, sqlite false, sqlite_disabled true, postgres true, leads_read_source pg

## Rollback

PTT_SQLITE_DISABLED=0
# giữ ptt.db backup; restart api
```

- [ ] **Step 2: Spec header** đổi `Status: Draft — awaiting review` → `Status: Wave 0 plan ready — [2026-08-23-zero-sqlite-wave-0.md](../plans/2026-08-23-zero-sqlite-wave-0.md)`

- [ ] **Step 3: Commit (chỉ khi user yêu cầu)**

```bash
git add docs/runbooks/zero-sqlite-wave-0-vps.md \
        docs/superpowers/specs/2026-08-23-zero-sqlite-full-stack-design.md
git commit -m "$(cat <<'EOF'
docs: Wave 0 zero-SQLite VPS runbook

EOF
)"
```

---

### Task 8: Verify local + VPS

**Files:** none (commands)

- [ ] **Step 1: Typecheck / unit**

```bash
cd services/ptt-crm-api && npm run build
./node_modules/.bin/jest \
  src/common/sqlite-guard.util.spec.ts \
  src/common/sqlite-guard.wire.spec.ts \
  src/config/app-config.sqlite-disabled.spec.ts \
  src/health/health.controller.spec.ts \
  src/service-lifecycle/lifecycle-finance-confirm-pg.repository.spec.ts \
  --runInBand
```

Expected: build 0, jest PASS

- [ ] **Step 2: Local grep gate**

```bash
rg -n "new DatabaseSync" services/ptt-crm-api/src --glob '!*.spec.ts'
```

Mọi hit production có `assertSqliteAllowed` trong cùng function.

- [ ] **Step 3: Deploy VPS (chỉ khi user yêu cầu deploy)**

Thứ tự: apply W0 DDL → apply payroll nếu thiếu → rsync `dist/` → append flags → `systemctl restart realosai-api` → `curl /health` → smoke:

| Check | Expect |
|-------|--------|
| `GET /health` | `ok`, `sqlite_disabled: true` |
| Leads list (ops-web / API PG) | 200 |
| BĐS project list | 200 |
| Accounting cash flow 1 project | 200 |
| Payroll dashboard | 200 (sau DDL) |
| `GET` customers (sqlite-only) | 503 `sqlite_disabled` |

- [ ] **Step 4: Optional proof không cần file** (hỏi user trước)

```bash
# backup rồi rename, KHÔNG rm
sudo cp -a /var/www/realosai/ptt.db /var/www/realosai/backups/ptt.db.w0-$(date +%Y%m%d)
# restart; /health vẫn ok
```

---

## Thứ tự thực thi

```
Task 1 guard → Task 2 config → Task 3 health → Task 4 wire
     → Task 5 finance-confirm PG → Task 6 payroll checklist
     → Task 7 runbook → Task 8 verify/deploy
```

Task 5 song song được với Task 4 sau khi Task 1 xong (confirm repo cũng cần guard ở sqlite path).

## Rollback

1. `PTT_SQLITE_DISABLED=0` trên VPS `.env`
2. `systemctl restart realosai-api`
3. Dual-module: từng `PTT_CRM_*_PG=0` chỉ khi sqlite repo còn và `ptt.db` còn
4. Không rollback DDL W0 (`CREATE TABLE IF NOT EXISTS` an toàn)

## Self-review vs spec Wave 0

| Spec item | Task |
|-----------|------|
| `PTT_SQLITE_DISABLED` in app-config | 2 |
| `assertSqliteAllowed()` + wire getters | 1, 4 |
| VPS flag matrix | 7, 8 |
| Guard throws trước fallback | 4 |
| Health `sqlite: false` không fail | 3 |
| Smoke BĐS + CRM PG | 8 |
| Payroll default off / VPS on | 2, 6 |
| Straggler lifecycle-finance-confirm | 5 |
| Flask / scripts / xóa sqlite files | **không** (Wave 3–4) |
