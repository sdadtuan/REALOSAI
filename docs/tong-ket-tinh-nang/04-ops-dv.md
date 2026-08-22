# Ops DV — Operations Delivery OS

> **Module:** MOD-OPS  
> **Trạng thái:** ~85% · Staging INT-P0→P4 @ `2f7ef76`

## Tính năng staff (ops-web)

| Tính năng | Mô tả | Route / API |
|-----------|-------|-------------|
| Catalog DV01–21 | Profile 21 dịch vụ, readiness | `GET /api/ops/catalog` |
| Ops Hub | Header, engines, weekly, KPI, alerts | Tab `ops-hub` · `GET /api/ops/lifecycle/:id/hub` |
| Spawn checklist tuần | Sinh task idempotent | `POST /api/ops/lifecycle/:id/spawn-week` |
| Weekly checklist | PATCH status pending/done/skipped | `GET/PATCH /api/ops/lifecycle/:id/weekly` |
| KPI record | Nhập actual, auto nhãn | `GET/PUT /api/ops/lifecycle/:id/kpi` |
| KPI nhãn | Đạt / Cần chú ý / Không đạt (BR-OPS-KPI-01) | `POST .../kpi/compute-labels` |
| Quote Builder | 3 gói Basic/Standard/Premium, export PDF/DOCX | `/crm/proposals` wizard |
| Quote accept | Accept → lifecycle + optional spawn | `/api/crm/proposals` |
| Ops Agent (L2) | Scan task + KPI → alert log | `POST /api/ops/agent/run` |
| Alert center | List/ack cảnh báo | `/crm/ops/alerts` |
| Dashboard AM | Instance list theo assigned AM | `/crm/ops/dashboard` (tab AM) |
| Dashboard Team Lead | Theo phòng ban | tab Team Lead |
| Dashboard Specialist | Pending checklist tuần | tab Specialist · `/crm/ops/my-tasks` |
| Dashboard Executive | Aggregate pilot DV | tab Executive |

## Tính năng portal (INT-P4)

| Tính năng | Route / API |
|-----------|-------------|
| Ops summary card | `/dashboard` (card) |
| Chi tiết triển khai | `/service-delivery` |
| Linked lifecycle | `GET /api/v1/portal/ops/linked` |
| Lifecycle summary | `GET /api/v1/portal/ops/lifecycle/:id/summary` |

## Pilot DV

DV02 (Content), DV05 (SEO), DV04 (Ads), DV20 (Email)

## Database (PostgreSQL)

- `ops_service_profile`
- `ops_weekly_spawn_log`, `ops_weekly_checklist_item`
- `ops_kpi_record`
- `ops_alert_log`

## Feature flags

```
PTT_OPS_DV_ENABLED=1
PTT_OPS_WEEKLY_SPAWN=1
PTT_OPS_AGENT_ENABLED=1
PTT_OPS_PORTAL_SUMMARY=1
PTT_OPS_HUB_PILOT_DV=DV02,DV05,DV04,DV20
NEXT_PUBLIC_OPS_DV=1
NEXT_PUBLIC_OPS_PORTAL_SUMMARY=1
```

## Tài liệu tham chiếu

- `docs/specs/2026-08-10-ptt-ops-rnosai-integration-spec.md`
- `docs/superpowers/specs/2026-08-10-ptt-ops-dv-implementation-status.md`
- `docs/specs/ops-dv01-dv21-route-map.json`
