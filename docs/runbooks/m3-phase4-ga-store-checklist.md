# RNOS-M3 Phase 4 — GA store (2 tuần)

> **Prerequisite:** Phase 3 sign-off · Pilot KPI met · Legal privacy final  
> **Gate:** `bash scripts/staging_m3_phase4_kickoff.sh` · Report: `.local-dev/rnos-m3-phase4-gate-report.json`

---

## Mục tiêu

| Task | Deliverable |
|------|-------------|
| **Public listing** | App Store + Play Production — **PTT Portal** (client approver B2B) |
| **Monitor crash** | Sentry `client:capacitor-portal` + WebView · store crash-free ≥99.5% |
| **Rollback** | Pull listing **hoặc** `min_version` + `force_update` block |

---

## Pre-flight GA

| # | Item | Owner | OK |
|---|------|-------|-----|
| 1 | `.local-dev/m3-phase3-signoff.json` decision=go | AM + DevOps | ☐ |
| 2 | Pilot KPI ≥ targets (push, crash-free, deep link) | Product | ☐ |
| 3 | Privacy `/privacy` Legal sign-off (no draft banner) | Legal | ☐ |
| 4 | Screenshots + metadata EN/VI uploaded | AM | ☐ |
| 5 | Review notes + prod test account | AM | ☐ |
| 6 | `NEXT_PUBLIC_SENTRY_DSN` in prod portal build | DevOps | ☐ |
| 7 | VPS `PTT_MOBILE_*` + FCM/APNs live | DevOps | ☐ |
| 8 | Rollback runbook rehearsed (staging) | DevOps | ☐ |

```bash
bash scripts/staging_m3_phase4_kickoff.sh
bash scripts/m3_ga_sentry_verify.sh
```

---

## 4.1 — Public listing «PTT Portal»

**Audience:** Client approver B2B only — **not** public self-signup. Listing copy states login required.

### iOS App Store

```bash
# Requires mobile-shell/.env.local secrets
bash scripts/m3_store_ga_release_ios.sh
```

**Manual checklist:**

| # | App Store Connect | OK |
|---|-------------------|-----|
| 1 | Version submitted for **App Review** (production) | ☐ |
| 2 | Pricing: Free · Availability: selected markets | ☐ |
| 3 | App Privacy + export compliance | ☐ |
| 4 | **Release:** manual or scheduled after approval | ☐ |
| 5 | Post-approval: status **Ready for Sale** | ☐ |

Fastlane: `cd services/mobile-shell && bundle exec fastlane ios release`

### Google Play Production

```bash
bash scripts/m3_store_ga_release_android.sh
```

| # | Play Console | OK |
|---|--------------|-----|
| 1 | Production track · staged rollout **10% → 50% → 100%** | ☐ |
| 2 | Data safety + content rating finalized | ☐ |
| 3 | Store listing VI + EN live | ☐ |

Fastlane: `bundle exec fastlane android production`

### Metadata source

- [`m3-app-store-metadata-draft.md`](../templates/m3-app-store-metadata-draft.md)
- [`m3-app-store-review-notes.md`](../templates/m3-app-store-review-notes.md)
- Screenshots: `services/mobile-shell/store-assets/screenshots/`

---

## 4.2 — Monitor crash (Sentry native + WebView)

> **Runbook:** [`m3-sentry-native-webview-monitoring.md`](./m3-sentry-native-webview-monitoring.md)

### Deploy Sentry

1. Set env from [`deploy/env.m3-ga-prod.example`](../../deploy/env.m3-ga-prod.example)
2. Rebuild + deploy **portal-web** (NEXT_PUBLIC_* baked in)
3. Verify tags:

```bash
bash scripts/m3_ga_sentry_verify.sh
# Expect: client:capacitor-portal in sentry.client.ts
```

### Store consoles

| Platform | Console | Target |
|----------|---------|--------|
| iOS | App Store Connect → Analytics → Crashes | crash-free ≥99.5% |
| Android | Play Console → Android vitals | crash-free ≥99.5% |

### On-call

- **P0:** login broken, crash on launch → consider rollback §4.3
- **P1:** push delivery <80% 24h → FCM/APNs triage
- **P2:** single-screen JS error → hotfix portal-web (no store binary)

---

## 4.3 — Rollback

Two independent levers — can combine.

### Option A — Block old builds (`min_version` + `force_update`)

**Use when:** portal/API fix shipped · need force new store binary · **keep listing live**

```bash
# Dry-run (prints env changes)
bash scripts/m3_ga_rollback_min_version_block.sh --min-version 1.0.1

# Apply on VPS (SSH)
bash scripts/m3_ga_rollback_min_version_block.sh --apply --min-version 1.0.1
```

VPS vars:

```bash
PTT_MOBILE_MIN_VERSION=1.0.1
PTT_MOBILE_FORCE_UPDATE=1
```

Effect: app `X-PTT-App-Version` < min → Settings shows force-update · push disabled · user must update from store.

**Revert after fix:**

```bash
bash scripts/m3_ga_rollback_min_version_block.sh --apply --min-version 1.0.0 --force-update 0
```

### Option B — Pull store listing

**Use when:** critical blocker · cannot hotfix quickly · stop new installs

```bash
bash scripts/m3_ga_rollback_pull_listing.sh
# Prints ASC + Play Console steps (manual — requires org access)
```

| Store | Action |
|-------|--------|
| **Apple** | App Store Connect → Pricing and Availability → **Remove from sale** (or unpublish version) |
| **Google** | Play Console → Production → **Halt rollout** · optionally deactivate |

Existing installs may continue — combine with **Option A** to block usage.

### Rollback decision matrix

| Severity | Action |
|----------|--------|
| P0 crash >5% sessions | B pull listing + A min_version block |
| P0 auth broken | B + portal rollback deploy |
| P1 push broken | Fix FCM/APNs · no listing pull |
| P2 UI bug | portal-web hotfix only |

---

## Post-GA (2 tuần soak)

| Week | Activity |
|------|----------|
| W1 | Daily Sentry + store crash review · staged Play rollout |
| W2 | KPI vs GA targets · Phase 4 sign-off |

```bash
DATABASE_URL=... KPI_DAYS=14 bash scripts/m3_pilot_kpi_collect.sh
```

---

## Sign-off Phase 4

```bash
cp docs/templates/m3-phase4-signoff-template.json .local-dev/m3-phase4-signoff.json
```

| Criterion | Required |
|-----------|----------|
| Production listing live both stores | Yes |
| Sentry monitoring active | Yes |
| Rollback rehearsed (one option) | Yes |
| Crash-free ≥99.5% week 2 | Yes |
| Legal + AM + DevOps sign | Yes |

**Done** → RNOS-M3 Capacitor Option A **GA complete**

---

## Liên kết

| Path | Nội dung |
|------|----------|
| [`m3-phase3-pilot-enterprise-checklist.md`](./m3-phase3-pilot-enterprise-checklist.md) | Prerequisite Phase 3 |
| [`m3-sentry-native-webview-monitoring.md`](./m3-sentry-native-webview-monitoring.md) | Sentry tags |
| [`env.m3-ga-prod.example`](../../deploy/env.m3-ga-prod.example) | Prod env |
| §7.7 [`rnosai-vps-operations-guide.md`](./rnosai-vps-operations-guide.md) | VPS ops |

---

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-08-01 | Phase 4 GA store runbook |
