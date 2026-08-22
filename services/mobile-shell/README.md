# RNOS-M3 — Capacitor Mobile Shell (Phase 1)

Capacitor wrapper for **Portal PWA** (`https://portal.pttads.vn`). Phase 1 ships native shell + push + deep links; portal UI stays in `portal-web`.

**Strategy:** PWA-first (M2) → Capacitor shell (M3 Option A) → store pilot (Phase 2)

---

## Quick start

```bash
cd services/mobile-shell
cp env.example .env.local   # optional
npm install
npm run build:www         # bundle src/shell-bootstrap.ts → www/shell-bootstrap.js
npm run cap:sync          # or cap:sync:staging
```

### First-time native projects (1.1)

```bash
# From repo root
bash scripts/m3_mobile_shell_init.sh
```

Requires **Xcode** (iOS) and **Android Studio** (Android). iOS `cap add` must run on macOS.

---

## WebView URL (1.2)

| Environment | Command |
|-------------|---------|
| Production | default `https://portal.pttads.vn` |
| Staging | `CAPACITOR_PORTAL_URL=https://portal-staging.pttads.vn npm run cap:sync` |

Config: [`capacitor.config.ts`](./capacitor.config.ts) → `server.url`

---

## Architecture

```
┌─────────────────────┐
│  Capacitor shell    │  ios/ android/ (generated)
│  server.url ────────┼──► https://portal.pttads.vn
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  portal-web         │  CapacitorShellInit (deep link, status bar, fetch headers)
│  useCapacitorNativePush │  Settings → FCM token → Nest API
└─────────────────────┘
```

Remote `server.url` mode **does not** load `www/index.html` — native init runs from portal-web [`CapacitorShellInit`](../portal-web/src/components/capacitor/CapacitorShellInit.tsx).

Local fallback (no `server.url`): `www/index.html` loads `shell-bootstrap.js`.

---

## Native push (1.3)

- Plugin: `@capacitor/push-notifications`
- Registration UI: portal **Settings → Bật native push**
- API: `POST /api/v1/mobile/device-token`
- Configure Firebase + APNs in native projects before device test

---

## Deep links (1.4)

| URL | Portal route |
|-----|--------------|
| `pttads://approve/{creativeId}` | `/creatives?focus={id}` |
| `pttads://notifications` | `/notifications` |
| `https://portal.pttads.vn/...` | Universal links (see resources/) |

- iOS: [`resources/ios/universal-links.md`](./resources/ios/universal-links.md)
- Android: [`resources/android/deep-link-intent-filter.snippet.xml`](./resources/android/deep-link-intent-filter.snippet.xml)

---

## Splash & status bar (1.5)

Background `#0f172a` in `capacitor.config.ts`. Runtime: `SplashScreen.hide()` + `StatusBar` dark style in shell init.

---

## Analytics header (1.6)

Capacitor WebView patches `fetch()`:

```
X-PTT-Client: capacitor-portal/1.0
X-PTT-App-Version: 0.1.0
```

---

## Biometric v1.1 (1.7 — optional, post-pilot)

Not wired in Phase 1. Planned: `@capacitor-community/biometric-auth` after store pilot KPI.

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run build:www` | esbuild → `www/shell-bootstrap.js` |
| `npm run cap:sync` | build + cap sync |
| `npm run cap:open:ios` | Open Xcode |
| `npm run cap:open:android` | Open Android Studio |

Repo root:

```bash
bash scripts/m3_mobile_shell_sync.sh
bash scripts/rnos_m3_phase1_gate.sh
bash scripts/staging_m3_phase1_kickoff.sh
```

---

## Gate

```bash
bash scripts/staging_m3_phase1_kickoff.sh
```

Report: `.local-dev/rnos-m3-phase1-gate-report.json`

Runbook: [`docs/runbooks/m3-phase1-capacitor-shell-checklist.md`](../docs/runbooks/m3-phase1-capacitor-shell-checklist.md)
