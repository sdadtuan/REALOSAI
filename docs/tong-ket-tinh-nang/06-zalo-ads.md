# Zalo Ads

> **Module:** MOD-ZALO  
> **App:** ops-web · portal-web · ptt-crm-api

## Tính năng staff (ops-web)

| Tính năng | Mô tả | Route |
|-----------|-------|-------|
| Zalo Ads Hub | Campaign insights | `/zalo/zalo-ads` |
| Zalo Leads Inbox | Lead ingest từ Zalo | `/zalo/leads` |
| Zalo Ads Ops | Campaign write operations | `/zalo/ads-ops` |
| Zalo Tracking | Tích hợp Launch QA | Tab launch QA |

## Tính năng portal

| Tính năng | Route |
|-----------|-------|
| Zalo KPI dashboard | `/zalo` |

## API chính

```
/api/v1/zalo/leads
/api/v1/zalo/ads-ops
/api/v1/zalo-ads/*
/api/v1/portal/zalo/*
/api/v1/webhooks/zalo
```

## Feature flags

```
PTT_ZALO_ADS_OPS_ENABLED=1
PTT_ZALO_LEADS_ENABLED=1
NEXT_PUBLIC_ZALO_ADS=1
NEXT_PUBLIC_ZALO_LEADS=1
```

## Tích hợp

- Launch QA bridge
- Campaign Write Queue
- Channel report schedules
- Webhook Zalo lead events

## Tài liệu tham chiếu

- `docs/specs/modules/RNOSAI-BA-ZALO-UseCases.md`
