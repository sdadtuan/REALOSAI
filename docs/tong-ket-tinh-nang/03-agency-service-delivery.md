# Agency & Triển khai dịch vụ

> **Module:** MOD-AGENCY · MOD-SVC  
> **App:** ops-web · portal-web (approval) · ptt-crm-api

## Agency OS

| Tính năng | Mô tả | Route |
|-----------|-------|-------|
| Agency Hub | Trang chủ quản lý đa client | `/agency` |
| Client Management | CRUD client, owner AM | `/agency/clients/[id]`, `/new` |
| Ingest Monitor | Theo dõi ingest lead/data | `/agency/ingest` |
| Agency Jobs | Queue job Temporal | `/agency/jobs` |
| KPI Definitions | KPI cấu agency | `/agency/kpi-definitions` |
| Agency Notifications | Thông báo ops agency | `/agency/notifications` |

## Service Delivery

| Tính năng | Mô tả | Route |
|-----------|-------|-------|
| Lifecycle Kanban | Board lifecycle active | `/crm/service-delivery` |
| Lifecycle Detail | 7 giai đoạn + tab nhúng | `/crm/service-delivery/[id]` |
| Launch QA | Checklist pre-launch | `/crm/launch-qa` · tab `launch_qa` |
| SOP Library | Template + run SOP | `/crm/sop` · tab `sop` |
| Creative Hub | Registry creative | `/crm/creatives` · tab creatives |
| Campaign Write Queue | Ghi campaign Meta/Zalo | `/crm/campaign-writes` |
| Service Finance | Billing/margin lifecycle | Tab `finance` |
| Performance Metrics | CPL, spend, ROAS | API performance |
| Channel Report Schedules | Lịch báo cáo Meta/Zalo | API schedules |

## Tab nhúng trong Lifecycle Detail

| Tab | Module |
|-----|--------|
| `workflow` | Workflow chung |
| `tmmt` | Marketing plan |
| `ai-planner` | Marketing AI Planner |
| `content-os` | Content Marketing OS |
| `ops-hub` | Ops DV Hub |
| `finance` | Service finance |
| `sop` | SOP run |
| `launch_qa` | Launch QA |

## Giai đoạn lifecycle

`lead` → `onboard` → `deliver` → `handover` → `retain` (status: draft/active)

## API chính

```
/api/v1/clients
/api/crm/service-lifecycle
/api/crm/launch-qa
/api/crm/sop
/api/crm/creatives
/api/crm/campaign-writes
/api/v1/campaign-writes
/api/v1/creatives
/api/v1/performance
/api/v1/facebook-ads/reports/schedules
/api/v1/zalo-ads/reports/schedules
```

## Feature flags

```
PTT_CRM_SERVICE_LIFECYCLE_PG=1
PTT_CRM_SVC_FINANCE_PG=0
PTT_LAUNCH_QA_AUTO_START_ON_DELIVER=0
PTT_SOP_AUTO_START_ON_LAUNCH=0
PTT_TEMPORAL_ADDRESS=...
PTT_JOBS_ENABLED=1
```

## Tài liệu tham chiếu

- `docs/specs/modules/RNOSAI-BA-SVC-UseCases.md`
- `docs/SPEC_AGENCY_OPERATING_PLATFORM.md`
- `docs/crm/README.md`
