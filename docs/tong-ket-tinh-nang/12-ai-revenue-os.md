# AI Revenue OS

> **Module:** MOD-AI  
> **App:** ops-web · portal-web · ptt-crm-api

## Tính năng staff (ops-web)

| Tính năng | Mô tả | Route |
|-----------|-------|-------|
| AI Insights | Lead scoring, anomaly | `/crm/ai/insights` |
| NL Analytics Query | Hỏi đáp ngôn ngữ tự nhiên | `/crm/ai/query` |
| Manager Coach | Coaching digest cho manager | `/crm/ai/coach` |
| Automation Workflows | Rule + AI automation | `/crm/automation` |
| Playbook RAG | Playbook retrieval-augmented | `/crm/playbooks` |
| Lead Copilot | Copilot trên lead detail | Tab lead · `PTT_AI_COPILOT` |

## Agents backend (orchestrator)

| Agent | Mục đích |
|-------|----------|
| Renewal Agent | Dự báo gia hạn |
| Churn Agent | Cảnh báo rời bỏ |
| Upsell Agent | Gợi ý cross-sell |
| Forecast Agent | Revenue forecast nâng cao |
| Lead Scoring | Điểm lead AI |

## Tính năng portal

| Tính năng | API |
|-----------|-----|
| AI Reports summary | `/api/v1/portal/ai` |

## API chính

```
/api/v1/ai/*
/api/v1/ai/intelligence
/api/v1/ai/playbooks
/api/v1/ai/orchestrator
/api/v1/automation-workflows
/api/v1/portal/ai/*
```

## Admin console

| Route | Mục đích |
|-------|----------|
| `/admin/ai/agents` | Registry agents |
| `/admin/ai/runs` | Run history |
| `/admin/ai/tools` | Tool definitions |

## Feature flags

```
PTT_AI_INTELLIGENCE_ENABLED=1
PTT_AI_ORCHESTRATOR_ENABLED=1
PTT_AI_PLAYBOOKS_ENABLED=1
NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=1
NEXT_PUBLIC_AI_INSIGHTS=1
NEXT_PUBLIC_AI_QUERY=1
```

## Tài liệu tham chiếu

- `docs/specs/modules/RNOSAI-BA-AI-UseCases.md`
- `docs/ai/README.md`
