# Hướng dẫn — HR Employee File OS (P1–P8)

> **Chương trình:** Employee File OS · **Phiên bản:** P1–P8 (2026-08)  
> **Đối tượng:** HR/HCNS, Quản lý, Nhân viên, IT/DevOps  
> **URL staff:** https://rs.pttads.vn  
> **Use case chi tiết:** [`docs/specs/modules/RNOSAI-BA-HR-UseCases.md`](../specs/modules/RNOSAI-BA-HR-UseCases.md)

---

## 1. Giới thiệu

**HR Employee File OS** là phân hệ quản lý nhân sự nội bộ trên PTT CRM, gồm:

| Gói | Phase | Nội dung |
|-----|-------|----------|
| Hồ sơ 360 | P1 | Định danh, địa chỉ, shell 2-pane |
| Ví giấy tờ | P4 | Thẻ CCCD, bằng cấp, chứng chỉ, scan PDF/JPG |
| Hợp đồng | P2 | Timeline HĐLĐ, phụ lục, liên kết thẻ ví |
| Bảo hiểm | P3 | Sổ BHXH/BHYT/BHTN, lịch sử đóng |
| Gia đình & lifecycle | P5 | Người phụ thuộc, 8 stage onboard/offboard |
| NV tự nộp | P6 | Self-submit ví, HR duyệt, export Excel kế toán |
| Chấm công máy | P7 | CSV/ADMS, PIN, rollup ngày |
| Chấm công GPS | P8 | Geofence site, vào/ra ca PWA, duyệt ngoại lệ |

**Phạm vi có:** hồ sơ NV, ví giấy tờ, HĐ/BH register, chấm công máy + GPS, export kế toán.  
**Phạm vi không có:** kê khai BHXH điện tử, quyết toán TNCN, thay MISA/FAST.

**Luồng dữ liệu chấm công:**

```
Máy ZK/ADMS ──► hr_attendance_punches (device)
GPS PWA       ──► hr_attendance_punches (gps)
                    │
                    ▼ rollup (Asia/Ho_Chi_Minh)
              crm_attendance (1 dòng/ngày)
                    │
                    ▼
              Payroll lite đọc — không nhập tay
```

---

## 2. Thiết lập môi trường (IT / DevOps)

### 2.1. Feature flag bắt buộc

| Biến | Giá trị | Mô tả |
|------|---------|-------|
| `PTT_HR_EMPLOYEE_FILE` | `1` | Bật API + UI Employee File trên `ptt-crm-api` |
| `NEXT_PUBLIC_PTT_API_URL` | URL API | ops-web gọi backend (VD: `https://rs.pttads.vn`) |

**Lưu ý:** Trên production, flag mặc định `0` cho đến khi UAT xong. Chỉ bật `1` sau khi apply đủ DDL.

### 2.2. Apply DDL PostgreSQL (theo thứ tự)

Chạy trên DB `rnosaidb` (local hoặc VPS):

```bash
# Thiết lập kết nối (local dev mặc định)
export DATABASE_URL=postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb

# Apply lần lượt P1 → P8
bash scripts/apply_pg_ddl_hr_employee_file_p1.sh
bash scripts/apply_pg_ddl_hr_employee_file_p2.sh
bash scripts/apply_pg_ddl_hr_employee_file_p3.sh
bash scripts/apply_pg_ddl_hr_employee_file_p4.sh
bash scripts/apply_pg_ddl_hr_employee_file_p5.sh
bash scripts/apply_pg_ddl_hr_employee_file_p6.sh
bash scripts/apply_pg_ddl_hr_employee_file_p7.sh
bash scripts/apply_pg_ddl_hr_employee_file_p8.sh
```

| Phase | File DDL |
|-------|----------|
| P1 | `docs/specs/postgresql-ddl-hr-employee-file-p1.sql` |
| P2 | `docs/specs/postgresql-ddl-hr-employee-file-p2.sql` |
| P3 | `docs/specs/postgresql-ddl-hr-employee-file-p3.sql` |
| P4 | `docs/specs/postgresql-ddl-hr-employee-file-p4.sql` |
| P5 | `docs/specs/postgresql-ddl-hr-employee-file-p5.sql` |
| P6 | `docs/specs/postgresql-ddl-hr-employee-file-p6.sql` |
| P7 | `docs/specs/postgresql-ddl-hr-employee-file-p7.sql` |
| P8 | `docs/specs/postgresql-ddl-hr-employee-file-p8.sql` |

### 2.3. Deploy lên VPS

Mỗi phase có script deploy riêng. Ví dụ deploy P8 (bao gồm build API + ops-web):

```bash
APPLY=1 bash scripts/deploy_hr_employee_file_p8_vps.sh
```

Deploy đầy đủ P1–P8: chạy lần lượt `deploy_hr_employee_file_p1_vps.sh` … `p8_vps.sh`, hoặc deploy phase mới nhất nếu DB đã có các phase trước.

**Smoke test sau deploy:**

```bash
bash scripts/smoke_hr_employee_file_p1.sh   # … đến p8
```

### 2.4. Phân quyền RBAC (caps)

Gán caps qua **Admin → Ma trận chức vụ** (`/admin/crm/permissions`) hoặc job function add-on.

| Cap | Vai trò điển hình | Chức năng UI |
|-----|-------------------|--------------|
| `crm_staff_roster.view` | Lead, HR | Xem roster, HR Hub |
| `crm_staff_roster.edit` | HR | Sửa hồ sơ cơ bản, lifecycle, PIN máy |
| `crm_hr_pii.view` / `.edit` | HR | Xem/sửa CCCD, MST, lương HĐ, số BH |
| `crm_hr_docs.view` / `.edit` | HR | Ví giấy tờ trên hồ sơ NV |
| `crm_hr_docs.approve` | HR | Duyệt thẻ NV tự nộp |
| `crm_hr_docs.download` | HR | Tải file scan (có audit) |
| `crm_hr_contract.view` / `.edit` | HR | Tab Hợp đồng |
| `crm_hr_insurance.view` / `.edit` | HR | Tab Bảo hiểm |
| `crm_payroll_attendance.view` | HR, Payroll | Tab Chấm công trên hồ sơ NV |
| `crm_hr_attendance.device` | HR, IT | Quản lý máy, import CSV, site GPS |
| `crm_hr_attendance.gps` | NV | Chấm GPS trên Phiếu lương của tôi |
| `crm_hr_attendance.review` | HR | Duyệt punch ngoài geofence / PIN lẻ |

**Quy tắc mask PII:** Lead có `crm_staff_roster.view` nhưng **không** có `crm_hr_pii.view` → CCCD/MST/lương hiển thị mask server-side.

### 2.5. Flags liên quan (WIN-4-D)

Các module HR cũ vẫn chạy song song:

| Flag | Module |
|------|--------|
| `PTT_PAYROLL_ENABLED=1` | Chấm công & lương `/crm/payroll` |
| `NEXT_PUBLIC_WIN_LEAVE_LITE=1` | Nghỉ phép lite `/crm/hr/leave` |

Xem thêm: [`13-hr-payroll.md`](./13-hr-payroll.md)

---

## 3. Truy cập & điều hướng

### 3.1. Đăng nhập

1. Mở https://rs.pttads.vn/login
2. Đăng nhập SSO Keycloak hoặc email + mật khẩu
3. Xác nhận topbar hiển thị tên + chức vụ

### 3.2. Vào HR Hub

1. Sidebar ☰ → **Nhân sự & Hiệu suất**
2. Bấm **HR Hub** → `/crm/hr`
3. Trang hiển thị:
   - Widget **Cảnh báo hết hạn** (P5)
   - Widget **Chấm công máy** (P7)
   - Hàng **GPS chờ duyệt** (P8)
   - Hàng **Thẻ chờ duyệt** (P6)
   - Nút **Export Excel ví + NPT (kế toán)** (P6)
   - Lưới workspace theo nhóm quyền

### 3.3. Bản đồ route chính

| Route | Đối tượng | Mô tả |
|-------|-----------|-------|
| `/crm/hr` | HR, Manager | Trung tâm HR |
| `/crm/staff` | HR, Lead | Roster nhân viên |
| `/crm/staff/[id]` | HR, Lead | Hồ sơ 360 NV (Employee File) |
| `/crm/hr/my-wallet` | NV | Tự nộp giấy tờ |
| `/crm/hr/attendance` | HR, IT | Máy chấm công + site GPS |
| `/crm/payroll/me` | NV | Phiếu lương + chấm GPS |
| `/crm/payroll` | HR, Finance | Chấm công & lương tháng |
| `/crm/hr/leave` | NV, Manager | Nghỉ phép lite |

---

## 4. HR Hub — tổng quan hàng ngày

### 4.1. Widget cảnh báo hết hạn (P5)

**Vị trí:** đầu trang `/crm/hr`

Hiển thị khi có NV cần xử lý:

- **Ví sắp hết hạn** — giấy tờ hết hạn trong 30 ngày
- **Ví % thấp (<80%)** — hồ sơ onboard chưa đủ
- **HĐ sắp hết hạn** — hợp đồng active còn ≤30 ngày
- **BHYT sắp hết hạn** — thẻ BHYT sắp hết

**Thao tác:**
1. Đọc số lượng trên từng ô
2. Bấm tên NV trong danh sách mẫu (nếu có) → mở `/crm/staff/[id]`
3. Xử lý trên tab tương ứng (Ví / Hợp đồng / Bảo hiểm)

### 4.2. Widget chấm công máy (P7)

**Vị trí:** dưới widget hết hạn

Chip cảnh báo:

- **PIN chưa map** — punch máy không khớp NV
- **Máy offline** — thiết bị chưa push gần đây
- **GPS chờ duyệt** — punch ngoài geofence
- **Chưa chấm hôm nay** — NV active thiếu check-in

**Thao tác:** bấm link **Mở trung tâm chấm công →** → `/crm/hr/attendance`

### 4.3. Hàng GPS chờ duyệt (P8)

**Vị trí:** section **GPS chờ duyệt (N)**

**Điều kiện:** cap `crm_hr_attendance.review`

**Thao tác từng dòng:**
1. Đọc tên NV, hướng (Vào/Ra), thời gian, badge «ngoài vùng»
2. Bấm **Duyệt** → punch chấp nhận, rollup ngày
3. Hoặc **Từ chối** → punch bị loại

### 4.4. Hàng thẻ chờ duyệt (P6)

**Vị trí:** section **Thẻ chờ duyệt (N)**

**Điều kiện:** cap `crm_hr_docs.approve`

**Thao tác từng dòng:**
1. Bấm tên NV → mở hồ sơ
2. Bấm **Duyệt** → thẻ chuyển `valid`, tính vào % ví
3. Hoặc **Từ chối** → nhập lý do (tuỳ chọn)

### 4.5. Export Excel kế toán (P6)

**Vị trí:** nút **Export Excel ví + NPT (kế toán)**

**Điều kiện:** cap `crm_hr_docs.view`

**Kết quả:** file `.xlsx` 2 sheet — ví giấy tờ + người phụ thuộc, dùng cho kế toán MISA/FAST (read-only export, không kê khai).

---

## 5. Danh sách nhân viên (Roster)

**Route:** `/crm/hr` → thẻ **Danh sách nhân viên** hoặc trực tiếp `/crm/staff`

### 5.1. Xem roster

1. Mở `/crm/staff`
2. Dùng ô tìm kiếm lọc theo tên, mã NV, phòng ban
3. Quan sát cột:
   - **Ví %** — % hoàn thiện ví giấy tờ (P4)
   - Chip **hết hạn** — số giấy sắp hết hạn

### 5.2. Mở hồ sơ 360

1. Bấm dòng NV → `/crm/staff/[id]`
2. Shell 2-pane hiển thị:
   - **Header:** avatar, tên, mã NV, phòng, chip hết hạn, vòng **Ví %**
   - **Tab bar:** Ví giấy tờ · Hợp đồng · Bảo hiểm · Gia đình · Chấm công · Hồ sơ · CRM / Case

**Lưu ý:** Tab **Gia đình** chỉ hiện khi có `crm_hr_pii.view`. Tab **Chấm công** cần `crm_payroll_attendance.view`.

---

## 6. Tab Ví giấy tờ (P4) — HR quản lý trực tiếp

**Route:** `/crm/staff/[id]` → tab **Ví giấy tờ** (mặc định)

**Cap:** `crm_hr_docs.view` (xem), `crm_hr_docs.edit` (thêm/sửa)

### 6.1. Thêm thẻ mới

1. Bấm **+ Thêm thẻ** (góc phải lưới thẻ)
2. Drawer mở — điền:
   - **Loại giấy tờ** (CCCD, bằng đại học, IELTS, …)
   - **Tiêu đề**, số giấy, nơi cấp, **Ngày hết hạn**
   - Trường education (bậc, ngành, trường) nếu loại bằng cấp
3. Bấm **Lưu**
4. Trong drawer thẻ vừa tạo → **Upload file** (PDF, JPG, PNG, WebP)
5. Đóng drawer — thẻ xuất hiện trên lưới, vòng **Ví %** cập nhật

### 6.2. Lọc thẻ

Trên thanh filter, chọn:

- **Tất cả**
- **Sắp hết hạn** — hết hạn trong 30 ngày
- **Bằng cấp** — category education/cert
- **Thiếu file** — thẻ chưa có scan

### 6.3. Sửa / xem thẻ

1. Bấm thẻ trên lưới → drawer chi tiết
2. Sửa metadata → **Lưu**
3. **Xem file** — preview trong drawer (cap download riêng để tải về)

---

## 7. Tab Hợp đồng (P2)

**Route:** `/crm/staff/[id]` → tab **Hợp đồng**

**Cap:** `crm_hr_contract.view` / `.edit`; lương cần `crm_hr_pii.view`

### 7.1. Tạo HĐLĐ mới

1. Bấm **+ Hợp đồng mới**
2. Điền form:
   - **Loại:** Thử việc / Xác định thời hạn / Không xác định / …
   - **Số HĐ**, ngày ký, ngày bắt đầu, ngày kết thúc
   - **Lương gross** (mask nếu không có PII cap)
   - **Thẻ ví scan** — chọn thẻ loại hợp đồng đã upload ở tab Ví (BR-HR-140: không upload riêng trên HĐ)
3. Bấm **Lưu**
4. Kích hoạt HĐ mới → HĐ active cũ tự chuyển **Thay thế** (superseded)

### 7.2. Phụ lục HĐ

1. Bấm HĐ trên timeline → **+ Phụ lục**
2. Nhập nội dung phụ lục, ngày hiệu lực
3. Lưu — phụ lục gắn trên cùng HĐ (BR-HR-112)

### 7.3. Badge header

Khi HĐ active còn ≤30 ngày → chip **HĐ sắp hết hạn** trên header NV.

---

## 8. Tab Bảo hiểm (P3)

**Route:** `/crm/staff/[id]` → tab **Bảo hiểm**

**Cap:** `crm_hr_insurance.view` / `.edit`

### 8.1. Cập nhật sổ BHXH / BHYT / BHTN

1. Form **BHXH:** số sổ, ngày tham gia, trạng thái
2. Form **BHYT:** số thẻ, nơi KCB, hạn thẻ (`valid_to`)
3. Form **BHTN:** trạng thái tham gia
4. **Thẻ ví scan** — chọn thẻ bảo hiểm từ tab Ví
5. Bấm **Lưu sổ bảo hiểm**

### 8.2. Lịch sử đóng BHXH/BHTN

1. Cuộn xuống bảng **Kỳ đóng**
2. Bấm **+ Thêm kỳ**
3. Nhập tháng, mức lương đóng (PII — mask nếu thiếu cap)
4. Lưu từng kỳ

### 8.3. Badge header

BHYT `valid_to` ≤30 ngày → chip **BHYT sắp hết hạn**.

---

## 9. Tab Gia đình (P5)

**Route:** `/crm/staff/[id]` → tab **Gia đình**

**Cap:** `crm_hr_pii.view` (xem), `crm_hr_pii.edit` (sửa)

### 9.1. Thêm người phụ thuộc

1. Bấm **+ Người phụ thuộc**
2. Điền: họ tên, quan hệ, ngày sinh, CCCD (mask cho Lead)
3. Đánh dấu **Giảm trừ TNCN** nếu áp dụng
4. Bấm **Lưu**

### 9.2. Sửa / xóa

1. Bấm dòng NPT → sửa form → **Lưu**
2. Hoặc **Xóa** (xác nhận)

Dữ liệu NPT được export cùng file Excel kế toán trên HR Hub.

---

## 10. Tab Hồ sơ — Định danh & Lifecycle (P1 + P5)

**Route:** `/crm/staff/[id]` → tab **Hồ sơ**

### 10.1. Lifecycle (8 stage)

**Vị trí:** card đầu tab Hồ sơ

| Stage | Nhãn UI |
|-------|---------|
| offer | Offer |
| onboard_docs | Onboard giấy tờ |
| probation | Thử việc |
| official | Chính thức |
| transfer | Chuyển bộ phận |
| notice | Thông báo nghỉ |
| offboard_hold | Offboard |
| archived | Lưu trữ |

**Chuyển stage:**
1. Chọn stage mới trên dropdown
2. Thêm ghi chú (tuỳ chọn)
3. Bấm **Cập nhật stage**

**Gate BR-HR-130:** Chuyển sang **Chính thức** bị chặn nếu thiếu:
- HĐLĐ active
- CCCD
- Địa chỉ thường trú

Hệ thống hiển thị danh sách thiếu — hoàn thiện trước khi chuyển.

### 10.2. Card Định danh

1. Điền **Họ tên pháp lý**, **Ngày sinh**
2. **CCCD**, **MST** — chỉ sửa được với `crm_hr_pii.edit`
3. **PIN máy chấm công** (`timeclock_pin`) — mã PIN trên máy ZK, dùng cho P7
4. Thông tin ngân hàng (nếu có field)
5. Bấm **Lưu định danh** — lưu riêng card này (L-01)

### 10.3. Card Địa chỉ

1. **Thường trú:** dòng 1, quận/huyện, tỉnh/thành
2. **Tạm trú:** điền riêng hoặc tick **Giống thường trú**
3. Bấm **Lưu địa chỉ** — PATCH riêng, không gộp với định danh

**Cảnh báo đổi tab:** Nếu có thay đổi chưa lưu trên tab Hồ sơ, hệ thống nhắc **Bỏ thay đổi** hoặc lưu trước khi chuyển tab.

### 10.4. Rail «Việc tiếp theo»

Sidebar trái liệt kê việc còn thiếu: họ tên, CCCD, địa chỉ — dùng checklist onboard.

---

## 11. NV tự nộp ví giấy tờ (P6)

**Route:** `/crm/hr` → **Ví giấy tờ của tôi** hoặc `/crm/hr/my-wallet`

**Đối tượng:** Nhân viên (không cần cap HR)

### 11.1. Nộp thẻ mới

1. Mở `/crm/hr/my-wallet`
2. Section **Nộp giấy tờ mới:**
   - Chọn **Loại giấy tờ** (bằng cấp, chứng chỉ, giấy khám, …)
   - Nhập **Tiêu đề**, **Ghi chú**
3. Bấm **Gửi chờ duyệt**
4. Thẻ xuất hiện ở **Thẻ của tôi** — trạng thái «Chờ HR duyệt»
5. Bấm **Upload file** trên thẻ → chọn PDF/JPG scan
6. Bấm **Xem file** để kiểm tra

**Loại được phép tự nộp:** `education`, `cert`, `license`, `medical`, `family`, `other` — không gồm CCCD/HĐ (HR nhập).

### 11.2. HR duyệt

Xem mục [4.4. Hàng thẻ chờ duyệt](#44-hàng-thẻ-chờ-duyệt-p6) hoặc duyệt trực tiếp trên tab Ví của NV sau khi mở hồ sơ.

**Sau duyệt:** `% ví` roster chỉ tính thẻ `valid` + có file.

---

## 12. Chấm công máy (P7)

### 12.1. Trung tâm quản lý máy

**Route:** `/crm/hr` → **Chấm công máy** hoặc `/crm/hr/attendance`

**Cap:** `crm_hr_attendance.device` hoặc `crm_staff_roster.edit`

#### Bước 1 — Tạo thiết bị

1. Section **Thiết bị**
2. Nhập **Tên máy mới** (VD: «Máy VP HN»)
3. Bấm **Tạo thiết bị**
4. **Lưu ngay Device key** — chỉ hiện 1 lần, dùng cấu hình máy push

#### Bước 2 — Cấu hình máy ZK/ADMS

Cấu hình máy chấm công push tới:

```
POST https://rs.pttads.vn/api/v1/hr/attendance/device/ingest
Header: X-Device-Key: <device_key>
Body: JSON theo format ADMS (pin, timestamp, direction)
```

#### Bước 3 — Gán PIN cho NV

1. Mở `/crm/staff/[id]` → tab **Hồ sơ**
2. Trường **PIN máy chấm công** = mã PIN trên máy
3. **Lưu định danh**

#### Bước 4 — Import CSV (phương án dự phòng)

1. Section **Import CSV** trên `/crm/hr/attendance`
2. Chọn **Thiết bị** gắn với batch
3. Dán nội dung CSV vào textarea:

```csv
pin,datetime,direction
101,2026-08-19 08:30:00,in
101,2026-08-19 17:30:00,out
```

4. Bấm **Import CSV**
5. Đọc kết quả: `imported`, `accepted`, `duplicate`, `pending_review`

#### Bước 5 — Xử lý PIN chưa map

1. Section **PIN chưa map** liệt kê punch không khớp NV
2. Gán `timeclock_pin` đúng trên hồ sơ NV
3. Punch mới sẽ `accepted`; punch cũ vẫn treo cho HR review

### 12.2. Tab Chấm công trên hồ sơ NV

**Route:** `/crm/staff/[id]` → tab **Chấm công**

1. **Rollup ngày (30 ngày):** bảng check-in / check-out / nguồn
2. **Timeline punch:** từng lần chấm — chip **Máy** / **GPS** / **Tay**
3. Badge «ngoài vùng» trên punch GPS pending

**Rollup rule:** Timezone `Asia/Ho_Chi_Minh` — check-in = punch sớm nhất, check-out = muộn nhất trong ngày.

---

## 13. Chấm công GPS (P8)

### 13.1. HR — tạo site geofence

**Route:** `/crm/hr/attendance` → section **Site GPS**

1. Nhập **Tên site** (VD: «VP Hà Nội»)
2. Nhập **Lat**, **Lng** (tọa độ trung tâm)
3. **Bán kính (m)** — mặc định 150m
4. Bấm **Tạo site**

#### Gán NV vào site

1. Chọn site trong dropdown
2. Nhập **staff_id** cách nhau dấu phẩy (VD: `1, 2, 3`)
3. Bấm **Gán NV vào site**

### 13.2. NV — chấm GPS trên điện thoại

**Route:** `/crm/hr` → **Phiếu lương của tôi** hoặc `/crm/payroll/me`

**Cap:** `crm_hr_attendance.gps`

1. Cuộn tới section **Chấm công GPS**
2. Đọc danh sách site đã gán + bán kính
3. Bấm **Lấy vị trí** — trình duyệt xin quyền GPS
4. Xác nhận tọa độ hiển thị (lat, lng, ±accuracy)
5. Bấm **Vào ca** khi bắt đầu ca
6. Bấm **Ra ca** khi kết thúc ca

**Kết quả:**
- Trong geofence + accuracy OK → «Chấm Vào/Ra thành công @ [tên site]»
- Ngoài vùng hoặc accuracy > radius → «chờ HR duyệt»

**Lưu ý PWA:** Dùng Chrome/Safari, bật Location; nên add-to-home-screen trên mobile.

### 13.3. HR — duyệt GPS ngoại lệ

1. HR Hub → section **GPS chờ duyệt**
2. Hoặc widget chip **GPS chờ duyệt** trên widget chấm công
3. **Duyệt** hoặc **Từ chối** từng punch

**Rollup BR-HR-154:** Máy thắng in/out; GPS chỉ bổ sung nếu thiếu máy.

---

## 14. Tab CRM / Case

**Route:** `/crm/staff/[id]` → tab **CRM / Case**

Giữ nguyên workspace KPI / lead / case hiện có — không thay đổi bởi Employee File OS. Lead xem cùng NV nhưng không thấy PII (mask trên các tab khác).

---

## 15. Tích hợp Payroll & Leave (WIN-4-D)

Employee File OS **bổ sung** dữ liệu cho payroll, không thay module cũ.

| Module | Route | Liên kết |
|--------|-------|----------|
| Chấm công & lương | `/crm/payroll` | Đọc `crm_attendance` rollup từ P7/P8 |
| Phiếu lương NV | `/crm/payroll/me` | Payslip + panel GPS P8 |
| Nghỉ phép lite | `/crm/hr/leave` | Độc lập — export cho payroll |

Chi tiết: [`13-hr-payroll.md`](./13-hr-payroll.md)

---

## 16. Quy trình vận hành theo vai trò

### 16.1. HR — onboard NV mới

1. Tạo NV trên roster (`/crm/staff`) hoặc org users
2. Mở `/crm/staff/[id]`:
   - Tab **Hồ sơ:** định danh + địa chỉ + PIN máy
   - Tab **Ví:** thêm CCCD, bằng cấp bắt buộc
   - Tab **Hợp đồng:** tạo HĐ thử việc
   - Tab **Bảo hiểm:** nhập sổ (khi có)
3. Lifecycle → **Onboard giấy tờ** → **Thử việc**
4. Gán site GPS (P8) + xác nhận PIN máy (P7)
5. Khi đủ gate → **Chính thức**

### 16.2. HR — hàng tuần

1. Mở `/crm/hr` — xử lý widget hết hạn
2. Duyệt thẻ ví + GPS pending
3. Kiểm tra PIN chưa map / máy offline
4. Export Excel ví + NPT (cuối tháng cho kế toán)

### 16.3. NV — self-service

1. `/crm/hr/my-wallet` — nộp bằng cấp/chứng chỉ
2. `/crm/payroll/me` — chấm GPS vào/ra ca
3. `/crm/hr/leave` — xin nghỉ (nếu bật WIN leave lite)

### 16.4. IT — triển khai máy chấm công

1. Apply DDL P7, bật flag
2. Tạo device + lưu key
3. Cấu hình máy push ADMS
4. Import CSV lịch sử (nếu migrate)
5. Smoke: `bash scripts/smoke_hr_employee_file_p7.sh`

---

## 17. Nguồn dữ liệu HR — tổng hợp

| Nguồn | Kênh vào | UI quản lý | Đối tượng |
|-------|----------|------------|-----------|
| HR nhập trực tiếp | Form trên hồ sơ NV | Tab Ví / HĐ / BH / Hồ sơ | HR |
| NV self-submit | `/crm/hr/my-wallet` | HR Hub hàng duyệt | NV → HR |
| Máy chấm công | ADMS push / CSV | `/crm/hr/attendance` | IT → HR |
| GPS mobile | `/crm/payroll/me` | HR Hub GPS duyệt | NV → HR |
| Roster CRM | `/crm/staff` | Cột Ví %, chip hết hạn | HR, Lead |
| Export kế toán | Nút trên HR Hub | Excel 2 sheet | HR → Kế toán |

---

## 18. Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|-------------|-------------|------------|
| «Hồ sơ 360 chưa sẵn sàng» | Flag `PTT_HR_EMPLOYEE_FILE=0` hoặc chưa apply DDL P1 | Bật flag + apply DDL |
| Không thấy tab Ví / HĐ / BH | Thiếu cap section tương ứng | Gán cap qua Admin permissions |
| CCCD hiện `****` | Thiếu `crm_hr_pii.view` | Bình thường với Lead — cấp cap nếu cần |
| Không chuyển stage Chính thức | Gate thiếu HĐ/CCCD/địa chỉ | Hoàn thiện checklist rail |
| Punch máy «pending» | PIN chưa map | Gán `timeclock_pin` trên tab Hồ sơ |
| GPS «chờ duyệt» | Ngoài geofence hoặc GPS kém | HR duyệt hoặc NV vào đúng vùng |
| «Chưa được gán site geofence» | HR chưa gán NV vào site P8 | `/crm/hr/attendance` → Gán NV |
| Import CSV 0 accepted | Sai format cột hoặc PIN lạ | Kiểm tra header `pin,datetime,direction` |
| Export Excel lỗi | Thiếu `crm_hr_docs.view` | Cấp cap HR |
| Không thấy menu HR Hub | Thiếu mọi cap HR (`crm_staff_roster`, payroll, KPI…) | Cấp ít nhất một cap HR |

---

## 19. Kiểm tra sau triển khai (checklist UAT)

- [ ] Flag `PTT_HR_EMPLOYEE_FILE=1` trên API
- [ ] DDL P1–P8 applied, không lỗi migration
- [ ] `/crm/staff/[id]` mở shell 7 tab
- [ ] Thêm thẻ ví + upload file → Ví % tăng
- [ ] Lead xem NV: CCCD mask
- [ ] NV nộp ví → HR duyệt trên Hub
- [ ] Tạo device + import CSV → tab Chấm công có rollup
- [ ] Tạo site GPS + NV chấm → punch accepted hoặc pending
- [ ] Widget HR Hub hiển thị cảnh báo đúng
- [ ] Export Excel tải được 2 sheet
- [ ] Smoke P1–P8 pass

---

## 20. Tài liệu tham chiếu

| Loại | Đường dẫn |
|------|-----------|
| Use case BA | [`docs/specs/modules/RNOSAI-BA-HR-UseCases.md`](../specs/modules/RNOSAI-BA-HR-UseCases.md) |
| Kế hoạch kỹ thuật | [`docs/superpowers/plans/2026-08-18-hr-employee-file-os.md`](../superpowers/plans/2026-08-18-hr-employee-file-os.md) |
| HR & Payroll (WIN) | [`13-hr-payroll.md`](./13-hr-payroll.md) |
| Đào tạo 30 phút | [`docs/runbooks/hrm-win4d-hr-training-30min.md`](../runbooks/hrm-win4d-hr-training-30min.md) |
| Phân quyền | [`docs/handover/05-PHAN-QUYEN-BAO-MAT-SLA.md`](../handover/05-PHAN-QUYEN-BAO-MAT-SLA.md) |
| VPS operations | [`docs/runbooks/rnosai-vps-operations-guide.md`](../runbooks/rnosai-vps-operations-guide.md) |
