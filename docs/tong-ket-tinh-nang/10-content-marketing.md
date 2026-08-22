# Content Marketing OS

> **Module:** MOD-CMKT  
> **Trạng thái:** Backend ~90%, FE ~65%, UAT formal chưa PASS

## Tính năng (tab `content-os` trong lifecycle)

| Tính năng | Mô tả |
|-----------|-------|
| Content Board | Ideas, kanban, calendar |
| AI Draft | Sinh nội dung theo brief/DV |
| Dual approval | Text + visual QA gate |
| Repurpose Wizard | Đa kênh từ 1 nguồn |
| SEO bridge | Đẩy content sang module SEO |
| Email bridge | Đẩy content sang Email |
| Media AI | Image/carousel (stub provider) |
| Portal summary | Tóm tắt + duyệt content client |

## Components ops-web

- `ContentOsBoard.tsx` — kanban
- `ContentOsCalendar.tsx` — lịch publish
- `ContentOsAiDraftPanel.tsx` — AI draft
- `ContentOsRepurposeWizard.tsx` — repurpose đa kênh
- `ContentOsMediaPanel.tsx` — media assets

## API chính

```
/api/crm/service-lifecycle/:id/content-marketing/*
/api/crm/service-lifecycle/:id/content-marketing/ideas
/api/crm/service-lifecycle/:id/content-marketing/items
/api/crm/service-lifecycle/:id/content-marketing/ai-draft
/api/crm/service-lifecycle/:id/content-marketing/repurpose
/api/v1/portal/service-lifecycle/:id/content-summary
```

## Feature flags

```
PTT_CONTENT_MARKETING_ENABLED=1
NEXT_PUBLIC_CONTENT_MARKETING=1
PTT_CONTENT_MARKETING_AI_ENABLED=1
PTT_CMKT_PORTAL_SUMMARY=1
NEXT_PUBLIC_CMKT_PORTAL_SUMMARY=1
```

## Tích hợp

- Ops DV pilot DV02 (Content)
- SEO content pipeline
- Email campaign content
- Portal approval workflow

## Tài liệu tham chiếu

- `docs/superpowers/specs/2026-08-09-content-marketing-implementation-status.md`
- `docs/specs/modules/RNOSAI-BA-CMKT-UseCases.md`
