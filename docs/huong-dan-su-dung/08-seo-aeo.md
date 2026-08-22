# Hướng dẫn — SEO / AEO Enterprise

> **Module:** MOD-SEO  
> **Đối tượng:** Head SEO, Strategist, Writer, Technical SEO, Client Approver  
> **URL staff:** https://rs.pttads.vn/seo/* · **Portal:** https://portal.pttads.vn/seo*

> **Tài liệu chuyên sâu:** [`docs/huong-dan-seo-aeo-ops.md`](../huong-dan-seo-aeo-ops.md)

---

## 1. Giới thiệu

SEO/AEO Enterprise quản lý **organic search end-to-end**: research, content pipeline, technical audit, governance, AEO, reports, portal client.

---

## 2. Luồng hàng ngày Head SEO (15–20 phút)

1. `/seo/hub` — GSC/GA4 sync OK? Client health đỏ/vàng?
2. Drill client vàng/đỏ → `/seo/clients/[id]`
3. `/seo/technical` — critical issues mới
4. `/seo/content` — card **overdue**
5. `/seo/automations` — ack alerts chưa xử lý

---

## 3. SEO Hub

**Route:** `/seo/hub`

1. Portfolio tất cả client SEO
2. KPI: clicks, impressions, avg position, content velocity
3. Filter tier / AM / health status
4. Click client → workspace

---

## 4. Onboard client SEO mới

1. `/seo/clients/[id]` tab **Settings** — domain, tier, approvers portal
2. `/seo/technical` — **OAuth GSC** + **OAuth GA4**
3. `/seo/research` — import keywords (CSV hoặc manual)
4. Hub KPI hiển thị **T+1** sau sync cron
5. Portal `/seo` visible cho client

---

## 5. Content pipeline

**Route:** `/seo/content`, `/seo/content/[id]`

### Writer

1. Mở card assigned — stage **Draft**
2. Viết/sửa nội dung trong editor
3. Điền metadata: title, meta desc, slug, target keyword
4. **Submit review** → stage **In Review**

### Reviewer / Approver nội bộ

1. Queue sort SLA
2. Approve internal → **Approved internal**
3. Reject → comment bắt buộc

### Client approval (portal)

1. Client mở `/seo/content` trên portal
2. Preview → Approve/Reject + comment
3. Staff publish sau approve

### Publish

1. Stage **Ready to publish**
2. Bấm **Publish** — webhook CMS (nếu bật) hoặc manual
3. Governance block nếu thiếu metadata (`PTT_SEO_GOVERNANCE_ENABLED=1`)

**13 stage workflow** — xem card stage trên kanban.

---

## 6. Technical SEO

**Route:** `/seo/technical`

1. Site audit crawl — issues critical/warning
2. Assign fix → track status
3. GSC coverage, indexing issues
4. Verify fix → re-crawl

---

## 7. Research & Strategy

| Route | Mục đích |
|-------|----------|
| `/seo/research` | Keyword research, clustering |
| `/seo/strategy` | Content plan, pillar/cluster |
| `/seo/authority` | Link building tracker |
| `/seo/ranks` | Rank tracker positions |

---

## 8. AEO (Answer Engine Optimization)

**Route:** `/seo/aeo`

1. Scan AI answer coverage (SGE, Perplexity, …)
2. Gap analysis vs competitors
3. Action items → content pipeline

---

## 9. Governance & Gate A

| Route | Mục đích |
|-------|----------|
| `/seo/governance` | Rule publish (metadata, word count, …) |
| `/seo/gate-a` | Gate approval trước go-live client mới |

---

## 10. Reports & BI

| Route | Mục đích |
|-------|----------|
| `/seo/reports` | PDF export báo cáo tháng |
| `/seo/bi` | ClickHouse BI export |
| `/seo/freshness` | Content cần refresh |
| `/seo/automations` | Alert tự động |
| `/seo/experiments` | A/B test (flag off mặc định) |

---

## 11. Portal SEO (khách hàng)

| Route | Nội dung |
|-------|----------|
| `/seo` | Dashboard organic KPI |
| `/seo/content` | Duyệt bài SEO |
| `/seo/reports` | Tải báo cáo PDF |

Chi tiết: [14-client-portal.md](./14-client-portal.md)

---

## 12. Lỗi thường gặp

| Vấn đề | Xử lý |
|--------|-------|
| Publish blocked | Governance — điền đủ metadata |
| GSC sync fail | Re-OAuth technical tab |
| Portal không thấy content | `PTT_PORTAL_SEO_ENABLED` + approver assign |
| Overdue nhiều | Freshness queue + tăng capacity writer |

**Checklist in A4:** [`docs/forms/seo-aeo-ops-checklist-a4.html`](../forms/seo-aeo-ops-checklist-a4.html)

---

## 13. Tài liệu tham chiếu

- [`huong-dan-seo-aeo-ops.md`](../huong-dan-seo-aeo-ops.md)
- Actions: [`docs/use-cases/actions/04-SEO-ACTIONS.md`](../use-cases/actions/04-SEO-ACTIONS.md)
