# RNOS-M3 Phase 1 — Capacitor Shell Checklist

> **Repo:** `services/mobile-shell/` · **appId:** `vn.pttads.portal` · **Gate:** `bash scripts/rnos_m3_phase1_gate.sh`

---

## Task map

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | `cap add ios` / `android` | ☐ | `bash scripts/m3_mobile_shell_init.sh` · macOS+Xcode for iOS |
| 1.2 | WebView → portal URL | ✅ | `CAPACITOR_PORTAL_URL` in `capacitor.config.ts` |
| 1.3 | Native push plugin | ✅ | portal-web `useCapacitorNativePush` + Nest `/mobile/device-token` |
| 1.4 | Deep link `pttads://approve/{id}` | ✅ | `CapacitorShellInit` + universal link docs |
| 1.5 | Splash + status bar `#0f172a` | ✅ | Config + runtime hide in shell init |
| 1.6 | `X-PTT-Client: capacitor-portal/1.0` | ✅ | fetch patch in `CapacitorShellInit` |
| 1.7 | Biometric v1.1 | ⏸ Optional | `@capacitor-community/biometric-auth` after pilot |

---

## 1.1 — Generate native projects

```bash
cd RNOSAI
bash scripts/m3_mobile_shell_init.sh
bash scripts/m3_mobile_shell_patch_native.sh   # Android intent filters + iOS entitlements
```

**iOS requires full Xcode** (not only Command Line Tools):

```bash
bash scripts/m3_mobile_shell_xcode_select.sh   # sudo — point xcode-select to Xcode.app
cd services/mobile-shell && npx cap sync ios
npm run cap:open:ios
```

**CI runners:** `.github/workflows/rnos-m3-mobile-shell.yml`

---

## 1.2 — WebView URL

| Env | URL |
|-----|-----|
| Prod (default) | `https://portal.pttads.vn` |
| Staging | `CAPACITOR_PORTAL_URL=https://portal-staging.pttads.vn` |

```bash
CAPACITOR_PORTAL_URL=https://portal-staging.pttads.vn bash scripts/m3_mobile_shell_sync.sh
```

---

## 1.3 — Native push

1. Follow [`resources/firebase/FIREBASE-SETUP.md`](../services/mobile-shell/resources/firebase/FIREBASE-SETUP.md)
2. Copy Firebase **`google-services.json`** → `android/app/google-services.json`  
   Template: `android/app/google-services.json.example`
3. iOS: **`GoogleService-Info.plist`** in `ios/App/App/` + Push capability in Xcode
4. VPS: `PTT_MOBILE_NATIVE_PUSH_ENABLED=1`, `PTT_FCM_SERVER_KEY=...`
5. App → Settings → **Bật native push** (approver pilot)

Test: Settings → Gửi test native push

---

## 1.4 — Deep links

| Link | Route |
|------|-------|
| `pttads://approve/{creativeId}` | `/creatives?focus={id}` |
| `pttads://notifications` | `/notifications` |
| `pttads://email/approvals` | `/email/approvals` |
| `https://portal.pttads.vn/...` | Universal links |

**Patch (automated):** `bash scripts/m3_mobile_shell_patch_native.sh`

**Universal links on portal:** `public/.well-known/apple-app-site-association` (set `TEAMID`) · `assetlinks.json` (SHA256)

**Test:**

```bash
bash scripts/m3_mobile_shell_deeplink_test.sh [creative-uuid]
```

---

## 1.5 — Splash & status bar

- `SplashScreen.backgroundColor: #0f172a`
- `StatusBar.style: DARK`, `backgroundColor: #0f172a`
- Hidden after load via `CapacitorShellInit` / `shell-bootstrap.js`

---

## 1.6 — Analytics header

All `fetch()` from Capacitor WebView include:

```
X-PTT-Client: capacitor-portal/1.0
X-PTT-App-Version: 0.1.0
```

Verify in Nest access logs or browser devtools Network tab.

---

## 1.7 — Biometric (v1.1, optional)

**Not in Phase 1 scope.** After pilot:

```bash
npm install @capacitor-community/biometric-auth
```

Gate unlock before showing portal session — separate ADR/task.

---

## Gate & kickoff

```bash
bash scripts/staging_m3_phase1_kickoff.sh
# Report: .local-dev/rnos-m3-phase1-gate-report.json
```

**Expect:** build:www OK · portal tsc OK · M3 backend gate PASS

---

## Related

| Doc | Content |
|-----|---------|
| [`m3-phase0-discovery-adr-checklist.md`](./m3-phase0-discovery-adr-checklist.md) | Prerequisite Phase 0 |
| [`mobile-shell/README.md`](../services/mobile-shell/README.md) | Local dev |
| §7.7 runbook | M3 overview |

---

**Phase 1 sign-off**

| Role | Name | Date |
|------|------|------|
| Tech lead | | |
| DevOps | | |
