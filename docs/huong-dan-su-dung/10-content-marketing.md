# Hướng dẫn — Content Marketing OS (tóm tắt)

> **Module:** MOD-CMKT  
> **Đối tượng:** SP Content, Lead SP, QA, AM  
> **Route chính:** `/crm/service-delivery/[id]?tab=content-os`  
> **Flags:** `PTT_CONTENT_MARKETING_ENABLED=1`, `NEXT_PUBLIC_CONTENT_MARKETING=1`  
> **Bản đầy đủ (mọi kênh, ảnh, video, thiết lập môi trường):** [`18-content-marketing-os.md`](./18-content-marketing-os.md)

---

## 1. Giới thiệu

Content OS nằm **trong lifecycle detail** — quản lý idea → draft AI → review → calendar → publish → repurpose đa kênh. **Human publish** — AI chỉ draft (BR-AI-01).

**Điều kiện:** Lifecycle stage ≥ Deliver (thường); cap `crm_content.view` / `crm_content.edit`.

---

## 2. Mở Content Board

1. Mở `/crm/service-delivery/[id]`
2. Click tab **Content Board** (content-os)
3. Banner hiển thị trạng thái **snapshot Planner** (sealed / chưa import)
4. Sub-nav: **Overview**, **Ideas**, **Board**, **Calendar**

Tab ẩn nếu flag tắt hoặc slug không trong allowlist.

---

## 3. Import từ AI Planner

Sau khi SP **Apply TMMT** trên tab AI Planner:

1. Trên Content Board, banner **Import từ Planner**
2. Bấm **Import** — merge pillars/ideas vào idea bank
3. Toast xác nhận số ideas imported
4. Review ideas trên tab **Ideas**

---

## 4. Idea bank → Content item

### 4.1. Tạo item từ idea

1. Tab **Ideas** — chọn idea
2. Bấm **Convert to item**
3. Chọn **channel** (Facebook, Website, …) + **format** (social_post, blog, carousel, …)
4. Drawer mở — item ở status **draft**

### 4.2. AI Draft

1. Trong drawer tab **Body**
2. Bấm **Generate draft** — chọn tone, độ dài
3. Job chạy async → body text hiển thị
4. (Optional) **Generate variants** — 3 hook khác nhau
5. Chọn variant → sửa tay nếu cần → **Save version**

### 4.3. Submit review

1. Tab **Workflow** trong drawer
2. Bấm **Submit review** → status **in_review**
3. QA/Lead mở **Review queue** (sort SLA)

---

## 5. Duyệt nội dung (QA / Lead)

1. Review queue — mở item
2. Đọc body + metadata
3. **Approve internal** → `approved_internal`  
   hoặc **Reject** → comment **≥ 10 ký tự** (bắt buộc)
4. Item visual (carousel): duyệt text trước → Media AI sau (P1)

**Không publish** khi chưa `approved_internal` (BR-CMKT-01).

---

## 6. Calendar & lịch publish

**Tab Calendar:**

1. Kéo item **approved** vào ngày trong tuần
2. Status → **scheduled**
3. Ngày đến → SP thực hiện publish thủ công:
   - Social: **Copy caption** → đăng FB/Zalo/OA
   - Blog: publish CMS hoặc **→ SEO pipeline**
4. Trên item bấm **Mark published** — URL optional

---

## 7. Repurpose Wizard

**Component:** Repurpose Wizard (tab hoặc action trên item nguồn)

1. Chọn **1 bài nguồn** (blog approved)
2. Bấm **Repurpose**
3. Chọn target channels (FB post, Zalo, email snippet, …)
4. AI sinh draft từng kênh
5. Review từng item con → workflow riêng

Dùng khi tái sử dụng 1 pillar thành đa kênh.

---

## 8. Bridge SEO / Email

| Bridge | Thao tác |
|--------|----------|
| **→ SEO** | Item blog approved → chip **Push SEO** → xuất hiện `/seo/content` |
| **→ Email** | Snippet → Email template/campaign draft |

(P1 — kiểm tra flag staging)

---

## 9. Media AI (P1)

1. Item carousel — sau text approved
2. Tab **Media AI** → **Generate slides**
3. Visual QA score hiển thị
4. **Submit visual review** → Lead approve visual
5. **Publish** — watermark removed sau approve

---

## 10. Portal summary (khách)

Card trên portal `/dashboard` — tóm tắt content pipeline (counts, pending approval client nếu bật `PTT_CMKT_PORTAL_SUMMARY`).

---

## 11. Walkthrough UAT P0 (60 phút)

| # | Việc |
|---|------|
| 1 | Import Planner |
| 2 | Convert 1 idea FB + 1 blog |
| 3 | AI draft + variants |
| 4 | Submit + QA approve |
| 5 | Calendar schedule 2 items |
| 6 | Mark published FB + bridge blog SEO |

Chi tiết từng bước: [`docs/use-cases/actions/11-CMKT-ACTIONS.md`](../use-cases/actions/11-CMKT-ACTIONS.md)

---

## 12. Lỗi thường gặp

| Vấn đề | Xử lý |
|--------|-------|
| Tab ẩn | Flag + cap + slug allowlist |
| Generate fail | OPENAI key; xem audit `ai_agent_runs` |
| Reject 400 | Comment quá ngắn |
| Publish blocked | Chưa approved_internal / visual |

---

## 13. Tài liệu tham chiếu

- Actions: [`docs/use-cases/actions/11-CMKT-ACTIONS.md`](../use-cases/actions/11-CMKT-ACTIONS.md)
- UX spec: [`docs/specs/2026-08-09-content-marketing-integration-spec.md`](../specs/2026-08-09-content-marketing-integration-spec.md)
