# RNOS-M3 Phase 2 — QA & Store prep (3 tuần)

> **Prerequisite:** Phase 1 gate PASS · ADR-MOB-04 accepted · store accounts enrolled  
> **Gate:** `bash scripts/staging_m3_phase2_kickoff.sh` · Report: `.local-dev/rnos-m3-capacitor-gate-report.json`

---

## Mục tiêu Phase 2

| # | Task | Deliverable |
|---|------|-------------|
| **2.1** | Gate M3 (build iOS/Android + deep link smoke) | `rnos_m3_capacitor_gate.sh` |
| **2.2** | TestFlight + Play Internal Testing | Fastlane + upload scripts |
| **2.3** | Store screenshots 6.7" / 5.5" / tablet | `store-assets/screenshots/` |
| **2.4** | App Review notes | `m3-app-store-review-notes.md` |

---

## 2.1 — Gate script (`rnos_m3_capacitor_gate.sh`)

### Chạy local

```bash
# Full gate (macOS + Xcode + Android SDK)
bash scripts/staging_m3_phase2_kickoff.sh

# Strict deep link (Simulator booted hoặc adb device)
RUN_DEEPLINK_SMOKE=1 bash scripts/rnos_m3_capacitor_gate.sh

# CI / không có Xcode
SKIP_IOS_BUILD=1 SKIP_ANDROID_BUILD=1 bash scripts/rnos_m3_capacitor_gate.sh
```

### Gate checks

| ID | Check |
|----|-------|
| Artifacts | Phase 2 scripts, runbook, review notes, manifest |
| Phase 1 | `rnos_m3_phase1_gate.sh` nested PASS |
| API | portal-mobile unit tests |
| portal-web | `tsc --noEmit` |
| shell | `npm run build:www` |
| **ios-build** | `xcodebuild` Simulator Debug (`IOS_SIM_NAME`, default iPhone 17 Pro) |
| **android-build** | `./gradlew :app:assembleDebug` |
| **deeplink-smoke** | `m3_mobile_shell_deeplink_test.sh` → `pttads://approve/{uuid}` |
| review-notes | Template chứa WebView authenticated portal text |

### Deep link smoke

```bash
# Boot Simulator, cài app, rồi:
bash scripts/m3_mobile_shell_deeplink_test.sh
# Hoặc:
xcrun simctl openurl booted "pttads://approve/00000000-0000-4000-8000-000000000001"
```

**Android:** `brew install android-platform-tools` · emulator running · `adb shell am start -a android.intent.action.VIEW -d "pttads://approve/..."`

---

## 2.2 — TestFlight (iOS) + Play Internal Testing

### Prerequisites

| Item | Owner | Doc |
|------|-------|-----|
| Apple Developer Program | DevOps | [`m3-store-accounts-checklist.md`](../templates/m3-store-accounts-checklist.md) |
| App Store Connect app `vn.pttads.portal` | DevOps | |
| App Store Connect API key (.p8) | DevOps | `fastlane/README.md` |
| Play Console app + service account | DevOps | |
| Signing cert + provisioning (iOS) | DevOps | Xcode / ASC |
| `google-services.json` (FCM) | DevOps | `resources/firebase/` |

### Env (`services/mobile-shell/.env.local` — gitignored)

```bash
APPLE_TEAM_ID=XXXXXXXXXX
APP_STORE_CONNECT_API_KEY_PATH=/secure/AuthKey_XXXX.p8
APP_STORE_CONNECT_KEY_ID=XXXXXXXXXX
APP_STORE_CONNECT_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
GOOGLE_PLAY_JSON_KEY_PATH=/secure/play-console-sa.json
TESTFLIGHT_CHANGELOG="RNOS-M3 internal build 1"
```

### Upload

```bash
# iOS → TestFlight internal group
bash scripts/m3_store_testflight_upload.sh

# Android → Play Internal Testing (draft release)
bash scripts/m3_store_play_internal.sh
```

**Fastlane lanes** (alternative):

```bash
cd services/mobile-shell
bundle install
bundle exec fastlane ios beta
bundle exec fastlane android internal
```

### Post-upload checklist

| # | iOS TestFlight | Android Internal |
|---|----------------|------------------|
| 1 | Build processed in ASC | AAB visible in Internal testing |
| 2 | Internal testers added (3–5 approver pilot) | Email list / Google Group |
| 3 | Install from TestFlight app | Opt-in link sent |
| 4 | Login approver test account | Same |
| 5 | Push token registers (`/mobile/device-token`) | Same |
| 6 | Deep link from Notes / push | `pttads://approve/{id}` |

---

## 2.3 — Store screenshots

### Kích thước bắt buộc

| Class | Pixel | Simulator / tool |
|-------|-------|------------------|
| iPhone **6.7"** | 1290 × 2796 | iPhone 17 Pro Max |
| iPhone **5.5"** (legacy) | 1242 × 2208 | iPhone 8 Plus hoặc resize |
| iPad **13"** | 2064 × 2752 | iPad Pro 13-inch |

### Nội dung (4–5 màn)

Theo [`m3-app-store-metadata-draft.md`](../templates/m3-app-store-metadata-draft.md) §6:

1. Dashboard KPI  
2. Creative inbox  
3. Notifications  
4. Settings (native push)  
5. (Optional) Email approval  

### Capture

```bash
# Automated — Playwright @ portal (cần E2E credentials / local stack)
bash scripts/m3_store_screenshots_capture.sh

# Manual — Simulator frames
bash scripts/m3_store_screenshots_capture.sh --simulator-only
```

Output: `services/mobile-shell/store-assets/screenshots/ios/`  
Manifest: `store-assets/screenshots/manifest.json`

**Play Store:** reuse phone PNGs (1080×1920 min) + iPad captures cho tablet slot.

---

## 2.4 — App Review notes

**File:** [`m3-app-store-review-notes.md`](../templates/m3-app-store-review-notes.md)

**Key message (English paste vào ASC):**

> WebView loads **authenticated client portal** at fixed URL `https://portal.pttads.vn` only — **no arbitrary URL** navigation. B2B accounts provisioned by PTT; test credentials provided.

### Trước khi submit

| # | Item | OK |
|---|------|-----|
| 1 | Test account hoạt động trên TestFlight build | ☐ |
| 2 | Privacy URL live: `https://portal.pttads.vn/privacy` | ☐ |
| 3 | Review notes pasted + test login filled in | ☐ |
| 4 | Screenshots uploaded per device class | ☐ |
| 5 | Metadata EN + VI từ template | ☐ |
| 6 | Legal sign-off privacy (bỏ draft banner) | ☐ |

---

## Sign-off Phase 2

Tạo `.local-dev/m3-phase2-signoff.json`:

```json
{
  "phase": "2-store-prep",
  "gate_report": ".local-dev/rnos-m3-capacitor-gate-report.json",
  "testflight_build": "<build number>",
  "play_internal_version_code": "<versionCode>",
  "screenshots_uploaded": true,
  "review_notes_pasted": true,
  "signed_by": "DevOps + AM",
  "signed_at": "2026-08-XX"
}
```

**GO** → Phase 3 Pilot (3–5 approver · 1 enterprise client)

Cohort template: [`deploy/m3-pilot-cohort.example.json`](../../deploy/m3-pilot-cohort.example.json)

---

## CI

Workflow: `.github/workflows/rnos-m3-phase2-store-prep.yml`  
Artifacts-only + Android assemble on Linux; iOS build on `macos-latest` when secrets available.

---

## Liên kết

| Path | Nội dung |
|------|----------|
| [`m3-phase1-capacitor-shell-checklist.md`](./m3-phase1-capacitor-shell-checklist.md) | Phase 1 |
| [`m3-app-store-metadata-draft.md`](../templates/m3-app-store-metadata-draft.md) | Listing copy |
| [`m3-app-store-review-notes.md`](../templates/m3-app-store-review-notes.md) | Review notes |
| `services/mobile-shell/fastlane/` | TestFlight + Play lanes |
| §7.7 [`rnosai-vps-operations-guide.md`](./rnosai-vps-operations-guide.md) | VPS ops M3 |

---

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-07-26 | Phase 2 QA & store prep runbook |
