# Checklist 30 phút — Marketing Leader chốt TMMT lần đầu

> **Actor:** Solution Strategist / Marketing Leader (SP)  
> **Mục tiêu:** Lifecycle mới → TMMT chính thức gate pass + export PDF trong **≤30 phút**  
> **Staging:** https://rs.pttads.vn (ops-web)  
> **Prod pilot:** lifecycle thật đã khai báo trong `MKT_AI_PILOT_LIFECYCLE_ID`  
> **UAT đầy đủ:** [`10-MKTP-ACTIONS.md`](../use-cases/actions/10-MKTP-ACTIONS.md) (45 ph)

---

## Trước khi bắt đầu (5 phút — không tính vào 30 phút)

| ✓ | Chuẩn bị |
|---|----------|
| ☐ | Login SP có cap **`crm_mkt_ai.generate`** (+ `export` nếu tải PDF) |
| ☐ | Lifecycle **stage `onboard`**, slug trong whitelist (`meta-lead-gen` prod pilot) |
| ☐ | Đã có **TMMT official plan** trên lifecycle (promote presales R5 hoặc tạo official) |
| ☐ | Consult-brief / onboarding-brief đã có trên lead (prefill nhanh hơn) |
| ☐ | Ghi sẵn: **Lifecycle #___** · Client ___ · Slug ___ |

**Prod pilot:** không dùng lifecycle tag `mkt-ai-smoke-seed` — chọn HĐ khách thật.

---

## Timeline 30 phút

| Phút | Bước | Việc làm | Pass khi |
|------|------|-----------|----------|
| **0–3** | Mở | Login → `/crm/service-delivery` → mở lifecycle → tab **AI Planner** | Banner Governance + stepper Brief hiện; không 403/404 |
| **3–8** | Brief | Review prefill → **Áp dụng playbook** (Meta/BĐS/SEO) → sửa brand/budget/geo/pain → autosave | Toast *Đã lưu brief*; nút **Tiếp tục** enabled |
| **8–14** | Strategy | **Sinh chiến lược AI** → đợi job ✓ → kiểm tra 4 block prof có chữ → sửa 1 dòng nếu cần | ICP + persona + pain + market_context không rỗng |
| **14–18** | Campaign | **Sinh chiến dịch AI** → ≥2 cards → skim KPI/kênh | Job panel ✓ succeeded |
| **18–22** | Content | **Sinh lịch nội dung** → skim 30 ngày → (tuỳ chọn) sửa 1 dòng calendar | Calendar có ≥1 tuần có row |
| **22–26** | Quality | **Tiếp tục → Apply** → chạy **Quality** nếu score &lt;70 → mục tiêu **≥70/100** | Score bar xanh/vàng ≥70 |
| **26–30** | Chốt | **Apply vào TMMT** (tick review → Xác nhận) → banner gate **xanh** → **PDF Kế hoạch** | Toast apply OK; tab TMMT đồng bộ; file `.pdf` tải được |

**Sau 30 phút (AM):** Tab Workflow → **Chuyển → Triển khai** khi PO/AM duyệt (không auto).

---

## Checklist chi tiết (tick từng ô)

### Phút 0–3 · Mở lifecycle

- [ ] URL: `/crm/service-delivery/{id}?tab=ai-planner`
- [ ] Banner TMMT gate hiển thị (đỏ → sẽ xanh sau Apply)
- [ ] Governance banner sticky (3 bullet + checkbox gate)
- [ ] Job panel không báo lỗi auth

### Phút 3–8 · Brief

- [ ] **Tên thương hiệu / KH** — đúng tên client
- [ ] **Ngành** + **Mục tiêu** (lead / awareness)
- [ ] **Ngân sách tháng (VND)** — số hợp lệ
- [ ] **Geo** — ≥1 thị trường
- [ ] **Thách thức** + **USP** — ≥1 câu cụ thể (quality score phụ thuộc)
- [ ] Playbook applied (dropdown + *Áp dụng template*)
- [ ] **Tiếp tục → Strategy**

### Phút 8–14 · Strategy

- [ ] Bấm **Sinh chiến lược AI** (hoặc dùng Pipeline AI — xem fast path)
- [ ] Job `strategy` status **succeeded**
- [ ] **Thị trường mục tiêu** — có text
- [ ] **ICP / phân khúc** — ≥80 ký tự khuyến nghị
- [ ] **Persona** — có pain/desired outcome
- [ ] SWOT / positioning — skim nhanh, sửa 1 chỗ nếu sai ngành
- [ ] **Tiếp tục → Campaign**

### Phút 14–18 · Campaign

- [ ] **Sinh chiến dịch AI**
- [ ] ≥ **2 campaign cards** (Meta/Google/Zalo…)
- [ ] Mỗi card có KPI + budget gợi ý
- [ ] **Tiếp tục → Content**

### Phút 18–22 · Content

- [ ] **Sinh lịch nội dung**
- [ ] Calendar ~30 ngày có row (topic/format/channel)
- [ ] (Tuỳ chọn) Sửa 1 dòng tiêu đề tuần 1
- [ ] **Tiếp tục → Apply**

### Phút 22–26 · Quality

- [ ] Xem **Quality score** (tự cập nhật hoặc bấm chạy Quality job)
- [ ] Nếu &lt;70: bổ sung ICP + thêm chi tiết brief → chạy lại Quality
- [ ] Score **≥70** trước Apply (prod pilot Launch QA gate)

### Phút 26–30 · Apply + Export

- [ ] Đọc modal diff Apply (TMMT trước/sau)
- [ ] Tick **Đã review** → **Xác nhận Apply**
- [ ] Banner gate chuyển **xanh ✓**
- [ ] Mở tab **TMMT** — field strategy khớp draft
- [ ] **PDF Kế hoạch** — download OK, không lỗi base64
- [ ] (Tuỳ chọn) DOCX nếu cần gửi khách chỉnh sửa

---

## Fast path (~22 phút AI) — Pipeline AI

Dùng khi Leader đã quen brief + playbook:

| Phút | Việc |
|------|------|
| 0–5 | Brief + playbook (như trên) |
| 5–15 | Tab **Pipeline AI** → chọn playbook → **Chạy pipeline AI** (4 job tuần tự) |
| 15–18 | Skim strategy/campaign/content trong draft |
| 18–22 | Quality ≥70 → Apply → PDF |

**Lưu ý:** Pipeline chạy sync — đợi job panel parent **Pipeline AI · succeeded** trước khi Apply.

---

## Staging vs prod pilot

| | Staging (`rs.pttads.vn`) | Prod pilot |
|--|--------------------------|------------|
| Lifecycle | UAT seed #1 OK cho luyện | **Lifecycle khách thật** |
| Slugs | 3 slug (meta/bds/seo) | **1 slug** (`meta-lead-gen`) |
| Launch QA gate | Bật | Opt-in |
| Rollback | Flag off trên VPS | `mkt_ai_prod_pilot_rollback.sh` |
| Monitor | Smoke scripts | `mkt_ai_prod_pilot_monitor.sh` daily ×7 |

---

## Nếu bị kẹt (30 giây chẩn đoán)

| Triệu chứng | Làm ngay |
|-------------|----------|
| Tab ẩn | Hỏi DevOps: `NEXT_PUBLIC_MKT_AI_PLANNER=1` |
| 403 context | Slug chưa trong `PTT_MKT_AI_PLANNER_SLUGS` |
| Nút Sinh AI disabled | Thiếu cap `crm_mkt_ai.generate` |
| Apply 409 | Chưa có official plan → promote R5 |
| Quality &lt;60 | Brief thiếu ICP + campaign &lt;2 cards |
| Job fail | **Thử lại** — draft bước trước giữ nguyên |

Chi tiết: [`mkt-ai-planner-delivery-sop.md`](./mkt-ai-planner-delivery-sop.md) §10.

---

## Chữ ký Leader (lần đầu)

| Trường | Giá trị |
|--------|---------|
| Lifecycle # | |
| Client | |
| Ngày | |
| Quality score | /100 |
| Apply gate | ☐ Pass |
| PDF export | ☐ OK |
| Thời gian thực tế | ___ phút |
| Ghi chú | |

---

*Cập nhật: WS-P4-01 · align MKTP-UC-001…010*
