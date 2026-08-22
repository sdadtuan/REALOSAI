# Firebase + FCM (Android) — RNOS-M3

## 1. Firebase Console

1. Create project **ptt-portal-m3** (or use existing org project).
2. Add **Android app**: package `vn.pttads.portal`.
3. Download **`google-services.json`** → copy to:

```
services/mobile-shell/android/app/google-services.json
```

4. Add **iOS app**: bundle `vn.pttads.portal` → download **`GoogleService-Info.plist`** →

```
services/mobile-shell/ios/App/App/GoogleService-Info.plist
```

(`cap add ios` must exist first.)

5. Project settings → Cloud Messaging → copy **Server key** (legacy) or service account → VPS:

```bash
PTT_FCM_SERVER_KEY=...
PTT_MOBILE_NATIVE_PUSH_ENABLED=1
```

## 2. Verify Android build

```bash
cd services/mobile-shell/android
./gradlew :app:assembleDebug
```

Log should **not** say `google-services.json not found`.

## 3. iOS APNs via Firebase

1. Firebase → Project settings → Cloud Messaging → Apple app configuration.
2. Upload **APNs Authentication Key** (.p8) from Apple Developer, or certificates.
3. Xcode → target **App** → Signing & Capabilities → **Push Notifications** (add capability).

## 4. APNs key (Apple Developer — direct Nest optional)

| Item | Where |
|------|--------|
| .p8 key file | Secure vault — **never commit** |
| Key ID | Apple Developer → Keys |
| Team ID | Membership details |

VPS env (optional if using Firebase only):

```bash
PTT_APNS_KEY_ID=...
PTT_APNS_TEAM_ID=...
PTT_APNS_KEY_PATH=/secure/path/AuthKey_XXXX.p8
```

## 5. Checklist

| # | Task | OK |
|---|------|-----|
| 1 | `google-services.json` in `android/app/` | ☐ |
| 2 | `GoogleService-Info.plist` in iOS app target | ☐ |
| 3 | `PTT_FCM_SERVER_KEY` on VPS | ☐ |
| 4 | Push capability in Xcode | ☐ |
| 5 | Test push from Portal Settings | ☐ |
