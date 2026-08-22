# RNOSAI — HR Use Cases

## HR-UC-001 — Employee File P1 (Identity + Address)

**Actor:** HR / Lead (view-only, PII masked)

**Pre:** `PTT_HR_EMPLOYEE_FILE=1`, DDL P1 applied, NV tồn tại trong `crm_staff`.

**Flow:**
1. Mở `/crm/staff/:id` → shell 2-pane với header vòng % hồ sơ.
2. Tab **Hồ sơ**: card Định danh (CCCD, MST, ngân hàng) + card Địa chỉ (thường trú / tạm trú).
3. Lưu từng card riêng (L-01) — PATCH identity ≠ PUT addresses.
4. Lead không có `crm_hr_pii.view` → CCCD/MST mask server-side.
5. Tab **CRM / Case** giữ workspace KPI hiện có.

**API:**
- `GET /api/v1/hr/staff/:id/profile`
- `PATCH /api/v1/hr/staff/:id/identity`
- `PUT /api/v1/hr/staff/:id/addresses`

**Verify:** `bash scripts/smoke_hr_employee_file_p1.sh`

## HR-UC-004 — Document Wallet P4

**Actor:** HR

**Pre:** P1 deployed + P4 DDL + `PTT_HR_EMPLOYEE_FILE=1`.

**Flow:**
1. Tab **Ví giấy tờ** (default) trên `/crm/staff/:id`.
2. Thêm thẻ (CCCD, bằng, chứng chỉ…) → upload PDF/JPG.
3. Lọc: Sắp hết hạn · Bằng cấp · Thiếu file.
4. Roster `/crm/staff`: cột **Ví %** + chip hết hạn.
5. Header: vòng **Ví %** thay cho hồ sơ cơ bản khi P4 sẵn sàng.

**API:** `GET/POST/PATCH wallet`, `POST .../files`, `GET doc-types`, `GET wallet-roster-stats`.

**Verify:** `bash scripts/smoke_hr_employee_file_p4.sh`

## HR-UC-002 — Labor Contracts P2 (HĐLĐ)

**Actor:** HR

**Pre:** P1 + P4 deployed, P2 DDL, `PTT_HR_EMPLOYEE_FILE=1`.

**Flow:**
1. Tab **Hợp đồng** trên `/crm/staff/:id`.
2. Timeline HĐLĐ — tạo/sửa hợp đồng, thêm phụ lục trên cùng HĐ (BR-HR-112).
3. Chọn thẻ ví loại hợp đồng làm scan (BR-HR-140) — không upload riêng.
4. Kích hoạt HĐ mới → HĐ active cũ chuyển `superseded` (BR-HR-110).
5. Header badge **HĐ sắp hết hạn** khi còn ≤30 ngày (BR-HR-111).
6. Lương gross mask nếu thiếu `crm_hr_pii.view`.

**API:**
- `GET/POST /api/v1/hr/staff/:id/contracts`
- `PATCH .../contracts/:contractId`
- `POST/PATCH .../contracts/:contractId/appendices[/:appendixId]`

**Verify:** `bash scripts/smoke_hr_employee_file_p2.sh`

## HR-UC-003 — Insurance Register P3 (BHXH / BHYT / BHTN)

**Actor:** HR

**Pre:** P1 + P4 deployed, P3 DDL, `PTT_HR_EMPLOYEE_FILE=1`.

**Flow:**
1. Tab **Bảo hiểm** trên `/crm/staff/:id`.
2. Sổ register: BHXH (số sổ, ngày tham gia, trạng thái), BHYT (số thẻ, nơi KCB, hạn), BHTN.
3. Chọn thẻ ví loại bảo hiểm làm scan (BR-HR-140).
4. Lịch sử đóng BHXH/BHTN theo tháng (mức lương đóng = PII).
5. Header badge **BHYT sắp hết hạn** khi `valid_to` ≤30 ngày (BR-HR-120).
6. Số sổ BHXH / số thẻ BHYT mask nếu thiếu `crm_hr_pii.view`.

**API:**
- `GET/PUT /api/v1/hr/staff/:id/insurance`
- `POST/PATCH .../insurance/periods[/:periodId]`

**Verify:** `bash scripts/smoke_hr_employee_file_p3.sh`

## HR-UC-005 — Dependents + Lifecycle + Hub expiry P5

**Actor:** HR

**Pre:** P1–P4 deployed, P5 DDL, `PTT_HR_EMPLOYEE_FILE=1`.

**Flow:**
1. Tab **Gia đình** trên `/crm/staff/:id` — người phụ thuộc (PT TNCN, CCCD mask).
2. Tab **Hồ sơ** — timeline lifecycle 8 stage; chuyển **Chính thức** bị chặn nếu thiếu HĐ active + CCCD + địa chỉ thường trú (BR-HR-130).
3. Header chip lifecycle stage + chip hết hạn (giữ P2/P3/P4).
4. HR Hub `/crm/hr` — widget **Ví sắp hết hạn**, **% ví thấp**, **HĐ/BHYT sắp hết hạn** (≤30 ngày).

**API:**
- `GET/POST/PATCH/DELETE /api/v1/hr/staff/:id/dependents[/:depId]`
- `GET/PATCH /api/v1/hr/staff/:id/lifecycle`
- `GET /api/v1/hr/hub/expiry-summary`

**Caps:** Gia đình = `crm_hr_pii.view/edit`; lifecycle = `crm_staff_roster`.

**Verify:** `bash scripts/smoke_hr_employee_file_p5.sh`

## HR-UC-006 — Self-submit wallet + Excel export P6

**Actor:** NV (self) · HR (duyệt / export)

**Pre:** P1–P5 deployed, P6 DDL, `PTT_HR_EMPLOYEE_FILE=1`.

**Flow:**
1. NV mở `/crm/hr/my-wallet` — nộp thẻ bằng cấp/chứng chỉ (loại `education|cert|license|medical|family|other`).
2. Thẻ tạo với `status=pending_review`, `visibility=self` — upload file scan.
3. HR Hub `/crm/hr` — hàng **Chờ duyệt**; duyệt/từ chối (`crm_hr_docs.approve`).
4. Sau duyệt → `valid`; `% ví` roster chỉ tính thẻ đã duyệt + có file.
5. HR export **Excel ví + người phụ thuộc** cho kế toán (2 sheet).

**API:**
- `GET/POST /api/v1/hr/me/wallet` · `POST .../files` · `GET .../files/:id`
- `GET /api/v1/hr/wallet/pending-review`
- `PATCH /api/v1/hr/staff/:id/wallet/:cardId/approve|reject`
- `GET /api/v1/hr/wallet/export/accounting.xlsx`

**Verify:** `bash scripts/smoke_hr_employee_file_p6.sh`

## HR-UC-007 — Device attendance P7

**Actor:** HR (device admin) · Máy ZK/ADMS (push)

**Pre:** P1–P6 deployed, P7 DDL, `PTT_HR_EMPLOYEE_FILE=1`.

**Flow:**
1. HR tạo thiết bị tại `/crm/hr/attendance` → nhận `device_key` (1 lần).
2. Gán `timeclock_pin` trên tab **Hồ sơ** NV = mã PIN trên máy.
3. Import CSV (pin, datetime, direction) hoặc máy push `POST /api/v1/hr/attendance/device/ingest` + `X-Device-Key`.
4. Punch map NV → `accepted`; PIN lạ → `pending_review` (treo, không nuốt silent).
5. Rollup ngày vào `crm_attendance` (check_in sớm nhất / check_out muộn nhất, TZ `Asia/Ho_Chi_Minh`).
6. Tab **Chấm công** trên `/crm/staff/:id` — timeline punch + bảng ngày.
7. HR Hub widget: PIN chưa map · máy offline · chưa chấm hôm nay.

**API:**
- `POST /api/v1/hr/attendance/device/ingest` (header `X-Device-Key`)
- `POST /api/v1/hr/attendance/device/import.csv`
- `GET/POST /api/v1/hr/attendance/devices`
- `GET /api/v1/hr/staff/:id/attendance?from=&to=`
- `GET /api/v1/hr/attendance/unmapped` · `GET /api/v1/hr/attendance/hub-summary`

**Caps:** `crm_hr_attendance.device` · view tab = `crm_payroll_attendance.view`

**Verify:** `bash scripts/smoke_hr_employee_file_p7.sh`

## HR-UC-008 — GPS attendance P8

**Actor:** NV (self GPS) · HR (site admin / duyệt ngoại lệ)

**Pre:** P7 deployed, P8 DDL, `PTT_HR_EMPLOYEE_FILE=1`.

**Flow:**
1. HR tạo **site geofence** tại `/crm/hr/attendance` (lat/lng, radius 150m) và gán NV.
2. NV mở `/crm/payroll/me` → **Vào ca / Ra ca** (GPS PWA).
3. Trong vùng + accuracy OK → punch `accepted`, rollup ngày.
4. Ngoài geofence hoặc accuracy > radius → `pending_review` (BR-HR-153).
5. HR Hub — hàng **GPS chờ duyệt**; duyệt/từ chối (`crm_hr_attendance.review`).
6. Tab **Chấm công** NV: timeline chip **GPS** + badge «ngoài vùng».
7. Rollup: **máy thắng** in/out; GPS chỉ bổ sung nếu thiếu máy (BR-HR-154).

**API:**
- `GET/POST /api/v1/hr/attendance/sites` · `PUT .../sites/:id/staff`
- `GET /api/v1/hr/me/attendance/sites`
- `POST /api/v1/hr/attendance/gps/punch`
- `GET /api/v1/hr/attendance/gps/pending-review`
- `POST /api/v1/hr/attendance/punches/:id/review`

**Caps:** `crm_hr_attendance.gps` (self) · `.review` (duyệt) · `.device` (site admin)

**Verify:** `bash scripts/smoke_hr_employee_file_p8.sh`
