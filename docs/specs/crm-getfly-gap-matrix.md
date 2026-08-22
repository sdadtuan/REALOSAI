# Ma trận gap CRM vs Getfly — checklist PR theo màn hình

> **Phiên bản:** 1.9 · **Ngày:** 2026-07-26  
> **Mục đích:** Checklist PR khi nâng cấp ops-web `/crm/*` để đạt **table stakes ~80% CRM** (spec §20.5) so với [Getfly CRM](https://getfly.vn) — **không** copy ERP/LP builder.  
> **Traceability:** [`SPEC_AI_REVENUE_OPERATING_SYSTEM.md`](../SPEC_AI_REVENUE_OPERATING_SYSTEM.md) §4, §20 · [`SPEC_RNOSAI_MASTER.md`](../SPEC_RNOSAI_MASTER.md) · [`SPEC_UI_UX_PTT.md`](../SPEC_UI_UX_PTT.md)  
> **PR template chung:** [`docs/templates/pr-checklist-rnos-uc-ui-uat.md`](../templates/pr-checklist-rnos-uc-ui-uat.md)

---

## Cách dùng

1. **Chọn màn hình** trong bảng dưới — mỗi PR nên **chỉ đóng gap 1 màn** (hoặc 1 nhóm liên quan, ví dụ KPI dashboard).
2. **Author:** copy block checklist vào PR description; tick `- [ ]` → `- [x]`.
3. **Reviewer:** xác nhận screenshot/staging khớp cột **Done when**; không yêu cầu parity với mục 🚫 OUT.
4. **Gắn RNOS / parity ID** vào PR title khi có (ví dụ `RNOS-42: KPI dashboard tiles — /crm/kpi`).

### Chú thích trạng thái (as-is Jul 2026)

| Ký hiệu | Ý nghĩa |
|---------|---------|
| ✅ | Đạt parity hoặc vượt Getfly cho use case agency |
| ○ | Có màn hình + API; UX/widget còn thiếu |
| ❌ | Thiếu tính năng Getfly coi là table stakes |
| ➕ | RNOS có; Getfly không — **không bắt buộc** parity ngược |
| 🚫 | Cố ý không build (spec §20 OUT) |

### Parity ID (spec §20.5)

| ID | Hạng mục | Target wave |
|----|----------|-------------|
| P0-1 | Mobile / PWA lead care | R1 stretch |
| P0-2 | Import/export Excel | R1 |
| P0-3 | Workflow template dễ dùng | R2 |
| P1-1 | Custom field + pipeline admin | R2 (RNOS-35) |
| P1-2 | Calendar + reminder | R2 |
| P1-3 | Ticket / CS lite | R2 (RNOS-24) |
| P2-1 | Zalo ZNS broadcast | P2 |

---

## Tổng quan route ↔ Getfly

| Route ops-web | Tiêu đề sidebar | Module Getfly tương đương |
|---------------|-----------------|-------------------------|
| `/` | Bảng điều khiển | Trang chủ |
| `/crm` | Bảng CSKH | Launcher |
| `/crm/leads` | Quản lý Lead | Khách hàng F2 — danh sách |
| `/crm/leads/[id]` | Chi tiết lead | Khách hàng F2 — chi tiết |
| `/crm/leads/review-queue` | Phải tra soát (B2) | — (➕ agency) |
| `/crm/cskh-board` | Bảng CSKH SLA | Đừng quên + SLA |
| `/crm/customers` | Khách hàng | Khách hàng (post-convert) |
| `/crm/customers/[id]` | Chi tiết KH | Chi tiết KH |
| `/crm/intake` | Lead Intake | Optin (khác scope) |
| `/crm/sales` | Kinh doanh | Quản lý bán hàng F4 |
| `/crm/proposals` | Đề xuất | Báo giá |
| `/crm/hub` | Hub · Hợp đồng | — (➕) |
| `/crm/kpi` | KPI | KPI / F7 conversion |
| `/crm/staff-kpi` | KPI AM/SP | KPI NV |
| `/crm/business-dashboard` | Dashboard KD | Báo cáo |
| `/crm/owner-weekly` | BC tuần chủ DN | — |
| `/crm/financials` | Tài chính | Tài chính KT (🚫 ERP) |
| `/crm/payroll` | Chấm công & lương | HRM Getfly |
| `/crm/staff` | Nhân viên | Quản lý NV |
| `/crm/catalog` | Catalog | Sản phẩm / DV |
| `/crm/marketing-plan` | Kế hoạch marketing | Marketing plan |
| `/crm/service-delivery` | Triển khai DV | — (➕) |
| `/crm/sop` | Quy trình SOP | Automation (○) |
| `/crm/creatives` | Creative Hub | — (➕) |
| `/crm/campaign-writes` | Campaign Write | — (➕) |
| `/crm/launch-qa` | Launch QA | — (➕) |
| `/crm/re-projects` | Dự án BĐS | — (➕ vertical) |

---

## PR checklist theo màn hình

### 0. Shell topbar — Global search (RNOS-11 / UI-R2-07)

**Getfly:** Tìm nhanh KH / deal / ticket.  
**RNOS as-is:** ✅ Topbar search bar + `/api/v1/search` (OpenSearch only — `OPENSEARCH_URL` bắt buộc).

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 0.1 | [x] **Global search bar** trên topbar | R2 | `GlobalSearchBar` + entity filters |
| 0.2 | [x] API `GET /api/v1/search` index `search_entities` | R2 | account, contact, lead, deal, email, note, ticket |
| 0.3 | [x] OpenSearch client + `POST /api/v1/search/reindex` | R2 | `docker-compose.opensearch.yml` optional |

### 0b. `/crm/playbooks` — Playbook RAG (RNOS-12/36 / UI-R2-05)

**Getfly:** SOP / script bán hàng.  
**RNOS as-is:** ✅ Playbook library + RAG cite từ PostgreSQL vector chunks.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 0b.1 | [x] **Playbook library** `/crm/playbooks` | R2 | list + chunk viewer |
| 0b.2 | [x] **RAG query** `POST /api/v1/ai/playbooks/rag/query` | R2 | answer + citations |
| 0b.3 | [x] Vector store `ai_playbook_chunks.embedding_json` | R2 | PG only (no SQLite) |

### 0c. Copilot — Dismiss reason modal (RNOS-29 / UI-R2-06)

**Getfly:** —  
**RNOS as-is:** ✅ Follow-up draft dismiss → preset reason → `ai_recommendations.dismissed_reason` + analytics.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 0c.1 | [x] **DismissReasonModal** trên copilot follow-up | R2 | preset radio + PATCH dismissed |
| 0c.2 | [x] API `PATCH /api/v1/ai/recommendations/:id` + `dismiss_reason` | R2 | lưu PG |
| 0c.3 | [x] Analytics G6 tile + inbox `/crm/ai/insights` | R2 | acceptance rate + top reasons |

### 0d. Copilot — GDKD override score (AI-UC-006 / UI-R1-08)

**Getfly:** —  
**RNOS as-is:** ✅ GDKD điều chỉnh score trên copilot + audit `overridden_by`.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 0d.1 | [x] **ScoreOverrideModal** trên copilot | UI-R1-08 | score 0–100 + reason ≥10 |
| 0d.2 | [x] API `POST /api/v1/ai/scores/lead/override` | R1 | guard `crm_leads.assign` |
| 0d.3 | [x] Badge **GDKD điều chỉnh** + explain factor | R1 | E2E AI-UC-006 green |

---

### 1. `/` — Bảng điều khiển

**Getfly:** Trang chủ widget tóm tắt KH, công việc, pipeline.  
**RNOS as-is:** ○ Health API + lời chào; không widget CRM.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 1.1 | [ ] Widget **lead mới hôm nay** + link `/crm/leads` | ○ | Staging screenshot |
| 1.2 | [ ] Widget **SLA breach** (summary từ CSKH board) | ○ | Số khớp `/crm/cskh-board` |
| 1.3 | [ ] Widget **copilot DAU** (pilot, từ `ai_agent_runs`) | ➕ | Chỉ hiện khi AI enabled |
| 1.4 | [ ] Quick links: Lead, CSKH board, Hub | ○ | 3 link hoạt động |

**Không yêu cầu:** Full pipeline value chart như Getfly F4 (defer `/crm/sales`).

---

### 2. `/crm` — Bảng CSKH (launcher)

**Getfly:** —  
**RNOS as-is:** ○ Card grid module từ API.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 2.1 | [ ] Badge số **pending** trên card (review queue, hub approvals) | ○ | Số realtime hoặc poll 60s |
| 2.2 | [ ] Mô tả 1 dòng / icon thống nhất spec UI | ○ | Design review |

---

### 3. `/crm/leads` — Quản lý Lead (danh sách)

**Getfly F2:** Tab trạng thái, bộ lọc lưu, bulk, import/export, chọn cột.  
**RNOS as-is:** ○ Bảng + search + pagination 50.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 3.1 | [x] **Import Excel** lead (template + validate) | P0-2 | E2E hoặc script gate |
| 3.2 | [x] **Export Excel** (filter hiện tại / selected) | P0-2 | File tải được |
| 3.3 | [x] Filter chips: **owner**, **status**, **source**, **channel** | ○ | URL query persist |
| 3.4 | [x] Tab / view: **Tất cả** · **Của tôi** · **Chưa phân** | ○ | Match Getfly “người phụ trách” |
| 3.5 | [x] **Bulk assign** + bulk export | ○ | Chọn checkbox hàng · export ○ |
| 3.6 | [ ] **Cột tùy chọn** (⚙): owner, SLA, score | ○ | LocalStorage prefs |
| 3.7 | [x] Cột **AI Score** + badge hot/warm/cold | UI-R1-10 | Pilot cohort · `fetchAiScoresBatch` |
| 3.8 | [ ] Empty state + CTA ingest doc | ○ | Link runbook ingest |

**PR title gợi ý:** `crm/leads: import/export Excel (P0-2)` · `crm/leads: score column (UI-R1-10)`

---

### 4. `/crm/leads/[id]` — Chi tiết lead

**Getfly F2 detail:** Trao đổi, email/SMS, lịch, file, cơ hội.  
**RNOS as-is:** ✅ Form + activity + funnel + contract + **AI Copilot** (➕).

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 4.1 | [ ] **Upload file** đính kèm activity | ○ | File lưu + hiển thị timeline |
| 4.2 | [ ] @mention staff trong activity (optional) | ○ | Notify hoặc highlight |
| 4.3 | [x] Chip **campaign / CPL** → deep link Meta hub | ○ | Spec UI §12 attribution |
| 4.4 | [x] Nút **copy SĐT / Zalo** (không auto-send) | ○ | Clipboard |
| 4.5 | [x] Copilot: dismiss draft modal + feedback (UI-R2-06) | R2 | RNOS-29 gate green |
| 4.6 | [x] Copilot: trust footer BR-AI copy | UI-R1 | Text spec §15 · `copilot-trust-footer` |
| 4.7 | [ ] Mobile tab **AI** không regress (RNOS-39 E2E) | P0-1 | CI green |
| 4.8 | [x] GDKD **override score** modal | UI-R1-08 | AI-UC-006 — `POST /api/v1/ai/scores/lead/override` + badge |

**Không yêu cầu PR:** Nút “Gửi Zalo/Email trực tiếp” (🚫 BR-AI-01 — dùng follow-up draft).

---

### 5. `/crm/leads/review-queue` — Phải tra soát (B2)

**Getfly:** —  
**RNOS as-is:** ✅ ➕ Agency QA queue.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 5.1 | [ ] Badge count sync sidebar (`OpsNav`) | ○ | Khớp API count |
| 5.2 | [ ] E2E smoke assign/release | ○ | Playwright optional |

---

### 6. `/crm/cskh-board` — Bảng CSKH SLA

**Getfly:** “Đừng quên” + công việc quá hạn.  
**RNOS as-is:** ✅ ➕ Bulk assign/reschedule/export.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 6.1 | [ ] Export CSV/Excel parity Getfly download | P0-2 | File + filter giữ nguyên |
| 6.2 | [ ] Mobile card view `<768px` | P0-1 | Responsive screenshot |
| 6.3 | [ ] E2E giữ green (`cskh-board.spec.ts`) | ✅ | CI |

---

### 7. `/crm/customers` + `/crm/customers/[id]`

**Getfly:** Quản lý KH sau chốt; nhóm KH; lịch sử giao dịch.  
**RNOS as-is:** ✅ List + detail profile/issues/relations.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 7.1 | [ ] Filter **nhóm KH** / segment | ○ | Dropdown |
| 7.2 | [ ] Tab **timeline** thống nhất (RNOS-16) | ○ | Events từ timeline API |
| 7.3 | [ ] Link lead gốc + lifecycle active | ○ | Drill-down |

---

### 8. `/crm/intake` — Lead Intake (BANT)

**Getfly:** Optin form (Marketing module).  
**RNOS as-is:** ✅ ➕ Sessions; AI summary stub.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 8.1 | [ ] Sidebar link hoặc entry từ lead detail rõ ràng | ○ | UX review |
| 8.2 | [ ] Thay stub AI summary bằng `/ai/summarize` | R1 | API wired |

**🚫 Không build:** LP builder / optin designer.

---

### 9. `/crm/sales` — Kinh doanh

**Getfly F4:** Pipeline, đơn hàng, báo cáo bán hàng.  
**RNOS as-is:** ✅ 6 tabs; ○ Kanban không full-screen.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 9.1 | [ ] Tab **funnel**: Kanban kéo thả stage (optional) | ○ | PATCH status |
| 9.2 | [ ] Tab **reports**: chart thay JSON | ○ | Visual report |
| 9.3 | [x] Deal **score** badge + NBA card (RNOS-09/10) | R2 | `/crm/sales` funnel |

**Defer PR:** Đơn hàng bán lẻ → RNOS-25.

---

### 10. `/crm/proposals` — Đề xuất

**Getfly:** Báo giá từ KH.  
**RNOS as-is:** ✅ CRUD + generate.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 10.1 | [ ] Export PDF proposal | ○ | Download |
| 10.2 | [ ] Link proposal ↔ lead detail 2 chiều | ✅ | Verify navigation |

---

### 11. `/crm/hub` — Hub · Hợp đồng

**Getfly:** —  
**RNOS as-is:** ✅ ➕ Campaign maps + contract approvals.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 11.1 | [ ] Map spend → lead **≥80%** hiển thị trên UI | G1 | KPI label trên map |
| 11.2 | [ ] Contract approval → lifecycle auto-start visible | ✅ | Toast + link SD |

---

### 12. `/crm/kpi` — KPI

**Getfly F7:** Conversion charts, nguồn → tương tác.  
**RNOS as-is:** ○ List + **JSON chart**.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 12.1 | [x] **KPI tiles** (4–6 chỉ số tháng) | ○ | RNOS-42 |
| 12.2 | [x] **Line/bar chart** thay `JSON.stringify` | ○ | Chart library |
| 12.3 | [x] Alerts list giữ + badge severity màu | ○ | UX polish |
| 12.4 | [x] Export staff KPI Excel (giữ + polish UI) | P0-2 | Button rõ ràng |
| 12.5 | [x] Widget **AI acceptance rate** (G6) | RNOS-29 | SQL + tile |
| 12.6 | [x] **Editable grid** nhập actual (target/actual/%) | RNOS-44 | PATCH + bulk save |

**PR title gợi ý:** `RNOS-42: /crm/kpi dashboard v1`

---

### 13. `/crm/staff-kpi` — KPI AM/SP

**Getfly:** KPI gắn NV/KH.  
**RNOS as-is:** ○ Picker + metric list.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 13.1 | [ ] Bar chart so sánh NV cùng role | ○ | Period filter |
| 13.2 | [ ] Drill-down → `/crm/staff/[id]` | ○ | Link |
| 13.3 | [ ] Progress vs target (nếu có target API) | ○ | % bar |

---

### 14. `/crm/business-dashboard` — Dashboard kinh doanh

**Getfly:** Executive reports.  
**RNOS as-is:** ✅ **Dashboard v2** (RNOS-42/46): tiles, 12-week sparkline, attribution drill, trend panels.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 14.1 | [x] Layout **2×2 cards**: revenue, AR, retention, alerts | ○ | RNOS-42 |
| 14.2 | [x] Trend sparkline 12 tuần | ○ | RNOS-46 |
| 14.3 | [x] Drill ≤3 click → hub → campaign → lead | ○ | RNOS-46 |
| 14.4 | [x] Không còn `<pre>` JSON làm UI chính | ○ | RNOS-42 |

**Shipped:** RNOS-42 → RNOS-46 (gate PASS).

---

### 15. `/crm/owner-weekly` — Báo cáo tuần chủ DN

**Getfly:** — (báo cáo tùy biến).  
**RNOS as-is:** ○ 4 khối JSON + export.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 15.1 | [ ] Layout in-ready: Cash · Business · Efficiency · Risk | ○ | PDF/export |
| 15.2 | [ ] Config patch UI polish (owner weekly config) | ○ | Form validated |
| 15.3 | [ ] Narrative text summary (optional AI) | R3 | Defer OK |

---

### 16. `/crm/financials` — Tài chính (front-office)

**Getfly:** Module kế toán ERP.  
**RNOS as-is:** ○ Lifecycle margin table + JSON AR.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 16.1 | [x] **AR aging chart** (bucket 30/60/90) | ○ | Visual |
| 16.2 | [x] Drill lifecycle → `/crm/service-delivery/[id]` | ○ | Link |
| 16.3 | [x] Copy footer: “Không thay ERP MISA” | 🚫 | FAQ §20.6 |
| 16.4 | [x] Tile **Burn rate** + runway aggregate | RNOS-45 | Intelligence API |
| 16.5 | [x] Tile **Margin at risk** (count + VND) | RNOS-45 | Threshold from KPI config |
| 16.6 | [x] Sparkline doanh thu vs chi phí 6 tháng | RNOS-45 | Intelligence trends |
| 16.7 | [x] Section **Cần xử lý** (margin đỏ + AR &gt;30d) | RNOS-45 | Action list |
| 16.8 | [x] Badge **Blocked** payment gate trên lifecycle AR overdue | RNOS-45 | GAP-P1-01 hook |

**🚫 Không PR:** Sổ cái, HĐ GTGT, tồn kho — export connector riêng.

---

### 17. `/crm/payroll` — Chấm công & lương

**Getfly HRM:** Chấm công, lương.  
**RNOS as-is:** ○ Lists + JSON policy.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 17.1 | [ ] Tab layout thay single scroll JSON | ○ | UX |
| 17.2 | [ ] Export payslip / attendance Excel | P0-2 | Optional |

---

### 18. `/crm/staff` + `/crm/staff/[id]`

**Getfly:** Quản lý NV, phòng ban.  
**RNOS as-is:** ✅ Roster 4 tabs; ○ detail read-only.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 18.1 | [ ] Import roster Excel | P0-2 | Template |
| 18.2 | [ ] Staff detail: KPI mini + lead list pagination | ○ | `/crm/staff/[id]` |
| 18.3 | [ ] Org tree / phòng ban (optional) | ○ | Defer R2 |

---

### 19. `/crm/catalog` — Catalog

**Getfly:** Sản phẩm.  
**RNOS as-is:** ✅ Services/industries/scopes.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 19.1 | [ ] Export/import catalog CSV | P0-2 | Optional |

---

### 20. Marketing ops (RNOS ➕ — polish only)

Routes: `/crm/marketing-plan`, `/crm/sop`, `/crm/creatives`, `/crm/campaign-writes`, `/crm/launch-qa`, `/crm/service-delivery`.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 20.1 | [ ] `/crm/marketing-plan/[id]`: form đủ field plan | ○ | Not stub |
| 20.2 | [x] **`/crm/automation`** workflow builder + AI nodes + simulate | P0-3 / UI-R2-04 | RNOS-13…15 |
| 20.3 | [ ] E2E regression creatives / campaign-writes | ➕ | CI optional |

**Không so Getfly 1:1** — đây là moat agency.

---

### 21. `/crm/re-projects` — Dự án BĐS

**Getfly:** —  
**RNOS as-is:** ✅ ➕ 11 tabs incl. accounting.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 21.1 | [ ] Tab accounting: chart forecast vs actual | ○ | RE vertical |
| 21.2 | [ ] Export project Excel | P0-2 | Optional |

---

### 22. PWA / Mobile (cross-cutting)

**Getfly:** App iOS/Android.  
**RNOS as-is:** ❌ PWA prod; ✅ RNOS-41 code + gate PASS; ○ responsive + tab AI.  
**Spec chi tiết:** [`2026-08-01-rnosai-mobile-strategy-spec.md`](./2026-08-01-rnosai-mobile-strategy-spec.md)

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 22.1 | [ ] `manifest.json` + icons + install prompt | P0-1 | Lighthouse installable |
| 22.2 | [ ] Service worker: shell + cached lead list read | P0-1 | Offline smoke |
| 22.3 | [ ] `/crm/leads` card list mobile | P0-1 | Screenshot 390px |
| 22.4 | [ ] RNOS-39 E2E mobile tab AI | ✅ | CI green |

**PR title gợi ý:** `RNOS-41: PWA lead care v1`

---

### 23. Admin & settings (chưa có route)

**Getfly:** Cài đặt → Định nghĩa dữ liệu, pipeline admin.

| # | PR checklist | Parity | Done when |
|---|--------------|--------|-----------|
| 23.1 | [x] **`/admin/ai/runs`** table + filter | UI-R1-09 | RBAC admin |
| 23.2 | [ ] **`/admin/crm/custom-fields`** CRUD | P1-1 | RNOS-35 |
| 23.3 | [ ] **`/admin/crm/pipeline`** stage editor | P1-1 | RNOS-35 |
| 23.4 | [ ] **`/crm/calendar`** month view + reminder | P1-2 | RNOS calendar |
| 23.5 | [x] **`/crm/tickets`** lite CRUD + sentiment | P1-3 | RNOS-24 |

---

## Màn hình 🚫 OUT — không mở PR parity

| Getfly module | Lý do | Thay thế RNOS |
|---------------|-------|---------------|
| Landing page builder 1000+ mẫu | §20 OUT | Form UTM + SEO |
| ERP kế toán / sổ cái | §20 OUT | Export MISA connector |
| Tồn kho / mua hàng VI | OUT retail | — |
| Chatbot Fanpage generic | Không moat | Meta ads OS |
| Call center click-to-call | Addon | Activity type `call` |

---

## Ma trận ưu tiên PR (gợi ý backlog)

| Ưu tiên | PR bundle | Màn | Parity |
|---------|-----------|-----|--------|
| **P0** | ~~Gate R1 pilot~~ ✅ | `/crm/leads/[id]` copilot prod | R1 |
| **P0** | RNOS-41 | PWA §22 | P0-1 |
| **P0** | Import/export | `/crm/leads` §3.1–3.2 | P0-2 |
| **P1** | RNOS-42 KPI UX | §12, §15 | Dashboard |
| **P1** | ~~UI-R1-09~~ ✅ | §23.1 AI admin runs | R1 |
| **P1** | Leads UX | §3.3–3.6 filter chips, tabs, bulk | Getfly F2 |
| **P2** | RNOS-35 | §23.2–23.3 | Custom field |
| **P2** | RNOS-24 | §23.5 | Ticket |

---

## Template PR description (copy-paste)

```markdown
## CRM ↔ Getfly gap — màn hình: `/crm/___`

**Parity ID:** P0-_ / P1-_ / RNOS-__
**Spec:** docs/specs/crm-getfly-gap-matrix.md §___

### Checklist (tick all before merge)

- [ ] … (copy từ section tương ứng)
- [ ] Staging screenshot attached
- [ ] Không vi phạm 🚫 OUT / BR-AI-01
- [ ] Regression: RNOS-39 E2E (nếu chạm lead/copilot)

### Done when

(1–2 câu từ cột Done when)
```

---

## Changelog

| Ngày | Phiên bản | Ghi chú |
|------|-----------|---------|
| 2026-07-26 | 1.0 | Ma trận ban đầu — as-is ops-web `main` post RNOS-39 |
| 2026-07-26 | 1.5 | §9.3 complete — RNOS-09 deal score + RNOS-10 NBA on sales funnel |
| 2026-07-26 | 1.6 | §0 complete — RNOS-11 OpenSearch global search bar + search API |
| 2026-07-26 | 1.7 | §0b complete — RNOS-12/36 playbook library + RAG at /crm/playbooks |
| 2026-07-26 | 1.8 | §0c complete — RNOS-29 dismiss reason modal on copilot (UI-R2-06) |
| 2026-07-26 | 1.9 | §0d + §4.8 — AI-UC-006 GDKD override score · §3.7 AI Score column pilot |

---

*Cập nhật file này khi ship PR đóng gap — đổi trạng thái as-is trong section tương ứng.*
