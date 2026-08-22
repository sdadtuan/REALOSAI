# Marketing AI Planner

> **Module:** MOD-MKTP  
> **Trạng thái:** Partial staging

## Tính năng (tab `ai-planner` trong lifecycle)

| Tính năng | Mô tả |
|-----------|-------|
| AI Planner wizard | Strategy, budget sim, KPI tree, calendar |
| Multi-agent pipeline | Async orchestration (strategy → budget → KPI) |
| Plan approval | Duyệt kế hoạch trước apply |
| TMMT apply | Apply kế hoạch vào marketing plan |
| KPI closed-loop | CPL/ROAS drift alerts |
| Optimize loop | Gợi ý điều chỉnh theo KPI thực tế |
| Playbooks admin | Registry playbook MKT-AI |
| Portal plan summary | Tóm tắt kế hoạch cho khách |
| CPL Digest (staff) | Manager coach digest |

## API chính

```
/api/crm/service-lifecycle/:id/ai-planner/*
/api/crm/service-lifecycle/:id/ai-planner/strategy
/api/crm/service-lifecycle/:id/ai-planner/budget
/api/crm/service-lifecycle/:id/ai-planner/kpi-tree
/api/crm/service-lifecycle/:id/ai-planner/apply
/api/v1/portal/service-lifecycle/:id/plan-summary
```

## Feature flags

```
PTT_MKT_AI_PLANNER_ENABLED=1
NEXT_PUBLIC_MKT_AI_PLANNER=1
PTT_MKT_AI_PORTAL_SUMMARY=1
PTT_MKT_AI_KPI_ALERT_ENABLED=1
NEXT_PUBLIC_MKT_AI_PORTAL_SUMMARY=1
```

## Tích hợp

- TMMT tab (marketing plan)
- Ops KPI records
- Meta/Zalo/Google performance
- AI Revenue OS orchestrator

## Tài liệu tham chiếu

- `docs/specs/modules/RNOSAI-BA-MKTP-UseCases.md`
- `docs/superpowers/specs/` (MKT-AI plans)
