# Hướng dẫn đăng PTT Portal — App Store + Google Play (thủ công)

> **App:** PTT Portal · **Bundle / Package:** `vn.pttads.portal`  
> **WebView:** `https://portal.pttads.vn` · **Không cần Fastlane/API key** nếu upload qua console

---

## Trước khi bắt đầu

| # | Item | OK |
|---|------|-----|
| 1 | Apple Developer Program (org) đã active | ☐ |
| 2 | Google Play Console app `vn.pttads.portal` đã tạo | ☐ |
| 3 | Privacy live: https://portal.pttads.vn/privacy | ☐ |
| 4 | Metadata + screenshots (Phase 2) | ☐ |
| 5 | Review notes: `docs/store/app-review-notes-paste-en.txt` | ☐ |
| 6 | `bash scripts/m3_mobile_shell_sync.sh` vừa chạy | ☐ |

---

## A. iOS — App Store Connect

### A1. Chuẩn bị signing (một lần)

1. Mở Xcode:
   ```bash
   open services/mobile-shell/ios/App/App.xcworkspace
   ```
2. Target **App** → **Signing & Capabilities**
   - Team: org PTT
   - Bundle ID: `vn.pttads.portal`
   - Capabilities: **Push Notifications**, **Associated Domains** (`applinks:portal.pttads.vn`)
3. Xcode → Settings → Accounts → Apple ID org

### A2. Archive + Upload

1. Scheme **App** · Destination **Any iOS Device (arm64)** (không chọn Simulator)
2. Menu **Product → Archive**
3. Organizer mở → chọn archive → **Distribute App**
4. **App Store Connect** → Upload
5. Chờ processing trên [App Store Connect](https://appstoreconnect.apple.com)

### A3. Submit for Review

1. Apps → **PTT Portal** → **App Store** tab
2. **+ Version** (e.g. 1.0.0)
3. Upload screenshots (6.7", 5.5", iPad) từ `store-assets/screenshots/ios/`
4. Description / keywords: `docs/templates/m3-app-store-metadata-draft.md`
5. **App Review Information → Notes:** paste `docs/store/app-review-notes-paste-en.txt`  
   (thay test account pilot thật trước submit)
6. **Pricing:** Free · **Availability:** chọn markets
7. Chọn build vừa upload → **Submit for Review**
8. Sau approve → **Release this version**

### A4. TestFlight (optional trước public)

Organizer → **Distribute App** → **TestFlight** → add internal testers

---

## B. Android — Google Play Console

### B1. Keystore (một lần)

```bash
keytool -genkey -v -keystore ptt-portal-release.keystore \
  -alias ptt-portal -keyalg RSA -keysize 2048 -validity 10000
```

Lưu keystore **ngoài repo** · backup password.

Thêm vào `android/gradle.properties` (local, gitignore):

```properties
PTT_RELEASE_STORE_FILE=/secure/ptt-portal-release.keystore
PTT_RELEASE_STORE_PASSWORD=***
PTT_RELEASE_KEY_ALIAS=ptt-portal
PTT_RELEASE_KEY_PASSWORD=***
```

Và signing config trong `android/app/build.gradle` (DevOps) — hoặc dùng **Play App Signing** (Google quản lý key).

### B2. Build AAB

**Cách 1 — Android Studio:**

```bash
open -a "Android Studio" services/mobile-shell/android
```

Build → Generate Signed Bundle / APK → **Android App Bundle** → release

**Cách 2 — CLI (unsigned/debug — chỉ test, Play cần signed):**

```bash
cd services/mobile-shell/android
./gradlew :app:bundleRelease
# Output: app/build/outputs/bundle/release/app-release.aab
```

### B3. Firebase (push — khuyến nghị trước GA)

1. Firebase Console → project PTT → add Android app `vn.pttads.portal`
2. Download `google-services.json` → `android/app/google-services.json`
3. `bash scripts/m3_mobile_shell_sync.sh`

### B4. Upload Play Console

1. [Play Console](https://play.google.com/console) → **PTT Portal**
2. **Release → Production** (hoặc **Internal testing** trước)
3. **Create new release** → upload **`.aab`**
4. Release notes (VI):
   ```
   PTT Portal — ứng dụng duyệt creative và email campaign cho khách doanh nghiệp PTT.
   ```
5. Store listing: screenshots + mô tả từ metadata draft
6. **Data safety** + **Content rating** hoàn tất
7. **Staged rollout** 10% → 50% → 100% (khuyến nghị)
8. **Review and roll out**

---

## C. Sau khi live

```bash
# Monitor Sentry tags
bash scripts/m3_ga_sentry_verify.sh

# Rollback nếu sự cố
bash scripts/m3_ga_rollback_min_version_block.sh --min-version 1.0.1
bash scripts/m3_ga_rollback_pull_listing.sh
```

---

## D. Checklist nhanh

| Store | Binary | Console | Review |
|-------|--------|---------|--------|
| Apple | Archive → Upload | ASC → Submit | 1–3 ngày |
| Google | Signed AAB | Production release | vài giờ – 7 ngày |

**Liên kết:** [`m3-phase4-ga-store-checklist.md`](./m3-phase4-ga-store-checklist.md)
