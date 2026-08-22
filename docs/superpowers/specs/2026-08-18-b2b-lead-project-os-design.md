# Design: Lead B2B — chủ quản PTT, dự án, kênh, phân công AI, SLA gọi

**Ngày:** 2026-08-18  
**Trạng thái:** Chờ duyệt  
**Module:** B2B Lead Project OS  
**Quyết định sản phẩm:** Mọi Lead B2B thuộc **công ty vận hành PTT** và **bắt buộc một dự án PTT**. Nguồn (nhiều Page/Form, OA, Website, API) thuộc dự án. Nhân viên chỉ thấy lead theo rule visibility. Không dùng `crm_re_projects` (BĐS).

---

## 1. Vấn đề

Hiện tại Lead B2B (`b2b_prospect`) **không có chủ quản công ty**. Hệ thống nhận diện B2B bằng cách *không* gắn `agency_client_id` (khác CSKH spa). Nguồn FB/Zalo/Web/API cấu hình toàn cục. `owner_id` là nhân viên, không gắn dự án PTT.

Hệ quả: không cô lập pipeline theo dự án; NV thấy/nhận lead ngoài phạm vi; không siết «NV PTT + nhận lead + trong dự án».

Đã có và **tái sử dụng:** chấm điểm AI (0–100, hot/warm/cold), auto-assign hybrid/RR/skill (Flask đủ bộ; Nest ingest chủ yếu RR), `lead-route` / `lead-route-ml` (mới gợi ý), SLA CSKH spa (cảnh báo, không tái phân B2B), PWA list lead mobile, cap `crm_gdkd.view_all_leads`.

**Chưa có:** chủ quản PTT, module dự án B2B, kênh 1:N, visibility 3 cổng, gán theo analytics lúc ingest, SLA 5 phút → chuyển NV rảnh, softphone realtime, chia hoa hồng khi chuyển, AI tự gọi, báo động Lead về.

---

## 2. Quyết định đã khóa

| # | Quyết định | Chọn |
|---|------------|------|
| Q1 | Phạm vi chủ quản | **A** — một công ty vận hành PTT |
| Q2 | Kiến trúc | **Cách 1** — module dự án B2B + 1 dòng `crm_operating_company` |
| Q3 | «Dự án» | **B** — dự án B2B chung, **không** BĐS |
| Q4 | Visibility ngoại lệ | **1** — Director / `crm_gdkd.view_all_leads` thấy mọi dự án |
| Q5 | Visibility nâng | **A+B+C** — owner luôn thấy lead mình; rời dự án vẫn thấy lead đang owner; cùng filter, ngoài scope = 404 |
| Q6 | Kênh / dự án | Nhiều Page (mỗi Page nhiều Form) + nhiều OA + nhiều Website + nhiều API |
| Q7 | AI tự gọi | **A** — chỉ khi NV chưa gọi tới mốc cảnh báo |
| Q8 | Mobile + báo động | PWA staff + `crm_b2b_lead_alerts` |

---

## 3. Kiến trúc

Ba lớp tách biệt:

1. **Chủ quản** — singleton PTT (`crm_operating_company`). Không CRUD đa công ty trên UI dự án.
2. **Dự án + kênh + pool NV** — `/crm/b2b-projects`. Tách hoàn toàn `crm_re_projects`.
3. **Lead B2B** — bắt buộc `owner_company_id` + `b2b_project_id`. Không ghi `agency_client_id` (tránh `resolveLeadFlowKind` → spa).

```
Kênh (Page/Form · OA · Website · API · tay)
  → map ID active → đúng 1 dự án PTT
  → create_lead (owner_company_id, b2b_project_id, source)
  → dedup trong dự án
  → AI analytics snapshot → route (pool dự án) hoặc Hybrid
  → alert Lead về
  → SLA first-touch → (cảnh báo) → AI gọi nếu NV chưa gọi → hết hạn tái phân
  → list / mobile theo visibility
```

Chấm điểm và strategy assign cũ **giữ**; candidate set = pool dự án `assign_enabled`.

---

## 4. Mô hình dữ liệu

### 4.1. `crm_operating_company`

Một dòng seed `code=PTT`. Sửa tên/MST = platform admin. Lead B2B `owner_company_id` NOT NULL → FK đây.

### 4.2. `crm_b2b_projects`

| Cột | Ý nghĩa |
|-----|---------|
| `id` | UUID PK |
| `owner_company_id` | FK PTT |
| `code` | Slug unique (webhook path) |
| `name` | Tên |
| `status` | `draft \| active \| paused \| archived` |
| `business_hours_json` | Ngoài giờ: không đếm SLA, không chuông, không AI gọi |
| `sla_json` | Ngưỡng cảnh báo/chuyển theo band, `max_hops=2` |
| `commission_json` | `{ first_touch_pct: 30, closer_pct: 70 }` |
| `ai_call_enabled` | Bật AI gọi (rule A) |
| `manual_ingest_enabled` | Cho nhập tay/CSV |

### 4.3. Kênh

**Facebook**

- `crm_b2b_project_pages`: `project_id`, `page_id`, tên, token vault ref, `active`
- `crm_b2b_project_page_forms`: `page_id` FK, `form_id`, tên, `active`

**Zalo / Website / API** — `crm_b2b_project_channel_accounts`:

| `channel_type` | Khóa |
|----------------|------|
| `zalo` | `oa_id`, webhook slug |
| `webform` | form slug / site key |
| `api` | API key **hash** + nhãn (không lưu key thô) |

**Unique khi active (toàn hệ thống):** `page_id`, `form_id`, `oa_id`, webform slug, API key hash — mỗi khóa thuộc đúng **một** dự án active.

Webhook: `POST …/webhooks/facebook/{project_slug}`, `…/zalo/{project_slug}`. Meta gửi `page_id` + `form_id`. Form chưa map → không tạo lead, hàng unmatched.

### 4.4. `crm_b2b_project_staff`

`(project_id, staff_id)` PK. `assign_enabled` (Nhận lead). `sales_level` S/A/B/C. Một NV nhiều dự án được. Chỉ NV PTT `crm_staff.active`.

### 4.5. Cột trên `crm_leads` (B2B)

- `owner_company_id` NOT NULL  
- `b2b_project_id` NOT NULL  
- `assign_strategy`, `assign_reason`, `assign_confidence`  
- Không set `agency_client_id`

Lead cũ: backfill dự án `PTT-LEGACY` (`paused`) + chủ quản PTT.

### 4.6. Bảng phụ

| Bảng | Việc |
|------|------|
| `crm_b2b_lead_hops` | Lịch sử gán / SLA reassign / AI |
| `crm_b2b_lead_commission_split` | First-touch vs closer % |
| `crm_b2b_lead_alerts` | Báo động Lead về |
| `crm_b2b_call_sessions` | Trạng thái tổng đài realtime |
| `crm_b2b_unmatched_ingress` | Form/OA/page chưa map |

---

## 5. Visibility

Ba cổng **đồng thời** (trừ lãnh đạo):

1. NV PTT active  
2. Có trong `crm_b2b_project_staff` của dự án lead  
3. `assign_enabled = true`

**Ngoại lệ:** staff có flag Director trên roster **hoặc** cap `crm_gdkd.view_all_leads`.

**Gói A+B+C**

- **A:** `owner_id = tôi` → luôn thấy lead đó, kể cả tắt Nhận lead.  
- **B:** Rời dự án → mất inbox đồng đội + chưa gán; vẫn thấy lead mình còn owner.  
- **C:** List, chi tiết, export, intake, thông báo, AI search, review-queue, alert: cùng filter. Ngoài phạm vi → **404**, không leak tên.

`assign_enabled` = được nhận lead **mới** + thấy lead **chưa gán** của dự án.

CSKH spa (`agency_client_id`) không đi rule này.

---

## 6. Ingest

Thiếu `b2b_project_id` → **không** tạo lead B2B.

| Nguồn | Map |
|-------|-----|
| Facebook | `form_id` → Form → Page → dự án; form lạ → unmatched, không tạo |
| Zalo | `oa_id` (+ slug) |
| Website | form slug / site key |
| API | Key → dự án; `project_code` trong body **không** được khác dự án của key |
| Tay / CSV | Bắt buộc chọn dự án; NV phải đang nhận lead trên dự án (`view_all` chọn mọi dự án) |

Dedup **trong dự án** (cùng SĐT hai dự án = hai lead). Page/OA không thuộc slug webhook → HTTP 200, không tạo, ghi unmatched.

Hết pool → `owner_id` null, inbox chưa gán (receiver + GDKD).

---

## 7. Phân công và chăm sóc

### 7.1. First assign — AI analytics rồi Hybrid

```
Lead đã có dự án
  → snapshot analytics (timeout 800ms)
  → lọc pool (PTT + nhận lead + cap ngày + không nghỉ + không in_call)
  → lead-route-ml trên pool dự án
  → confidence ≥ 0.75 → tự gán
  → thấp / timeout / lỗi → Hybrid (skill + ít first-touch + RR)
```

Snapshot: điểm + band (`lead-score`), nguồn/campaign, sản phẩm/khu vực, intent/ngành nếu có field, tải mở + cấp NV.

Ghi `assign_strategy=ai_analytics|hybrid|…`, `assign_reason`, `confidence`.

Không v1: LLM chặn ingest; route ngoài pool dự án.

### 7.2. «Rảnh»

Trong pool · cap ngày còn · ít lead `moi` chưa call · không `in_call` · không phải owner vừa bị hốt · (nếu có chấm công) punch-in · chưa nhận lead mới trong 2 phút.

### 7.3. SLA first-touch (mặc định, ghi đè / dự án)

| Band | Cảnh báo | Tự chuyển | AI gọi (nếu NV chưa gọi) |
|------|----------|-----------|---------------------------|
| Hot ≥70 | 3 phút | 5 phút | Tại mốc 3 phút |
| Warm | 10 phút | 15 phút | Tại mốc 10 phút |
| Cold | 25 phút | 30 phút | Tại mốc 25 phút |

Đồng hồ chỉ chạy trong `business_hours_json`.

**Tái phân:** đổi owner → NV rảnh khác, ưu tiên cùng nhóm AI; audit hop; notify cả hai; owner cũ mất xem (trừ A/B + GDKD). Tối đa **2 hop** rồi hàng GDKD. Đã có call/message (kể cả không nghe) hoặc `answered` → **không** auto-reassign.

### 7.4. Nghe máy realtime

Một CPaaS (Stringee / Tel4VN / Twilio Voice — chọn lúc implement). Softphone `/crm/leads/:id` hoặc click-to-call.

Events: `queued → ringing → answered → no_answer → ended`. `in_call` = không rảnh. `answered` = first-touch.

V1 **không** barge / GDKD nghe lén.

### 7.5. Hoa hồng khi chuyển

`crm_b2b_lead_commission_split`: first-touch **30%**, closer **70%** (cấu hình / dự án). Hưởng khi HĐ `Active` từ lead. Hop trung gian 0% v1. Đổi owner tay: bắt buộc chọn có/không chia. Cơ sở = doanh thu HĐ.

### 7.6. AI tự gọi (Q7 = A)

Chỉ khi NV **chưa** bấm gọi tới mốc cảnh báo. Không gọi lúc lead vừa vào.

- Một cuộc AI / lead trước hop. Script theo analytics.  
- `no_answer` → tiếp tục đồng hồ chuyển NV.  
- `answered` → chuyển máy NV rảnh (nếu tổng đài hỗ trợ) hoặc task «KH đang nghe» + dừng hop.  
- Ngoài giờ / DNC / KH từ chối: không gọi.  
- Lỗi AI → SLA người, không chặn ingest.

---

## 8. UI

### 8.1. Desktop — `/crm/b2b-projects`

Menu CRM → **Dự án PTT**. Cap `crm_b2b_projects.view` / `.manage`. Không trộn `/crm/re-projects`.

Danh sách: mã, tên, status, số Page/OA/Website/API, số NV nhận lead, lead mở.

Tab chi tiết: Tổng quan (chủ quản PTT chỉ đọc, giờ làm) · Kênh · Nhân viên · SLA & gọi · Hoa hồng.

`/crm/leads` B2B: cột Dự án, điểm AI, owner, SLA, `in_call`. Tạo/import bắt buộc dự án. Chi tiết: softphone, lý do gán, hop + split %.

GDKD: mọi dự án, quá 2 hop, unmatched kênh.

### 8.2. Mobile — PWA staff ops-web

Cài từ URL CRM. Cùng visibility. Không cấu hình kênh/API key trên điện thoại.

| Màn | Việc |
|-----|------|
| Inbox | Lead dự án + chưa gán; chip Hot/SLA |
| Chi tiết | CTA **Gọi**; ghi chú; lý do AI; SLA |
| Dự án | Dự án đang tham gia (đọc) |
| Cài đặt | Push + âm báo Hot |

Deep link: `/crm/leads/{id}`, `pttads://leads/{id}`.

### 8.3. Báo động Lead về

Bảng `crm_b2b_lead_alerts`. Không dùng push portal khách.

| Mức | Khi | Kênh |
|-----|-----|------|
| Khẩn (Hot) | Hot gán cho tôi / AI chuyển máy | Push + in-app + chuông/rung ≤30s hoặc đến khi mở lead |
| Thường | Warm/cold gán cho tôi | Push + badge |
| Inbox dự án | Chưa gán — NV nhận lead trên dự án | Push, không chuông |
| Điều phối | SLA sắp chuyển, AI vừa gọi, quá 2 hop | Push NV hiện tại + GDKD |

Ngoài scope → không báo. Tắt nhận lead → không báo lead mới (vẫn báo lead đang owner). Ngoài giờ → không chuông, chỉ badge. Bấm **Gọi** trong cửa sổ SLA = xử lý alert.

---

## 9. API (chính)

| Method | Path | Việc |
|--------|------|------|
| GET/POST | `/api/v1/b2b-projects` | List / tạo dự án |
| GET/PATCH | `/api/v1/b2b-projects/:id` | Chi tiết |
| PUT | `/api/v1/b2b-projects/:id/pages` | Page + Form |
| PUT | `/api/v1/b2b-projects/:id/channels` | OA / web / API |
| PUT | `/api/v1/b2b-projects/:id/staff` | Pool + `assign_enabled` |
| GET | `/api/v1/leads` | Filter `flow=b2b` + visibility C |
| POST | `/api/v1/leads` | Bắt buộc `b2b_project_id` khi B2B |
| POST | `/api/v1/webhooks/facebook/:projectSlug` | Ingest FB |
| POST | `/api/v1/webhooks/zalo/:projectSlug` | Ingest Zalo |
| GET | `/api/v1/b2b-lead-alerts` | Inbox báo động |
| POST | `/api/v1/leads/:id/calls` | Softphone session |

Mọi GET lead/alert: 404 nếu fail visibility.

---

## 10. Xử lý lỗi

| Tình huống | Hành vi |
|------------|---------|
| Kênh chưa map | 200 webhook, `unmatched_ingress`, không lead |
| API key sai dự án | 403 `project_mismatch` |
| Hết pool | Lead tạo, `owner_id` null, alert inbox |
| Analytics >800ms | Hybrid, `assign_strategy=hybrid_timeout` |
| CPaaS down | `tel:` fallback; SLA người; không AI gọi |
| AI gọi fail | Log, tiếp tục SLA hop |
| Trùng `form_id` active | 400 lúc lưu kênh |
| Lead B2B thiếu project | 400 `b2b_project_required` |

---

## 11. Kiểm thử

| ID | Case | Kết quả |
|----|------|---------|
| B2B-01 | Tạo lead B2B không `b2b_project_id` | 400 |
| B2B-02 | NV ngoài pool GET lead dự án | 404, JSON không tên KH |
| B2B-03 | GDKD `view_all_leads` list | Thấy mọi dự án PTT |
| B2B-04 | Owner tắt nhận lead | Vẫn GET được lead mình |
| B2B-05 | Rời dự án | Mất lead đồng đội; còn lead đang owner |
| B2B-06 | Cùng SĐT 2 dự án | 2 lead, không dedup chéo |
| B2B-07 | Form chưa map | 0 lead, unmatched |
| B2B-08 | Route confidence ≥0.75 | `assign_strategy=ai_analytics` |
| B2B-09 | Timeout analytics | Hybrid |
| B2B-10 | Hot 5 phút không call | Hop owner mới trong pool |
| B2B-11 | `answered` trước 5 phút | Không hop |
| B2B-12 | Hop lần 3 | Hàng GDKD, không gán vòng |
| B2B-13 | AI gọi trước mốc cảnh báo | Không gọi |
| B2B-14 | AI gọi tại mốc, NV chưa gọi | 1 session AI |
| B2B-15 | Reassign SLA | Split 30/70 ghi trên hop |
| B2B-16 | Hot gán cho NV | Alert khẩn + push (mock) |
| B2B-17 | NV không trong scope | 0 alert |
| B2B-18 | Export ngoài dự án | Không có hàng ngoài filter |

---

## 12. Ngoài phạm vi v1

- Đa công ty vận hành; gộp BĐS `crm_re_projects`
- Nhiều dự án share một Form/OA/Page
- Barge / nghe lén; SMS/Zalo báo NV; báo toàn công ty
- Role manager-trong-dự án (xem hết / sales chỉ lead mình)
- LLM đọc form trước khi tạo lead
- Chia hoa hồng hop trung gian; cấu hình kênh trên mobile

---

## 13. Thứ tự ship gợi ý

1. DDL + chủ quản + dự án + kênh + staff + cột lead + visibility + backfill `PTT-LEGACY`  
2. Ingest map kênh + UI desktop dự án / lead  
3. AI route lúc ingest + Hybrid fallback  
4. SLA hop + hoa hồng  
5. CPaaS + AI gọi (A)  
6. Alert + PWA mobile  

Flag: `PTT_B2B_PROJECT_OS=1`. Tắt flag: ingest/list giữ hành vi cũ (không bắt buộc project).

---

## 14. Tài liệu liên quan

- [huong-dan-day-du-lead-den-cham-soc-khach-hang.md](../../crm/huong-dan-day-du-lead-den-cham-soc-khach-hang.md)  
- [huong-dan-nguon-lead-va-setup.md](../../crm/huong-dan-nguon-lead-va-setup.md)  
- `lead-flow-kind.util.ts`, `lead-status-gate.util.ts`, `lead-score.engine.ts`, `lead-route-ml.engine.ts`  
- [15-mobile.md](../../huong-dan-su-dung/15-mobile.md) · mobile strategy M1 staff lead care  

---

*Duyệt Ban + Trưởng Sales + GDKD trước khi mở implementation plan.*
