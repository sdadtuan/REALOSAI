# Admin Control Plane P0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sidebar ops-web có section **Quản trị hệ thống** với link admin đầy đủ; gỡ admin khỏi AI & Automation; đồng bộ HR Hub + module subnav — IT tìm `/admin/crm/org/users` ≤30 giây không gõ URL.

**Architecture:** Tạo `lib/admin/admin-nav.ts` làm SSoT link admin (precursor P1 hub). `OpsNav` import `buildAdminSidebarLinks` + `canViewAdminSection`. `buildCrmConfigModuleLinks` delegate subset RBAC+dữ liệu. HR Hub bỏ badge planned cho routes đã ship. Không tạo `/admin` hub trong P0.

**Tech Stack:** Next.js 14 App Router · TypeScript · Vitest · Playwright · existing `hasCap` / WIN flags

**Spec:** [`docs/specs/2026-08-11-admin-control-plane-ia.md`](../specs/2026-08-11-admin-control-plane-ia.md) §12 P0

## Global Constraints

- Vietnamese-first labels; code paths secondary.
- Cap-gated: ẩn link hoàn toàn khi thiếu cap (fail-closed), không grey disabled.
- `NEXT_PUBLIC_WIN_ORG_UI=1` required for org links in nav (match `winOrgUiEnabled()`).
- Optional links gated by `winPermissionSetsEnabled`, `winSsoEnabled`, `winSimulatorEnabled`, `winFieldAbacEnabled`.
- Do **not** add `/admin` hub page in P0.
- Do **not** remove `admin/crm/layout.tsx` subnav (P1 merges it).
- Minimize diff: reuse existing route paths; no backend changes.

---

## File map (P0)

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/admin/admin-nav.ts` | **Create** | SSoT: caps check + admin link list |
| `src/lib/admin/admin-nav.spec.ts` | **Create** | Unit tests caps + flags |
| `src/lib/admin/module-nav.ts` | Modify | Delegate `buildCrmConfigModuleLinks` |
| `src/components/OpsNav.tsx` | Modify | New section; remove old config + AI admin links |
| `src/lib/crm/hr-hub.ts` | Modify | Live links for functions + org users |
| `src/lib/crm/hr-hub.spec.ts` | **Create** | Unit tests hub cards |
| `src/components/layout/nav-icons.tsx` | Modify | Section label + icon |
| `docs/huong-dan-su-dung/01-nen-tang-platform.md` | Modify | Sidebar entry docs |
| `e2e/admin-control-plane-p0-nav.spec.ts` | **Create** | Smoke: sidebar → org users |

---

### Task 1: Admin nav SSoT (`admin-nav.ts`)

**Files:**
- Create: `services/ops-web/src/lib/admin/admin-nav.ts`

**Interfaces:**
- Produces:
  - `canViewAdminSection(user: StoredStaffUser | null): boolean`
  - `buildAdminSidebarLinks(user: StoredStaffUser | null): ModuleNavLink[]`
  - `buildCrmConfigModuleLinksFromAdminNav(user): ModuleNavLink[]` — subset for AdminPageShell

- [ ] **Step 1: Write the failing test**

Create `services/ops-web/src/lib/admin/admin-nav.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  buildAdminSidebarLinks,
  canViewAdminSection,
} from './admin-nav';
import type { StoredStaffUser } from '@/lib/auth';

const adminUser: StoredStaffUser = {
  id: 'u1',
  email: 'admin@pttads.vn',
  display_name: 'Admin',
  caps: ['crm_data_config.view', 'crm_staff_roster.view', 'ai_admin.view'],
  position_code: 'super-admin',
  job_functions: [],
};

describe('admin-nav', () => {
  it('canViewAdminSection true when any admin cap', () => {
    expect(canViewAdminSection(adminUser)).toBe(true);
    expect(canViewAdminSection(null)).toBe(false);
  });

  it('includes org users link when roster view + WIN_ORG_UI', () => {
    const prev = process.env.NEXT_PUBLIC_WIN_ORG_UI;
    process.env.NEXT_PUBLIC_WIN_ORG_UI = '1';
    const links = buildAdminSidebarLinks(adminUser);
    expect(links.some((l) => l.href === '/admin/crm/org/users')).toBe(true);
    process.env.NEXT_PUBLIC_WIN_ORG_UI = prev;
  });

  it('includes permissions when crm_data_config.view', () => {
    const links = buildAdminSidebarLinks(adminUser);
    expect(links.some((l) => l.href === '/admin/crm/permissions')).toBe(true);
  });

  it('includes AI links when ai_admin.view', () => {
    const links = buildAdminSidebarLinks(adminUser);
    expect(links.some((l) => l.href === '/admin/ai/agents')).toBe(true);
  });

  it('empty for user without admin caps', () => {
    const user: StoredStaffUser = {
      ...adminUser,
      caps: ['crm_leads.view'],
    };
    expect(canViewAdminSection(user)).toBe(false);
    expect(buildAdminSidebarLinks(user)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && npm run test:unit -- src/lib/admin/admin-nav.spec.ts`

Expected: FAIL — module `./admin-nav` not found

- [ ] **Step 3: Implement `admin-nav.ts`**

Create `services/ops-web/src/lib/admin/admin-nav.ts`:

```typescript
import { hasCap, type StoredStaffUser } from '@/lib/auth';
import {
  winFieldAbacEnabled,
  winOrgUiEnabled,
  winPermissionSetsEnabled,
  winSimulatorEnabled,
  winSsoEnabled,
} from '@/lib/win/flags';
import type { ModuleNavLink } from './module-nav';

export function canViewAdminSection(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return (
    hasCap(user, 'crm_data_config', 'view') ||
    hasCap(user, 'crm_staff_departments', 'view') ||
    hasCap(user, 'crm_staff_roster', 'view') ||
    hasCap(user, 'ai_admin', 'view')
  );
}

function canViewOrgAdmin(user: StoredStaffUser): boolean {
  if (!winOrgUiEnabled()) return false;
  return (
    hasCap(user, 'crm_staff_departments', 'view') ||
    hasCap(user, 'crm_staff_roster', 'view') ||
    hasCap(user, 'crm_data_config', 'view')
  );
}

export function buildAdminSidebarLinks(user: StoredStaffUser | null): ModuleNavLink[] {
  if (!user || !canViewAdminSection(user)) return [];

  const links: ModuleNavLink[] = [];

  if (hasCap(user, 'crm_data_config', 'view')) {
    links.push(
      { href: '/admin/crm/custom-fields', label: 'Custom fields' },
      { href: '/admin/crm/pipeline', label: 'Pipeline sales' },
      { href: '/admin/crm/lead-lookups', label: 'Nguồn & Kênh' },
      { href: '/admin/crm/permissions', label: 'Ma trận chức vụ' },
      { href: '/admin/crm/permissions/functions', label: 'Job function' },
      { href: '/admin/crm/permissions/users', label: 'Gán user' },
    );
    if (winPermissionSetsEnabled()) {
      links.push({ href: '/admin/crm/permission-sets', label: 'Permission Sets' });
    }
    if (winSimulatorEnabled()) {
      links.push({ href: '/admin/crm/permissions/simulator', label: 'Simulator' });
    }
    if (winFieldAbacEnabled()) {
      links.push({ href: '/admin/crm/permissions/fields', label: 'Field ABAC' });
    }
    if (winSsoEnabled()) {
      links.push({ href: '/admin/crm/sso/groups', label: 'SSO groups' });
    }
  }

  if (canViewOrgAdmin(user)) {
    links.push(
      { href: '/admin/crm/org/users', label: 'Người dùng' },
      { href: '/admin/crm/org/users/new', label: '+ Onboard NV' },
      { href: '/admin/crm/org/departments', label: 'Phòng ban' },
      { href: '/admin/crm/org/teams', label: 'Team' },
      { href: '/admin/crm/org/positions', label: 'Chức vụ (HR)' },
      { href: '/admin/crm/org/chart', label: 'Sơ đồ tổ chức' },
    );
  }

  if (hasCap(user, 'ai_admin', 'view')) {
    links.push(
      { href: '/admin/ai/agents', label: 'AI Agents' },
      { href: '/admin/ai/tools', label: 'AI Tools' },
      { href: '/admin/ai/runs', label: 'AI Runs' },
    );
  }

  return links;
}

/** Subset for AdminPageShell module subnav (data + permissions entry). */
export function buildCrmConfigModuleLinksFromAdminNav(
  user: StoredStaffUser | null,
): ModuleNavLink[] {
  if (!user || !hasCap(user, 'crm_data_config', 'view')) return [];
  return buildAdminSidebarLinks(user).filter((l) =>
    l.href.startsWith('/admin/crm/custom-fields') ||
    l.href.startsWith('/admin/crm/pipeline') ||
    l.href.startsWith('/admin/crm/lead-lookups') ||
    l.href.startsWith('/admin/crm/permissions'),
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd services/ops-web && npm run test:unit -- src/lib/admin/admin-nav.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/admin/admin-nav.ts services/ops-web/src/lib/admin/admin-nav.spec.ts
git commit -m "feat(ops-web): add admin-nav SSoT for control plane sidebar"
```

---

### Task 2: Wire `OpsNav` — section Quản trị hệ thống

**Files:**
- Modify: `services/ops-web/src/components/OpsNav.tsx`

**Interfaces:**
- Consumes: `buildAdminSidebarLinks`, `canViewAdminSection` from `@/lib/admin/admin-nav`

- [ ] **Step 1: Add imports**

At top of `OpsNav.tsx`, add:

```typescript
import { buildAdminSidebarLinks, canViewAdminSection } from '@/lib/admin/admin-nav';
```

- [ ] **Step 2: Remove AI admin links from `aiAutomation` block**

Replace lines ~483–487 with nothing — keep only workflows + playbooks:

```typescript
  const aiAutomation: NavLink[] = [];
  if (hasCap(user, 'automation_workflows', 'view')) {
    aiAutomation.push({ href: '/crm/automation', label: 'Workflows' });
  }
  if (hasCap(user, 'playbooks', 'view')) {
    aiAutomation.push({ href: '/crm/playbooks', label: 'Playbooks' });
  }
  if (aiAutomation.length) sections.push({ label: 'AI & Automation', links: aiAutomation });
```

- [ ] **Step 3: Replace `Cấu hình CRM` section with Quản trị hệ thống**

Remove block:

```typescript
  const config: NavLink[] = [];
  if (hasCap(user, 'crm_data_config', 'view')) {
    ...
  }
  if (config.length) sections.push({ label: 'Cấu hình CRM', links: config });
```

Add **before** `return sections`:

```typescript
  if (canViewAdminSection(user)) {
    const adminLinks = buildAdminSidebarLinks(user);
    if (adminLinks.length) {
      sections.push({
        label: 'Quản trị hệ thống',
        links: adminLinks.map((l) => ({ href: l.href, label: l.label })),
        defaultOpen: false,
      });
    }
  }
```

- [ ] **Step 4: Extend `PAGE_TITLES` for missing admin routes**

Add to `PAGE_TITLES` record in same file:

```typescript
  '/admin/crm/permissions': 'Ma trận chức vụ',
  '/admin/crm/permissions/functions': 'Job function',
  '/admin/crm/permissions/users': 'Gán user',
  '/admin/crm/permissions/simulator': 'Simulator',
  '/admin/crm/permissions/fields': 'Field ABAC',
  '/admin/crm/permission-sets': 'Permission Sets',
  '/admin/crm/sso/groups': 'SSO groups',
  '/admin/crm/org/users': 'Người dùng',
  '/admin/crm/org/users/new': 'Onboard NV',
  '/admin/crm/org/departments': 'Phòng ban',
  '/admin/crm/org/teams': 'Team',
  '/admin/crm/org/positions': 'Chức vụ',
  '/admin/crm/org/chart': 'Sơ đồ tổ chức',
```

- [ ] **Step 5: Build verify**

Run: `cd services/ops-web && npm run build`

Expected: Compiled successfully

- [ ] **Step 6: Commit**

```bash
git add services/ops-web/src/components/OpsNav.tsx
git commit -m "feat(ops-web): add Quản trị hệ thống sidebar section for admin routes"
```

---

### Task 3: Sync `module-nav.ts` + nav icons

**Files:**
- Modify: `services/ops-web/src/lib/admin/module-nav.ts`
- Modify: `services/ops-web/src/components/layout/nav-icons.tsx`

- [ ] **Step 1: Delegate `buildCrmConfigModuleLinks`**

In `module-nav.ts`, replace `buildCrmConfigModuleLinks` body:

```typescript
import { buildCrmConfigModuleLinksFromAdminNav } from './admin-nav';

export function buildCrmConfigModuleLinks(user: StoredStaffUser | null): ModuleNavLink[] {
  return buildCrmConfigModuleLinksFromAdminNav(user);
}
```

Remove duplicate inline array (keep `buildAiAutomationModuleLinks` unchanged for AdminPageShell AI section).

- [ ] **Step 2: Remove AI admin from `buildAiAutomationModuleLinks`**

Align with OpsNav — only workflows + playbooks:

```typescript
export function buildAiAutomationModuleLinks(user: StoredStaffUser | null): ModuleNavLink[] {
  const links: ModuleNavLink[] = [];
  if (hasCap(user, 'automation_workflows', 'view')) {
    links.push({ href: '/crm/automation', label: 'Workflows' });
  }
  if (hasCap(user, 'playbooks', 'view')) {
    links.push({ href: '/crm/playbooks', label: 'Playbooks' });
  }
  return links;
}
```

Note: Admin AI pages still reachable via sidebar Quản trị; AdminPageShell `section: 'ai-automation'` may need separate admin AI module links in P1 — for P0, AI admin pages use `admin/crm`-style breadcrumb or existing page titles only.

- [ ] **Step 3: Add nav icon mapping**

In `nav-icons.tsx` `SECTION_LABELS`:

```typescript
  'Quản trị hệ thống': 'Quản trị',
```

In `SECTION_ICON_ALIASES` (or equivalent map ~line 554):

```typescript
  'Quản trị': 'settings',
```

Remove or keep `'Cấu hình CRM': 'Cấu hình'` for backward compat if referenced elsewhere.

- [ ] **Step 4: Run unit tests + build**

Run: `cd services/ops-web && npm run test:unit && npm run build`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/admin/module-nav.ts services/ops-web/src/components/layout/nav-icons.tsx
git commit -m "refactor(ops-web): sync admin module nav with admin-nav SSoT"
```

---

### Task 4: HR Hub — live links (bỏ planned)

**Files:**
- Create: `services/ops-web/src/lib/crm/hr-hub.spec.ts`
- Modify: `services/ops-web/src/lib/crm/hr-hub.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { buildHrHubGroups } from './hr-hub';
import type { StoredStaffUser } from '@/lib/auth';

const hrAdmin: StoredStaffUser = {
  id: 'u1',
  email: 'hr@pttads.vn',
  display_name: 'HR',
  caps: ['crm_data_config.view', 'crm_staff_roster.view'],
  position_code: 'hr-admin',
  job_functions: [],
};

describe('hr-hub identity cards', () => {
  it('org-users card is linked not planned', () => {
    const groups = buildHrHubGroups(hrAdmin);
    const identity = groups.find((g) => g.id === 'identity');
    const orgUsers = identity?.cards.find((c) => c.id === 'org-users');
    expect(orgUsers?.planned).toBeFalsy();
    expect(orgUsers?.href).toBe('/admin/crm/org/users');
  });

  it('permissions-functions card is linked not planned', () => {
    const groups = buildHrHubGroups(hrAdmin);
    const identity = groups.find((g) => g.id === 'identity');
    const fn = identity?.cards.find((c) => c.id === 'permissions-functions');
    expect(fn?.planned).toBeFalsy();
    expect(fn?.href).toBe('/admin/crm/permissions/functions');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd services/ops-web && npm run test:unit -- src/lib/crm/hr-hub.spec.ts`

- [ ] **Step 3: Update `hr-hub.ts`**

Replace `permissions-functions` card (~105–112):

```typescript
    cards.push({
      id: 'permissions-functions',
      group: 'identity',
      label: 'Ma trận job function',
      description: 'Add-on content, design, leader…',
      href: '/admin/crm/permissions/functions',
    });
```

Replace `org-users` card (~113–120):

```typescript
    cards.push({
      id: 'org-users',
      group: 'identity',
      label: 'Người dùng & quyền',
      description: 'Onboard login + position + functions',
      href: '/admin/crm/org/users',
    });
```

Optional: gate `org-users` href with `winOrgUiEnabled()` — if flag off, set `planned: true` + badge `WIN-2` (match runtime). Import `winOrgUiEnabled` from `@/lib/win/flags`.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/hr-hub.ts services/ops-web/src/lib/crm/hr-hub.spec.ts
git commit -m "fix(ops-web): HR hub links to live admin org and permissions routes"
```

---

### Task 5: E2E smoke — sidebar → org users

**Files:**
- Create: `services/ops-web/e2e/admin-control-plane-p0-nav.spec.ts`

- [ ] **Step 1: Add Playwright spec**

```typescript
import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

test.describe('Admin Control Plane P0 nav', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('sidebar Quản trị hệ thống reaches org users', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Mở rộng menu|»/ }).click().catch(() => {});
    const section = page.getByText('Quản trị hệ thống', { exact: false });
    await expect(section.first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Người dùng' }).click();
    await expect(page).toHaveURL(/\/admin\/crm\/org\/users/);
    await expect(page.getByRole('heading', { name: /Nhân viên/i })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run e2e (local/staging with admin user + WIN_ORG_UI=1)**

Run: `cd services/ops-web && NEXT_PUBLIC_WIN_ORG_UI=1 npm run test:e2e -- e2e/admin-control-plane-p0-nav.spec.ts`

Expected: PASS when API + admin caps available; document skip if staging lacks caps.

- [ ] **Step 3: Commit**

```bash
git add services/ops-web/e2e/admin-control-plane-p0-nav.spec.ts
git commit -m "test(ops-web): e2e smoke admin sidebar to org users"
```

---

### Task 6: Docs update

**Files:**
- Modify: `docs/huong-dan-su-dung/01-nen-tang-platform.md`

- [ ] **Step 1: Add sidebar section after §1**

Insert new subsection **1.1 Truy cập Quản trị hệ thống**:

```markdown
### 1.1 Truy cập Quản trị hệ thống (sidebar)

1. Đăng nhập ops-web với tài khoản có quyền Admin/HR/IT
2. Sidebar → mở rộng menu (nút **»**)
3. Nhóm **Quản trị hệ thống** — chọn mục cần:
   - **Người dùng** — onboard, offboard, gán quyền
   - **Ma trận chức vụ** / **Job function** — RBAC
   - **Custom fields**, **Pipeline**, **Nguồn & Kênh** — schema CRM
   - **AI Agents** — governance AI (nếu có cap `ai_admin`)
4. HR vận hành roster: **Nhân sự & Hiệu suất → Nhân viên** (`/crm/staff`) — khác với tài khoản login

Spec: [`docs/specs/2026-08-11-admin-control-plane-ia.md`](../specs/2026-08-11-admin-control-plane-ia.md)
```

Update §3.1 line "Admin → Phân quyền CRM" → "Sidebar → Quản trị hệ thống → Ma trận chức vụ".

- [ ] **Step 2: Commit**

```bash
git add docs/huong-dan-su-dung/01-nen-tang-platform.md
git commit -m "docs: document Quản trị hệ thống sidebar entry for admin P0"
```

---

### Task 7: P0 exit verification & deploy

- [ ] **Step 1: Full verify**

```bash
cd services/ops-web
npm run test:unit
npm run build
npm run lint
```

Expected: all PASS

- [ ] **Step 2: Manual UAT checklist**

- [ ] Sidebar shows **Quản trị hệ thống** for admin user
- [ ] **Cấu hình CRM** section removed
- [ ] AI admin not under **AI & Automation**
- [ ] Click **Người dùng** → `/admin/crm/org/users` (requires `NEXT_PUBLIC_WIN_ORG_UI=1`)
- [ ] HR Hub **Người dùng & quyền** card clickable
- [ ] User without admin caps: section hidden

- [ ] **Step 3: Deploy ops-web**

On VPS:

```bash
cd /var/www/rnosai && git pull
grep -q NEXT_PUBLIC_WIN_ORG_UI=1 deploy/runtime.env || echo NEXT_PUBLIC_WIN_ORG_UI=1 >> deploy/runtime.env
./scripts/deploy_ops_web.sh
sudo ./scripts/deploy_ops_web.sh --restart
```

Hard-refresh browser.

- [ ] **Step 4: Final commit if spec link added to handover (optional)**

Add row in `docs/specs/2026-08-11-admin-control-plane-ia.md` §16 pointing to this plan file.

---

## P0 exit criteria (from spec §15)

- [ ] **EC-P0-01** 100% shipped admin routes reachable from sidebar Quản trị (cap-gated)
- [ ] **EC-P0-02** 0 badge "planned" on HR Hub for `/admin/crm/org/users` and `/admin/crm/permissions/functions`
- [ ] **EC-P0-03** IT timed find org users ≤30s (3 testers)
- [ ] **EC-P0-04** Unit tests green; e2e smoke green on staging

---

## Spec self-review

| Spec requirement | Task |
|------------------|------|
| P0-1 Quản trị section + full links | Task 1, 2 |
| P0-2 Remove AI admin from Automation | Task 2, 3 |
| P0-3 Sync module-nav | Task 3 |
| P0-4 HR Hub live links | Task 4 |
| P0-5 Docs §01 | Task 6 |
| Cap gating §11 | Task 1 `canViewAdminSection` |
| WIN_ORG_UI flag | Task 1 `canViewOrgAdmin` |
| No `/admin` hub in P0 | Global constraint |

No placeholders remain in task steps.

---

## Out of scope P0 (defer P1+)

- `/admin` hub launcher page
- `AdminShell` / `AdminLeftRail`
- Staff roster Login/RBAC column (P2)
- GlobalSearchBar admin routes (P3)
- Merge `admin/crm/layout.tsx` into single shell (P1)

---

## RACI

| Role | Responsibility |
|------|----------------|
| Eng | Tasks 1–5, 7 |
| PO | Sign EC-P0-03 UAT |
| IT | Staging verify + deploy |
| HR | Confirm HR Hub card labels |

---

*Plan saved: ADMIN-CP-P0 · traceability spec ADMIN-CP-IA-20260811 §12*
