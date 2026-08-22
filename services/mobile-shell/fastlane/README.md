# Fastlane — RNOS-M3 store upload

## Prerequisites

| Platform | Requirement |
|----------|-------------|
| iOS | Apple Developer Program · App Store Connect app record · signing cert + provisioning |
| Android | Play Console app · service account JSON with Release Manager role |

## Env (CI secrets — never commit)

```bash
# iOS TestFlight
export APPLE_TEAM_ID=XXXXXXXXXX
export APP_STORE_CONNECT_API_KEY_PATH=/secure/AuthKey_XXXX.p8
export APP_STORE_CONNECT_KEY_ID=XXXXXXXXXX
export APP_STORE_CONNECT_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Android Internal
export GOOGLE_PLAY_JSON_KEY_PATH=/secure/play-console-sa.json
```

## GA release (Phase 4)

```bash
bundle exec fastlane ios release      # App Store production
bundle exec fastlane android production  # Play staged rollout (GA_ROLLOUT_FRACTION=0.1)
```

Or: `bash scripts/m3_store_ga_release_ios.sh` · `bash scripts/m3_store_ga_release_android.sh`

## Commands

```bash
cd services/mobile-shell
gem install bundler
bundle install   # if Gemfile added

# TestFlight internal
bundle exec fastlane ios beta

# Play Internal Testing
bundle exec fastlane android internal
```

Or use wrapper scripts from repo root:

```bash
bash scripts/m3_store_testflight_upload.sh
bash scripts/m3_store_play_internal.sh
```
