# CRM Core

> **Module:** MOD-CRM  
> **App:** ops-web · ptt-crm-api

## Tính năng

| Tính năng | Mô tả | Route ops-web |
|-----------|-------|---------------|
| Lead Management | CRUD lead, list theo vertical | `/crm/leads`, `/crm/b2b/leads`, `/crm/spa/leads`, `/crm/operational/leads` |
| Lead Detail | Hồ sơ lead, consult, contract, copilot | `/crm/leads/[id]` |
| Review Queue | Hàng chờ duyệt lead AI/manual | `/crm/leads/review-queue` |
| Lead Intake / BANT | Form khám phá có cấu trúc | `/crm/intake` |
| Pre-sales on Lead | Consult → contract trước lifecycle | Tab trên lead detail · `PTT_PRESALES_ON_LEAD` |
| Customers 360 | Khách hàng sau convert | `/crm/customers`, `/crm/customers/[id]` |
| Customer Timeline | Feed hoạt động thống nhất | API `/api/v1/timeline` |
| Sales Pipeline | Cơ hội, stage | `/crm/sales` |
| Proposals / Quote | Báo giá; Quote Builder Ops 3 gói | `/crm/proposals` |
| Orders | Đơn hàng | `/crm/orders` |
| Invoices | Hóa đơn | `/crm/invoices` |
| Finance / AR Aging | Công nợ, aging theo AM | `/crm/financials` |
| Forecast & Renewal | Revenue forecast, MAPE | `/crm/forecast` |
| Business Dashboard | Dashboard điều hành GDKD | `/crm/business-dashboard`, `/crm/gdkd-enterprise` |
| Customer Health | Health scoring | `/crm/health` |
| CSKH Board | Ticket board + SLA Excel export | `/crm/cskh-board` |
| Tickets / Cases | Quản lý ticket | `/crm/tickets` |
| Staff KPI | KPI cá nhân AM/SP | `/crm/staff-kpi`, `/crm/kpi` |
| Solution KPI | KPI team solution | `/crm/kpi/solution` |
| Solution Queue | Hàng chờ handoff solution | `/crm/solution/queue` |
| Staff Roster | Danh sách nhân viên | `/crm/staff`, `/crm/staff/[id]` |
| Catalog | Danh mục dịch vụ CRM | `/crm/catalog` |
| RE Projects | Dự án BĐS | `/crm/re-projects`, `/[id]` |
| Owner Weekly | Báo cáo tuần chủ sở hữu | `/crm/owner-weekly` |
| Marketing Plans | Kế hoạch marketing (legacy) | `/crm/marketing-plan`, `/[id]` |
| CRM Hub | Hub hợp đồng post-sign | `/crm/hub` |
| Automation | Workflow rule-based | `/crm/automation` |

## API chính

| Prefix | Nội dung |
|--------|----------|
| `/api/v1/leads` | Lead CRUD modern |
| `/api/v1/contracts` | Hợp đồng |
| `/api/crm/leads` | Legacy leads |
| `/api/crm/customers` | Khách hàng |
| `/api/crm/sales` | Pipeline |
| `/api/crm/proposals` | Báo giá + quote lines |
| `/api/crm/orders`, `/invoices` | Đơn hàng, HĐ |
| `/api/crm/finance` | Tài chính, aging |
| `/api/crm/kpi`, `/staff-kpi` | KPI |
| `/api/crm/intake` | Intake BANT |
| `/api/crm/tickets`, `/cskh-board` | CSKH |
| `/api/v1/automation-workflows` | Automation |

## Feature flags

```
PTT_PRESALES_ON_LEAD=1
PTT_CRM_LEADS_FUNNEL_PG=1
PTT_CRM_INTAKE_PG=1
PTT_CRM_CONTRACT_PG=1
PTT_CRM_KPI_PG=1
PTT_CRM_FINANCE_PG=1
PTT_FINANCE_GATE_STRICT=0
NEXT_PUBLIC_WIN_KPI_SOLUTION=1
NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=1
```

## Tài liệu tham chiếu

- `docs/specs/modules/RNOSAI-BA-CRM-UseCases.md`
- `docs/specs/2026-08-07-crm-enterprise-business-analysis.md`
- `docs/crm/README.md`
