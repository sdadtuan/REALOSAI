# INT-P3 — Ops Agent, Alerts, Dashboards

> **Goal:** L2 Ops Agent scan task/KPI → `ops_alert_log`; alert center + role dashboards (AM/TL/Specialist/Executive).

**Spec:** [`docs/specs/2026-08-10-ptt-ops-rnosai-integration-spec.md`](../../specs/2026-08-10-ptt-ops-rnosai-integration-spec.md) §6.4, §7

---

## Scope

| WS | Deliverable | Exit |
|----|-------------|------|
| **WS-P3-01** | `ops_alert_log` PG repo + DDL | Bootstrap idempotent |
| **WS-P3-02** | `OpsAgentScanService` + cron tick 08:00 VN | Manual POST run |
| **WS-P3-03** | Alerts API + hub `alerts` section | Hub JSON populated |
| **WS-P3-04** | Dashboard APIs (4 roles) | Nest build PASS |
| **WS-P3-05** | FE alerts panel + dashboard + my-tasks | ops-web build PASS |
| **WS-P3-06** | Smoke + deploy `PTT_OPS_AGENT_ENABLED=1` | smoke PASS |

---

## API (prefix `api/ops`)

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/alerts?lifecycle_id=&status=&limit=` | view | Danh sách cảnh báo |
| PATCH | `/alerts/:id/ack` | write | Acknowledge alert |
| GET | `/agent/status` | view | Trạng thái agent |
| POST | `/agent/run` | write | Chạy scan (body `dry_run`) |
| GET | `/dashboard/am?am_id=` | view | Dashboard AM (RLS assigned_am) |
| GET | `/dashboard/team-lead?department=` | view | Theo phòng ban |
| GET | `/dashboard/specialist` | view | Pending checklist tuần |
| GET | `/dashboard/executive` | view | Aggregate pilot DV |

Hub: `GET /lifecycle/:id/hub` thêm `alerts: { open_count, items[] }`.

---

## Agent rules

- Chỉ scan lifecycle `active` + stage `onboard|deliver|handover|retain`
- KPI tháng hiện tại: `CanChuY` → warning, `KhongDat` → critical
- Task pending: `day_of_week < today` → overdue; `<= today+2` → due_soon
- Upsert idempotent qua `source_key` UNIQUE

---

## Env flags

```
PTT_OPS_DV_ENABLED=1
PTT_OPS_WEEKLY_SPAWN=1
PTT_OPS_AGENT_ENABLED=1
PTT_OPS_HUB_PILOT_DV=DV02,DV05,DV04,DV20
NEXT_PUBLIC_OPS_DV=1
```

---

## FE routes

| Route | Vai trò |
|-------|---------|
| `/crm/ops/dashboard` | AM / TL / Specialist / Executive tabs |
| `/crm/ops/alerts` | Alert center + manual scan |
| `/crm/ops/my-tasks` | Specialist pending checklist |
| Hub tab `ops-hub` | `OpsAlertsPanel` |

---

## Smoke

```bash
STAFF_TOKEN=... LIFECYCLE_ID=... bash scripts/smoke_ops_agent.sh
```

---

## Out of scope (INT-P3 MVP)

- L3 RAG chat (`POST /api/ops/ai/chat`)
- Email/Zalo notify
- Branded PDF export
