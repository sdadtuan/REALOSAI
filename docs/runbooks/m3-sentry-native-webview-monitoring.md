# RNOS-M3 — Sentry monitoring (native shell + WebView)

> **Phase 4 GA** · App: **PTT Portal** · Tags: `client:capacitor-portal` · `surface:native-webview`

---

## Architecture

| Layer | What crashes | Sentry source |
|-------|--------------|---------------|
| **WebView (portal-web)** | JS errors, API failures, React | `NEXT_PUBLIC_SENTRY_DSN` · `sentry.client.ts` |
| **Native shell** | Plugin / WebView process (optional) | Sentry Capacitor SDK or Firebase Crashlytics |
| **Nest API** | Backend | `SENTRY_DSN` on ptt-crm-api |

Capacitor app loads `https://portal.pttads.vn` — **most GA monitoring is WebView JS** with native context tags.

---

## Tags (portal-web)

Auto-set by `getPortalSentryContext()`:

| Tag | Browser | Capacitor iOS/Android |
|-----|---------|------------------------|
| `client` | `portal-web` | `capacitor-portal` |
| `surface` | `browser` | `native-webview` |
| `platform` | `web` | `ios` / `android` |
| `app_version` | — | shell semver (e.g. `0.1.0`) |

**Verify after deploy:**

```bash
bash scripts/m3_ga_sentry_verify.sh
```

---

## Sentry dashboard — M3 GA

Create project **ptt-portal-mobile** (or reuse portal-web) with filters:

| Widget | Query |
|--------|-------|
| Capacitor errors | `client:capacitor-portal` |
| WebView only | `surface:native-webview` |
| iOS vs Android | `platform:ios` / `platform:android` |
| Crash-free rate | Session health (if SDK upgraded) |

**Alerts (recommended):**

| Alert | Condition | Action |
|-------|-----------|--------|
| M3 error spike | `client:capacitor-portal` > 10/min | #mobile-alerts Slack |
| New issue GA | first seen + `environment:production` | AM + DevOps |
| Login loop | message `*login*` + capacitor | P1 triage |

---

## Env (VPS + portal-web build)

```bash
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=ptt-portal@1.0.0
```

Template: [`deploy/env.m3-ga-prod.example`](../../deploy/env.m3-ga-prod.example)

Rebuild **portal-web** after setting `NEXT_PUBLIC_*` (baked at build time).

---

## Native shell crashes (optional upgrade)

For true native crash symbols (outside WebView):

1. Add `@sentry/capacitor` to `services/mobile-shell` (post-GA hardening).
2. Or enable **Firebase Crashlytics** via `google-services.json` / `GoogleService-Info.plist`.

Until then: monitor **TestFlight / Play Vitals** + WebView Sentry.

---

## Weekly GA review (2 tuần post-launch)

| # | Check | OK |
|---|-------|-----|
| 1 | Crash-free ≥99.5% (store consoles) | ☐ |
| 2 | No P0 open in Sentry `capacitor-portal` | ☐ |
| 3 | Push delivery ≥90% | ☐ |
| 4 | Force-update not accidentally blocking | ☐ |

---

## Liên kết

| Path | Nội dung |
|------|----------|
| [`m3-phase4-ga-store-checklist.md`](./m3-phase4-ga-store-checklist.md) | GA launch |
| [`sentry-phase2-dashboards.md`](./sentry-phase2-dashboards.md) | Nest dashboards |
| `scripts/m3_ga_sentry_verify.sh` | Tag verification |
