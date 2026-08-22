# Phân tích Gap — Use Case vs Hành động người dùng thực tế

> **Phiên bản:** 1.6 · **Ngày:** 2026-07-26  
> **Cập nhật:** **AI R1 code ship** — GAP-AI-01…05 đóng trên `main` @ `d2f07b8` (copilot, score, draft, audit UI, GDKD override)  
> **Mục đích:** Đối chiếu ~122 UC với ops-web / portal-web thực tế; xác định bước nghiệp vụ khách hàng chưa được hệ thống dẫn đủ.

---

## 1. Kết luận tổng quan

| Mức | Số UC ước lượng | Ý nghĩa |
|-----|-----------------|---------|
| **Đủ bước UI** | ~88 UC | Toàn bộ hành động chính có màn hình + API |
| **Thiếu bước / workaround thủ công** | ~24 UC | Nghiệp vụ đúng spec nhưng thiếu UI hoặc liên kết giữa module |
| **Chưa có / stub only** | ~10 UC | Cần phát triển trước khi khách tự phục vụ (chủ yếu Z4 API write, P2 BI) |
| **AI R1 P0 — code shipped** | **10 UC P0** | UC/actions ✅ · Nest `ai-intelligence` + `LeadCopilotPanel` + E2E RNOS-39 ✅ · polish R1 còn §4.6 trust footer |

**Thay đổi post Phase A (doc):**

| Module | Trước Phase A | Sau Phase A |
|--------|---------------|-------------|
| ZALO actions | 9/21 UC | **21/21 UC** ✅ |
| SYS cross-channel | Meta-only SYS-002/003 | **Meta + Zalo + Google** nhánh |
| PORTAL Zalo | Không có | **PORTAL-UC-013/014** ✅ |
| Gap doc Zalo | Stale (nhiều ❌ đã ship Z1–Z3) | **Refreshed** |

**Thay đổi post Phase B (doc):**

| Module | Trước Phase B | Sau Phase B |
|--------|---------------|-------------|
| CRM actions | 15 skeleton (~4–6 bước) | **15/15 expanded** — 8 P0 ≥8 bước, 7 P1 ≥5 bước |
| SVC actions | 12 skeleton | **12/12 expanded** — 8 P0 ≥8 bước, 4 P1 ≥5 bước |
| GAP-P1-01 finance gate | 1 dòng workaround | **8 bước chi tiết** + target UI spec trong SVC-UC-004 |
| CRM closed-loop Won | Không document | **CRM-UC-002 E2** → SYS-002 + ZALO-UC-015 |

**Thay đổi post Phase C (doc):**

| Module | Trước Phase C | Sau Phase C |
|--------|---------------|-------------|
| META actions | 14 skeleton | **14/14** — 9 P0 ≥8 bước, 5 P1 ≥4 bước |
| SEO actions | 14 skeleton | **14/14** — 9 P0 full, 5 P1 ≥4 bước |
| EM actions | 14 partial | **14/14** — 11 P0 full, 3 P1 ≥5 bước |
| PLAT actions | 10 thin | **10/10** — 9 P0 full, 2 P1 ≥6 bước |
| Webhook matrix | Scattered | **PLAT-UC-004/005/006** + summary table |

**Thay đổi post AI R1 code ship (2026-07-26):**

| Hạng mục | Trước | Sau (`main` @ `d2f07b8`) |
|----------|-------|---------------------------|
| Copilot lead detail | GAP-AI-01 pending | ✅ `LeadCopilotPanel` + RNOS-39 E2E |
| Lead score + explain | GAP-AI-02 pending | ✅ `POST /api/v1/ai/score/lead` + async RNOS-08 |
| Follow-up draft approve | GAP-AI-03 pending | ✅ RNOS-07 + BR-AI-01 E2E |
| Admin audit UI | GAP-AI-04 pending | ✅ `/admin/ai/runs` (gap matrix §23.1) |
| GDKD override score | GAP-AI-05 stretch | ✅ AI-UC-006 `ScoreOverrideModal` + override API |

**Nguyên nhân hệ thống "chưa ổn" khi đọc UC cũ:** UC mô tả luồng logic (Main flow 5–7 bước) nhưng **không liệt kê từng click, form field, điều kiện chuyển màn** — AM/CSKH không biết "làm gì tiếp theo" khi onboard đa module.

**Giải pháp tài liệu:** Bộ [`actions/`](actions/README.md) — mỗi UC có bảng hành động `# | Actor | Màn hình | Thao tác | Input | Output | Gate`.

---

## 2. Ma trận mong muốn khách hàng → UC → Trạng thái

| Mong muốn khách hàng / agency | UC liên quan | Trạng thái đáp ứng |
|------------------------------|--------------|-------------------|
| Ký HĐ xong → client chạy ads trong 2 tuần | SYS-001, SVC-001/002, META-001, **ZALO-001/021** | ⚠️ Orchestrator ✅; AM vẫn deep-link nhiều URL — **doc Phase A** đã map đủ bước |
| Lead Meta vào CRM < 1 phút, CSKH gọi ngay | META-004, **CRM-001**, PLAT-004 | ✅ **Phase B** — CRM-001 9 bước + nhánh Meta/Zalo |
| **CSKH SLA board — breach / bulk reassign** | **CRM-UC-008, CRM-001** | ✅ **Prod-S4** — `/crm/cskh-board` + API + 15m SLA |
| **Lead Zalo vào CRM (webhook + poll)** | **ZALO-011/012/013/014, CRM-001** | ✅ Shipped + **Prod-S3** prod cutover (no stub) |
| Biết CPL/ROAS đúng theo client | SYS-002, META-002/003, **ZALO-004/015** | ✅ Hub + map; Zalo CPA refresh Z2-B7 |
| **So sánh Meta/Google/Zalo một màn** | **SYS-002, ZALO-018** | ✅ `/meta/ads-combined` Z3-7 |
| Launch ads chỉ khi QA + client duyệt | SYS-003, **SVC-005/006/007**, PORTAL-006, ZALO-008/019 | ✅ **SVC-005** Zalo auto-checklist + creative channel tag |
| Khách tự xem báo cáo T-1 | SYS-005, PORTAL-002/003, **PORTAL-UC-013** | ✅ Dashboard + export; Zalo PDF Z3-6; **Meta/Zalo schedule email Prod-S2** |
| Khách duyệt email trước gửi | EM-007, PORTAL-008 | ✅ Portal approvals |
| **Khách duyệt creative Zalo** | **ZALO-019, PORTAL-014** | ✅ Shared `/creatives` + channel=zalo tag |
| SEO content duyệt trước publish | SEO-005/006, PORTAL-007 | ✅ Content pipeline + portal review |
| Tạo tài khoản portal cho khách | PORTAL-001, SYS-001 bước 13 | ✅ Tab **Portal users** |
| Reset mật khẩu portal | PORTAL-001 | ✅ `/forgot-password`, `/reset-password` |
| Offboard → thu hồi hết quyền | SYS-006, **SVC-012** | ✅ **SVC-UC-012** 6 bước + Offboard client |
| Finance chặn handover khi nợ | **SVC-004**, CRM-011 | ✅ **Prod-S5** strict + AR aging · warn mode default |
| **Cảnh báo Zalo CPL/zero leads** | **ZALO-017** | ✅ Alerts Z3 + Slack + hub banner |
| **Thông báo tiến độ campaign Zalo** | **ZALO-020** | ✅ **Prod-S1** — `/notifications` + emit creative/email/milestone |
| Onboard email domain tự phục vụ | EM-001 | ✅ Wizard E-11 |
| Journey email tự động | EM-011 | ⚠️ **GAP-P1-02** — Flag `PTT_EMAIL_JOURNEYS=1` |
| Báo cáo BI Grafana khách xem | EM-013, SEO-014 | ⚠️ **GAP-P1-03** — Staff embed OK; portal chưa embed |
| Subscriber preference center | EM-014 | ✅ Public routes tokenized |
| Multi-client isolation | SYS-011, PLAT-002/003 | ✅ JWT scope + **Prod-S4** pen test matrix |
| **Deploy campaign Zalo qua API** | **ZALO-009/010** | ✓ **Prod-Z4** — stub/pilot; E1 manual fallback |
| **AI copilot trên lead detail** | **AI-UC-002…005, CRM-002** | ✅ **RNOS-06/39** — `LeadCopilotPanel` trên `/crm/leads/[id]` + mobile drawer |
| **Lead score async ≤30s** | **AI-UC-001** | ✅ **RNOS-04/08** — `POST /api/v1/ai/score/lead` + consumer + `ScoreCard` |
| **Follow-up draft approve (no auto-send)** | **AI-UC-004** | ✅ **RNOS-07** — draft → Duyệt → activity note · BR-AI-01 E2E |
| **AI audit runs (admin)** | **AI-UC-009** | ✅ **UI-R1-09** — `/admin/ai/runs` + `ai_agent_runs` (RNOS-05) |
| **GDKD override score copilot** | **AI-UC-006** | ✅ **UI-R1-08** — `ScoreOverrideModal` + `POST /api/v1/ai/scores/lead/override` |

---

## 3. Danh sách Gap chi tiết (ưu tiên sửa)

### GAP-P0 — Chặn nghiệp vụ khách hàng

| ID | Mô tả | UC | Workaround hiện tại | Đề xuất |
|----|-------|-----|---------------------|---------|
| **GAP-P0-01** | ~~Không có UI CRUD portal users trên ops-web~~ | PORTAL-001, SYS-001 | — | ✅ **Đã implement** |
| **GAP-P0-02** | ~~Portal forgot password~~ | PORTAL-001 | — | ✅ **Đã implement** |
| **GAP-P0-03** | ~~Onboard đa module không có checklist thống nhất~~ | SYS-001, SVC-002 | — | ✅ **Onboard orchestrator** Z2 + doc nhánh Zalo SYS-001 |

### GAP-P1 — Enterprise depth / workaround được

| ID | Mô tả | UC | Workaround |
|----|-------|-----|------------|
| **GAP-P1-01** | Finance gate handover | SVC-004 | **Doc Phase B:** 8 bước manual `/crm/financials` + block policy; target UI on lifecycle advance |
| **GAP-P1-02** | Notification client khi có approval pending / milestone | PORTAL-006/008, **ZALO-020** | ✅ **Prod-S1** — `portal_notification` + `/notifications` + webhook `PTT_PORTAL_NOTIFY_WEBHOOK` |
| **GAP-P1-03** | Grafana BI trên portal khách | EM-013, SEO-014 | Khách xem PDF export; staff xem Grafana |
| **GAP-P1-04** | Campaign map bulk AI suggest | META-002 | Hub có suggest; buyer confirm từng dòng |
| **GAP-P1-05** | Double opt-in email public confirm | EM-002 | Route có; thiếu UI embed builder trong ops |
| **GAP-P1-06** | Zalo lead ops visibility | PLAT-005, **ZALO-011** | ✅ Filter `source=zalo` trên `/crm/leads`; `/agency/ingest` xem job |

### GAP-AI — AI Revenue OS R1 (snapshot 2026-07-26)

**Đã ship trên `main` (đóng gap):**

| ID | Mô tả | UC | Evidence |
|----|-------|-----|----------|
| **GAP-AI-01** | ~~Copilot panel trên lead detail~~ | AI-UC-002…005 | ✅ `LeadCopilotPanel` · RNOS-06 · E2E RNOS-39 |
| **GAP-AI-02** | ~~Async lead score + explainability~~ | AI-UC-001, AI-UC-005 | ✅ `POST /api/v1/ai/score/lead` · RNOS-04/08 · `ScoreCard` |
| **GAP-AI-03** | ~~Follow-up draft approve (no send)~~ | AI-UC-004 | ✅ RNOS-07 · `ai-copilot.spec.ts` follow-up accept |
| **GAP-AI-04** | ~~Admin UI audit runs~~ | AI-UC-009 | ✅ `/admin/ai/runs` · gap matrix §23.1 · RNOS-05 |
| **GAP-AI-05** | ~~Manager override score UI~~ | AI-UC-006 | ✅ `ScoreOverrideModal` · `d2f07b8` · E2E AI-UC-006 |

**R1 polish còn lại (không chặn copilot pilot):**

| ID | Mô tả | UC | Workaround / target |
|----|-------|-----|---------------------|
| **GAP-AI-R1-01** | Copilot trust footer BR-AI copy | UI-R1 §15 | Gap matrix §4.6 · text spec chưa render |
| **GAP-AI-R1-02** | Leads list sort/filter by score | AI-UC-001 §9 | Cột AI Score pilot OK (§3.7); sort score = stretch |
| **GAP-AI-R1-03** | Gate R1 prod pilot sign-off | AI-UC-010 | RNOS-40 runbook + `rnos_r1_prod_pilot_gate.sh` manual |

### GAP-P2 — Pilot / optional

| ID | Mô tả | UC |
|----|-------|-----|
| **GAP-P2-01** | ClickHouse / DWH export self-serve portal | SEO-014, **ZALO-018** |
| **GAP-P2-02** | Meta Horizon migration UAT client-facing | META-014 |
| **GAP-P2-03** | Portal branding full white-label | PORTAL settings partial |

### GAP-Z4 — Zalo API write (Wave Z4)

| ID | Mô tả | UC | Workaround v1 |
|----|-------|-----|---------------|
| **GAP-Z4-01** | Campaign create/pause/update qua Zalo API | ZALO-009, ZALO-010 | **Prod-Z4 shipped** — stub/pilot; manual UI fallback [08-ZALO-ACTIONS.md](actions/08-ZALO-ACTIONS.md) E1 |

---

## 4. Checklist nghiệm thu hành động (per UC)

Một UC được coi **"đủ bước nghiệp vụ"** khi file actions tương ứng có:

- [ ] **Mục tiêu khách hàng** — câu nói đúng ngôn ngữ PO/AM
- [ ] **Bảng hành động** ≥ 8 bước cho P0 UC (≥ 5 cho P1)
- [ ] **Mỗi bước** có URL ops-web hoặc portal-web cụ thể
- [ ] **Input/Output** — field form, nút bấm, message hệ thống
- [ ] **Gate** — điều kiện pass/fail trước bước tiếp
- [ ] **Nhánh E*** — hành động khi lỗi / từ chối / timeout
- [ ] **Gap tag** — nếu bước thiếu UI

**Coverage sau Phase C:**

| Module | UC catalog | Action file | Đạt checklist §4 |
|--------|------------|-------------|------------------|
| ZALO | 21 | 21 ✅ | **21/21** (Phase A) |
| CRM | 15 | 15 ✅ | **15/15** (Phase B) |
| SVC | 12 | 12 ✅ | **12/12** (Phase B) |
| **META** | 14 | 14 ✅ | **14/14** (Phase C) |
| **SEO** | 14 | 14 ✅ | **14/14** (Phase C) |
| **EM** | 14 | 14 ✅ | **14/14** (Phase C) |
| **PLAT** | 10 | 10 ✅ | **10/10** (Phase C) |
| **AI** | 20 | 20 ✅ | **10/10 P0 R1** + **10 R2–R4 target** (2026-07-26 v1.1) |
| SYS | 12 | 12 | **5/12** (001–005 expanded) |
| PORTAL | 10 + extras | 14 | **4/14** full + rest partial |

**Tổng actions đạt chuẩn:** ~**125/142** UC (~88%) · **AI R1 P0 UI/API shipped**; R2–R4 actions spec-only until UI ship

---

## 5. Lộ trình khuyến nghị (product + doc)

| Phase | Hạng mục | Trạng thái |
|-------|----------|------------|
| **A** | Zalo 21 UC; SYS multi-channel; Portal Zalo; gap refresh | ✅ **Done** (2026-07-25) |
| **B** | CRM 15 + SVC 12 actions expand; GAP-P1-01 finance gate doc | ✅ **Done** (2026-07-25) |
| **C** | META/SEO/EM/PLAT all UC actions expand | ✅ **Done** (2026-07-25) |
| **AI-doc** | AI 14 UC + actions 09-AI; pilot 8-step UAT | ✅ **Done** (2026-07-26) |
| **AI-R1-code** | GAP-AI-01…05 copilot + score + draft + audit + override | ✅ **Done** (`main` @ `d2f07b8`) |
| **D** (doc) | SYS 006–012 + PORTAL P0 expand | Pending |
| **E** (product) | GAP-P1-01 finance gate UI, ~~GAP-P1-02 portal notify~~, GAP-Z4-01 | **Partial** — P1-02 ✅ Prod-S1 |
| **F** (product) | GAP-P1-03 Grafana portal | Pending |

---

## 6. Liên kết tài liệu

| Tài liệu | Nội dung |
|----------|----------|
| [`actions/README.md`](actions/README.md) | Quy ước bảng hành động |
| [`actions/00-SYSTEM-ACTIONS.md`](actions/00-SYSTEM-ACTIONS.md) | 12 SYS UC — multi-channel |
| [`actions/01-CRM-ACTIONS.md`](actions/01-CRM-ACTIONS.md) | **15/15 CRM UC** chi tiết (Phase B) |
| [`actions/02-SVC-ACTIONS.md`](actions/02-SVC-ACTIONS.md) | **12/12 SVC UC** (Phase B) |
| [`actions/03-META-ACTIONS.md`](actions/03-META-ACTIONS.md) | **14/14 META UC** (Phase C) |
| [`actions/04-SEO-ACTIONS.md`](actions/04-SEO-ACTIONS.md) | **14/14 SEO UC** (Phase C) |
| [`actions/05-EM-ACTIONS.md`](actions/05-EM-ACTIONS.md) | **14/14 EM UC** (Phase C) |
| [`actions/07-PLAT-ACTIONS.md`](actions/07-PLAT-ACTIONS.md) | **10/10 PLAT UC** (Phase C) |
| [`actions/08-ZALO-ACTIONS.md`](actions/08-ZALO-ACTIONS.md) | **21/21 ZALO UC** (Phase A) |
| [`actions/06-PORTAL-ACTIONS.md`](actions/06-PORTAL-ACTIONS.md) | PORTAL + UC-013/014 Zalo |
| [`huong-dan-zalo-ads-ops.md`](../huong-dan-zalo-ads-ops.md) | Ops handover Z1–Z3 |
