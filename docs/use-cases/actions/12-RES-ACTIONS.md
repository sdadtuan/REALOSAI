# Chi tiết hành động — Market Research OS (RES)

> **UC gốc:** [`../12-MARKET-RESEARCH-OS.md`](../12-MARKET-RESEARCH-OS.md)  
> **BA:** [`../../specs/modules/RNOSAI-BA-RES-UseCases.md`](../../specs/modules/RNOSAI-BA-RES-UseCases.md)  
> **UX:** [`../../specs/2026-08-14-market-research-os-ui-ux.md`](../../specs/2026-08-14-market-research-os-ui-ux.md)  
> **SRS:** [`../../specs/2026-08-14-market-research-os-srs.md`](../../specs/2026-08-14-market-research-os-srs.md)  
> **Phiên bản:** 1.0 · **Coverage:** RES-UC-001…020 (P0 UAT) + walkthrough P1–P7 + P8 UAT 072 (this update does not re-sign P0–P7)

---

## Walkthrough UAT — Happy path G0 → DOCX (≈40 phút)

**Mục tiêu khách hàng:** *«AM brief 1 quyết định → Analyst desk + evidence → Lead duyệt insight → xuất DOCX CB.»*

**Actors:** AM, Research Analyst (AN), Research Lead (LD), QA

**Dữ liệu test:** Client `acme` trong scope AM+AN+LD · Client `beta` chỉ user khác (tenancy) · Flag research = 1 · Tavily key **có** trên staging (hoặc chạy nhánh E-Tavily)

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | `/login` | Đăng nhập cap `crm_research.create` | credentials | JWT | ✓ flag on |
| 2 | AM | OpsNav | Thấy nhóm **Lên kế hoạch** | — | Research + Marketing plan | ✓ RES-UC-001 · EC-RES-01 |
| 3 | AM | Nav Triển khai | Xác nhận **không** còn «Kế hoạch marketing» | — | Plan chỉ ở Lên kế hoạch | ✓ |
| 4 | AM | `/crm/sales?tab=market` | Regression NCTT BĐS | — | Tab Market BĐS nguyên | ✓ EC-RES-07 |
| 5 | AM | `/crm/research` | **Tạo project** | — | Wizard | ✓ |
| 6 | AM | Wizard 1 | Client Acme, title, tier **CB** | Acme / Sữa uống 2026 | Valid | ✓ |
| 7 | AM | Wizard 2 | Card **Category review** | CAT_REVIEW | Selected | ✓ |
| 8 | AM | Wizard 3 | Decision ≥20 ký tự | *Quyết định có mở SKU premium Q4 tại MT HCM hay không.* | Counter OK | ✓ RES-UC-002 |
| 9 | AM | Wizard 4 | Geo VN, language vi, risk medium | — | Chips | ✓ |
| 10 | AM | Wizard 5 | 1 RQ | *Quy mô thị trường sữa uống VN 2025–26?* | ≥1 dòng | ✓ RES-UC-003 |
| 11 | AM | Submit | **Tạo dự án** | — | Redirect `tab=brief` status Tiếp nhận | ✓ EC-RES-02 |
| 12 | AN | Brief | **Đổi trạng thái → Thiết kế** rồi **Thu thập** | — | Status collecting | ✓ RES-UC-015 |
| 13 | AN | Sources | RQ Q1 · **Chạy Desk Tavily** | question_id | Chip job · 202 | ✓ RES-UC-004 |
| 14 | AN | Same | Đợi job succeeded | — | ≥1 source AI | ✓ EC-RES-03 |
| 15 | AN | Same | Tick **Keep** nguồn tin cậy | keep=true | PATCH | ✓ RES-UC-014 |
| 16 | AN | Evidence | **Tạo evidence** từ source | locator + excerpt hoặc value+unit | EV-xx pending | ✓ RES-UC-006 |
| 17 | AN | Same | **Verify** ≥5 nguồn / ≥5 evidence (pilot A tối thiểu 1 P0 UAT; staging 1+) | — | Lock icon | ✓ |
| 18 | AN | Insights | **+ Insight** gắn EV verified + rationale | statement 4 khối | draft → evidence_attached | ✓ RES-UC-007 |
| 19 | AN | Same | **Gửi Lead duyệt** | — | analyst_verified | ✓ |
| 20 | LD | Insight drawer | **Duyệt nội bộ** (user ≠ creator) | comments | `approved_internal` | ✓ RES-UC-008 · EC-RES-04 · EC-RES-11 |
| 21 | AM | Same | **Duyệt bản khách** | — | `approved_client_facing` | ○ RES-UC-018 |
| 22 | AN | Report | Tick insight · **Tạo bản báo cáo** | — | version v1 | ✓ RES-UC-009 |
| 23 | AN | Preview | Kiểm appendix + evidence index | — | Blocks đủ | ✓ EC-RES-05 |
| 24 | AM | Same | **Xuất DOCX** | cap export | Download | ✓ |
| 25 | QA | User client Beta | GET `/projects/{acmeId}` | token beta | 403 không title | ✓ RES-UC-010 · EC-RES-06 |
| 26 | QA | Activity | `crm_research_ai_runs` desk row | SQL/UI | logged | ✓ EC-RES-12 |
| 27 | QA | Flag 0 (staging copy) | Nav ẩn + API 404 | — | empty VI | ✓ RES-UC-013 · EC-RES-08 |

#### Nhánh E-Tavily — không key

Bước 13: job `failed` `tavily_unconfigured` · banner vàng · project vẫn mở · AN thêm nguồn thủ công (RES-UC-019) rồi tiếp bước 16.

#### Nhánh E-Deep

Sau bước 14: **Chạy Deep Research** → modal cảnh báo → sources nháp thêm · **không** insight mới (EC-RES-09).

#### Nhánh E-Gate

Bước 20 với 0 evidence: dialog «Thiếu evidence đã verify» · không đổi status.

#### Nhánh E-SoD

AN tự bấm Duyệt nội bộ: 403 / banner người tạo không tự duyệt.

#### Nhánh E-Immutable

PATCH excerpt evidence verified: 409 · phải supersede (RES-UC-017).

#### Tiêu chí nghiệm thu walkthrough

- [ ] Bước 1–27 pass staging (hoặc E-Tavily + thủ công)
- [ ] DOCX có cover, exec, findings, recs, methodology stub, evidence index
- [ ] Nav Lên kế hoạch đúng
- [ ] PO / Research Lead sign EC-RES-01…12

---

## RES-UC-001 — Nav + list

**Mục tiêu:** *«Vào đúng nhóm PLAN, thấy queue project.»*

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | Sidebar | Mở **Lên kế hoạch** | — | 2 link | ✓ |
| 2 | AM | `/crm/research` | Filter Client / Status / Type | Acme | Query persist | ✓ |
| 3 | AM | Row | Click tiêu đề | — | Workspace Brief | ✓ |
| 4 | AM | Empty (env sạch) | Đọc empty + CTA | — | Tạo project | ○ |

#### Tiêu chí nghiệm thu
- [ ] Marketing plan không nằm Triển khai
- [ ] Không deep-link Sales Market từ Research

---

## RES-UC-002 — Wizard G0

**Mục tiêu:** *«Brief đúng quyết định kinh doanh — lỗi field tiếng Việt.»*

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | `/crm/research/new` | Bỏ trống client · Submit | — | Inline lỗi | ✓ |
| 2 | AM | Bước 3 | Gõ 10 ký tự | short | Counter đỏ <20 | ✓ |
| 3 | AM | Bước 5 | Xóa hết RQ · Submit | — | Chặn ≥1 RQ | ✓ |
| 4 | AM | Happy | 5 bước hợp lệ | payload SRS 5.2 | 201 + Brief | ✓ |

---

## RES-UC-003 — CRUD RQ

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | Brief | **+ Thêm câu hỏi** | Q2 text | Row mới | ✓ |
| 2 | AM | Same | Sửa Q1 | — | PATCH | ✓ |
| 3 | AM | Same | Xóa RQ đã có EV | — | 409 + tooltip | ✓ |

---

## RES-UC-004 — Desk Tavily

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Sources | Chọn Q1 · **Chạy Desk Tavily** | — | Chip pending | ✓ |
| 2 | AN | Same | Click Chạy lần 2 khi running | — | Disabled / 409 | ✓ |
| 3 | System | Worker | Tavily | credits | sources AI | ✓ |
| 4 | AN | Activity | Mở run | — | provider tavily | ✓ |

---

## RES-UC-005 — Deep Research

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Sources | **Chạy Deep Research** | — | Modal cảnh báo | ✓ |
| 2 | AN | Modal | Chọn Q1 · **Chạy** | — | Job ≤15 phút | ✓ |
| 3 | AN | Insights | Đếm card mới | — | **0** insight auto | ✓ EC-RES-09 |

---

## RES-UC-006 — Evidence

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Source row | **Tạo evidence** | — | Drawer | ✓ |
| 2 | AN | Drawer | Bỏ locator · Lưu | — | 400 | ✓ |
| 3 | AN | Drawer | Locator + excerpt · **Verify** | page/URL# | EV verified lock | ✓ |

---

## RES-UC-007 / 008 — Insight + duyệt

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Insights | Tạo không gắn EV · Gửi duyệt | — | Dialog gate | ✓ |
| 2 | AN | Drawer | Gắn EV + rationale · Gửi | — | chờ Lead | ✓ |
| 3 | LD | Drawer | Duyệt nội bộ | comments | approved_internal | ✓ |
| 4 | AN | Drawer | Tự duyệt (SoD) | — | 403 banner | ✓ |

---

## RES-UC-009 — DOCX

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Report | Tạo version | insight IDs | v1 hash | ✓ |
| 2 | AM | Preview | **Xuất DOCX** | — | file | ✓ |
| 3 | AM | File | Mở Word | — | appendix + index EV | ✓ |

---

## RES-UC-010 / 013 / 017 / 020 — Cross-cut

| # | Actor | Thao tác | Phản hồi | Gate |
|---|-------|----------|----------|------|
| 1 | User Beta | Mở URL project Acme | 403 không title | ✓ 010 |
| 2 | Ops | Tắt flag | Nav ẩn, API 404 | ✓ 013 |
| 3 | AN | Sửa excerpt verified | 409 supersede | ✓ 017 |
| 4 | AN | Retry job failed | Run mới, project OK | ✓ 020 |

---

## Walkthrough UAT P1 — Rubric → consult chip (≈25 phút)

**Mục tiêu khách hàng:** *«AM/Analyst siết rubric, snapshot đối thủ, chèn insight vào plan, chặn TC thiếu methodology, mở Research từ DV12, tam giác nguồn, prefill consult.»*

**Actors:** AM, Research Analyst (AN), Research Lead (LD), QA

**Dữ liệu test:** Client `acme` trong scope · Flag research = 1 (P0 đã bật) · Project P0 hoặc tạo mới · Consult `form_data` có industry + đối thủ (có thể kèm `0909…` để xác nhận strip)

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Insight drawer | Mở rubric 5 slider S/F/T/A/R | 0–4 | JSON lưu `confidence_json` | ✓ RES-UC-021 |
| 2 | AN | Same | Gửi duyệt thiếu rubric | — | 400 `missing_confidence_rubric` | ✓ EC-P1-rubric |
| 3 | AN | Tab Đối thủ | Thêm alias + snapshot gắn source | fact + source_id | Snapshot name-only không leak | ✓ RES-UC-022 |
| 4 | AM | Marketing-plan | **Chèn insight** cùng `client_id` | insight_ids | Snapshot JSON **không** có `statement` | ✓ RES-UC-023 |
| 5 | AN | Report TC | Export thiếu methodology | stub | 400 `methodology_incomplete` | ✓ RES-UC-024 |
| 6 | AN | Report TC | Điền population / source_plan / limitation | 3 field | Export OK | ✓ |
| 7 | AM | Service-delivery DV12 | CTA **Mở Research Project** | slug `phan-tich-thi-truong` | Wizard `lifecycle_id` + `client_id` từ `agency_client_id` | ✓ RES-UC-025 |
| 8 | AN | Sources | **Tam giác nguồn** | question_id | Job `research_triangulate` 202 | ✓ RES-UC-026 |
| 9 | AN | Same | Đợi overlap URL | — | Badge «Trùng 2 provider» · **0** insight mới | ✓ EC-P1-triangulate |
| 10 | AM | Wizard bước 1 | Chọn client có consult | client_id | Chip ngành + từng đối thủ | ✓ RES-UC-027 |
| 11 | AM | Same | «Dùng gợi ý» / «Bỏ» từng dòng | confirm | `prefill_competitors` → đối thủ nháp (không snapshot) | ✓ |
| 12 | QA | Prefill JSON | Form có `0909…` | GET `/prefill?client_id=` | 200 · JSON **không** chứa số đó · không 404 | ✓ BR-RES-11 |

#### Tiêu chí nghiệm thu walkthrough P1

- [ ] Bước 1–12 pass staging (triangulate skip live nếu không Tavily)
- [ ] Plan snapshot không chứa `statement`
- [ ] Prefill không chứa SĐT/email/tên người
- [ ] Không đụng `/crm/sales?tab=market`
- [ ] PO / Research Lead sign P1 ECs

---

## Walkthrough UAT P2 — Study → analytics (≈20 phút)

**Mục tiêu khách hàng:** *«Analyst gắn study/consent (không transcript thô); pulse báo Ops khi trend đổi (không auto-publish insight); Lead duyệt exec EN; AM xem cycle time trên analytics.»*

**Actors:** AM, Research Analyst (AN), Research Lead (LD), QA

**Dữ liệu test:** Client `acme` trong scope · Flag research = 1 (P0 đã bật) · Project P0/P1 hoặc tạo mới · Caps `crm_research.edit` (study/consent), `run` (pulse), `approve` (exec EN), `view` (analytics)

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Workspace tab **Studies** | **+ Thêm study** | IDI sữa / idi / n=8 | Study row | ✓ RES-UC-030 |
| 2 | AN | Same · **Consent** | **Ghi consent** mã giả danh | R-004 / record · notes không SĐT | 201 consent | ✓ RES-UC-030 |
| 3 | AN | Evidence | Tạo evidence gắn `study_id` + locator | T-12:03 · excerpt ngắn | EV gắn study · excerpt 800 → 400 `raw_transcript_forbidden` | ✓ RES-UC-030 |
| 4 | AN | Sources | **Chạy pulse** (cap `run`) | question_id | Job `research_pulse` 202 · **0** insight mới | ✓ RES-UC-031 |
| 5 | AN / Ops | `/crm/ops/alerts` | Mở **«Cảnh báo pulse»** | lifecycle có DV12 | `ops_alert_log` `alert_type=research_pulse` · `dv_code=DV12` | ✓ RES-UC-031 |
| 6 | AN | Report | Điền **Executive (EN)** | bản dịch draft | `en_status=draft` · VI không đổi | ✓ RES-UC-032 |
| 7 | LD | Same | **Duyệt bản dịch** (user ≠ `generated_by`) | cap `approve` | `en_status=approved` · sửa lại → 400 `exec_en_locked` | ✓ RES-UC-032 · BR-RES-05/07 |
| 8 | AM | `/crm/research/analytics` | Mở **Phân tích nghiên cứu** | cap `view` | 3 thẻ: chu kỳ p50 / % evidence verify / project đã giao · Beta 403 không `title` | ✓ RES-UC-033 |

#### Nhánh E-Consent PII

Bước 2 notes chứa `0909123456`: 400 `consent_pii_forbidden` · không persist.

#### Nhánh E-Pulse no insight

Bước 4: worker `insight_ids: []` · Jest `createInsight` không được gọi · không published insight.

#### Nhánh E-SoD EN

AN tự **Duyệt bản dịch**: 403 `cannot_self_approve`.

#### Tiêu chí nghiệm thu walkthrough P2

- [ ] Bước 1–8 pass staging (pulse skip live nếu API down / không Tavily)
- [ ] Consent PII 400; pulse không tạo insight; EN approved khóa; analytics 403 không title
- [ ] Không đụng `/crm/sales?tab=market`
- [ ] PO / Research Lead sign P2 ECs

---

## Walkthrough UAT P3 — Embargo → decision (≈20 phút)

**Mục tiêu khách hàng:** *«AM công bố report đã duyệt lên portal (không auto); khách Acme đọc watermark; Beta không thấy title; Analyst gắn 2 wave TRACKER và so sánh; AM ghi decision sau readout.»*

**Actors:** AM, Research Analyst (AN), Research Lead (LD), Client Acme, Client Beta, QA

**Dữ liệu test:** Client `acme` trong scope · Client `beta` ngoài scope · Flag research = 1 (P0 đã bật) · Report version đã duyệt insight client-facing · Project `TRACKER` (waves) + project bất kỳ (decision) · Caps `crm_research.edit` (embargo, waves, decisions), `approve` (publish-portal), `view` (GET) · Portal JWT `client_id` = `clients.id`

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | Report tab | Điền **embargo** / **expiry** | ISO datetime | Version giữ snapshot/vi · `embargo_until` / `expires_at` | ✓ RES-UC-040 |
| 2 | LD | Same | **Công bố portal** (cap `approve`, user ≠ `generated_by`) | `{ visible: true }` | `portal_visible=true` · insight chưa client-facing → 400 `insights_not_client_facing` | ✓ RES-UC-040 · BR-RES-01 |
| 3 | Acme | Portal `/research` + `/research/:versionId` | Mở report đã công bố | Portal JWT Acme | Watermark `CONFIDENTIAL · {client_id} · {email} · {YYYY-MM-DD}` · không `title` | ✓ RES-UC-040 · US-CL-30 |
| 4 | Beta | Same GET version Acme | Đọc chéo tenant | Portal JWT Beta | 403 `{error:forbidden}` · JSON **không** `title` | ✓ EC-P3-portal · BR-RES-12 |
| 5 | AN | Workspace tab **Waves** (TRACKER) | **+ Wave** ×2 | wave_no 1–2 + `metric_json` | 2 row persist · CAT_REVIEW → 400 `waves_not_tracker` | ✓ RES-UC-041 |
| 6 | AN | Same | Xem **So sánh 2 wave gần nhất** | 2 wave cùng `key` | Hàng delta (`waveDelta`) | ✓ RES-UC-041 |
| 7 | AM | Tab **Quyết định** | Ghi decision gắn insight ≥ `approved_internal` | text ≥ 10 + owner | 201 decision `open` · draft insight → 400 `insight_not_approved` | ✓ RES-UC-042 |
| 8 | AM / QA | Same · F5 | Reload | — | Decision + 2 wave + `portal_visible` còn | ✓ F5 |

#### Nhánh E-Publish gate

Bước 2 insight `approved_internal` (chưa client-facing): 400 `insights_not_client_facing` · `portal_visible` vẫn `false`. Tạo report mới **không** tự công bố.

#### Nhánh E-Portal tenancy

Bước 4: Beta 403 `{ error: 'forbidden' }` · `JSON.stringify(body)` không chứa `title` / competitor `name` / study `name`.

#### Nhánh E-Waves CAT_REVIEW

Bước 5 trên project không TRACKER: 400 `waves_not_tracker` · tab Waves ẩn.

#### Nhánh E-Decision draft

Bước 7 insight `draft`: 400 `insight_not_approved`. Text 3 ký tự: 400 `validation_error`. Pulse / publish-portal **không** insert decision.

#### Tiêu chí nghiệm thu walkthrough P3

- [ ] Bước 1–8 pass staging (portal skip live nếu API/portal down)
- [ ] Publish không client-facing 400; portal cross-tenant 403 không title; waves CAT_REVIEW 400; decision draft insight 400
- [ ] Không đụng `/crm/sales?tab=market`
- [ ] PO / Research Lead sign P3 ECs

---

## Walkthrough UAT P4 — PDF → cite (≈20 phút)

**Mục tiêu khách hàng:** *«AM xuất PDF staff (DOCX vẫn OK); Lead công bố; Acme tải PDF watermark; Beta 403 không title; AM cite insight vào Content OS; PATCH brief không mất cite; F5 còn.»*

**Actors:** AM, Research Analyst (AN), Research Lead (LD), Client Acme, Client Beta, QA

**Dữ liệu test:** Client `acme` trong scope · Client `beta` ngoài scope · Flag research = 1 (P0 đã bật) · Report version đã duyệt insight client-facing · Content OS item cùng `agency_client_id` · Caps `crm_research.export` (PDF staff), `view` (GET), `approve` (publish), `edit` + `crm_content.write` (cite) · Portal JWT `client_id` = `clients.id`

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | Report tab | **Xuất PDF** | `format=pdf` | 200 `application/pdf` · buffer `%PDF-` | ✓ RES-UC-050 |
| 2 | AM | Same | **Xuất DOCX** | no format / `docx` | 200 DOCX (P0 không regress) | ✓ RES-UC-009 · 050 |
| 3 | LD | Same | **Công bố portal** (cap `approve`, user ≠ `generated_by`) | `{ visible: true }` | `portal_visible=true` · `published_by` / `published_at` stamp | ✓ RES-UC-040 · M4 |
| 4 | Acme | Portal `/research/:versionId` | **Tải PDF** | Portal JWT Acme | 200 `%PDF-` · watermark `CONFIDENTIAL · {client_id} · {email} · {YYYY-MM-DD}` | ✓ RES-UC-050 · US-CL-30 |
| 5 | Beta | Same GET `export.pdf` Acme | Đọc chéo tenant | Portal JWT Beta | 403 `{error:forbidden}` · JSON **không** `title` | ✓ EC-P4-portal · BR-RES-12 |
| 6 | AM | Content OS item | **Chèn insight** cùng client | `insight_ids` ≥ `approved_internal` | Snapshot `brief_json.market_research` **không** `statement` · draft → 400 `insight_not_approved` | ✓ RES-UC-051 |
| 7 | AM | Same | PATCH brief (hook/body) | `brief_json` không gửi cite | Cite `insight_ids` **còn** · inbound `market_research` bị strip | ✓ RES-UC-051 |
| 8 | AM / QA | Same · F5 | Reload | — | PDF staff + portal + cite + publish audit còn | ✓ F5 |

#### Nhánh E-Portal PDF tenancy

Bước 5: Beta 403 `{ error: 'forbidden' }` · `JSON.stringify(body)` không chứa `title`. PDF **không** được build.

#### Nhánh E-Cite draft

Bước 6 insight `draft`: 400 `insight_not_approved`. Thiếu `crm_content.write`: 403 `missing_cap`.

#### Nhánh E-Wave NaN

POST wave `value: NaN` / `Infinity`: 400 `metric value must be number or null`.

#### Tiêu chí nghiệm thu walkthrough P4

- [ ] Bước 1–8 pass staging (portal/cite skip live nếu API/portal down)
- [ ] Staff PDF `%PDF-`; DOCX không regress; portal cross-tenant 403 không title; cite draft 400; wave NaN 400
- [ ] Không đụng `/crm/sales?tab=market`
- [ ] PO / Research Lead sign P4 ECs

---

## Walkthrough UAT P5 — Whisper + SparkToro (≈20 phút)

**Mục tiêu khách hàng:** *«Analyst ghi consent → tải audio IDI → excerpt ≤ 500 + locator; F5 không transcript; SparkToro (hoặc disabled) → source có limitation; không insight mới; F5 còn.»*

**Actors:** Research Analyst (AN), QA

**Dữ liệu test:** Client `acme` trong scope · Flag research = 1 (P0 đã bật) · `RESEARCH_SPARKTORO_ENABLED` mặc định `0` (không bật trong deploy) · Study + consent còn hạn · Audio ≤ 25 MB MIME `audio/mpeg|wav|mp4|x-m4a` · Caps `crm_research.run` (Whisper / SparkToro), `edit` (evidence), `view` (GET)

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Studies `?tab=studies` | Ghi **consent** còn hạn trên study | `expires_at` > now (recorded_at + 24 tháng) | Consent saved | ✓ RES-UC-060 · NFR-PRI-01 |
| 2 | AN | Same | **Tải audio** (cap `run`) | file ≤ 25 MB | 202 `{ok, run_id, excerpt_ids}` · poll job | ✓ RES-UC-060 |
| 3 | AN | Evidence | Kiểm excerpt | locator `T-mm:ss` | Mỗi excerpt length ≤ 500 | ✓ NFR-PRI-02 |
| 4 | AN | Same · F5 | Reload | — | Excerpts còn · **không** transcript / `audio_uri` / ô dán transcript | ✓ F5 · NFR-PRI-02 |
| 5 | AN | Sources `?tab=sources` | **Chạy SparkToro** — hoặc thấy nút ẩn + note disabled | `question_id` (question_vi + geo; không PII) | `200 {ok:true, note:sparktoro_disabled}` **hoặc** `202` sources | ✓ RES-UC-061 |
| 6 | AN | Same | Kiểm source SparkToro (nếu job chạy) | publisher `SparkToro` | `limitation_note` bắt buộc · `reliability_tier` ∈ {low, medium} | ✓ BR-RES-09 |
| 7 | AN | Insights | Đếm insight | — | **Không** insight mới từ Whisper / SparkToro (`createInsight` không gọi) | ✓ BR-RES-06/08 |
| 8 | AN / QA | Same · F5 | Reload | — | Excerpts + sources (nếu có) còn · không raw transcript | ✓ F5 |

#### Nhánh E-Consent

Bước 2 study 0 consent / hết hạn: 400 `{error:consent_required|consent_expired}` · không gọi OpenAI.

#### Nhánh E-Raw transcript

Evidence excerpt > 500: 400 `{error:raw_transcript_forbidden}`. Complete payload chỉ `excerpt_ids` — không key `transcript`.

#### Nhánh E-SparkToro off

`GET /health` `sparktoro_enabled=false` (flag hoặc key off) → **không** CTA **Chạy SparkToro**. `POST …/run-sparktoro` → `200 {ok:true, note:sparktoro_disabled}` — project không fail.

P5 **không** có live SparkToro HTTP: `collect` trả fixture rỗng. Flag + key on vẫn 0 source cho đến khi PO mua API (P6+). RES-UC-061 UAT verify bằng fixture / `sparktoro_disabled`, không census live.

#### Nhánh E-Tier

Paid estimate `sparktoro|similarweb|semrush` + tier `high`: 400 `{error:reliability_capped}`. Question có email/SĐT: 400 (BR-RES-11).

#### Tiêu chí nghiệm thu walkthrough P5

- [ ] Bước 1–8 pass staging (SparkToro skip live nếu `sparktoro_enabled` false / không audio fixture / API down)
- [ ] Consent 400; excerpt > 500 → `raw_transcript_forbidden`; SparkToro không `createInsight`; paid tier `high` → `reliability_capped`
- [ ] Không đụng `/crm/sales?tab=market`
- [ ] Không bật `RESEARCH_SPARKTORO_ENABLED` / không ghi `SPARKTORO_API_KEY` trên prod
- [ ] PO / Research Lead sign P5 ECs

---

## Walkthrough UAT P6 — Codebook + VW lite + Qualtrics stub (≈15 phút)

**Mục tiêu khách hàng:** *«Analyst chọn study survey → nhập codebook → evidence value+unit+base; F5 còn; PRICE_OFFER tính VW + limitation; không insight; Qualtrics ẩn/disabled; F5 còn.»*

**Actors:** Research Analyst (AN), QA

**Dữ liệu test:** Client `acme` trong scope · Flag research = 1 (P0 đã bật) · `RESEARCH_QUALTRICS_ENABLED` mặc định `0` (không bật trong deploy) · Study method survey · Fixture `scripts/fixtures/research-codebook.sample.csv` + `research-vw.sample.csv` · Caps `crm_research.edit` (import/VW), `run` (Qualtrics stub), `view`

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Studies `?tab=studies` | Tạo/chọn study **survey** | method survey | Study hiện trên tab | ✓ RES-UC-062 |
| 2 | AN | Same | **Nhập codebook** (cap `edit`) | CSV 2–4 hàng, không PII | 201 `{ok, study_id, evidence_ids, n}` | ✓ RES-UC-062 · BR-RES-02 |
| 3 | AN | Evidence | Kiểm evidence số | value + unit + base | Locator `Q-…`; không insight | ✓ BR-RES-02 · BR-RES-06 |
| 4 | AN | Same · F5 | Reload | — | Evidence còn · không PII / không insight mới | ✓ F5 |
| 5 | AN | Giá VW `?tab=` (chỉ `PRICE_OFFER`) | **Tính Van Westendorp** | study VW / 4 respondents | Bảng too_cheap…too_expensive + limitation | ✓ RES-UC-063 · BR-RES-03 |
| 6 | AN | Same | Kiểm limitation | — | Không MOE / 95%; **không** insight mới | ✓ BR-RES-03 · BR-RES-06/08 |
| 7 | AN | Sources / Studies | Qualtrics **ẩn** (hoặc disabled) | `GET /health` `qualtrics_enabled=false` | Không CTA **Chạy Qualtrics**; `POST …/run-qualtrics` → `200 {ok:true, note:qualtrics_disabled}` | ✓ stub |
| 8 | AN / QA | Same · F5 | Reload | — | Evidence + VW (nếu có) còn · Qualtrics vẫn ẩn | ✓ F5 |

#### Nhánh E-PII

Bước 2 CSV có email/SĐT: 400 `{error:survey_pii_forbidden}` · 0 evidence.

#### Nhánh E-BR-RES-02

Thiếu value / unit / base: 400 · không insert.

#### Nhánh E-VW type

POST van-westendorp trên `CAT_REVIEW` (không `PRICE_OFFER`): 400 `{error:vw_not_price_offer}`.

#### Nhánh E-Qualtrics off

`GET /health` `qualtrics_enabled=false` (flag hoặc key off) → **không** CTA **Chạy Qualtrics**. `POST …/run-qualtrics` → `200 {ok:true, note:qualtrics_disabled}` — project không fail. Không enqueue. Không `createInsight`.

P6 **không** có live Qualtrics HTTP / SDK. Flag + key on vẫn `qualtrics_disabled` cho đến khi PO mua retainer (P8+).

#### Tiêu chí nghiệm thu walkthrough P6

- [ ] Bước 1–8 pass staging (Qualtrics skip live nếu `qualtrics_enabled` false / API down)
- [ ] PII 400; BR-RES-02 400; `vw_not_price_offer`; không `createInsight`; Qualtrics disabled 200
- [ ] Không đụng `/crm/sales?tab=market`
- [ ] Không bật `RESEARCH_QUALTRICS_ENABLED` / không ghi `QUALTRICS_API_KEY` trên prod
- [ ] PO / Research Lead sign P6 ECs

---

## Walkthrough UAT P7 — RAG search + taxonomy (≈15 phút)

**Mục tiêu khách hàng:** *«Lead duyệt insight bản khách → (flag on staging) F5 còn embedding → search q hit đúng id / không draft → gắn theme PRICE → search lọc theme → statement không đổi → flag off ẩn ô tìm / rag_disabled → F5.»*

**Actors:** Research Analyst (AN), Research Lead (RL), QA

**Dữ liệu test:** Client `acme` trong scope · Flag research = 1 (P0 đã bật) · `RESEARCH_RAG_ENABLED` mặc định `0` (không bật trong deploy; staging only sau PO) · Fixture `scripts/fixtures/research-rag-goldset.json` · Caps `crm_research.view` (search), `edit` (attach), `configure` (CRUD theme), `approve` (embed side-effect)

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | RL | Insight drawer | Duyệt **bản khách** | insight đã đủ evidence | Status `approved_client_facing` | ✓ RES-UC-070 · BR-RES-01 |
| 2 | AN | Same · F5 (flag on staging) | Reload | `RESEARCH_RAG_ENABLED=1` staging | Embedding còn; PII skip embed | ✓ F5 · BR-RES-11 |
| 3 | AN | Insights `?tab=insights` | **Tìm insight đã duyệt** | q khớp statement | Hit đúng id · **không** draft | ✓ RES-UC-070 |
| 4 | AN | Insight drawer (edit) | Gắn theme **PRICE** | select + Lưu | Join row; banner taxonomy | ✓ RES-UC-071 |
| 5 | AN | Same search | Lọc theme PRICE | chip / `theme_code=PRICE` | Chỉ hit đã gắn PRICE | ✓ RES-UC-071 |
| 6 | AN | Same | Kiểm statement | — | Statement **không** đổi | ✓ BR-RES-06 |
| 7 | AN | Same (flag off) | Tắt RAG | `RESEARCH_RAG_ENABLED=0` | Ẩn ô tìm; API `rag_disabled` | ✓ flag |
| 8 | AN / QA | Same · F5 | Reload | — | Theme còn · ô tìm vẫn ẩn · không insight mới | ✓ F5 |

#### Nhánh E-draft

Search không trả insight `draft` / chưa duyệt bản khách — kể cả cùng câu.

#### Nhánh E-PII embed

Statement có email/SĐT: `shouldSkipRagEmbed` → không upsert embedding; approve vẫn 200.

#### Nhánh E-403

`GET …/insights/search` ngoài scope: 403 `{error:forbidden}` — **không** `statement`.

#### Nhánh E-attach

`POST …/insights/:id/themes` không gọi `createInsight` / không PATCH statement.

#### Nhánh E-RAG off

`GET /health` `rag_enabled=false` → **không** ô **Tìm insight đã duyệt**. `GET …/insights/search` → `200 {hits:[], note:rag_disabled}`.

P7 **không** có live Qualtrics / OpenAI embeddings / pgvector / conjoint / portal RAG / copilot inject. Deploy **không** ghi `RESEARCH_RAG_ENABLED=1`.

#### Tiêu chí nghiệm thu walkthrough P7

- [ ] Bước 1–8 pass staging (RAG skip live nếu `rag_enabled` false / API down)
- [ ] Draft no hit; PII skip embed; 403 no statement; `rag_disabled`; attach không đổi statement; không `createInsight`
- [ ] Không đụng `/crm/sales?tab=market`
- [ ] Không bật `RESEARCH_RAG_ENABLED` / Qualtrics / SparkToro trên prod
- [ ] PO / Research Lead sign P7 ECs

---

## Walkthrough UAT P8 — Copilot + RAG (≈10 phút)

**Mục tiêu:** *«AN chọn evidence verified → Gợi ý insight; (staging flag on) thấy banner + chip tham chiếu insight đã duyệt cùng khách; draft mới status draft; F5 còn; flag off không banner / rag_disabled.»*

| # | Actor | Thao tác | Phản hồi | Gate |
|---|-------|----------|----------|------|
| 1 | AN | Insights · chọn ≥1 EV verified · **Gợi ý insight** (flag off prod) | 1 insight draft · không banner | ✓ P0 |
| 2 | AN | Staging `RESEARCH_RAG_ENABLED=1` · cùng thao tác | Banner verbatim · `rag_hits` 0..5 | ✓ RES-UC-072 |
| 3 | AN | Có hit | Chip `Tham chiếu #id` · statement hit không thành published | ✓ BR-06 |
| 4 | AN | Excerpt EV có SĐT (staging) | Copilot vẫn draft · `rag_note=rag_skipped_pii` | ✓ BR-11 |
| 5 | QA | F5 | Draft còn · không portal publish | ✓ F5 |

## P9+ (backlog — không UAT P0–P8)

| Hạng mục | Điều kiện mở |
|----------|--------------|
| SparkToro **live** HTTP | **Shipped P9** — UAT staging bên dưới |
| Qualtrics **live** | Retainer + key staging |
| OpenAI embeddings | DPA vendor + gold-set semantic |
| Portal RAG | Sau copilot+search staging ổn |
| Conjoint / simulator / cluster quý / Talkwalker / ISO 20252 | Scorecard 100đ |
| **Apify login** | **Out (Design §20)** |

## Walkthrough UAT P9 — SparkToro live HTTP staging (≈15 phút)

**Mục tiêu:** *«PO bật key staging → Chạy SparkToro → sources websites + limitation_note + credits_used; không insight mới.»*

**Tiền đề:** `RESEARCH_SPARKTORO_ENABLED=1` + `SPARKTORO_API_KEY` trong `runtime.env` staging · restart `ptt-crm-api` + `ptt-worker` · Client `acme` trong scope · Caps `crm_research.run`

| # | Actor | Màn | Thao tác | Input | Kỳ vọng | UC |
|---|-------|-----|----------|-------|---------|-----|
| 1 | PO | VPS | Set flag + key staging | key PO | `GET /health` → `sparktoro_enabled=true` | 061 |
| 2 | AN | Sources | **Chạy SparkToro** | `question_id` (không PII) | `202 {ok, run_id}` | 061 |
| 3 | AN | Wait job | Poll run / F5 sources | — | Sources `publisher=SparkToro`, `limitation_note` | BR-RES-09 |
| 4 | AN | Run detail | Xem `ai_runs` | — | `credits_used` ≥ 12 · `output_json.report_id` | P9 |
| 5 | AN | Insights | Đếm insight | — | **Không** insight mới | BR-RES-06/08 |

**Prod deploy:** script P9 **không** ghi flag/key · smoke M4 skip live.

- [ ] Bước 1–5 pass staging
- [ ] Prod `sparktoro_enabled=false` sau deploy

## P10+ (backlog)

## Walkthrough UAT P11 — OpenAI embeddings staging (≈10 phút)

**Mục tiêu:** *«PO bật RAG + OpenAI embed staging → duyệt insight corpus → search paraphrase G3 hit đúng id; PII skip HTTP; prod `rag_openai_embed_enabled=false`.»*

**Tiền đề:** `RESEARCH_RAG_ENABLED=1` + `RESEARCH_RAG_OPENAI_EMBED_ENABLED=1` + `OPENAI_API_KEY` trong `runtime.env` staging · restart `ptt-crm-api` · PO đã xác nhận DPA gửi statement → OpenAI

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | PO | Set 3 env + restart api | `GET /health` → `rag_enabled=true`, `rag_openai_embed_enabled=true`, `rag_embed_model=openai` |
| 2 | AN | Approve insight corpus (không PII) | DB `embed_dims=256`, `embed_model=text-embedding-3-small` |
| 3 | AN | Search paraphrase G3 (`học sinh uống sữa đắt hơn ở thủ đô`) | Hit đúng `insight_id`; không draft |
| 4 | AN | Statement có SĐT/email | Approve 200; **không** dòng embedding mới |
| 5 | QA | Prod sau deploy P11 | `rag_openai_embed_enabled=false` |

**Lưu ý:** Insight đã embed hash 64-d **không** hit query OpenAI 256-d cho đến khi approve lại (dim skip). P11 **không** backfill.

- [ ] Bước 1–5 pass staging
- [ ] Prod `rag_openai_embed_enabled=false` sau deploy

## P12+ (backlog)

## Walkthrough UAT P12 — Portal RAG staging (≈10 phút)

**Mục tiêu:** *«PO bật RAG staging → khách portal tìm paraphrase → hit insight published cùng client; draft/ACF không hit; prod `rag_enabled=false`.»*

**Tiền đề:** `RESEARCH_RAG_ENABLED=1` trong `runtime.env` staging · restart `ptt-crm-api` · insight `published` + embedding (P7/P11) · portal JWT cùng `client_id`

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | PO | Set flag + restart api | Portal `GET …/health` → `rag_enabled=true` |
| 2 | AN | Staff publish insight (status `published`) | Embedding có sẵn |
| 3 | CL | Portal `/research` · tìm paraphrase | Hit đúng `insight_id`; status published |
| 4 | CL | Insight chỉ `approved_client_facing` / draft | **Không** hit |
| 5 | CL | JWT client khác | 0 hit; JSON không `statement` client A |
| 6 | CL | Câu có email + embed live | `rag_skipped_pii`; 0 HTTP |
| 7 | QA | Prod sau deploy P12 | `rag_enabled=false`; ô tìm ẩn |

- [ ] Bước 1–7 pass staging
- [ ] Prod `rag_enabled=false` sau deploy

## P13+ (backlog — conjoint / cluster / Talkwalker)

## P15+ (backlog — conjoint / Talkwalker)

## P16+ (backlog — conjoint / Talkwalker)

## Walkthrough UAT P16 — Theme QoQ/YoY delta (≈8 phút)

**Mục tiêu:** *«Staff mở Phân tích → bảng theme có Δ QoQ/YoY dưới mỗi quý.»*

**Tiền đề:** insight gắn theme ít nhất 2 quý liên tiếp hoặc cùng quý năm trước

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AM | Mở `/crm/research/analytics` | Ô quý hiện count + Δ QoQ/YoY (nếu có) |
| 2 | AN | Q2 count=4, Q1 count=2 | Δ QoQ +100% |
| 3 | AN | Q2 năm trước count=2 | Δ YoY +100% |
| 4 | AN | Q1 bất kỳ | Không Δ QoQ |
| 5 | AN | Prior count=0 | Δ = null (không hiện %) |
| 6 | QA | Prod sau deploy P16 | Bảng + Δ; RAG ẩn khi flag off |

- [ ] Bước 1–6 pass staging

## P17+ (backlog — conjoint / Talkwalker)

## Walkthrough UAT P17 — Portal theme QoQ/YoY delta (≈8 phút)

**Mục tiêu:** *«Khách portal mở /research → bảng theme có Δ QoQ/YoY dưới mỗi quý.»*

**Tiền đề:** insight `published` gắn theme ít nhất 2 quý liên tiếp hoặc cùng quý năm trước

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | CL | Mở `/research` | Ô quý hiện count + Δ QoQ/YoY (nếu có) |
| 2 | CL | Q2 count=4, Q1 count=2 | Δ QoQ +100% |
| 3 | CL | Q2 năm trước count=2 | Δ YoY +100% |
| 4 | CL | Q1 bất kỳ | Không Δ QoQ |
| 5 | CL | Prior count=0 | Δ = null (không hiện %) |
| 6 | QA | Prod sau deploy P17 | Bảng + Δ; RAG ẩn khi flag off |

- [ ] Bước 1–6 pass staging

## P18+ (backlog — conjoint / Talkwalker)

## Walkthrough UAT P18 — Insight stale banner (≈8 phút)

**Mục tiêu:** *«Analyst mở tab Insight → insight có valid_to quá khứ hiện banner hết hạn; filter «Chỉ hết hạn» hoạt động.»*

**Tiền đề:** ít nhất 1 insight `valid_to` < hôm nay và 1 insight còn hiệu lực hoặc không có valid_to

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Mở project → tab Insight | Card insight hết hạn có banner vàng |
| 2 | AN | Mở drawer insight hết hạn | Banner hiện đầu drawer |
| 3 | AN | Insight valid_to = hôm nay | Không banner |
| 4 | AN | Insight valid_to null | Không banner |
| 5 | AN | Bật «Chỉ hết hạn» | Chỉ card stale |
| 6 | QA | Prod sau deploy P18 | is_stale trên API; RAG flags không đổi |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P19 — Portal insight stale banner (≈8 phút)

**Mục tiêu:** *«Khách portal tìm insight RAG → hit hết hạn có banner vàng; hit còn hiệu lực không banner.»*

**Tiền đề:** RAG flag on staging; ≥1 insight `published` stale + ≥1 còn hiệu lực

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | CL | Mở `/research`, search keyword | Hit stale có banner |
| 2 | CL | Hit valid_to = hôm nay | Không banner |
| 3 | CL | Hit valid_to null | Không banner |
| 4 | CL | Hit còn hiệu lực | Không banner |
| 5 | QA | API search JSON | `is_stale` đúng |
| 6 | QA | Prod sau deploy P19 | Banner portal; RAG flags không đổi |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P20 — pgvector opt-in (≈8 phút)

**Mục tiêu:** *«Prod flag off = search như P19. Staging flag on = ANN prefilter, cùng hit contract (kể cả is_stale).»*

**Tiền đề:** staging có thể bật RAG + pgvector; prod giữ mọi flag off

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | QA | `GET /api/v1/research/health` | `rag_pgvector_enabled=false` |
| 2 | QA | Prod search (RAG off) | `rag_disabled` như cũ |
| 3 | AN | Staging RAG on, pgvector off | JSONB path; hits có `is_stale` |
| 4 | AN | Staging cả hai flag on | Search 200; không leak tenant |
| 5 | QA | `\d crm_research_insight_embeddings` | Có `embedding_vec` **hoặc** WARN skip nếu thiếu extension |
| 6 | QA | Prod sau deploy P20 | Không ghi `RESEARCH_RAG_PGVECTOR_ENABLED=1` |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P21 — Conjoint lite (≈10 phút)

**Mục tiêu:** *«Analyst import conjoint CSV → evidence; PRICE_OFFER tính bảng share + gợi ý; không insight; F5 còn.»*

**Tiền đề:** project `PRICE_OFFER` · fixture `scripts/fixtures/research-conjoint.sample.csv`

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Studies → import `format=conjoint` | Study + evidence `C-…`; không insight mới |
| 2 | AN | Tab **Conjoint** → **Tính conjoint lite** | Bảng share % + gợi ý gói |
| 3 | AN | F5 | Summary còn |
| 4 | AN | Project `CAT_REVIEW` → POST conjoint | 400 `cj_not_price_offer` |
| 5 | AN | <4 respondents | 400 `cj_insufficient_n` |
| 6 | QA | Prod sau deploy P21 | Không đổi RAG/pgvector flags |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P22 — Staff RAG stale banner (≈8 phút)

**Mục tiêu:** *«Analyst tìm insight RAG → hit hết hạn có banner vàng; hit còn hiệu lực không banner.»*

**Tiền đề:** RAG flag on staging; ≥1 insight ACF/published stale + ≥1 còn hiệu lực

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Mở analytics RAG, search keyword | Hit stale có banner |
| 2 | AN | Hit valid_to = hôm nay | Không banner |
| 3 | AN | Hit valid_to null | Không banner |
| 4 | AN | Hit còn hiệu lực | Không banner |
| 5 | QA | API search JSON | `is_stale` đúng |
| 6 | QA | Prod sau deploy P22 | Banner ops-web; RAG flags không đổi |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P23 — Talkwalker stub (≈8 phút)

**Mục tiêu:** *«Analyst bấm Chạy Talkwalker khi flag off → không source mới; staging flag+token → source Talkwalker + limitation, không insight.»*

**Tiền đề:** Prod flags Talkwalker off. Staging UAT bước 4–6 cần flag+token **staging only**.

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Sources, prod/default health | Không thấy **Chạy Talkwalker** |
| 2 | QA | `POST …/run-talkwalker` flag off | `200 {note:talkwalker_disabled}`; 0 source |
| 3 | QA | Health JSON | `talkwalker_enabled=false`; không token |
| 4 | AN | Staging flag+token, chọn RQ, **Chạy Talkwalker** | Source `publisher=Talkwalker` + limitation |
| 5 | QA | Activity / ai_run | `job_type=talkwalker`; `output_json.stub=true`; 0 insight |
| 6 | QA | Prod sau deploy P23 | Button ẩn; Talkwalker/RAG/pgvector flags không đổi |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P24 — Portal report-detail stale (≈8 phút)

**Mục tiêu:** *«Khách mở báo cáo portal → finding gắn insight hết hạn có banner vàng; finding còn hiệu lực không banner.»*

**Tiền đề:** ≥1 report portal-visible; ≥1 finding `insight_id` published stale + ≥1 còn hiệu lực / null

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | CL | Mở `/research/{versionId}` | Finding stale có banner P19 |
| 2 | CL | Finding valid_to = hôm nay | Không banner |
| 3 | CL | Finding valid_to null | Không banner |
| 4 | CL | Finding còn hiệu lực | Không banner |
| 5 | QA | GET report JSON | `is_stale` đúng trên finding/rec |
| 6 | QA | Prod sau deploy P24 | Banner portal; RAG/Talkwalker flags không đổi |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P25 — Portal RAG «Chỉ hết hạn» (≈8 phút)

**Mục tiêu:** *«Khách portal tìm RAG → bật «Chỉ hết hạn» → chỉ thấy insight published hết hạn; tắt filter → thấy cả hit còn hiệu lực + banner trên hit stale.»*

**Tiền đề:** Staging `RESEARCH_RAG_ENABLED=1`; ≥1 insight published stale + ≥1 còn hiệu lực cùng client

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | CL | Mở `/research`, search keyword | Hit stale có banner P19; hit còn hiệu lực không banner |
| 2 | CL | Bật **Chỉ hết hạn** | Chỉ hit stale; count khớp |
| 3 | CL | Tắt filter | Hit còn hiệu lực hiện lại |
| 4 | CL | Search keyword không có stale | Checkbox ẩn hoặc 0 stale |
| 5 | QA | GET search `stale_only=1` | JSON chỉ `is_stale: true` |
| 6 | QA | Prod sau deploy P25 | Filter portal; RAG/Talkwalker flags không đổi |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P26 — pgvector prod readiness (≈8 phút)

**Mục tiêu:** *«VPS có extension vector + cột embedding_vec; health báo ready; flag pgvector vẫn off prod.»*

**Tiền đề:** quyền sudo trên VPS · `DATABASE_URL` trỏ DB prod/staging

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | DevOps | `bash scripts/install_pgvector_vps.sh` | apt cài package; CREATE EXTENSION OK |
| 2 | DevOps | `bash scripts/verify_pgvector_market_research.sh` | exit 0 |
| 3 | DevOps | `bash scripts/apply_pg_ddl_market_research_p20.sh` | OK (không WARN skip) |
| 4 | QA | `GET /api/v1/research/health` | `rag_pgvector_ready=true`, `rag_pgvector_enabled=false` |
| 5 | QA | `GET /api/v1/portal/research/health` | cùng `rag_pgvector_ready=true` |
| 6 | QA | Prod sau deploy P26 | RAG/OpenAI/pgvector **flags** không đổi |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P27 — RAG default excludes stale (≈8 phút)

**Mục tiêu:** *«RAG mặc định không trả insight hết hạn; portal «Chỉ hết hạn» vẫn hoạt động.»*

**Tiền đề:** staging `RESEARCH_RAG_ENABLED=1`; corpus có insight fresh + stale (published/ACF)

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Staff RAG search keyword khớp stale + fresh | Chỉ hit fresh |
| 2 | AN | Insight copilot (flag on) | `rag_hits` không có insight stale |
| 3 | CL | Portal `/research` search mặc định | Không hit stale |
| 4 | CL | Bật «Chỉ hết hạn» | Chỉ hit stale (P25 regression) |
| 5 | QA | GET search không `stale_only` | JSON không có `is_stale: true` |
| 6 | QA | Prod sau deploy P27 | RAG/Talkwalker/pgvector flags không đổi |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P28 — pgvector ANN staging (≈8 phút)

**Mục tiêu:** *«Flag + DB ready → ANN path; flag on + DB chưa ready → JSONB fallback; prod deploy pgvector off.»*

**Tiền đề:** sudo VPS · corpus có embedding JSONB

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | DevOps | `install_pgvector_vps.sh` + verify | exit 0; health `rag_pgvector_ready=true` |
| 2 | DevOps | Deploy `--enable-pgvector-staging` | health `rag_pgvector_enabled=true` |
| 3 | AN | Re-approve / P13 re-embed 1 insight | `embedding_vec` NOT NULL |
| 4 | AN | Staff search (RAG+OpenAI staging) | `listEmbeddingsByVec` path; hits OK |
| 5 | QA | Tắt ready (mock) hoặc VPS chưa cài | JSONB fallback, không 500 |
| 6 | QA | Prod deploy không `--enable-pgvector-staging` | `rag_pgvector_enabled=false` |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P29 — PDF stale footer (≈8 phút)

**Mục tiêu:** *«PDF có insight stale → footer mọi trang; PDF fresh → không footer; DOCX không đổi.»*

**Tiền đề:** report version có finding trỏ insight `valid_to` quá khứ; 1 report chỉ insight còn hiệu lực

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Staff export PDF report stale | Footer staff mọi trang; `%PDF-` OK |
| 2 | AN | Staff export PDF report fresh | Không footer |
| 3 | AN | Staff export DOCX report stale | Không footer (DOCX unchanged) |
| 4 | CL | Portal download PDF report stale | Footer portal + watermark |
| 5 | CL | Portal download PDF report fresh | Không footer |
| 6 | QA | GET portal report JSON | Không đổi (P24 banner UI tách) |
| 7 | QA | Prod deploy P29 | RAG/pgvector flags không đổi |

- [ ] Bước 1–7 pass staging

## Walkthrough UAT P30 — Staff RAG «Chỉ hết hạn» (≈8 phút)

**Mục tiêu:** *«Staff RAG mặc định chỉ fresh; checkbox → chỉ stale; portal/copilot không regress.»*

**Tiền đề:** staging `RESEARCH_RAG_ENABLED=1` · corpus có insight stale + fresh cùng client

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Staff RAG search mặc định | Chỉ hit fresh |
| 2 | AN | Bật «Chỉ hết hạn» | Chỉ hit stale + banner P22 |
| 3 | AN | Query không khớp stale | Copy «Không có insight hết hạn…» |
| 4 | AN | Tab Insight «Chỉ hết hạn» (P18) | Không đổi |
| 5 | CL | Portal RAG `stale_only` (P25) | Không regress |
| 6 | QA | Copilot draft | `rag_hits` không chứa stale |
| 7 | QA | Prod deploy P30 | RAG/pgvector flags không đổi |

- [ ] Bước 1–7 pass staging

## Walkthrough UAT P31 — Staff DOCX stale footer (≈8 phút)

**Mục tiêu:** *«DOCX stale → footer staff; DOCX fresh → không footer; PDF P29 không regress.»*

**Tiền đề:** report version có finding stale; 1 report chỉ insight còn hiệu lực

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Staff export DOCX report stale | Word: footer staff mọi trang |
| 2 | AN | Staff export DOCX report fresh | Không footer |
| 3 | AN | Staff export PDF cùng report stale | Footer P29 OK |
| 4 | CL | Portal PDF stale | Footer portal P29 không đổi |
| 5 | QA | `content_snapshot` DB | Không thêm field |
| 6 | QA | Prod deploy P31 | RAG/pgvector flags không đổi |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P32 — Bake published_valid_to (≈8 phút)

**Mục tiêu:** *«Publish đóng băng published_valid_to; đổi valid_to sau → is_stale live, bake giữ; unpublish không xóa.»*

**Tiền đề:** report draft có finding; Lead ≠ generated_by; insight client-facing

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | Lead | Publish portal `visible=true` | Snapshot có `published_valid_to` = `valid_to` lúc đó |
| 2 | AN | Đổi insight `valid_to` quá khứ | GET portal: `is_stale=true`, bake **cũ** |
| 3 | AN | Export PDF/DOCX | Footer live (P29/P31) |
| 4 | Lead | Unpublish | Bake **còn** trong snapshot |
| 5 | Lead | Publish lại | Bake **cập nhật** theo `valid_to` hiện tại |
| 6 | QA | Prod deploy P32 | RAG/pgvector flags không đổi |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P33 — Hiện published_valid_to (≈8 phút)

**Mục tiêu:** *«Khách thấy Hiệu lực lúc gửi; đổi valid_to sau → banner stale live, note bake giữ; PDF/DOCX không in bake.»*

**Tiền đề:** report đã publish P32+ (snapshot có `published_valid_to`); một finding có ngày bake

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | CL | Mở report portal | Finding có `Hiệu lực lúc gửi: YYYY-MM-DD` |
| 2 | AN | Đổi insight `valid_to` quá khứ | Banner stale **live**; note bake **cũ** |
| 3 | Lead | Staff report version | List note cùng ngày bake |
| 4 | AN | Export PDF/DOCX | Footer live; không in bake |
| 5 | CL | Report publish trước P32 (không field) | Không note |
| 6 | QA | Prod deploy P33 | RAG/pgvector/Talkwalker flags không đổi |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P34 — Conjoint what-if lite (≈8 phút)

**Mục tiêu:** *«Analyst chọn gói giả định → Khớp mẫu n/N; F5 không persist; không insight mới; không MOE.»*

**Tiền đề:** project `PRICE_OFFER` · đã import fixture conjoint · đã **Tính conjoint lite**

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Chọn 99k + 500ml, **Đếm khớp mẫu** | `Khớp mẫu: 2 / 8 (25%)` trên fixture |
| 2 | AN | CAT_REVIEW POST what-if | 400 `cj_not_price_offer` |
| 3 | AN | Scenario rỗng | 400 `cj_whatif_empty` |
| 4 | AN | F5 tab Conjoint | Không hàng what-if mới |
| 5 | QA | Insights | Không insight mới |
| 6 | QA | Prod deploy P34 | RAG/pgvector/Talkwalker flags không đổi |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P35 — Portal conjoint lite (≈8 phút)

**Mục tiêu:** *«Khách thấy bảng conjoint lite; JWT client B không thấy dữ liệu A; không nút what-if / tính conjoint.»*

**Tiền đề:** project `PRICE_OFFER` cùng `client_id` · staff đã **Tính conjoint lite**

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | CL | Mở `/research` | Khối `portal-conjoint-lite` + bảng share + gợi ý gói |
| 2 | CL | JWT client B | Không thấy bảng client A (`summary=null` hoặc bảng khác) |
| 3 | CL | Không có summary | Khối ẩn; không 500 |
| 4 | QA | UI | Không nút **Tính conjoint** / **Đếm khớp mẫu** |
| 5 | QA | Payload | Không `created_by` / `title` |
| 6 | QA | Prod deploy P35 | RAG/pgvector/Talkwalker flags không đổi |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P36 — IVFFlat + live Talkwalker (≈10 phút)

**Mục tiêu:** *«DDL IVFFlat fail-soft; staging live Talkwalker khi có project_id; prod flags vẫn off.»*

**Tiền đề:** staging có thể bật Talkwalker flag+token+project_id (PO)

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | DevOps | Apply P36 DDL (no pgvector) | WARN skip; không crash deploy |
| 2 | DevOps | `install_pgvector_vps.sh` + P36 DDL | Index `crm_research_emb_vec_ivf`; health `rag_ivfflat_ready=true` |
| 3 | QA | Prod health | `rag_ivfflat_ready` false hoặc true; RAG/pgvector flags off |
| 4 | AN | Staging: flag+token, **không** project_id, Chạy Talkwalker | `note: talkwalker_stub` |
| 5 | AN | Staging: + `TALKWALKER_PROJECT_ID`, Chạy Talkwalker | Sources persist; `note: talkwalker_live` |
| 6 | QA | Prod deploy P36 | Talkwalker/RAG flags không đổi |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P37 — ISO 20252 gap-check (≈8 phút)

**Mục tiêu:** *«Lead mở project → thấy checklist ISO gap; không claim certified; prod flags không đổi.»*

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | Lead | Mở project mới (intake) | Nhiều `fail` ở execution/reporting |
| 2 | AN | Thêm source + verified evidence + insight ACF | Execution/supervision cải thiện |
| 3 | Lead | Report TC + methodology stub | `methodology_not_stub` = partial/fail |
| 4 | QA | JSON response | Không «certified»; không leak client title |
| 5 | QA | Prod deploy P37 | RAG/Talkwalker flags không đổi |

- [ ] Bước 1–5 pass staging

## Walkthrough UAT P38 — Persist conjoint what-if (≈8 phút)

**Mục tiêu:** *«Analyst chạy what-if + Lưu → F5 vẫn thấy hàng lịch sử; không insight mới; portal không đổi.»*

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | PRICE_OFFER, what-if, **không** tick Lưu | Kết quả inline; history không tăng |
| 2 | AN | Cùng scenario, tick **Lưu kết quả** | `run_id` + hàng history |
| 3 | AN | F5 tab Conjoint | History còn |
| 4 | Viewer | Tick Lưu | 403 forbidden |
| 5 | QA | Portal `/research` | Không what-if / history staff |
| 6 | QA | Prod deploy P38 | RAG/Talkwalker flags không đổi |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P43 — Staff version list stale badge (≈8 phút)

**Mục tiêu:** *«Lead tab Báo cáo → dòng v stale có badge meta → scroll vẫn thấy P42 detail banners.»*

**Tiền đề:** 2 version — một stale một fresh

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Seed version stale + fresh | Snapshot insight stale |
| 2 | Lead | Tab Báo cáo | Badge trên dòng `v` stale; fresh không |
| 3 | Lead | Scroll version stale | P42 `staff-report-stale-list` vẫn hiện |
| 4 | AN | Đổi valid_to + F5 | Badge meta + detail mất |
| 5 | CL | Portal list P41 | Không regress |
| 6 | QA | Prod deploy P43 | ops-web only; flags off |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P47 — Portal reports API stale_only (≈8 phút)

**Mục tiêu:** *«Bật filter P46 → refetch API stale_only → JSON + UI khớp; tắt filter → full list.»*

**Tiền đề:** 2 report portal-visible — một stale, một fresh

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Seed 2 report portal — 1 stale, 1 fresh | `/research` |
| 2 | CL | Bật filter | Chỉ card stale |
| 3 | QA | GET reports `stale_only=1` | JSON 1 item, `has_stale_insights: true` |
| 4 | CL | Tắt filter | 2 card; refetch full list |
| 5 | CL | Detail stale card | Banner P24 OK |
| 6 | QA | Prod deploy P47 | api + portal-web; flags off |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P46 — Portal report list stale filter (≈6 phút)

**Mục tiêu:** *«Khách bật filter → chỉ thấy báo cáo stale; tắt filter → cả list; detail P24 không regress.»*

**Tiền đề:** 2 report portal-visible — một stale, một fresh

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Seed 2 report portal-visible — 1 stale, 1 fresh | Portal `/research` |
| 2 | CL | Quan sát checkbox | «Chỉ báo cáo hết hạn (1)» |
| 3 | CL | Bật filter | Chỉ card stale; badge P41 đúng |
| 4 | CL | Mở detail stale card | Banner P24 OK |
| 5 | CL | Tắt filter | Cả 2 card hiện lại |
| 6 | QA | Prod deploy P46 | portal-web only; flags off |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P45 — Staff report version stale filter (≈6 phút)

**Mục tiêu:** *«Lead bật filter → chỉ thấy version stale; tắt filter → cả list; form tạo version vẫn dùng được.»*

**Tiền đề:** 2 version — một stale một fresh

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Seed version stale + fresh | Tab Báo cáo |
| 2 | Lead | Quan sát checkbox | «Chỉ version hết hạn (1)» |
| 3 | Lead | Bật filter | Chỉ version stale; badge P43 + banners P42 đúng |
| 4 | Lead | Tắt filter | Cả 2 version hiện lại |
| 5 | AN | Sửa insight → fresh + refetch | Checkbox ẩn hoặc count 0 |
| 6 | QA | Prod deploy P45 | ops-web only; flags off |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P44 — Staff reports API stale flag (≈8 phút)

**Mục tiêu:** *«Refetch reports sau khi insight hết hạn → API `has_stale_insights` true → badge P43 + banners P42 khớp.»*

**Tiền đề:** 2 version — một stale một fresh

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Seed version stale + fresh | 2 version |
| 2 | Lead | Tab Báo cáo | Badge P43 đúng |
| 3 | AN | PATCH insight valid_to quá khứ | Refetch reports → API `has_stale_insights` true |
| 4 | Lead | F5 tab Báo cáo | Badge + P42 banners khớp API |
| 5 | CL | Portal list P41 | Không regress |
| 6 | QA | Prod deploy P44 | api + ops-web; flags off |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P42 — Staff report version stale rows (≈8 phút)

**Mục tiêu:** *«Lead mở tab Báo cáo → version có finding stale thấy banner live; đổi valid_to + F5 banner mất; portal P24 không regress.»*

**Tiền đề:** report version snapshot trỏ insight `valid_to` quá khứ; 1 version fresh

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Seed report version stale | Snapshot có `insight_id` stale |
| 2 | Lead | Mở tab Báo cáo | Banner dưới version stale; fresh không |
| 3 | AN | Đổi `valid_to` tương lai + F5 | Banner biến mất |
| 4 | Lead | Cùng version có bake P32 | Note `published_valid_to` P33 vẫn hiện |
| 5 | CL | Portal detail cùng report | Banner P24 OK |
| 6 | QA | Prod deploy P42 | ops-web only; flags off |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P41 — Portal report list stale badge (≈8 phút)

**Mục tiêu:** *«Khách portal mở /research → row stale có badge list-level → detail P24 banner vẫn đúng; fresh row không badge.»*

**Tiền đề:** ≥2 report portal-visible — một có insight published stale, một fresh

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | CL | Seed report stale + fresh | 2 version portal-visible |
| 2 | CL | Mở `/research` | Row stale có badge; fresh không |
| 3 | CL | Click stale → detail | Banner P24 vẫn dưới finding |
| 4 | CL | Click fresh → detail | Không banner finding |
| 5 | QA | GET list JSON | `has_stale_insights` đúng; không `title` |
| 6 | QA | Prod deploy P41 | Flags off; badge hiện khi data stale |

- [ ] Bước 1–6 pass staging

## Walkthrough UAT P40 — Staff RAG re-embed panel (≈8 phút)

**Mục tiêu:** *«Configure user mở analytics staging → panel preview stale → chạy batch → kết quả inline; prod panel ẩn.»*

**Tiền đề:** P39 staging flags + `OPENAI_API_KEY` · user có `crm_research.configure`

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | PO | Staging embed on (P39) | health `rag_openai_embed_enabled=true` |
| 2 | LD | Mở `/crm/research/analytics` | Panel `rag-reembed-panel` hiện |
| 3 | LD | Xem preview | `rag-reembed-preview-count` ≥ 0 |
| 4 | LD | Chạy batch limit 50 | `rag-reembed-result` có processed/remaining |
| 5 | Viewer | Mở analytics (chỉ view) | Panel ẩn |
| 6 | QA | Prod deploy P40 | Panel ẩn; flags off |

- [ ] Bước 1–6 pass staging
- [ ] Prod không bật RAG/embed sau deploy

## Walkthrough UAT P39 — RAG re-embed backfill staging (≈12 phút)

**Mục tiêu:** *«PO cài pgvector → deploy P39 → bật staging RAG flags → preview stale → batch re-embed → DB 256-d + embedding_vec; search G3 hit; prod deploy không bật flags.»*

**Tiền đề:** corpus insight `approved_client_facing`/`published` embed 64-d · VPS sudo cho pgvector · `OPENAI_API_KEY` trong `.env` (PO manual)

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | PO | `bash scripts/install_pgvector_vps.sh` + verify | ext + `embedding_vec` OK |
| 2 | PO | `deploy_market_research_p39_vps.sh --local` (default) | WARN pgvector nếu chưa install; flags off |
| 3 | PO | `--enable-rag-staging` + `OPENAI_API_KEY` + restart api + worker | health: 5 field RAG/pgvector true (ready sau bước 1) |
| 4 | LD | `GET /research/rag/reembed/preview` | `stale_count` ≥ 1 |
| 5 | LD | `POST /research/rag/reembed` `{ "limit": 50 }` | `processed` ≥ 1 |
| 6 | AN | DB insight re-embedded | `embed_dims=256`; `embedding_vec` NOT NULL khi pgvector flag on |
| 7 | AN | RAG search paraphrase G3 | Hit insight vừa re-embed |
| 8 | AN | Health ANN | `rag_pgvector_enabled` ∧ `rag_pgvector_ready` → ANN path (ByVec) |
| 9 | LD | Statement có PII trong batch | `skipped_pii` ≥ 1 |
| 10 | QA | Prod deploy P39 **không** `--enable-rag-staging` | `rag_*` false; script không ghi API key |

- [ ] Bước 1–10 pass staging
- [ ] Prod không bật RAG/embed/pgvector sau deploy
- [ ] Runbook: `docs/runbooks/market-research-rag-staging-backfill.md`

## Walkthrough UAT P15 — Portal theme quarter analytics (≈8 phút)

**Mục tiêu:** *«Khách portal mở /research → bảng theme Q1–Q4 → click theme → RAG search prefill (staging flag on).»*

**Tiền đề:** corpus có insight `published` gắn theme · portal JWT đúng `client_id`

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | CL | Mở `/research` | Bảng «Theme theo quý» + banner published-only |
| 2 | CL | Đổi năm | `GET /portal/research/analytics/themes?year=` cập nhật |
| 3 | AN | So sánh counts với DB | Chỉ `published` cùng client; không ACF/draft |
| 4 | CL | JWT client B | 0 row client A; JSON không leak `statement` |
| 5 | CL | Staging `RESEARCH_RAG_ENABLED=1` | Click theme → lọc theme trên ô RAG |
| 6 | QA | Prod sau deploy P15 | Bảng hiện; RAG ẩn khi `rag_enabled=false` |

- [ ] Bước 1–6 pass staging
- [ ] Prod không bật RAG sau deploy

## Walkthrough UAT P14 — Theme quarter analytics (≈8 phút)

**Mục tiêu:** *«Staff mở Phân tích nghiên cứu → bảng theme Q1–Q4 theo năm → click theme → RAG search prefill (staging flag on).»*

**Tiền đề:** corpus có insight `approved_client_facing`/`published` gắn theme · `NEXT_PUBLIC_MARKET_RESEARCH=1`

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AM | Mở `/crm/research/analytics` | KPI ops + bảng «Theme theo quý» |
| 2 | AM | Đổi năm dropdown | API `GET /analytics/themes?year=`; counts cập nhật |
| 3 | AN | So sánh Q1–Q4 với DB | `insight_count` khớp insight gắn theme trong quý |
| 4 | LD | `client_id` ngoài scope | 403 `{error:forbidden}` |
| 5 | AN | Staging `RESEARCH_RAG_ENABLED=1` | Click theme → chip theme active trên ô RAG |
| 6 | QA | Prod sau deploy P14 | Bảng theme hiện; RAG ẩn khi `rag_enabled=false` |

- [ ] Bước 1–6 pass staging
- [ ] Prod không bật RAG sau deploy

## Walkthrough UAT P13 — RAG re-embed backfill staging (≈10 phút)

**Mục tiêu:** *«PO bật RAG + OpenAI embed staging → preview stale count → POST re-embed batch → insight hash 64-d → 256-d; search G3 hit; PII skip HTTP.»*

**Tiền đề:** `RESEARCH_RAG_ENABLED=1` + `RESEARCH_RAG_OPENAI_EMBED_ENABLED=1` + `OPENAI_API_KEY` · restart `ptt-crm-api` + `ptt-worker` · corpus có insight `approved_client_facing`/`published` embed `embed_dims=64`

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | PO | Set 3 env + restart api + worker | `GET /research/health` → `rag_openai_embed_enabled=true` |
| 2 | LD | `GET /research/rag/reembed/preview` | `stale_count` ≥ 1 |
| 3 | LD | `POST /research/rag/reembed` `{ "limit": 50 }` | `status=pending` hoặc `succeeded`; `processed` ≥ 1 |
| 4 | AN | DB check insight re-embedded | `embed_dims=256`, `embed_model=text-embedding-3-small` |
| 5 | AN | Search paraphrase G3 | Hit insight vừa re-embed |
| 6 | LD | Statement có email trong batch | `skipped_pii` ≥ 1; 0 HTTP OpenAI cho row đó |
| 7 | QA | Prod sau deploy P13 | `rag_openai_embed_enabled=false`; script không ghi RAG flags |

- [ ] Bước 1–7 pass staging
- [ ] Prod không bật RAG/embed sau deploy
