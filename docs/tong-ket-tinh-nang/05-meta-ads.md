# Meta / Facebook Ads

> **Module:** MOD-META  
> **App:** ops-web · portal-web · ptt-crm-api

## Tính năng staff (ops-web)

| Tính năng | Mô tả | Route |
|-----------|-------|-------|
| Facebook Ads Hub | Tổng quan campaign | `/meta/facebook-ads` |
| Meta Intelligence | Anomaly, ROAS forecast, pixel health | `/meta/intelligence` |
| Tracking / Pixel / CAPI | Conversion rules, pixel test | `/meta/tracking` |
| Ads Ops | Launch/edit campaign (write ops) | `/meta/ads-ops` |
| Ads Combined | View đa kênh | `/meta/ads-combined` |
| Meta Alerts | Inbox cảnh báo spend/CPL | `/meta/alerts` |
| Meta Compliance | Kiểm tra policy | `/meta/compliance` |
| Creative Registry | Link creative ↔ campaign | `/meta/creatives` |
| API Migration | Migrate Graph API version | `/meta/migration` |

## Tính năng portal

| Tính năng | Route |
|-----------|-------|
| Meta KPI dashboard | `/meta` |
| Read-only insights | Portal API summary |

## API chính

```
/api/v1/meta/tracking
/api/v1/meta/intelligence
/api/v1/meta/ads-ops
/api/v1/meta/alerts
/api/v1/meta/compliance
/api/v1/facebook-ads/*
/api/v1/portal/meta/*
```

## Feature flags

```
PTT_META_TRACKING_ENABLED=1
PTT_META_ADS_OPS_ENABLED=1
PTT_META_INTELLIGENCE_ENABLED=1
PTT_META_ALERTS_ENABLED=1
PTT_META_COMPLIANCE_ENABLED=1
NEXT_PUBLIC_META_TRACKING=1
NEXT_PUBLIC_META_ADS_OPS=1
```

## Tích hợp

- Launch QA bridge (pre-launch checklist)
- Campaign Write Queue (Temporal)
- Creative Hub → portal approval
- Webhook Meta events

## Tài liệu tham chiếu

- `docs/specs/modules/RNOSAI-BA-META-UseCases.md`
- `docs/meta/README.md`
