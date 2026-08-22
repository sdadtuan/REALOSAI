# iOS native config (after `npx cap add ios`)

## 1. URL scheme `pttads://` (Capacitor)

`capacitor.config.ts` sets `ios.scheme: 'pttads'`. Verify in `ios/App/App/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>pttads</string>
    </array>
  </dict>
</array>
```

## 2. Universal Links (Associated Domains)

1. Apple Developer → Identifiers → `vn.pttads.portal` → Associated Domains  
   Add: `applinks:portal.pttads.vn`

2. In Xcode → Signing & Capabilities → Associated Domains:

```
applinks:portal.pttads.vn
```

3. Host `https://portal.pttads.vn/.well-known/apple-app-site-association` (DevOps):

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.vn.pttads.portal",
        "paths": ["/creatives*", "/notifications*", "/email/approvals*", "/dashboard*"]
      }
    ]
  }
}
```

Replace `TEAMID` with Apple Team ID.

## 3. Push (APNs)

Enable Push Notifications capability in Xcode. Upload APNs key to Firebase or use direct APNs with Nest `PTT_APNS_*` env (Phase 2).

## 4. Test deep link

```bash
# Simulator
xcrun simctl openurl booted "pttads://approve/test-creative-id"
```
