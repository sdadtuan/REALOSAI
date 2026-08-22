# Client Portal

> **Module:** MOD-PORTAL  
> **App:** portal-web · ptt-crm-api  
> **URL:** `https://portal.pttads.vn`

## Tính năng theo route

| Route | Tính năng |
|-------|-----------|
| `/dashboard` | KPI đa kênh + card MKT-AI, Content, Ops DV |
| `/creatives` | Duyệt creative (approve/reject) |
| `/notifications` | Thông báo in-app + push |
| `/service-delivery` | Tiến độ triển khai DV + KPI tháng (INT-P4) |
| `/meta` | KPI Meta Ads |
| `/google` | KPI Google Ads |
| `/zalo` | KPI Zalo Ads |
| `/seo` | SEO dashboard |
| `/seo/content` | Duyệt content SEO |
| `/seo/reports` | Báo cáo SEO |
| `/email` | Email dashboard |
| `/email/approvals` | Duyệt campaign email |
| `/email/campaigns/[id]` | Chi tiết campaign |
| `/settings` | Tài khoản, branding, push prefs |
| `/login` | Auth portal JWT |
| `/forgot-password`, `/reset-password` | Reset mật khẩu |
| `/privacy` | Privacy / GDPR |

## Auth

- Portal JWT (email/password)
- Keycloak SSO (optional, WIN-4)
- Role: viewer, approver, admin

## API prefix

```
/api/v1/portal/auth/*
/api/v1/portal/meta/*
/api/v1/portal/google/*
/api/v1/portal/zalo/*
/api/v1/portal/seo/*
/api/v1/portal/email/*
/api/v1/portal/ai/*
/api/v1/portal/ops/*
/api/v1/portal/push/*
/api/v1/portal/service-lifecycle/*
```

## Feature flags

```
PTT_PORTAL_ENABLED=1
PTT_OPS_PORTAL_SUMMARY=1
PTT_CMKT_PORTAL_SUMMARY=1
PTT_MKT_AI_PORTAL_SUMMARY=1
NEXT_PUBLIC_OPS_PORTAL_SUMMARY=1
NEXT_PUBLIC_CMKT_PORTAL_SUMMARY=1
NEXT_PUBLIC_MKT_AI_PORTAL_SUMMARY=1
NEXT_PUBLIC_PWA_ENABLED=1
```

## Closed-loop approvals

| Luồng | Staff side | Portal side |
|-------|------------|-------------|
| Creative | `/crm/creatives` | `/creatives` |
| SEO content | `/seo/content` | `/seo/content` |
| Email campaign | `/email/campaigns` | `/email/approvals` |

## Tài liệu tham chiếu

- `docs/specs/modules/RNOSAI-BA-PORTAL-UseCases.md`
- `docs/handover/README.md`
