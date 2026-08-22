# Google Ads

> **Module:** Google Ads (cross-channel, không có MOD riêng trong BA)  
> **App:** ops-web · portal-web · ptt-crm-api

## Tính năng staff (ops-web)

| Tính năng | Mô tả | Route |
|-----------|-------|-------|
| Google Ads Hub | Insights sync OAuth | `/google/google-ads` |
| Campaign overview | Spend, conversions, CPL | Hub dashboard |
| OAuth connect | Liên kết Google Ads account | Settings trong hub |

## Tính năng portal

| Tính năng | Route |
|-----------|-------|
| Google KPI dashboard | `/google` |
| Read-only summary | Portal API |

## API chính

```
/api/v1/google-ads/*
/api/v1/portal/google/*
/api/v1/webhooks/google
```

## Feature flags

```
PTT_GOOGLE_INSIGHTS_SYNC=1
NEXT_PUBLIC_GOOGLE_ADS=1
```

## Tích hợp

- Portal dashboard KPI đa kênh
- Performance metrics cross-channel
- Ads Combined view (Meta + Google + Zalo)

## Tài liệu tham chiếu

- `docs/specs/modules/RNOSAI-BA-Google-UseCases.md` (nếu có)
