# SEO / AEO Enterprise

> **Module:** MOD-SEO  
> **App:** ops-web · portal-web · ptt-crm-api

## Tính năng staff (ops-web)

| Tính năng | Route |
|-----------|-------|
| SEO Hub | `/seo/hub` |
| Client workspace | `/seo/clients/[id]` |
| Research | `/seo/research` |
| Content pipeline | `/seo/content`, `/seo/content/[id]` |
| Technical SEO | `/seo/technical` |
| Strategy | `/seo/strategy` |
| Governance | `/seo/governance` |
| Gate A | `/seo/gate-a` |
| Reports | `/seo/reports` |
| AEO (Answer Engine) | `/seo/aeo` |
| Authority | `/seo/authority` |
| Ranks | `/seo/ranks` |
| Automations | `/seo/automations` |
| Freshness | `/seo/freshness` |
| Experiments | `/seo/experiments` (flag off mặc định) |
| BI | `/seo/bi` |
| CMS bridge | `/seo/cms` |

## Tính năng portal

| Tính năng | Route |
|-----------|-------|
| SEO dashboard | `/seo` |
| Content review | `/seo/content` |
| Reports | `/seo/reports` |
| Approve/reject content | Portal approval flow |

## API chính

```
/api/v1/seo/*
/api/v1/portal/seo/*
/api/v1/seo/cron
```

## Feature flags

```
PTT_SEO_ENABLED=1
PTT_SEO_AEO_ENABLED=1
PTT_SEO_EXPERIMENTS=0
PTT_SEO_CRON_ENABLED=1
NEXT_PUBLIC_SEO=1
NEXT_PUBLIC_SEO_AEO=1
```

## Cron jobs

- Rank tracking sync
- Freshness alerts
- Report generation schedules

## Tích hợp

- Ops DV pilot DV05 (SEO)
- Content Marketing OS bridge
- Portal content approval

## Tài liệu tham chiếu

- `docs/specs/modules/RNOSAI-BA-SEO-UseCases.md`
- `docs/seo/README.md`
