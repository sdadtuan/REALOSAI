# HR Employee File OS — Kế hoạch quản lý nhân sự chuyên nghiệp

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thắng **Getfly** trên hồ sơ 360 + ví giấy tờ **và** chấm công: **máy chấm công + GPS** một luồng punch, sâu hơn app Getfly — không đánh MISA kê khai.

**Architecture:** `crm_staff` master. Ví `hr_doc_wallet`. Chấm công: `hr_attendance_punches` (append-only, `source=device|gps|manual`) → rollup `crm_attendance` (payroll đã có). Shell từ **P1**. Gói hồ sơ = **P1+P4**; gói chấm công = **P7+P8**.

**Tech Stack:** PostgreSQL DDL; NestJS `hr-employee-file`; ops-web `/crm/staff/[id]`; Jest + vitest; bash deploy/smoke. Flag `PTT_HR_EMPLOYEE_FILE=1`.

**Hướng đề xuất:** **1** — thắng Getfly (hồ sơ + ví + CRM KPI). Full HRM thay MISA = hướng 2.

---

## 1. As-is — vì sao chưa chuyên nghiệp

Hồ sơ hiện tại (`crm_staff` + `StaffEditDrawer`) chỉ sửa **4 field**:

| Có | Thiếu (PO vừa nêu) |
|----|---------------------|
| Tên, SĐT, email, chức danh | Địa chỉ thường trú / tạm trú |
| `internal_code`, phòng, `started_on` | Hợp đồng lao động (loại, hạn, lương, phụ lục) |
| Login / RBAC / KPI / lương lite | BHXH, BHYT, BHTN (sổ, thẻ, nơi KCB) |
| Leave lite, payslip self-service | CCCD, MST, người phụ thuộc, liên hệ khẩn |
| Không có kho file | Bằng cấp, chứng chỉ, giấy khám SK, mọi loại giấy tờ |
| `crm_attendance` 1 dòng/ngày (nhập tay) | Punch máy (vân tay/RFID) + GPS geofence |

BA cũ ([`2026-08-07-hr-enterprise-business-analysis.md`](../specs/2026-08-07-hr-enterprise-business-analysis.md)) **cố ý** để BHXH/HĐLĐ ngoài scope — export MISA. Thực tế vận hành: HR vẫn Excel + Drive → lệch roster CRM, hết hạn HĐ không cảnh báo, offboard thiếu checklist giấy tờ.

**Định vị mới:** RNOSAI = **HRIS nội bộ** (hồ sơ + ví giấy tờ + **chấm công máy + GPS** + HĐ/BH register). MISA = kê khai nhà nước. Payroll lite **đọc** rollup từ punch — không nhập tay 50 dòng.

---

## 2. Ba hướng

| # | Hướng | Effort | Ghi chú |
|---|--------|--------|---------|
| **1** | **Employee File 360 + HĐLĐ + sổ BH (register)** | **M–L · 6 phase** | **Đề xuất** — đủ HR chuyên nghiệp; không C12/TNCN |
| 2 | Full HRM VN thay MISA (kê khai BHXH, thuế TNCN, eBHXH) | XL | 6–12 tháng; legal/cert; không làm |
| 3 | Chỉ link Drive + Excel template, không DDL hồ sơ | S | Giữ Excel; không đóng gap «chưa lưu thông tin» |

**Khóa hướng:** PO chọn **1 / 2 / 3** trước khi code. Mặc định **hướng 1**.

---

## 2b. Thắng Getfly — chuyên sâu hơn, không copy

Getfly mạnh: roster + phòng ban + file đính kèm kiểu Drive + chấm công app. Yếu: hồ sơ phẳng, giấy tờ không phải «ví», không gắn KPI lead/handoff, không mask PII theo cap.

| Getfly làm | RNOS làm sâu hơn (bắt buộc) |
|------------|-----------------------------|
| Form NV 1 trang dài | **2-pane:** rail ngữ cảnh + 1 canvas / việc |
| File đính kèm list | **Ví thẻ** — hạn, issuer, pin, lịch sử `replaced` |
| Bằng cấp = text/ghi chú | Thẻ education (bậc, ngành, trường, xếp loại) |
| Checklist cứng | Catalog loại + HR tự thêm + `% ví` theo JD |
| NV tách khỏi CRM | Cùng NV: ví + KPI lead + RBAC + offboard |
| Ai xem cũng thấy SĐT/CCCD | Mask PII + cap `crm_hr_pii` + audit tải file |
| Hết hạn = nhớ Excel | Hub: hết hạn HĐ / BHYT / chứng chỉ ≤30 ngày |
| Chấm công app / máy tách CRM | **Một punch stream** máy + GPS + thủ công → lương |

**Không copy:** kê khai BHXH/thuế, ATS, LMS. **Có build** máy + GPS — sâu hơn Getfly (nguồn, geofence, hàng ngoại lệ).

**Gói demo 5 phút hồ sơ (thắng Getfly staff):**

1. Roster: cột **Ví %** + chip hết hạn (Getfly không có).  
2. Mở NV: header dính (ảnh, mã, phòng, vòng % ví, HĐ active).  
3. Ví: 1 click thêm ĐH + IELTS — 2 thẻ, preview.  
4. Lead xem cùng NV: **không** thấy CCCD.  
5. Click KPI trên header → lead của NV (Getfly HRM không làm).

**Demo chấm công (sau P7–P8):** máy đẩy 1 punch → hiện trên tab NV + map GPS trong geofence → rollup giờ → payroll đọc `crm_attendance` không sửa tay.

**Thứ tự ship:** P1 → **P4 ví** → P2/P3 HĐ/BH → P5–P6 → **P7 máy** → **P8 GPS** (P7 có thể song song sau P1 nếu có máy sẵn).

---

## 3. Global constraints (hướng 1)

- **Không** kê khai BHXH điện tử / quyết toán TNCN / chữ ký số C06
- **Không** xóa `crm_staff` — chỉ `active=0` + `ended_on` (BR-HR-030)
- Field PII (CCCD, số BHXH, lương HĐ, MST) — cap riêng `crm_hr_pii.view` / `crm_hr_pii.edit`
- Audit mọi PATCH PII + tạo/sửa HĐ
- Mọi scan (HĐ, CCCD, bằng, chứng chỉ): object storage nội bộ (minio/S3); **cấm** commit file vào git
- Một giấy tờ = một thẻ ví (`hr_doc_wallet`); HĐ/BH **không** lưu file riêng rẽ — `document_id` trỏ ví
- HR thêm loại giấy tùy ý (`hr_doc_types.is_system=false`); không hard-code hết loại trong UI
- Flag `PTT_HR_EMPLOYEE_FILE` default `0` trên prod cho đến UAT
- **UI:** `CrmHrPageShell` + `EmployeeFileShell` — cấm form 1 cột 40 field (anti-Getfly)
- **Logic:** 1 màn = 1 việc; lưu từng sổ (identity / địa chỉ / 1 thẻ ví), không «Lưu tất cả»
- Branch: `feat/hr-employee-file-p1` from `main` @ P47 (`b171c512`)
- Commit chỉ khi user yêu cầu · không gộp GTM WIP / Research P

---

## 4. Mô hình tổ chức nghiệp vụ (8 sổ)

```text
                    ┌─ 1. Identity (CCCD, MST, ngày sinh)
                    ├─ 2. Địa chỉ (thường trú / tạm trú / liên hệ)
  crm_staff (1) ────┼─ 3. HĐLĐ + phụ lục (phiên bản, hạn, loại)
                    ├─ 4. Bảo hiểm (BHXH / BHYT / BHTN)
                    ├─ 5. Gia đình / người phụ thuộc
                    ├─ 6. Ví điện tử giấy tờ (mọi loại + bằng cấp)
                    ├─ 7. Lifecycle (onboard → thử việc → chính thức → nghỉ)
                    └─ 8. Chấm công đa nguồn (máy + GPS + thủ công)
```

Giữ nguyên moat cũ: RBAC, KPI CRM, payroll lite — **không** đụng Research OS.

### 4.1. Sổ 1 — Identity

| Field | Rule |
|-------|------|
| `legal_name` | Họ tên giấy tờ (có thể ≠ display `crm_staff.name`) |
| `dob`, `gender`, `nationality` | UTC date |
| `cccd` | 12 số; unique khi khác rỗng; mask `****` nếu thiếu `crm_hr_pii.view` |
| `cccd_issued_on`, `cccd_issued_by` | |
| `tax_code` | MST 10/13 số |
| `bank_name`, `bank_account`, `bank_holder` | Chi lương |

### 4.2. Sổ 2 — Địa chỉ

Mỗi NV **2 dòng bắt buộc khi onboard xong**: `permanent` (thường trú), `temporary` (tạm trú). Optional `contact`.

| Field | Ghi chú |
|-------|---------|
| `kind` | `permanent` \| `temporary` \| `contact` |
| `province_code`, `district_code`, `ward_code` | Catalog VN (cấp tỉnh/xã mới 2025 nếu có) |
| `line1` | Số nhà, đường |
| `same_as_permanent` | Tạm trú = thường trú → 1 click |

### 4.3. Sổ 3 — Hợp đồng lao động

| Field | Ghi chú |
|-------|---------|
| `contract_no` | Unique / công ty |
| `kind` | `probation` · `fixed` · `indefinite` · `seasonal` · `service` |
| `signed_on`, `effective_on`, `expires_on` | `indefinite` → `expires_on` null |
| `salary_gross`, `currency` | PII |
| `work_place`, `job_title_legal` | Chức danh trên HĐ (khác `job_title` CRM) |
| `status` | `draft` · `active` · `expired` · `terminated` · `superseded` |
| `document_id` | Scan PDF |

**BR-HR-110:** Một NV chỉ **1 HĐ `active`** tại một thời điểm.  
**BR-HR-111:** Hết hạn ≤30 ngày → badge «Sắp hết hạn HĐ».  
**BR-HR-112:** Phụ lục (`hr_labor_contract_appendices`) không tạo HĐ mới trừ khi đổi loại / gia hạn.

### 4.4. Sổ 4 — Bảo hiểm (register, không kê khai)

| Loại | Field |
|------|--------|
| BHXH | `book_no`, `joined_on`, `status` (đang đóng / tạm / chốt) |
| BHYT | `card_no`, `valid_from`, `valid_to`, `clinic_name` |
| BHTN | `joined_on`, `status` |

Lịch sử đóng (`hr_insurance_periods`) optional phase P3 — tháng/năm + mức lương đóng. **Không** sinh file XML cơ quan BH.

**BR-HR-120:** BHYT `valid_to` ≤30 ngày → badge «Sắp hết hạn thẻ».

### 4.5. Sổ 5 — Người phụ thuộc

`name`, `relation`, `dob`, `tax_dependent` (boolean), `cccd` optional — phục vụ giảm trừ gia cảnh (export Excel cho kế toán).

### 4.6. Sổ 6 — Ví điện tử giấy tờ (`hr_doc_wallet`)

**Nguyên tắc:** mọi giấy tờ (CCCD, HĐ, BH, **bằng cấp, chứng chỉ, giấy khám, giấy tờ khác**) là **thẻ trong một ví** — không folder Drive rời, không đính kèm rải trên nhiều tab.

```text
  ┌──────── Ví giấy tờ NV #42 ────────┐
  │  [CCCD]  [HĐLĐ]  [BHYT]           │
  │  [ĐH Kinh tế] [IELTS] [GPLX]      │
  │  [Khám SK] [Cam kết BM] [Khác+]   │
  └───────────────────────────────────┘
         ▲              ▲
    HĐ / BH trỏ    Bằng cấp cũng là thẻ
    document_id    (issuer + chuyên ngành)
```

#### 4.6.1. Mô hình thẻ

| Field | Ý nghĩa |
|-------|---------|
| `type_code` | FK `hr_doc_types` (catalog) |
| `title` | Tên hiển thị (vd. «ĐH Marketing — UEH») |
| `doc_no` | Số văn bằng / số giấy |
| `issuer` | Trường, cơ quan cấp |
| `issued_on`, `expires_on` | Hết hạn null = vô thời hạn |
| `status` | `valid` · `expiring` · `expired` · `revoked` · `replaced` |
| `visibility` | `hr_only` · `manager` · `self` |
| `pinned` | Ghim lên đầu ví (CCCD, HĐ active) |
| `linked_entity` | Optional: `contract:12` / `insurance:bhyt` |
| `files[]` | 1–n file (mặt trước/sau, bản dịch) |
| `notes` | Ghi chú HR |

**Bằng cấp / chứng chỉ** thêm field trên cùng thẻ (`hr_doc_wallet_education` 1–1 khi `category=education`):

| Field | Ví dụ |
|-------|--------|
| `level` | THPT · Trung cấp · CĐ · ĐH · ThS · TS · khác |
| `major` | Chuyên ngành |
| `school` | Cơ sở đào tạo |
| `graduated_on` | Năm tốt nghiệp |
| `classification` | Xuất sắc / Giỏi / Khá… |
| `training_form` | Chính quy / vừa học vừa làm |

**BR-HR-140:** Mọi upload đi qua ví — tab Hợp đồng/Bảo hiểm chỉ **chọn thẻ có sẵn** hoặc «Tạo thẻ + upload».  
**BR-HR-141:** `expires_on` ≤30 ngày → `expiring` + badge ví + widget Hub.  
**BR-HR-142:** Thẻ `replaced` giữ file cũ (lịch sử); thẻ mới `valid`.  
**BR-HR-143:** Xóa thẻ = soft-delete; file không purge ngay (retention 5 năm, cùng BR-HR-030).

#### 4.6.2. Catalog loại giấy (`hr_doc_types`) — seed hệ thống

HR có thể **thêm loại mới** (ví dụ «Chứng chỉ Google Ads»). Seed mặc định:

| Nhóm | `type_code` | Bắt buộc onboard? |
|------|-------------|-------------------|
| **Định danh** | `cccd_front`, `cccd_back`, `passport`, `cv_resume` | CCCD 2 mặt |
| **Hợp đồng** | `labor_contract`, `contract_appendix`, `nda`, `offer_letter` | HĐ đã ký |
| **Bảo hiểm** | `bhxh_book`, `bhyt_card`, `bhtn` | Policy HR |
| **Bằng cấp** | `degree_highschool`, `degree_college`, `degree_bachelor`, `degree_master`, `degree_phd` | Theo JD |
| **Chứng chỉ nghề** | `cert_language`, `cert_it`, `cert_professional`, `cert_other` | Theo JD |
| **Giấy phép** | `driver_license`, `work_permit` (NLĐ nước ngoài) | Nếu JD lái xe / người nước ngoài |
| **Y tế** | `health_check`, `vaccination` | Policy công ty |
| **Gia đình** | `dependent_birth_cert`, `marriage_cert` | Nếu kê khai phụ thuộc |
| **Khác** | `other` | Không |

`is_required_onboard` + `is_required_official` trên catalog → tính `% hồ sơ` (không hard-code 8 mục).

#### 4.6.3. UX ví (giống ví điện tử)

Tab **Ví giấy tờ** trên `/crm/staff/[id]`:

| Thành phần | Hành vi |
|------------|---------|
| Lưới thẻ | Màu theo nhóm; icon loại; số / issuer / hạn |
| Tìm + lọc | Nhóm, sắp hết hạn, thiếu file, bằng cấp |
| Thêm thẻ | Chọn loại → metadata → upload 1–n file (PDF/JPG ≤10MB) |
| Xem | Preview PDF/ảnh trong drawer; tải (audit) |
| Ghim | CCCD + HĐ active mặc định pin |
| Trống | CTA «Thêm giấy tờ» — không bắt buộc mọi loại |
| Self-service P6 | NV nộp thẻ «chờ HR duyệt» (`pending_review`) |

`completeness_pct` = số `type_code` bắt buộc có ≥1 thẻ `valid` + ≥1 file / tổng bắt buộc. Roster cột «Ví %».

### 4.7. Sổ 7 — Lifecycle

```text
offer → onboard_docs → probation → official → transfer → notice → offboard_hold → archived
```

Gate: không `official` nếu thiếu HĐ active + CCCD + địa chỉ thường trú (BR-HR-130). Offboard: HĐ `terminated`, BH `chốt`, login revoke (đã có R2-HR).

### 4.8. Sổ 8 — Chấm công đa nguồn (máy + GPS)

As-is: `crm_attendance` **1 dòng / NV / ngày** (`check_in`/`check_out` text) — HR nhập hoặc import, tab payroll max 50 dòng. Không có nguồn, tọa độ, thiết bị.

**Target:** mọi lần chấm là **punch** append-only; ngày công = rollup vào `crm_attendance` cho engine lương hiện có.

```text
  Máy ZK/ADMS / CSV     GPS PWA (geofence)     HR sửa tay
           \                   |                    /
            └──► hr_attendance_punches ────────────┘
                         │  first in / last out
                         ▼
                   crm_attendance (1 ngày) ──► payroll-engine
```

#### 4.8.1. Punch (`hr_attendance_punches`)

| Field | Rule |
|-------|------|
| `staff_id` | Map từ `attendance_pin` (máy) hoặc JWT (GPS) |
| `punched_at` | timestamptz UTC |
| `direction` | `in` · `out` · `auto` (máy 1 chiều → infer) |
| `source` | `device` · `gps` · `manual` |
| `device_id` | Máy / serial |
| `pin` | Mã trên máy (audit) |
| `lat`, `lng`, `accuracy_m` | Bắt buộc nếu `source=gps` |
| `site_id` | Geofence khớp (GPS) hoặc máy gắn site |
| `outside_geofence` | true → hàng ngoại lệ |
| `raw_payload` | JSON máy (không PII thừa) |
| `status` | `accepted` · `pending_review` · `rejected` · `duplicate` |

**BR-HR-150:** Punch không UPDATE — sửa ngày công = punch `manual` + note, hoặc reject punch lỗi.  
**BR-HR-151:** Trùng máy cùng PIN + cùng giây → `duplicate`, không tính 2 lần.  
**BR-HR-152:** Rollup ngày: `check_in` = punch `in`/`auto` sớm nhất; `check_out` = `out`/`auto` muộn nhất (cùng `work_date` theo TZ `Asia/Ho_Chi_Minh`).  
**BR-HR-153:** GPS ngoài geofence + ngoài sai số → `pending_review`, không vào rollup cho đến khi HR duyệt.  
**BR-HR-154:** Một ca có cả máy và GPS: **máy thắng** in/out; GPS chỉ bổ sung nếu thiếu máy (ghi `sources[]` trên ngày).

#### 4.8.2. Máy chấm công (HR-P7)

| Hạng mục | Spec |
|----------|------|
| Adapter 1 | **CSV/Excel** (PIN, thời gian, in/out) — mọi hãng |
| Adapter 2 | **HTTP push** kiểu ADMS/ZKTeco (`POST /api/v1/hr/attendance/device/ingest`) + `X-Device-Key` |
| Map NV | `crm_staff.attendance_pin` / identity `timeclock_pin` unique |
| Thiết bị | `hr_attendance_devices`: tên, serial, site, timezone, last_seen |
| Offline | Máy buffer → đẩy batch; idempotent theo `(device_id, pin, punched_at)` |

Không viết driver USB tại chỗ cho mọi hãng — văn phòng đẩy file hoặc máy cloud-push.

Sâu hơn Getfly: log ingest, thiết bị last_seen, hàng PIN không map (treo, không nuốt silent).

#### 4.8.3. GPS chấm công (HR-P8)

| Hạng mục | Spec |
|----------|------|
| Site | `hr_attendance_sites`: tên, lat/lng, `radius_m` (mặc định 150) |
| NV | Gán 1–n site (văn phòng / khách / WFH radius nhà — policy) |
| Client | ops-web PWA **Chấm công** + `/crm/payroll/me` nút Vào/Ra |
| Payload | lat/lng, accuracy, `punched_at` client (server lấy `now` nếu lệch >2 phút) |
| Map | Tab chấm công: điểm trong/ngoài vòng geofence |
| Ảnh selfie | **P8.1 optional** — không chặn P8 |

Sâu hơn Getfly: geofence đa site + `accuracy_m` + duyệt ngoài vùng; cùng NV thấy máy vs GPS trên một timeline.

#### 4.8.4. UI chấm công

- Tab **Chấm công** trên Employee File: timeline punch (chip nguồn Máy / GPS / Tay).  
- `/crm/hr/attendance`: lưới ngày, filter nguồn, hàng `pending_review`.  
- Payroll tab attendance: **đọc rollup**, không nhập 50 dòng (giữ sửa tay = tạo punch `manual`).  
- Hub: «Chưa chấm hôm nay» · «GPS ngoài vùng».

---

## 5. UI / IA — đẹp hơn và logic hơn Getfly

Tham chiếu tokens: [`SPEC_UI_UX_PTT.md`](../SPEC_UI_UX_PTT.md) §6–7 · shell [`CrmHrPageShell`](../../docs/specs/2026-08-07-rnosai-competitive-win-ui-ux-design.md).

### 5.1. Getfly UI cần vượt

| Getfly | PTT (bắt buộc) |
|--------|----------------|
| Sidebar module + form dài | **EmployeeFileShell** 3 vùng cố định |
| Tab = dump field | Tab = **một sổ**; field nhóm 2 cột, label trên input |
| Đính kèm cuối form | Ví = **sản phẩm chính**, không phụ lục |
| Empty = bảng trống | Empty = 1 câu + 1 CTA |
| Cảnh báo text đỏ rải | Chip hạn trên header + Hub, không modal spam |

### 5.2. Layout `/crm/staff/[id]` (P1 ship shell)

```
┌─ IdentityHeader (sticky) ─────────────────────────────────────┐
│ Avatar  Tên pháp lý / tên CRM     Mã NV    Phòng · Chức vụ     │
│ Vòng Ví 72%   HĐ active v3   2 thẻ hết hạn   [+ Thẻ ví]        │
│ [Hồ sơ] [Ví] [HĐ] [BH] [Chấm công] [Gia đình] [CRM]              │
├──────────────┬────────────────────────────────────────────────┤
│ Rail 240px   │ Canvas                                        │
│ • Việc tiếp  │  Card nhóm (không 1 form khổng lồ)            │
│ • Thiếu bắt  │  2 cột ≥960px · 1 cột mobile                  │
│   buộc       │  Footer card: Lưu sổ này · Hủy                │
│ • Thẻ ghim   │                                               │
└──────────────┴────────────────────────────────────────────────┘
```

**Rail logic:** chỉ việc *của NV này* (thiếu CCCD, HĐ hết hạn). Click rail → đúng tab + scroll tới card. Không menu trùng tab.

### 5.3. Visual (thắng cảm xúc 10 giây)

| Token | Rule |
|-------|------|
| Bề mặt | Card `--surface` + radius 12; **cấm** shadow / gradient |
| Thẻ ví | Tỷ lệ ~1.58 (thẻ ngân hàng); màu **nhóm** (1 hue/catalog), chữ issuer 12px muted |
| % ví | Vòng SVG 40px trên header — số lớn, không progress bar Getfly |
| Chip hạn | Amber ≤30 ngày · đỏ hết hạn · xám vô hạn |
| PII | `•••• 219` + hover «Hiện» nếu có cap; copy = audit |
| Type | Inter/system; monospace chỉ `internal_code`, số HĐ |
| Dense | Roster table compact; detail thoáng — không nhồi 20 input một lúc |

Component mới (ops-web):

- `EmployeeFileShell` · `IdentityHeader` · `WalletCardGrid` · `WalletCard` · `HrCompletenessRing` · `HrExpiryChip` · `PiiMask` · `AddressPairFields` (thường trú / «Giống thường trú»)

### 5.4. Logic tương tác (không chỉ đẹp)

| Rule | Hành vi |
|------|---------|
| **L-01** | 1 card = 1 PATCH. Lưu Hồ sơ ≠ Lưu địa chỉ ≠ Lưu 1 thẻ ví |
| **L-02** | Đổi tab có dirty → dialog «Lưu / Bỏ» — không mất data im lặng |
| **L-03** | «Giống thường trú» copy field + `same_as_permanent`; bỏ tick thì unlock tạm trú |
| **L-04** | Thêm thẻ: loại → metadata (bằng cấp hiện block education) → file. Không file-first |
| **L-05** | Preview file trong drawer; tải = `crm_hr_docs.download` + audit |
| **L-06** | Tab HĐ/BH: chọn thẻ ví hoặc «Tạo thẻ» — **cấm** `<input type=file>` rời |
| **L-07** | Roster search: tên, mã, phòng, `expires_soon=1` — không full-scan CCCD |
| **L-08** | Keyboard: `/` focus search roster; `Esc` đóng drawer ví |
| **L-09** | Punch máy/GPS không sửa tại chỗ — «Điều chỉnh» = punch `manual` + lý do |
| **L-10** | GPS Vào/Ra: hiện bán kính site trước khi bấm; ngoài vùng → submit `pending_review` + copy rõ |

### 5.5. Roster `/crm/staff` (vượt list Getfly)

Cột thêm: **Ví %** · **Hết hạn** (số chip) · **HĐ** (loại + ngày).  
Filter chips: Thiếu giấy bắt buộc · Sắp hết hạn · Thử việc · Active.  
Row click → Employee File (không drawer 4 field cũ làm master). `StaffEditDrawer` chỉ sửa tên/SĐT/email nhanh nếu cần — không thay hồ sơ 360.

### 5.6. Map tab × cap

| Tab | Nội dung | Cap |
|-----|----------|-----|
| Hồ sơ | Identity + 2 địa chỉ + ngân hàng | `crm_staff_roster.view` + PII mask |
| **Ví** | Lưới thẻ (default tab sau P4) | `crm_hr_docs.view` |
| Hợp đồng | Timeline + chọn thẻ ví | `crm_hr_contract.view` |
| Bảo hiểm | BHXH/BHYT/BHTN + thẻ ví | `crm_hr_insurance.view` |
| **Chấm công** | Timeline punch máy/GPS | `crm_payroll_attendance.view` |
| Gia đình | Dependents | `crm_hr_pii.view` |
| CRM | KPI / case / lead (giữ) | roster view |

HR Hub: **Ví sắp hết hạn** (công ty) · **% ví thấp** · HĐ hết hạn — không 5 card trùng.

---

## 6. Caps mới

| Cap | Ý nghĩa |
|-----|---------|
| `crm_hr_pii.view` / `.edit` | CCCD, MST, lương HĐ, số BH |
| `crm_hr_contract.view` / `.edit` | HĐ + phụ lục |
| `crm_hr_insurance.view` / `.edit` | Sổ BH |
| `crm_hr_docs.view` / `.edit` | Ví: xem / thêm / sửa thẻ + file |
| `crm_hr_docs.approve` | Duyệt thẻ NV tự nộp (P6) |
| `crm_hr_docs.download` | Tải file (audit) — tách khỏi view |
| `crm_hr_attendance.device` | Ingest máy / quản lý device + PIN |
| `crm_hr_attendance.gps` | Chấm GPS (self) |
| `crm_hr_attendance.review` | Duyệt ngoài geofence / PIN lẻ |

NV tự xem **ví của mình** (thẻ `visibility=self`) — phase P6; mặc định thẻ PII/`hr_only`.

---

## 7. Lộ trình — gói thắng Getfly trước

| Phase | UC | Scope | Deploy | Effort |
|-------|-----|--------|--------|--------|
| **HR-P1** | HR-UC-001 | Shell 2-pane + identity + địa chỉ + header % | api + ops-web | M |
| **HR-P4** | HR-UC-004 | **Ví thẻ + bằng cấp + % ví roster** ← demo thắng | api + ops-web | M |
| **HR-P2** | HR-UC-002 | HĐLĐ + phụ lục + chọn thẻ ví | api + ops-web | M |
| **HR-P3** | HR-UC-003 | BHXH / BHYT / BHTN + thẻ ví | api + ops-web | S–M |
| **HR-P5** | HR-UC-005 | Dependents + lifecycle + Hub hết hạn | api + ops-web | S–M |
| **HR-P6** | HR-UC-006 | NV nộp thẻ + Excel ví / kế toán | api + ops-web | S–M |
| **HR-P7** | HR-UC-007 | **Máy chấm công:** PIN, ingest CSV/ADMS, rollup ngày | api + ops-web | M |
| **HR-P8** | HR-UC-008 | **GPS:** site geofence, Vào/Ra PWA, hàng ngoại lệ | api + ops-web | M |

Mỗi phase = 1 branch `feat/hr-employee-file-pN`, 1 deploy script, smoke m1–m5 — giống Research P41–P47.

**Out of roadmap:** kê khai BHXH/thuế, ATS, LMS, OCR bằng, selfie bắt buộc, app native store (PWA đủ P8).

### 7.2. HR-P7 / P8 — API chấm công

```
POST /api/v1/hr/attendance/device/ingest     # X-Device-Key
POST /api/v1/hr/attendance/device/import.csv
GET  /api/v1/hr/attendance/devices
GET  /api/v1/hr/staff/:id/attendance?from=&to=
POST /api/v1/hr/attendance/gps/punch         # JWT + lat/lng
GET  /api/v1/hr/attendance/sites
POST /api/v1/hr/attendance/punches/:id/review
```

DDL: `hr_attendance_devices`, `hr_attendance_sites`, `hr_attendance_site_staff`, `hr_attendance_punches`.  
P1 bổ sung `timeclock_pin` trên identity (map máy).  
Rollup ghi `crm_attendance` — **không** đổi công thức `payroll-engine` besides đọc check_in/out đã có.

### 7.1. HR-P4 — Ví điện tử (chi tiết khi tới phase)

```
GET    /api/v1/hr/doc-types
POST   /api/v1/hr/doc-types                  # loại tùy chỉnh
GET    /api/v1/hr/staff/:id/wallet
POST   /api/v1/hr/staff/:id/wallet           # tạo thẻ
PATCH  /api/v1/hr/staff/:id/wallet/:cardId
POST   /api/v1/hr/staff/:id/wallet/:cardId/files
GET    /api/v1/hr/staff/:id/wallet/:cardId/files/:fileId  # signed URL
```

DDL: `hr_doc_types`, `hr_doc_wallet`, `hr_doc_wallet_files`, `hr_doc_wallet_education`.  
UI: lưới thẻ + drawer tạo/xem + filter «Bằng cấp» / «Sắp hết hạn».  
HĐ P2 / BH P3 khi có P4: đổi upload rời → chọn thẻ ví.

---

## 8. HR-P1 — chi tiết (phase đầu, khi PO khóa hướng 1)

### 8.1. DDL (mới)

```sql
-- hr_staff_identity (1-1 crm_staff)
-- hr_staff_addresses (1-n)
-- indexes: unique (staff_id, kind) for permanent+temporary
```

Không nhét JSON vào `crm_staff.notes`.

### 8.2. API

```
GET  /api/v1/hr/staff/:id/profile
PATCH /api/v1/hr/staff/:id/identity
PUT  /api/v1/hr/staff/:id/addresses
```

PATCH `crm_staff` cũ (name/phone/email) **giữ**. Profile mới tách module `hr-employee-file`.

### 8.3. File map P1

| File | Role |
|------|------|
| `docs/specs/postgresql-ddl-hr-employee-file-p1.sql` | DDL |
| `scripts/apply_pg_ddl_hr_employee_file_p1.sh` | Apply |
| `services/ptt-crm-api/src/hr-employee-file/*` | Module Nest |
| `ops-web/src/components/hr/EmployeeFileShell.tsx` | Layout 3 vùng |
| `ops-web/src/components/hr/IdentityHeader.tsx` | Sticky header |
| `ops-web/src/components/hr/AddressPairFields.tsx` | Thường trú / tạm trú |
| `ops-web/src/app/crm/staff/[id]/` | Hồ sơ trong shell |
| `docs/specs/modules/RNOSAI-BA-HR-UseCases.md` | HR-UC-001… |
| `scripts/deploy_hr_employee_file_p1_vps.sh` | api + ops-web |

### 8.4. Tasks P1

**Task 1 — DDL + types (TDD)**  
- [ ] Identity + addresses  
- [ ] Unique `cccd`  
- [ ] Jest repository

**Task 2 — API profile**  
- [ ] GET mask CCCD  
- [ ] PATCH identity + PUT addresses (2 PATCH, L-01)  
- [ ] Audit

**Task 3 — Shell + Hồ sơ (thắng UI từ ngày 1)**  
- [ ] `EmployeeFileShell` + `IdentityHeader` (vòng % placeholder 0–100)  
- [ ] Card Identity / card Địa chỉ — Lưu từng card  
- [ ] Dirty-tab dialog (L-02) · «Giống thường trú» (L-03)  
- [ ] Smoke UI: grep `EmployeeFileShell` · UAT 10 phút

---

## 9. UAT sketch (toàn chương trình)

| # | Actor | Kỳ vọng vs Getfly |
|---|-------|-------------------|
| 1 | HR | Header dính + 2 card (identity / địa chỉ) — không form 1 trang |
| 2 | HR | Lưu địa chỉ không ghi đè identity (L-01) |
| 3 | HR | P4: 3 thẻ ví (ĐH, IELTS, GPLX) + preview |
| 4 | HR | Roster: Ví % + filter sắp hết hạn |
| 5 | Lead | Cùng NV — không thấy CCCD; thấy KPI |
| 6 | HR | P2: HĐ chọn thẻ ví, không upload rời |
| 7 | QA | Demo 5 phút §2b pass staging |
| 8 | HR | P7: import CSV máy → punch + rollup ngày |
| 9 | NV | P8: GPS trong geofence → Vào; ngoài vùng → pending |
| 10 | HR | Duyệt GPS lẻ; payroll thấy giờ không nhập tay |

---

## 10. Rủi ro

| Rủi ro | Mitigation |
|--------|------------|
| Scope phình thành MISA | Giữ §2 hướng 1; cấm XML BHXH |
| PII leak roster list | Mask; cap; không hiện CCCD trên `/crm/staff` list |
| Catalog địa chính đổi 2025 | Lưu `line1` + mã; cho sửa text |
| File scan lớn | ≤10MB/file; ≤20 file/thẻ; PDF/JPG/PNG/WEBP; không git |
| Copy form Getfly | Gate review: cấm 1 form >12 input visible |
| Drive vs ví lệch | Một kho `hr_doc_wallet`; cấm upload bypass |
| Catalog loại phình | Seed + HR tự thêm; `other` bắt buộc |
| Lệch BA 2026-08-07 «không build BH» | Plan này **cập nhật** định vị: register ≠ kê khai |
| Máy nhiều hãng | CSV chuẩn + 1 HTTP ADMS; không USB driver |
| Fake GPS | accuracy + geofence + review; không tin client time |
| Punch trùng máy/GPS | BR-HR-154 máy thắng; duplicate PIN+giây |

---

## 11. Self-review

| Yêu cầu | Phase |
|---------|-------|
| Thắng Getfly trên demo | **P1 + P4** trước |
| UI đẹp + logic hơn form Getfly | §5 shell · L-01…L-10 từ P1 |
| Địa chỉ thường trú / tạm trú | P1 |
| Ví + bằng cấp | P4 |
| HĐ / BH | P2 / P3 (sau ví) |
| Hub hết hạn + lifecycle | P5 |
| Máy chấm công | **HR-P7** |
| GPS chấm công | **HR-P8** |

**Next step:** PO khóa **hướng 1** → `code HR-P1` → **P4 ví** → P7/P8 khi có máy / geofence.
