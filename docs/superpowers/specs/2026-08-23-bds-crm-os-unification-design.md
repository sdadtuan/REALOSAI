# Design: CRM BĐS thống nhất — BĐS + HR + CSKH + Kế toán + Marketing + Kinh doanh

**Ngày:** 2026-08-23  
**Trạng thái:** Chờ duyệt  
**Module:** Industry Pack `bds` × platform (HR, CSKH, Finance facade, Marketing OS, Sales OS)  
**Phụ thuộc:** [`2026-08-21-bds-industry-pack-design.md`](./2026-08-21-bds-industry-pack-design.md) (Q1–Q29 **giữ nguyên**)  
**Runbook UI:** [`../../runbooks/bds-ops-user-guide.md`](../../runbooks/bds-ops-user-guide.md)  
**Nghiệp vụ từng ban × chu trình:** [`2026-08-23-bds-crm-operating-cycle.md`](./2026-08-23-bds-crm-operating-cycle.md)

**Quyết định sản phẩm:** RNOSAI không bán «module BĐS đứng cạnh CRM agency». Khi `PTT_BDS_PACK=1` + tenant `developer|hybrid|broker`, năm khối platform **xoay quanh một xương sống** (Căn · Giao dịch · Người mua · Nhân sự). Đối thủ (Getfly / Bitrix24 / Salesforce RE / CRM sàn Việt) thắng từng mảnh; RNOSAI thắng **một vòng đời căn từ ads → sổ hồng**, cùng roster, cùng SLA, cùng sổ thu, cùng KPI.

---

## 1. Vấn đề

Pack BĐS P0–P12b đã có tenant, tồn kho PG, hold/TTL, TX, collection, HH, ra quân, aftersales, chat, ticket. Platform đã có HR Hub, CSKH board, Marketing OS, pipeline B2B, P&L dự án RE.

Hôm nay chúng **cùng app, chưa cùng khối**:

| Khối | Hiện trạng | Hệ quả khi demo CĐT |
|------|------------|---------------------|
| HR | Seed 12 ban / 18 chức vụ. Payroll / phép / chấm công **không biết** BĐS | Roster gallery, KPI TVV, offboard hold — thủ công |
| CSKH | Lead `re_buyer` + SLA engine + ticket `cskh_first_touch`. Board `/crm/cskh-board` **không** filter BĐS | CSKH agency và CSKH CĐT hai thế giới |
| Kế toán | Collection + HH trong pack. Tab Kế toán RE = P&L JSON. Invoices / payroll **không** ghi | CFO không đối soát GMV căn với sổ agency |
| Marketing | Ingest + CAPI stub `Purchase`. Marketing OS / ads **không** đọc `net_price_vnd` | Closed-loop ads → căn **gãy** |
| Kinh doanh | Hold/TX/ra quân ≠ `/crm/sales` B2B. GDKD hai mặt | GĐKD CĐT lạc vào pipeline dịch vụ PTT |

Đối thủ CRM generic: form + pipeline + task. Đối thủ CĐT nội bộ: khóa căn + HĐMB, yếu ads/SLA. **Lỗ hổng để thắng:** một hệ — ads biết căn, CSKH biết hold, kế toán biết phiếu thu, HR biết ca gallery, GĐKD thấy một war-room.

---

## 2. Quyết định đã khóa (Q30–Q48)

Q1–Q29 của pack BĐS **không sửa**. Spec này **chỉ** khóa chỗ nối.

| # | Quyết định | Chọn |
|---|------------|------|
| Q30 | Kiểu thống nhất | **Spine + adapters** — không gộp bảng, không fork module. Mỗi khối đọc/ghi qua **cổng** (`BdsSpineEvent` + query port) |
| Q31 | Xương sống | Bốn thực thể: `bds_tenant` · `crm_re_project_products` (căn) · `bds_transactions` · `crm_leads` (`re_buyer`) + `staff_users` |
| Q32 | Kinh doanh B2B | **Giữ tách.** `/crm/sales` = bán dịch vụ agency. `/crm/bds/*` = bán căn. Tenant CĐT **ẩn** nav B2B Sales trừ `operated_by_ptt` + cap `crm_b2b_*` |
| Q33 | CSKH | **Một board, hai skin.** `/crm/cskh-board` thêm `flow=re_buyer`. Cột: dự án, căn, hold TTL, stage TX. Deal Room agency **404** trên `re_buyer` |
| Q34 | CSKH sau bán | Aftersales pack **là** CSKH after. Ticket khách `tickets` **không** dùng. Defect aftersales **không** tạo staff ticket (BR-BDS-46 giữ) |
| Q35 | HR | **Không fork** payroll/leave. Onboard / offboard / roster / KPI TVV đọc spine. Hoa hồng BĐS → **dòng payslip tùy chọn** (`PTT_BDS_PAYROLL_MAP=0` mặc định) |
| Q36 | Kế toán | Collection BĐS = **sổ thu khách mua** (nguồn sự thật tiền căn). Module invoices/financials agency = **sổ PTT**. Facade `/crm/bds/finance` tổng hợp GMV + aging + HH; **không** thay ERP |
| Q37 | Chứng từ xuất | Phiếu thu / bảng kê HH / aging CSV. Journal ERP = file + webhook `finance.export` — ngoài v1 ghi GL |
| Q38 | Marketing | CAPI **thật** khi `PTT_BDS_CAPI=1`: `Lead` ingest, `Schedule` xem nhà, `Purchase` lúc `deposit` (mặc định) hoặc `contracted` (tenant setting). Value = `transactions.net_price_vnd` |
| Q39 | Attribution | Lead `re_buyer` giữ `utm` + `ad_id` + `campaign_id`. Closed-loop report: spend ads ÷ GMV căn (không `crm_contracts`) |
| Q40 | Marketing plan | Kế hoạch MKT **dự án BĐS** = `bds_project_os` kind `marketing` (duyệt PM/GĐKD). `/crm/marketing-plan` agency **không** gắn căn |
| Q41 | War-room Kinh doanh | `/crm/bds` + `/crm/bds/launches` = console GĐKD CĐT. `/crm/gdkd-enterprise` = GĐKD agency. Không trộn KPI |
| Q42 | Sự kiện xương sống | Mọi adapter subscribe `BdsSpineEvent` (lead, hold, visit, tx_stage, receipt, commission, handover, staff_assign, offboard). At-least-once, idempotency_key |
| Q43 | UI khối | Sidebar **BĐS** là nhà. Deep-link sang HR / CSKH / Finance / Marketing **đã lọc tenant + flow**. Không clone trang |
| Q44 | Flag master | `PTT_BDS_OS=0` mặc định. Bật khi PACK=1. Từng adapter: `PTT_BDS_CSKH_BOARD`, `PTT_BDS_HR_ROSTER`, `PTT_BDS_FINANCE_HUB`, `PTT_BDS_CAPI`, `PTT_BDS_PAYROLL_MAP`, `PTT_BDS_NAV_HIDE_B2B` |
| Q45 | Tenant broker | CSKH board `re_buyer` + giỏ. Finance hub = HH + aging **của sàn**. HR roster = staff sàn. Nav B2B ẩn |
| Q46 | Người mua 360 | `/crm/bds/buyers/:leadId` (hoặc `/crm/leads/:id` skin `re_buyer`): timeline ads → gọi → xem nhà → hold → cọc → HĐMB → thu → bàn giao. Một URL |
| Q47 | Thắng đối thủ | Đo bằng **demo 90 phút** §16 — không bằng số module |
| Q48 | Phạm vi v1 OS | Nối **đã có**. Không eSign, không BQL tòa, không marketplace, không GL ERP, không app CTV store |

---

## 3. Mục tiêu và phi mục tiêu

### 3.1. Mục tiêu (CRM BĐS thống nhất v1)

Một tenant CĐT chạy **một ngày bán** mà không mở Excel / Zalo group / CRM khác:

1. Ads ra lead `re_buyer` → board CSKH 15p → xem nhà → hold khóa căn.  
2. GĐKD duyệt F1 trên **Việc** + thấy cùng hold trên hub.  
3. Cọc → phiếu thu Collection → CAPI Purchase → HH accrue.  
4. HR thấy ca gallery / KPI TVV từ TX, không nhập tay.  
5. Offboard TVV → hold mở, ticket về trưởng ban, room chat revoke.

### 3.2. Phi mục tiêu

- Gộp `crm_b2b_projects` / `crm_contracts` / `crm_b2b_commission_ledger`.  
- Thay thế SAP/MISA/Fast.  
- Một pipeline «Sales» cho cả bán căn và bán ads.  
- Board CSKH SPA và BĐS dùng chung **cột mặc định** (cột theo `flow`).  
- Payroll tự tính lương cứng + BHXH từ HH (chỉ map dòng HH khi flag ON).

---

## 4. Kiến trúc

### 4.1. Spine + adapters

```
                    ┌───────────── BdsSpine ─────────────┐
                    │  Tenant · Unit · Tx · Buyer · Staff │
                    │  BdsSpineEvent (outbox PG)          │
                    └──────┬──────────┬──────────┬────────┘
           ┌───────────────┼──────────┼──────────┼───────────────┐
           ▼               ▼          ▼          ▼               ▼
        HR adapter    CSKH adapter  Finance    Marketing      Sales OS
        roster/KPI    board+SLA     hub+export CAPI+attr      war-room
        offboard      visits                  plan OS         (BĐS only)
```

- **BdsModule** giữ domain (hold/TX/collection).  
- Adapter **không** import ngược vòng: CSKH đọc port `BdsBuyerQuery`, không `BdsTxService` trực tiếp trừ hook đã có.  
- Outbox bảng `bds_spine_events` (UUID, type, aggregate, payload, idempotency_key, created_at). Job `bds_spine_dispatch` fan-out.

### 4.2. Không import chéo cấm

| Từ | Sang | Cách |
|----|------|------|
| `staff-tickets` | `BdsModule` | Giữ `@Optional()` hook như P12b |
| `cskh-board` | TX/hold | `BdsBuyerQueryPort` (lead_id → unit, hold, tx_stage) |
| `hr` / payroll | commission | `BdsCommissionExportPort` khi `PTT_BDS_PAYROLL_MAP=1` |
| Marketing OS | TX | Subscribe `tx.deposit` / `tx.contracted` |
| `/crm/sales` | BĐS | **Cấm** ghi. Nav ẩn khi `PTT_BDS_NAV_HIDE_B2B=1` |

### 4.3. Sự kiện spine (catalog)

| `event_type` | Aggregate | Consumer |
|--------------|-----------|----------|
| `buyer.created` | lead | CSKH board, ticket `cskh_first_touch`, CAPI Lead |
| `buyer.assigned` | lead | HR roster load, CSKH SLA start |
| `visit.booked` / `visit.done` | visit | CAPI Schedule, CSKH playbook |
| `hold.created` / `hold.approved` / `hold.expired` | hold | CSKH cột TTL, Sales hub, HR KPI |
| `tx.deposit` / `tx.vbtt` / `tx.contracted` / `tx.cancelled` | tx | Finance, CAPI Purchase, HH, HR KPI |
| `receipt.posted` | installment | Finance aging, HĐMB % gate (đã có) |
| `commission.accrued` / `commission.paid` | ledger | Finance hub, payroll map |
| `handover.done` / `title.handed` | aftersales | CSKH after, Finance clawback window |
| `staff.assigned_project` / `staff.offboarded` | staff | HR, chat, tickets, hold release |

---

## 5. Người mua 360 (join chính)

### 5.1. Màn hình

**URL:** `/crm/leads/[id]` khi `resolveLeadFlowKind=re_buyer` **đổi skin** (không URL thứ hai bắt buộc). Alias `/crm/bds/leads?lead=` redirect.

Tab (thứ tự): **Hồ sơ · Hành trình · Căn & hold · Giao dịch · Thu tiền · Ads · Việc · Chat**.

| Tab | Nguồn | Cap |
|-----|-------|-----|
| Hồ sơ | `crm_leads` + PII mask nếu thiếu `bds_buyers.view_pii` | `bds_buyers.view` |
| Hành trình | timeline spine + CSKH activities | `bds_buyers.view` |
| Căn & hold | products + holds | `bds_holds.view` |
| Giao dịch | TX | `bds_transactions.view` |
| Thu tiền | installments | `bds_collections.view` |
| Ads | utm, ad, CAPI status | `cdt_mkt` hoặc `bds_buyers.view` |
| Việc | staff tickets `entity=lead\|hold\|tx` | `staff_tickets.view` |
| Chat | room huddle gắn lead (nội bộ) | `staff_chat.view` |

### 5.2. Cấm trên skin `re_buyer`

- Deal Room agency, đề xuất dịch vụ, `b2b_project_id`, marketing-plan agency.  
- HTTP 404 nếu gọi API deal-room với lead `re_buyer`.

---

## 6. Khối CSKH

### 6.1. Board thống nhất

**URL giữ** `/crm/cskh-board`. Query bắt buộc khi tenant BĐS: `flow=re_buyer` (default nếu user chỉ có cap BĐS, không có `crm_leads` SPA).

Cột **re_buyer** (thay cột SPA):

| Cột | Nguồn |
|-----|--------|
| KH / SĐT | lead (PII) |
| Dự án / Căn | `re_project_id`, unit_code |
| Stage | `new → contacted → xem_nha → giu_cho → coc → vbtt → hdmb` |
| Hold TTL | hold active |
| TX | stage giao dịch |
| SLA 15p / nhắc | engine hiện có (`lead-sla-care`) |
| TVV | assignee |

Filter: dự án, tòa, pool `inhouse|channel`, assignee, `sla_filter=breach`.

Home-summary `/api/crm/cskh-board/home-summary` thêm block `re_buyer` (counts) khi `PTT_BDS_CSKH_BOARD=1` — **không** trộn số SPA.

### 6.2. Playbook

| Bước | Hệ thống |
|------|----------|
| First-touch 15p | SLA + ticket `cskh_first_touch` (đã có) |
| Mời xem nhà | `bds_site_visits` + CAPI Schedule |
| Nhắc TTL hold | cột board + ticket escalate |
| Lost | `lost_reason` bắt buộc (enum BĐS, không lý do SPA) |

### 6.3. Sau bán

`/crm/bds/aftersales` là workspace Ban CSKH after. Board CSKH **không** list defect. Deep-link từ người mua 360 tab Hành trình khi `handed_over`.

### 6.4. Nav

- User cap `bds_buyers.view`: **BĐS → Lead khách mua** = board `flow=re_buyer` (thay placeholder P6).  
- **CRM · CSKH vận hành** ẩn với tenant CĐT thuần (`PTT_BDS_NAV_HIDE_B2B=1` + không cap SPA).

---

## 7. Khối Kinh doanh (CĐT / Sàn)

### 7.1. Định nghĩa

**Kinh doanh BĐS** = Ban KD Inhouse + Ban Kênh + GĐKD: hold, ra quân, CSBH, mạng, giỏ.  
**Kinh doanh agency** = `/crm/sales` — ngoài tenant CĐT thuần.

### 7.2. War-room một màn

Hub `/crm/bds` (đã có KPI) **bắt buộc** 4 widget sống:

1. Inbox hold F1 (đã có).  
2. Hold hết hạn 2h (đã có).  
3. **Hàng đợi CSKH breach** (port CSKH, 5 lead).  
4. **Phiếu thu hôm nay / overdue** (port Finance).

Ra quân `/crm/bds/launches` giữ war-room 3 cột. Thêm chip **Lead đang xem nhà** (visit `booked` trong cửa sổ launch).

### 7.3. GĐKD

- Cap `cdt_sales_dir` / `gdkd`: mặc định landing `/crm/bds` không `/crm/gdkd-enterprise`.  
- `/crm/gdkd-enterprise` 403 nếu user không có cap B2B và `PTT_BDS_NAV_HIDE_B2B=1`.

### 7.4. KPI TVV / AM

Nguồn: TX `contracted` GMV + số hold convert + SLA CSKH.  
Đích: HR KPI định nghĩa `bds_gmv_hdmb`, `bds_hold_convert_pct`, `bds_first_touch_ok` — **không** KPI lead B2B.

---

## 8. Khối Marketing

### 8.1. Closed-loop

```
Ads/Form/Zalo → crm_leads (re_buyer, utm, ad_id)
    → visit → CAPI Schedule
    → tx.deposit|contracted → CAPI Purchase (value = net_price_vnd)
    → báo cáo /crm/bds (hoặc /seo|/meta không bắt buộc v1)
```

Bảng `bds_capi_events` (đã stub) thêm: `external_id`, `http_status`, `retry_count`. Job retry 3 lần.

### 8.2. Cấu hình tenant

`bds_tenants.capi_purchase_at`: `deposit` (mặc định) | `contracted`.  
Ad account map: `crm_re_project_lead_config` (đã có) + `meta_ad_account_id` bắt buộc trước khi `PTT_BDS_CAPI=1` trên dự án.

### 8.3. Báo cáo thắng ads

Màn `/crm/bds` hoặc tab Ads trên dự án:

| Chỉ số | Công thức |
|--------|-----------|
| CPL | spend / lead `re_buyer` |
| CPA cọc | spend / số `tx.deposit` |
| ROAS căn | GMV `net_price_vnd` (mốc Purchase) / spend |

Spend đọc từ hub Meta **nếu** account đã map; không map → hiện «Chưa gắn ad account» — không bịa số.

### 8.4. Kế hoạch MKT dự án

`bds_project_os` plan kind `marketing`: duyệt PM (A) + Trưởng MKT (R).  
`/crm/marketing-plan` (agency) **không** list plan này.

### 8.5. Claim / kit đại lý

Tài liệu `visibility=agency` trên Project OS. Marketing không hold, không sửa giá (charter §25.9 giữ).

---

## 9. Khối Kế toán / Tài chính

### 9.1. Hai sổ, một facade

| Sổ | Chủ | Thực thể |
|----|-----|----------|
| Thu khách mua căn | Collection BĐS | phiếu thu, installment, aging |
| Hoa hồng kênh | Commission BĐS | ledger, statement kỳ |
| Dịch vụ PTT | invoices / financials | **không** trộn |
| P&L dự án RE cũ | tab Kế toán `re-projects` | **đổi nhãn** «P&L nội bộ dự án» — không phải sổ thu |

**URL facade:** `/crm/bds/collections` nâng thành **Tài chính BĐS** (tabs: Thu · Aging · HH · Xuất chứng từ). Giữ URL cũ redirect tab Thu.

### 9.2. Đối soát ngày

CFO / Trưởng collection:

1. GMV HĐMB tháng (hub) = SUM TX `contracted`.  
2. Đã thu = SUM receipt `posted`.  
3. Overdue >30d (hub).  
4. HH phải trả kỳ = ledger `accrued` − `paid` − `clawback`.

Xuất CSV + (v1) JSON webhook `PTT_BDS_FINANCE_WEBHOOK_URL` — không bút toán nợ/có.

### 9.3. Cổng tiền

Giữ Q21/Q24: HĐMB cần `% thu` + cổng pháp lý. Finance hub **chỉ đọc** — không bypass.

### 9.4. Payroll map (tùy chọn)

Khi `PTT_BDS_PAYROLL_MAP=1`: mỗi `commission.paid` tạo **một dòng** `payroll_addon` (hoặc bảng `bds_payroll_lines`: staff_id, period, amount_vnd, ledger_id). HR xem trên `/crm/payroll` filter `source=bds_commission`. Không tự cộng vào lương cứng.

---

## 10. Khối HR

### 10.1. Việc HR phải làm trên UI (không SQL)

| Việc | UI | Hệ quả spine |
|------|-----|----------------|
| Onboard TVV | `/admin/crm/org/users` + chức vụ `tvv_inhouse` | `staff.assigned` → room `ban_kd` |
| Gán dự án / khu | `/crm/re-projects/:id` tab Nhân sự | `staff.assigned_project` → pool lead |
| Roster gallery | `/crm/hr/attendance` filter `dept=ban_kd` | Ca → quyền hold `inhouse` trong ca (v1: hiển thị; chặn hold ngoài ca = v1.1) |
| Offboard | HR Hub / users `active=false` | `staff.offboarded`: hold `open` của user → `available` nếu chưa cọc; ticket → queue trưởng; chat revoke |

### 10.2. KPI

Định nghĩa KPI HR thêm 3 mã §7.4, nguồn query spine (không sheet). Trang `/crm/staff-kpi` filter `pack=bds`.

### 10.3. Charter HR

HR **không** hold, không phiếu thu, không activate CSBH. Chỉ roster + quyền + phép.

### 10.4. Chat / Việc

Giữ Q28–Q29. Adapter HR: đổi `department_id` → job đồng bộ membership trong 60s (đo bằng test). Offboard bắt buộc gọi cùng transaction với `staff_users.active=false`.

---

## 11. Nav & skin tenant

### 11.1. Tenant `developer` / `hybrid` (`PTT_BDS_OS=1` + `PTT_BDS_NAV_HIDE_B2B=1`)

Sidebar thứ tự:

1. **BĐS** (hub, dự án, lead=CSKH board, hold, ra quân, TX, mạng, tài chính, after, HH, chat, việc)  
2. **Tổng quan** (dashboard tenant — ẩn Bảng CSKH SPA)  
3. **Nhân sự & Hiệu suất** (HR Hub, KPI `pack=bds`)  
4. **Marketing** chỉ mục: Ads Meta **nếu** cap `cdt_mkt` + deep-link dự án; ẩn Content/Email agency nếu không cap  
5. **Admin**

Ẩn: CRM · B2B Sales, Deal Room, `/crm/sales`, `/crm/gdkd-enterprise`.

### 11.2. Tenant `broker`

BĐS: giỏ, lead board, hold, HH, chat. Tài chính = HH + công nợ **sàn**. HR = staff sàn. Ẩn Project OS CĐT.

### 11.3. Tenant PTT `operated_by_ptt` + agency

Nav **cả hai** khối. User chọn workspace: chip **Agency | BĐS**. Default theo cap mạnh hơn.

---

## 12. API / cổng

### 12.1. Query ports (nội bộ Nest)

```
BdsBuyerQuery.port
  getBoardRow(leadId): { project_id, unit_code, hold_expires_at, tx_stage }

BdsFinanceQuery.port
  todayReceipts(tenantId)
  overdueGt30(tenantId)
  gmvContractedMonth(tenantId)

BdsHrQuery.port
  kpiForStaff(staffId, period)
```

### 12.2. HTTP mới (staff JWT)

| Method | Path | Flag | Mục đích |
|--------|------|------|----------|
| GET | `/api/v1/bds/spine/buyer/:leadId` | OS | payload 360 |
| GET | `/api/crm/cskh-board?flow=re_buyer` | CSKH_BOARD | board |
| GET | `/api/v1/bds/finance/hub` | FINANCE_HUB | facade CFO |
| POST | `/api/v1/bds/finance/export` | FINANCE_HUB | CSV |
| POST | `/api/v1/staff/:id/offboard` | HR_ROSTER | spine offboard |

CAPI gửi Meta: reuse client ads hiện có; không endpoint public mới.

### 12.3. Idempotency

Mọi ghi spine: `idempotency_key = event_type + ':' + aggregate_id + ':' + stage`. Trùng → 200 cùng body.

---

## 13. Cờ môi trường

```bash
PTT_BDS_PACK=1
PTT_BDS_OS=0                    # master thống nhất
PTT_BDS_CSKH_BOARD=0
PTT_BDS_HR_ROSTER=0
PTT_BDS_FINANCE_HUB=0
PTT_BDS_CAPI=0
PTT_BDS_PAYROLL_MAP=0
PTT_BDS_NAV_HIDE_B2B=0

NEXT_PUBLIC_PTT_BDS_UI=1
NEXT_PUBLIC_PTT_BDS_OS=0
NEXT_PUBLIC_PTT_STAFF_TICKETS=1
NEXT_PUBLIC_PTT_STAFF_CHAT=1
```

Bật staging đề xuất: OS + CSKH_BOARD + FINANCE_HUB + NAV_HIDE_B2B + CAPI (nếu có ad account). PAYROLL_MAP tắt đến khi HR sign-off.

---

## 14. Pha triển khai

| Pha | Tên | Thắng demo | Phụ thuộc |
|-----|-----|------------|-----------|
| U0 | Spine outbox + ports | Event hold/tx vào bảng, replay được | PACK |
| U1 | Người mua 360 + ẩn Deal Room | 1 URL đủ hành trình | U0 |
| U2 | CSKH board `re_buyer` | First-touch 15p trên board + cột căn | U1, SLA cũ |
| U3 | Nav tenant + ẩn B2B | CĐT không thấy `/crm/sales` | U1 |
| U4 | Finance hub + export | CFO 4 số khớp TX/receipt/HH | Collection, HH |
| U5 | CAPI thật + ROAS | Purchase đúng `net_price_vnd` | ad map |
| U6 | HR offboard + KPI 3 mã | Offboard mở hold; KPI = GMV | U0, tickets, chat |
| U7 | Payroll map | 1 dòng HH trên payslip | U4, U6, flag |
| U8 | War-room 4 widget | Hub = CSKH + thu + hold | U2, U4 |

Thứ tự bắt buộc: U0 → U1 → U2/U3 song song → U4/U5 → U6 → U7 → U8.

---

## 15. RACI chỗ nối (bổ sung §25.4)

| Việc nối | A | R | C |
|----------|---|---|---|
| Skin board `re_buyer` | GĐKD | CSKH presales | MKT |
| Map ad account | Trưởng MKT | MKT | PM |
| CAPI Purchase mốc | TGĐ (policy) | MKT | Collection |
| Export chứng từ kỳ | Trưởng collection | CV collection | CFO |
| Offboard TVV | HR BP | HR + Trưởng inhouse | GĐKD |
| Map HH → payroll | TGĐ | HR + CV HH | Collection |
| Ẩn nav B2B | `cdt_admin` | IT flag | — |

---

## 16. Thắng đối thủ — demo 90 phút

Chuẩn bị: tenant `cdt-demo`, 1 dự án đủ pháp lý, 3 căn, 2 TVV, 1 CSKH, 1 GĐKD, 1 Collection, 1 MKT, ad account map **hoặc** spend stub `0`.

| # | Phút | Cảnh | Đối thủ thất bại nếu |
|---|------|------|----------------------|
| 1 | 0–10 | Form ads → lead trên **board CSKH** cột căn trống, SLA chạy | CRM generic không FK căn |
| 2 | 10–20 | Xem nhà → Schedule; hai TVV hold cùng căn → 201 + 409 | Bitrix/Getfly không TTL/409 |
| 3 | 20–35 | GĐKD duyệt F1 trên **Việc**; hub hiện cùng hold | Hai hệ ticket / Excel |
| 4 | 35–50 | Cọc → phiếu thu → hub GMV/thu; CAPI log Purchase = giá căn | Ads gắn `crm_contracts` sai |
| 5 | 50–65 | CFO **Tài chính BĐS** aging + CSV; HH accrue | Kế toán nhập tay |
| 6 | 65–80 | Người mua 360: ads→hold→cọc trên 1 trang | 4 phần mềm |
| 7 | 80–90 | Offboard TVV: hold mở, ticket về trưởng, không login | Hold treo xác |

**Không** demo pipeline B2B, Deal Room, payroll BHXH.

---

## 17. Kiểm thử

| ID | Case | Kỳ vọng |
|----|------|---------|
| U-01 | `PTT_BDS_OS=0` | Nav/API mới 404; pack BĐS cũ nguyên |
| U-02 | Board `flow=re_buyer` | 0 lead SPA; có cột hold |
| U-03 | Deal-room `re_buyer` | 404 |
| U-04 | Nav hide B2B | `/crm/sales` 403 tenant CĐT |
| U-05 | CAPI off | Không HTTP ra Meta; TX vẫn OK |
| U-06 | Purchase value | = `net_price_vnd` không `list_price` |
| U-07 | Offboard + hold cọc | **Không** mở căn (TX giữ) |
| U-08 | Offboard + hold chưa cọc | Căn `available` |
| U-09 | Finance hub | GMV = SUM contracted cùng kỳ |
| U-10 | Payroll map off | 0 dòng payslip |
| U-11 | Home-summary | Block `re_buyer` tách `spa` |
| U-12 | Spine replay | Trùng idempotency không nhân ticket |

---

## 18. Rủi ro

| Rủi ro | Xử lý |
|--------|--------|
| Board CSKH chậm vì join hold/TX | Port cache 15s; index `(tenant_id, flow, assignee)` |
| CAPI PII | Hash SĐT theo chuẩn Meta; không log raw |
| Offboard nhầm mở căn đã cọc | U-07 bắt buộc; transaction PG |
| GĐKD PTT lẫn KPI | Nav hide + landing `/crm/bds` |
| Finance bị hiểu là ERP | Copy UI: «Sổ thu căn — không phải hạch toán» |

---

## 19. Quan hệ spec cũ

| Spec | Hành động |
|------|-----------|
| 2026-08-21 pack BĐS Q1–Q29 | **Giữ.** Q24 «không thay ERP» = Q36–Q37 |
| 2026-08-21 §8.2 CSKH board `re_buyer` | **Thực hiện** tại U2 (trước đây chưa code) |
| 2026-08-21 §8.3 CAPI | **Thực hiện** U5 (trước = stub) |
| 2026-08-21 §8.4 HH không payroll | **Nới** bằng Q35 flag OFF mặc định |
| P8 UI / P12b tickets | Spine bọc hook đã có — không viết lại hold/TX |

---

## 20. Glossary

| Thuật ngữ | Nghĩa |
|-----------|--------|
| Spine | Bộ 4 thực thể + outbox sự kiện |
| Adapter | Module platform subscribe spine |
| Sổ thu | Collection phiếu thu khách mua căn |
| Sổ PTT | Invoices / financials agency |
| Skin `re_buyer` | Cùng route lead/CSKH, cột và cấm Deal Room |
| War-room | Hub + launch — GĐKD CĐT |
| OS flag | `PTT_BDS_OS` — bật khối thống nhất |

---

*Duyệt Q30–Q48 rồi mở plan U0. Không triển khai trước khi chốt: mốc CAPI (`deposit` vs `contracted`), ẩn B2B mặc định staging, payroll map (OFF). Tham chiếu nghiệp vụ CĐT VN — không copy thương hiệu.*
