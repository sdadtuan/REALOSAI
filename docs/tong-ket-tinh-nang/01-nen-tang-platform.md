# Nền tảng & Bảo mật

> **Module:** MOD-PLAT · MOD-AUTH · MOD-ADMIN  
> **App:** ops-web (admin) · ptt-crm-api

## Tính năng

| Tính năng | Mô tả | Route / API |
|-----------|-------|-------------|
| Staff Auth JWT | Login, refresh token | `/login`, `/login/callback`, `/login/mfa` · `POST /api/v1/staff/auth/*` |
| Keycloak SSO | SSO enterprise (WIN-4) | `/login/callback` · env `PTT_STAFF_KEYCLOAK_*` |
| RBAC ma trận | Section/action caps (`crm_board`, `crm_leads`, …) | `/admin/crm/permissions` |
| Permission Sets | Gói quyền theo template | `/admin/crm/permission-sets/[code]` |
| Permission Simulator | Xem trước menu/caps theo user | `/admin/crm/permissions/simulator` |
| Break-glass | Truy cập khẩn cấp có audit | API `/api/v1/staff/break-glass` |
| Org Chart | Phòng ban, team, chức vụ, user | `/admin/crm/org/*` |
| SSO Group mapping | Keycloak group → caps | `/admin/crm/sso/groups` |
| Client scope pilot | Giới hạn client theo NV | `STAFF_SCOPE_PILOT` |
| Policy / OPA | Policy engine hook | API `/api/v1/policy` |
| CRM Config | Pipeline, custom fields, lead lookups | `/admin/crm/pipeline`, `/custom-fields`, `/lead-lookups` |
| Global Search | Tìm kiếm cross-entity | API `/api/v1/search` |
| Webhooks | Meta/Zalo/Google/Email events | API `/api/v1/webhooks/*` |
| Health & Metrics | Liveness, observability | `/health`, `/api/v1/metrics` |
| Admin AI Console | Agents, runs, tools registry | `/admin/ai/agents`, `/runs`, `/tools` |

## Nest modules

`staff-auth`, `staff-permissions`, `staff-permission-sets`, `staff-org`, `staff-break-glass`, `staff-client-scope`, `staff-notifications`, `policy`, `crm-config`, `crm-search`, `webhooks`, `health`, `observability`, `metrics`, `workflows`, `temporal`, `ai-intelligence` (admin)

## Feature flags

```
STAFF_AUTH_MODE=nest|keycloak|dual
PTT_STAFF_KEYCLOAK_ISSUER=...
STAFF_SCOPE_PILOT=1
STAFF_POLICY_OPA=1
NEXT_PUBLIC_WIN_ORG_UI=1
NEXT_PUBLIC_WIN_PERMISSION_SETS=1
NEXT_PUBLIC_WIN_SIMULATOR=1
NEXT_PUBLIC_WIN_SSO=1
NEXT_PUBLIC_WIN_BREAK_GLASS=1
```

## Tài liệu tham chiếu

- `docs/specs/modules/RNOSAI-BA-PLAT-UseCases.md`
- `docs/specs/2026-08-06-rbac-enterprise-design.md`
- `docs/runbooks/keycloak-staff-auth.md`
