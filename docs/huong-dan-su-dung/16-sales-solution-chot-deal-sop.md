# SOP Training — Sales & Solution: Chu trình chốt deal PRO

> **Phiên bản:** 1.0 · **Cập nhật:** 2026-08-11  
> **Đối tượng:** Sales (AM), Solution Strategist (SP/MKT), GDKD  
> **URL:** https://rs.pttads.vn  
> **Thời lượng training:** 3 buổi × 90 phút + 2 deal pilot  
> **Liên quan:** [02-crm-core.md](./02-crm-core.md) · [11-marketing-ai-planner.md](./11-marketing-ai-planner.md) · [03-agency-service-delivery.md](./03-agency-service-delivery.md)

---

## 1. Mục tiêu training

Sau khóa này, team Sales/Solution phải:

1. **Không báo giá** khi chưa có **Kế hoạch Marketing sơ bộ (KH MKT sơ bộ / R5)** trên lead.
2. Phân biệt rõ **3 lớp Marketing Plan** — không nhầm giai đoạn bán vs triển khai.
3. Chạy buổi chốt **45 phút** trên RNOSAI (screen-share lead, không file PowerPoint rời).
4. Dùng AI đúng vai: **draft + human duyệt**, không auto gửi khách.

**Pitch nội bộ (nhớ 1 câu):**

> PTT không bán “gói dịch vụ” — PTT bán **chiến lược đã Solution sign-off** + báo giá 3 gói trên cùng nền tảng.

---

## 2. Ba lớp Marketing Plan — KHÔNG được nhầm

| Lớp | Tên | Khi nào | Ở đâu trên RNOSAI | Ai làm |
|-----|-----|---------|-------------------|--------|
| **L1** | **KH MKT sơ bộ (R5)** | **Trước HĐ** — vũ khí chốt deal | Lead B2B → tab **Tư vấn** → form **KH Marketing sơ bộ (R5)** | Solution + AM |
| **L2** | **TMMT chính thức** | **Sau ký HĐ**, trước go-live | `/crm/service-delivery/[id]?tab=ai-planner` → Apply TMMT | SP (AM theo dõi) |
| **L3** | **Checklist + KPI DV** | Đang triển khai | Tab **Ops Hub** | AM + SP vận hành |

**Quy tắc vàng:**

- Buổi chốt HĐ → chỉ show **L1 + Proposal**.
- **L2 (TMMT)** là việc **sau ký** — Sales **không hứa** “AI sinh full plan trong buổi chốt”.
- **Content OS AI** (`tab=content-os`) chỉ sau Deliver — không demo khi chưa ký.

---

## 3. Phân vai RACI (Sales vs Solution)

| Việc | Sales (AM) | Solution (SP) | GDKD |
|------|------------|---------------|------|
| Qualify lead, SLA 15p | **R** | I | Approve deal lớn |
| Handoff Solution | **R** | **R** (claim queue) | I |
| Task Consult (audit, đối thủ) | C | **R/A** | — |
| **KH MKT sơ bộ (R5)** | Review trước buổi chốt | **R/A** | — |
| Proposal / báo giá | **R/A** | C | Approve discount lớn |
| Buổi chốt 45p | **R** (facilitate) | **R** (present strategy) | Optional |
| Accept proposal + cọc | **R** | I | — |
| TMMT sau ký | I | **R** | — |
| Ops Hub / Content OS | I | C | — |

**Solution queue:** `/crm/solution/queue`  
**Handoff:** Lead detail → Pre-sales → Solution nhận case / AM handoff.

---

## 4. Chu trình 6 pha — checklist thao tác

### Pha 0 — Qualify (AM, ≤24h)

| # | Việc | Route | Done khi |
|---|------|-------|----------|
| 0.1 | Lead mới có owner | `/crm/leads` | Owner = AM |
| 0.2 | First touch ≤15p | Lead detail → Activity Call | Log call |
| 0.3 | BANT (nếu deal B2B) | `/crm/intake?lead_id=…` | Session completed |
| 0.4 | Hoàn thành B2 | Lead funnel → Care report | Banner **B2 ✓** — Pre-sales mở |

**Gate:** `presales_care_gate.complete = true` → mới **Bắt đầu pre-sales**.

---

### Pha 1 — Pre-sales Consult (Solution, 2–5 ngày)

| # | Việc | Route | Done khi |
|---|------|-------|----------|
| 1.1 | Bắt đầu pre-sales | Lead → **Bắt đầu pre-sales** (chọn `service_slug`) | Stage = `consult` |
| 1.2 | Mở workspace | Tab **Tư vấn** hoặc stepper → Consult | `LeadConsultWorkspace` |
| 1.3 | Prefill | Nút **Prefill từ Lead/Intake** | Brief có data |
| 1.4 | L2 docs (nếu bật) | Checklist L2 trong workspace | Tick đủ mục bắt buộc |
| 1.5 | Task Consult | Form task theo DV (audit, đối thủ, KPI…) | **Tick hoàn thành** từng task |
| 1.6 | AI hỗ trợ consult | **AI Hỗ trợ** trên task `consult_analysis` | SP **đọc + sửa** output |
| 1.7 | Chuyển stage | Stepper phía trên → **Chuyển giai đoạn** | Gate Consult PASS |

**Gate Consult:** 100% task Consult done (`fetchLeadPresalesConsultGate`).

**SLA:** Banner SLA Consult→Proposal — AM nhắc nếu Solution quá hạn.

---

### Pha 2 — KH MKT sơ bộ R5 ⭐ (Solution, 1–2 ngày)

**Đây là bước bắt buộc trước báo giá (Gate G4).**

| # | Việc | Route | Done khi |
|---|------|-------|----------|
| 2.1 | Mở form R5 | Lead → Overview → scroll **KH Marketing sơ bộ (R5)** hoặc tab Tư vấn → **Chỉnh R5** | Form hiện |
| 2.2 | Điền bắt buộc | Tên KH · North Star **hoặc** Mục tiêu · 3 khối: **Thông điệp · Media · Chuyển đổi** | Validation list **trống** |
| 2.3 | (Tuỳ chọn) AI draft | **AI draft** → **SP sửa tay ≥15 phút** | Không gửi raw AI |
| 2.4 | Lưu | **Lưu KH MKT sơ bộ** | Toast OK |
| 2.5 | AM review | AM đọc preview trên workspace | Tick nội bộ “AM OK gửi KH” |
| 2.6 | Chuyển Proposal | Stepper → **Chuyển → Báo giá** | Stage = `proposal` |

**Gate Proposal:** `buildProposalAdvanceGate` — Consult done **+** KH MKT sơ bộ valid.

**Lỗi thường gặp:**

| Triệu chứng | Nguyên nhân | Xử lý |
|-------------|-------------|-------|
| Nút Chuyển → Báo giá disabled | Thiếu 3 khối chiến lược | Điền `market_message`, `media_reach`, `conversion_strategy` |
| “Chưa hoàn thành task Consult” | Task chưa tick Done | Quay lại Pha 1 |
| AM không thấy form R5 | Chưa mở tab Tư vấn / chưa scroll `#funnel-presales-r5` | `onEditR5` từ preview panel |

---

### Pha 3 — Proposal & chốt HĐ (AM + Solution, 1 buổi)

| # | Việc | Route | Done khi |
|---|------|-------|----------|
| 3.1 | Mở Proposal | Workspace → **Tạo Proposal từ Consult →** hoặc `/crm/proposals` | Proposal draft |
| 3.2 | Chọn gói | Basic / Standard / Premium (theo DV) | Line items + tổng tiền |
| 3.3 | Export | PDF/DOCX proposal | File gửi KH (kèm tóm tắt R5 — hiện export riêng) |
| 3.4 | Buổi chốt 45p | Screen-share lead (xem §5) | Khách đồng ý |
| 3.5 | Accept | Proposal → **Accept** | Lifecycle + order |
| 3.6 | Cọc | `/crm/invoices` | Invoice paid / cọc |

**Gate GDKD:** Deal vượt ngưỡng → `/crm/leads/review-queue` approve trước proposal.

---

### Pha 4–7 — Sau ký (AM + SP vận hành — Sales **biết** để hứa đúng)

| Pha | Việc | Route |
|-----|------|-------|
| 4 Onboard | Agency client 100% | `/agency/clients/[id]` |
| 5 TMMT | AI Planner 5 bước → Apply | `?tab=ai-planner` |
| 6 Deliver | Launch QA + Ops Hub | `/crm/launch-qa`, `?tab=ops-hub` |
| 7 Retain | KPI + Portal | Ops Dashboard, portal KH |

Sales **không** cam kết timeline Deliver chi tiết nếu chưa có TMMT (L2) — chỉ cam kết **onboard + TMMT trong X ngày làm việc** theo HĐ.

---

## 5. Kịch bản buổi chốt 45 phút (demo RNOSAI)

**Chuẩn bị (AM + Solution, 30p trước):**

- [ ] Gate G4 xanh (KH MKT sơ bộ)
- [ ] Proposal draft + 3 gói
- [ ] AM + Solution cùng login `rs.pttads.vn`
- [ ] Mở sẵn: `/crm/leads/[id]` tab **Tư vấn** + tab Proposal

| Phút | Người nói | Nội dung | Màn hình |
|------|-----------|----------|----------|
| 0–5 | AM | Recap nhu cầu + BANT | Lead overview |
| 5–15 | Solution | **North Star + 3 khối chiến lược** (R5 preview) | Workspace → R5 preview |
| 15–25 | Solution | Timeline 90 ngày (nói miệng, chưa TMMT chi tiết) | — |
| 25–35 | AM | So sánh 3 gói + ROI ước tính | `/crm/proposals` |
| 35–40 | AM | Trả lời objection | — |
| 40–45 | AM | Accept + cọc ngay | Proposal Accept + invoice |

**Câu chốt mẫu:**

> “Anh/chị thấy **chiến lược** trên màn hình — đó là phần team Solution đã sign-off. Bên dưới là **3 mức đầu tư** cùng cam kết KPI. Hôm nay mình chốt gói [Standard] và cọc [X]% để team onboard tuần sau.”

**Không làm trong buổi chốt:**

- Demo Content OS / sinh bài AI
- Hứa TMMT full calendar (L2 — sau ký)
- Bỏ qua R5, chỉ show bảng giá

---

## 6. Quy tắc AI (thực chiến — chưa auto 100%)

| Công cụ | Giai đoạn | Quy tắc |
|---------|-----------|---------|
| **AI Hỗ trợ** (task consult) | Consult | SP đọc + sửa form trước khi tick Done |
| **AI draft** (KH MKT sơ bộ) | Trước proposal | Bắt buộc sửa tay; AM review trước buổi chốt |
| **AI Planner** | Sau ký (TMMT) | Quality ≥70 + tick “Đã review” mới Apply |
| **Content OS Generate** | Sau Deliver | QA duyệt trước publish |

**Badge nói với khách:** “Bản nháp hỗ trợ AI — đã được chuyên gia PTT hiệu chỉnh.”

---

## 7. Gates — bảng treo phòng Sales

| Gate | Điều kiện | Ai chịu trách nhiệm |
|------|-----------|---------------------|
| **G0 B2** | Care stage complete | AM |
| **G1 Consult** | 100% task Consult | Solution |
| **G4 R5** | KH MKT sơ bộ valid | Solution |
| **G5 Proposal** | GDKD approve (deal lớn) | GDKD |
| **G6 Accept** | Khách ký + cọc | AM |
| **G7 TMMT** | Apply TMMT (sau ký) | Solution |
| **G8 Deliver** | Onboard 100% + Launch QA | AM |

**Cấm bypass:** Không tạo proposal khi G4 đỏ — hệ thống block; nếu bypass văn hóa (file ngoài CRM) → KPI team bị trừ.

---

## 8. Chương trình training 3 buổi

### Buổi 1 — Nền tảng (90p) — AM + Solution

| Thời gian | Nội dung |
|-----------|----------|
| 15p | 3 lớp Marketing Plan + RACI |
| 30p | Demo lead B2B: B2 → Pre-sales → Consult task |
| 30p | Thực hành: điền R5 trên lead sandbox |
| 15p | Q&A gates |

**Bài tập:** Hoàn thành R5 trên lead sandbox **`#900000910`** — https://rs.pttads.vn/crm/leads/900000910  
**Runbook IT:** [`docs/runbooks/workshop-buoi1-presales-r5-runbook.md`](../runbooks/workshop-buoi1-presales-r5-runbook.md)

### Buổi 2 — Chốt deal (90p) — AM trọng tâm

| Thời gian | Nội dung |
|-----------|----------|
| 20p | Proposal + 3 gói |
| 40p | Role-play buổi chốt 45p (2 cặp AM+Solution) |
| 20p | Objection handling + GDKD queue |
| 10p | Checklist Accept + cọc |

### Buổi 3 — Sau ký & cam kết đúng (90p) — Solution + AM

| Thời gian | Nội dung |
|-----------|----------|
| 25p | TMMT AI Planner (tab ai-planner) — **không phải buổi bán** |
| 25p | Agency onboard + lifecycle stages |
| 25p | Ops Hub / Content OS — giới hạn cam kết sales |
| 15p | UAT: 2 deal pilot thật — retro |

---

## 9. UAT pilot — 2 deal bắt buộc trước go-live team

Mỗi AM + Solution pair chạy **1 deal thật** (hoặc lead nóng) với checklist:

| # | Tiêu chí | Pass |
|---|----------|------|
| 1 | B2 → Consult → R5 → Proposal trên CRM | ☐ |
| 2 | Buổi chốt screen-share RNOSAI (ghi nhận activity) | ☐ |
| 3 | Không file PowerPoint plan rời | ☐ |
| 4 | AI draft có dấu hiệu SP sửa (không copy 100%) | ☐ |
| 5 | Accept + lifecycle xuất hiện | ☐ |
| 6 | Solution bắt đầu TMMT trong 5 ngày làm việc sau cọc | ☐ |

**Retro 30p:** Gate nào hay kẹt? Field R5 nào khách hỏi nhiều?

---

## 10. FAQ nội bộ

**Q: Khách vội, chỉ cần báo giá?**  
A: Gửi **range 3 gói** + hẹn buổi 30p show R5. Không Accept trên CRM nếu chưa G4.

**Q: Solution bận, AM tự điền R5?**  
A: Được nếu AM có cap edit + **Solution tick review** trước buổi chốt (audit activity).

**Q: TMMT khác R5 thế nào?**  
A: R5 = 1 trang chiến lược chốt deal. TMMT = lịch 90 ngày + campaign + calendar — sau ký.

**Q: Tab Tư vấn không hiện?**  
A: Kiểm tra `lead_flow_kind = b2b_prospect`, B2 xong, `PTT_PRESALES_ON_LEAD=1`.

**Q: AI draft lỗi?**  
A: Điền tay — gate R5 không phụ thuộc AI. Báo IT sau buổi.

---

## 11. Tài liệu tham chiếu

| Tài liệu | Nội dung |
|----------|----------|
| [02-crm-core.md](./02-crm-core.md) § Pre-sales & Proposal | Route CRM |
| [11-marketing-ai-planner.md](./11-marketing-ai-planner.md) | TMMT sau ký |
| [03-agency-service-delivery.md](./03-agency-service-delivery.md) | Lifecycle sau Accept |
| [04-ops-dv.md](./04-ops-dv.md) | Ops Hub 21 DV |
| `docs/use-cases/actions/01-CRM-ACTIONS.md` | Bước chi tiết |

---

## 12. Cam kết quản lý

| Vai trò | Cam kết |
|---------|---------|
| **Trưởng Sales** | 100% proposal từ CRM có G4 xanh |
| **Trưởng Solution** | SLA Consult→R5 ≤ 3 ngày làm việc |
| **GDKD** | Review queue ≤ 4h |
| **IT/PO** | (Roadmap) Plan+Quote Pack PDF — 1 file chốt deal |

*SOP này có hiệu lực khi được Trưởng KD + Trưởng Solution ký duyệt nội bộ.*
