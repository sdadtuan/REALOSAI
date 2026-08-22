# Email Marketing

> **Module:** MOD-EM  
> **App:** ops-web · portal-web · ptt-crm-api

## Tính năng staff (ops-web)

| Tính năng | Route |
|-----------|-------|
| Email Hub | `/email/hub`, `/email` |
| Campaigns | `/email/campaigns`, `/[id]`, `/[id]/review` |
| Contacts | `/email/contacts` |
| Segments | `/email/segments` |
| Templates | `/email/templates/[id]` |
| Journeys (drip) | `/email/journeys/[id]` |
| Governance | `/email/governance` |
| Gate A | `/email/gate-a` |
| Deliverability | `/email/deliverability` |
| Reports | `/email/reports` |
| Suppression | `/email/suppression` |
| Consent | `/email/consent` |
| Client workspace | `/email/clients/[id]` |

## Public pages (không auth)

| Trang | Mục đích |
|-------|----------|
| Unsubscribe | Opt-out |
| Preferences | Cập nhật prefs |
| Confirm | Double opt-in |

## Tính năng portal

| Tính năng | Route |
|-----------|-------|
| Email dashboard | `/email` |
| Campaign approvals | `/email/approvals` |
| Campaign detail | `/email/campaigns/[id]` |

## API chính

```
/api/v1/email/*
/api/v1/portal/email/*
/api/v1/email/public/*
/api/v1/webhooks/email
```

## Feature flags

```
PTT_EMAIL_ENABLED=1
PTT_EMAIL_GATE_A=1
PTT_EMAIL_JOURNEYS=1
PTT_EMAIL_DELIVERABILITY=1
NEXT_PUBLIC_EMAIL=1
NEXT_PUBLIC_EMAIL_APPROVALS=1
```

## Tích hợp

- Ops DV pilot DV20 (Email)
- Content Marketing bridge
- Portal approval (role approver)
- Webhook ESP events

## Tài liệu tham chiếu

- `docs/specs/modules/RNOSAI-BA-EM-UseCases.md`
- `docs/email/README.md`
