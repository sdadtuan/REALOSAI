# Store assets — PTT Portal (RNOS-M3)

## Screenshot sizes (Phase 2.3)

| Device class | App Store | Play Store | Capture |
|--------------|-----------|------------|---------|
| **6.7" iPhone** | 1290 × 2796 | Phone (min 1080×1920) | `iphone-6.7-*.png` |
| **5.5" iPhone** | 1242 × 2208 (legacy) | — | `iphone-5.5-*.png` |
| **13" iPad** | 2064 × 2752 | Tablet 10" | `ipad-13-*.png` |

## Generate

```bash
# Playwright (portal logged-in UI @ mobile viewports)
bash scripts/m3_store_screenshots_capture.sh

# Or iOS Simulator manual frames
bash scripts/m3_store_screenshots_capture.sh --simulator-only
```

Output: `screenshots/ios/` · manifest: `screenshots/manifest.json`

## Upload

- **App Store Connect** → App → Previews and Screenshots → drag PNGs per device size
- **Play Console** → Main store listing → phone + tablet graphics

Design brief: [`docs/templates/m3-app-store-metadata-draft.md`](../../../docs/templates/m3-app-store-metadata-draft.md) §6
