# Hướng dẫn sử dụng phân hệ BĐS (CĐT / Sàn)

> **Đối tượng:** TGĐ, trưởng ban, TVV, AM đại lý, Admin hệ thống, IT triển khai  
> **URL staging:** https://real.gomira.vn  
> **Spec nghiệp vụ:** [`../superpowers/specs/2026-08-21-bds-industry-pack-design.md`](../superpowers/specs/2026-08-21-bds-industry-pack-design.md) (§25 tổ chức CĐT)  
> **UX / nav:** [`../superpowers/specs/2026-08-22-bds-ux-ui-design.md`](../superpowers/specs/2026-08-22-bds-ux-ui-design.md)  
> **Roadmap flag:** [`../superpowers/plans/2026-08-22-bds-coding-roadmap.md`](../superpowers/plans/2026-08-22-bds-coding-roadmap.md)

---

## Mục lục

1. [Tổng quan & điều kiện hiển thị](#1-tổng-quan--điều-kiện-hiển-thị)
2. [Thiết lập môi trường (IT / Admin)](#2-thiết-lập-môi-trường-it--admin)
3. [Onboard tenant CĐT lần đầu](#3-onboard-tenant-cđt-lần-đầu)
4. [Đăng nhập & menu BĐS trên UI](#4-đăng-nhập--menu-bđs-trên-ui)
5. [Sơ đồ tổ chức — 12 ban & 18 chức vụ](#5-sơ-đồ-tổ-chức--12-ban--18-chức-vụ)
6. [Gán quyền & map nhân sự vào ban](#6-gán-quyền--map-nhân-sự-vào-ban)
7. [Hướng dẫn theo từng chức vụ (UI từng bước)](#7-hướng-dẫn-theo-từng-chức-vụ-ui-từng-bước)
8. [Hướng dẫn theo từng ban / phòng ban](#8-hướng-dẫn-theo-từng-ban--phòng-ban)
9. [Từng màn hình BĐS — thao tác chi tiết](#9-từng-màn-hình-bđs--thao-tác-chi-tiết)
10. [Chat nội bộ & Việc (ticket)](#10-chat-nội-bộ--việc-ticket)
11. [Chế độ Sàn (broker)](#11-chế-độ-sàn-broker)
12. [Xử lý sự cố thường gặp](#12-xử-lý-sự-cố-thường-gặp)

---

## 1. Tổng quan & điều kiện hiển thị

Phân hệ **BĐS** là industry pack trên RNOSAI, dùng cho **Chủ đầu tư (CĐT)**, **Sàn** hoặc **Hybrid**. Một tenant chọn mode lúc onboard; UI và quyền thay đổi theo mode.

### 1.1. Ba điều kiện để thấy menu **BĐS** trên sidebar

| # | Điều kiện | Ai chịu trách nhiệm |
|---|-----------|---------------------|
| 1 | Build ops-web có `NEXT_PUBLIC_PTT_BDS_UI=1` | IT (rebuild + deploy) |
| 2 | API bật `PTT_BDS_PACK=1` và các sub-flag tương ứng | IT (`.env` + restart API) |
| 3 | User đăng nhập có **ít nhất một cap** `bds_*` | Admin / HR |

Nếu thiếu một trong ba → sidebar **không có** nhóm **BĐS** (vẫn có thể gõ URL trực tiếp nếu flag FE bật).

### 1.2. Vị trí menu trên UI

- Sidebar trái → nhóm **「BĐS」** nằm **trên cùng**, trước Tổng quan / CRM.
- Nhóm mở mặc định (`defaultOpen: true`).
- Badge mode góc sidebar: **CĐT** / **Sàn** / **Hybrid** (theo tenant).

### 1.3. Luồng nghiệp vụ tóm tắt (CĐT)

```
Mở tenant → Seed 12 ban → Gán nhân sự + quyền
    → Tạo dự án → Tồn kho căn → CSBH / giá
    → Ra quân → Hold → Cọc → VBTT → HĐMB
    → Thu tiền / công nợ → Hoa hồng → Sau bán (bàn giao, sổ)
```

Song song: **Chat** (phòng ban / liên phòng) và **Việc** (queue ticket SLA) gắn từng bước bàn giao.

---

## 2. Thiết lập môi trường (IT / Admin)

### 2.1. Flag API (runtime — `.env` trên VPS)

Bật tối thiểu cho staging demo CĐT:

```bash
# Master — tắt = mọi /api/v1/bds/* trả 404
PTT_BDS_PACK=1
PTT_BDS_PG=1

# Hub + sidebar API
PTT_BDS_UI=1

# Sub-module (bật theo nhu cầu demo)
PTT_BDS_PROJECT_OS=1      # Tòa / đợt / cổng pháp lý
PTT_BDS_HOLD_TTL=1        # Hold + TTL
PTT_BDS_POLICY=1          # CSBH / bảng giá
PTT_BDS_TX=1              # Giao dịch VBTT / HĐMB
PTT_BDS_AGENCY=1          # Mạng đại lý / hạng / giỏ
PTT_BDS_COLLECTION=1      # Công nợ / phiếu thu
PTT_BDS_BUYER=1           # Lead khách mua
PTT_BDS_COMMISSION=1      # Hoa hồng
PTT_BDS_LAUNCH=1          # Ra quân / war-room
PTT_BDS_AFTERSALES=1      # Sau bán

# Nền tảng nhân sự (khuyến nghị bật cùng BĐS staging)
PTT_STAFF_CHAT=1
PTT_STAFF_TICKETS=1
PTT_STAFF_TICKETS_NOTIFY=1

# Lead OLTP
PTT_LEADS_READ_SOURCE=pg
PTT_LEADS_WRITE_SOURCE=pg
PTT_LEADS_WRITE_ENABLED=1
```

Sau khi sửa `.env`:

```bash
sudo systemctl restart realosai-api
```

### 2.2. Flag FE (build-time — ops-web)

Rebuild ops-web với:

```bash
NEXT_PUBLIC_PTT_API_URL=https://real.gomira.vn \
NEXT_PUBLIC_PTT_BDS_UI=1 \
NEXT_PUBLIC_PTT_BDS_NAV_HIDE_B2B=1 \
NEXT_PUBLIC_BDS_TENANT_ID=46738383-ecf6-4f57-8ce1-d5f783cb47ed \
NEXT_PUBLIC_PTT_STAFF_TICKETS=1 \
NEXT_PUBLIC_PTT_STAFF_CHAT=1 \
npm run build
```

`NEXT_PUBLIC_BDS_TENANT_ID` bắt buộc cho staging single-tenant — API BĐS cần header `x-bds-tenant`. Không set → `/tenants/me` 404, sidebar BĐS ẩn.

Deploy standalone + copy static (xem [`ops-web-deploy-no-chunkloaderror.md`](./ops-web-deploy-no-chunkloaderror.md)).

### 2.3. ClickHouse (tuỳ chọn — BI)

Export domain events / SEO / email cần ClickHouse. VPS **≥ 4GB RAM** khuyến nghị. Xem [`seo-aeo-clickhouse-bi.md`](./seo-aeo-clickhouse-bi.md).

### 2.4. Kiểm tra nhanh sau triển khai

| Kiểm tra | Cách |
|----------|------|
| API health | `GET /health` → 200 |
| BDS pack | `GET /api/v1/bds/tenants/me` + header `x-bds-tenant` + JWT → 200 (không 404) |
| Sidebar | Login admin → thấy nhóm **BĐS** |
| Hub | **BĐS → Tổng quan** → KPI Tiêu thụ / GMV / Quá hạn / Hold hết hạn |

---

## 3. Onboard tenant CĐT lần đầu

> Bước này do **IT / System Admin** thực hiện (API hoặc script). Chưa có màn hình UI tạo tenant trên ops-web.

### 3.1. Tạo tenant (draft)

**POST** `/api/v1/bds/tenants`  
Header: `Authorization: Bearer <staff_jwt>` hoặc `x-ptt-internal-key`

Body ví dụ:

```json
{
  "code": "cdt-demo",
  "name": "CĐT Demo Staging",
  "mode": "developer",
  "operated_by_ptt": true
}
```

- `mode`: `developer` (CĐT) | `broker` (Sàn) | `hybrid`
- Hệ thống tự **seed 12 phòng ban + 12 team + 18 chức vụ** (trừ mode `broker`).

### 3.2. Kích hoạt tenant (active)

**POST** `/api/v1/bds/tenants/{id}/activate`

Body **bắt buộc** 5 mã chức vụ:

```json
{
  "assigned_position_codes": [
    "pm_du_an",
    "gdkd",
    "truong_pc",
    "truong_collection",
    "truong_sp"
  ]
}
```

Thiếu một mã → lỗi `br_bds_34`. Sau activate → `status: active`.

### 3.3. Seed demo (tuỳ chọn)

Trên VPS (đã có venv + `DATABASE_URL`):

```bash
cd /var/www/realosai
source .venv/bin/activate
# Admin full caps
python3 scripts/seed_super_admin_full_access.py --apply \
  --email admin@pttads.vn --password '<mật_khẩu>'
```

Tenant demo `cdt-demo`, dự án `DA-DEMO-01`, lead/căn mẫu có thể seed qua API + SQL (xem session triển khai staging).

---

## 4. Đăng nhập & menu BĐS trên UI

### 4.1. Đăng nhập nhân viên

1. Mở **https://real.gomira.vn/login**
2. Nhập **Email** và **Mật khẩu**
3. Bấm đăng nhập → chuyển **Bảng điều khiển** (`/`)

> Sau khi Admin gán cap BĐS mới: **đăng xuất → đăng nhập lại** để JWT cập nhật quyền.

### 4.2. Mở sidebar & nhóm BĐS

1. Sidebar trái — nếu đang thu gọn (rail), bấm nút **mở rộng** (góc trên sidebar)
2. Cuộn lên đầu — thấy nhóm **「BĐS」**
3. Các link con phụ thuộc **mode tenant** và **cap** của bạn (xem bảng §9)

### 4.3. Menu mặc định — mode CĐT / Hybrid

| Nhãn sidebar | URL | Cap tối thiểu |
|--------------|-----|---------------|
| Tổng quan | `/crm/bds` | `bds_tenant.view` |
| Dự án | `/crm/re-projects` | `crm_re_projects.view` hoặc `bds_inventory.view` |
| Lead khách mua | `/crm/bds/leads` | `bds_buyers.view` |
| Hold | `/crm/bds/holds` | `bds_holds.view` |
| Ra quân | `/crm/bds/launches` | `bds_launches.view` |
| Giao dịch | `/crm/bds/transactions` | `bds_transactions.view` |
| Mạng | `/crm/bds/agencies` | `bds_agencies.view` |
| Hạng | `/crm/bds/tiers` | `bds_agency_tiers.view` |
| Bảng xếp hạng | `/crm/bds/leaderboard` | `bds_agency_tiers.view` |
| Công nợ | `/crm/bds/collections` | `bds_collections.view` |
| Sau bán | `/crm/bds/aftersales` | `bds_aftersales.view` |
| Hoa hồng | `/crm/bds/commissions` | `bds_commission.view` |
| Sàn nội bộ *(hybrid)* | `/crm/bds/basket` | `bds_baskets.view` |
| Chat | `/crm/chat` | `staff_chat.view` + flag chat |
| Việc | `/crm/work` | `staff_tickets.view` + flag tickets |

---

## 5. Sơ đồ tổ chức — 12 ban & 18 chức vụ

Khi tạo tenant CĐT/Hybrid, hệ thống seed sẵn (code trong `bds-org-seed.ts`). Admin xem trên UI:

**Admin → Cấu hình CRM → Phòng ban** (`/admin/crm/org/departments`)  
**Admin → Cấu hình CRM → Chức vụ** (`/admin/crm/org/positions`)

### 5.1. Mười hai ban (phòng ban)

| Mã | Tên hiển thị | Vai trò chính trên hệ thống |
|----|--------------|----------------------------|
| `ban_tgd` | Ban Điều hành | TGĐ — KPI khối, override chiến lược |
| `ban_du_an` | Ban Dự án | PM — hồ sơ dự án, đợt, cổng pháp lý |
| `ban_san_pham` | Ban Sản phẩm – Giỏ hàng | Tồn kho căn, bảng giá, giỏ allocation |
| `ban_kd` | Ban Kinh doanh Inhouse | Gallery, hold F0, VBTT inhouse |
| `ban_kenh` | Ban Kênh phân phối | Đại lý, hạng, giỏ sàn, hold F1 |
| `ban_cskh_presales` | Ban CSKH trước bán | Lead khách mua, lịch hẹn |
| `ban_mkt` | Ban Marketing | Chiến dịch, lead MKT → CSKH |
| `ban_phap_che` | Ban Pháp chế | Cổng pháp lý, HĐMB gate |
| `ban_tc_collection` | Ban Tài chính – Công nợ | Phiếu thu, aging, % cổng HĐMB |
| `ban_tc_hh` | Ban Tài chính – Hoa hồng | Ledger hoa hồng, đối soát |
| `ban_cskh_after` | Ban CSKH sau bán | Bàn giao, sổ hồng, defect |
| `ban_hr` | Ban Nhân sự | HR BP, onboarding cap |

### 5.2. Mười tám chức vụ (position code)

| Mã | Tên | Thuộc ban |
|----|-----|-----------|
| `tgd` | Tổng giám đốc | ban_tgd |
| `pm_du_an` | Giám đốc / PM dự án | ban_du_an |
| `gdkd` | Giám đốc khối KD | ban_kd |
| `truong_sp` | Trưởng sản phẩm | ban_san_pham |
| `cv_gia` | Chuyên viên bảng giá | ban_san_pham |
| `truong_inhouse` | Trưởng gallery / Inhouse | ban_kd |
| `tvv_inhouse` | TVV tự doanh | ban_kd |
| `truong_kenh` | Trưởng ban kênh | ban_kenh |
| `am_kenh` | AM đại lý | ban_kenh |
| `cskh_lead` | CSKH trước bán | ban_cskh_presales |
| `truong_mkt` | Trưởng MKT | ban_mkt |
| `truong_pc` | Trưởng pháp chế | ban_phap_che |
| `cv_hd` | CV hợp đồng | ban_phap_che |
| `truong_collection` | Trưởng công nợ | ban_tc_collection |
| `cv_hh` | CV hoa hồng | ban_tc_hh |
| `truong_after` | Trưởng CSKH sau bán | ban_cskh_after |
| `cv_ban_giao` | CV bàn giao | ban_cskh_after |
| `hr_bp` | HR BP | ban_hr |

**Năm chức vụ bắt buộc khi activate tenant:** `pm_du_an`, `gdkd`, `truong_pc`, `truong_collection`, `truong_sp`.

---

## 6. Gán quyền & map nhân sự vào ban

### 6.1. Ma trận quyền BĐS (cap)

Admin xem catalog đầy đủ tại `services/ptt-crm-api/src/bds/bds-cap-catalog.ts`. Tóm tắt:

| Nhóm cap | Hành động | Màn hình UI |
|----------|-----------|-------------|
| `bds_tenant` | view, configure | Tổng quan hub |
| `bds_inventory` | view, create, edit, import, lock | Dự án → tab Tồn kho / Sản phẩm |
| `bds_holds` | view, create, approve, cancel | Hold |
| `bds_transactions` | view, create, edit, export | Giao dịch |
| `bds_policies` | view, create, edit, approve | CSBH (trong dự án) |
| `bds_agencies` | view, create, edit, suspend | Mạng đại lý |
| `bds_agency_tiers` | view, configure, override | Hạng, BXH |
| `bds_baskets` | view, create, edit | Giỏ hàng |
| `bds_commission` | view, approve, export, payout | Hoa hồng |
| `bds_launches` | view, create, open | Ra quân |
| `bds_collections` | view, create, export | Công nợ |
| `bds_aftersales` | view, edit, approve | Sau bán |
| `bds_buyers` | view, edit, view_pii | Lead khách mua |

Thêm cap nền tảng: `staff_chat.*`, `staff_tickets.*`.

### 6.2. Gán cap cho chức vụ (Admin UI)

1. Login **Admin** (user có `crm_data_config.configure` hoặc super admin)
2. Vào **Admin** (sidebar) → **Cấu hình CRM** → **Ma trận quyền** (`/admin/crm/permissions`)
3. Chọn **Chức vụ** tương ứng (vd. `gdkd`, `truong_sp`)
4. Tick các section `bds_*` và `staff_*` phù hợp mô tả §7–§8
5. **Lưu**
6. Nhân viên **đăng xuất / đăng nhập lại**

### 6.3. Gán nhân sự vào ban (Admin UI)

1. **Admin → Cấu hình CRM → Người dùng & quyền** (`/admin/crm/org/users`)
2. Chọn user → gán **Phòng ban** + **Chức vụ** (vd. `tvv_inhouse` thuộc `ban_kd`)
3. Lưu → user thấy menu BĐS tương ứng cap của chức vụ

### 6.4. Mô hình quyền demo nhanh (staging)

| Persona | Chức vụ gợi ý | Cap tối thiểu |
|---------|---------------|---------------|
| TGĐ / PM | `tgd` / `pm_du_an` | `bds_tenant.view`, `bds_project_os.*`, `bds_launches.view` |
| GĐKD | `gdkd` | Hub + hold approve + policies |
| Trưởng SP | `truong_sp` | `bds_inventory.*`, `bds_policies.view` |
| TVV Inhouse | `tvv_inhouse` | `bds_holds.create`, `bds_buyers.view` |
| AM kênh | `am_kenh` | `bds_baskets.view`, `bds_holds.create` |
| Collection | `truong_collection` | `bds_collections.*`, `bds_transactions.view` |
| Pháp chế | `truong_pc` | `bds_legal.*`, `bds_transactions.view` |
| Sau bán | `truong_after` | `bds_aftersales.*` |

Super admin staging: script `seed_super_admin_full_access.py` + insert cap `bds_*` cho `position_id=1`.

---

## 7. Hướng dẫn theo từng chức vụ (UI từng bước)

### 7.1. Tổng giám đốc (`tgd`)

**Mục tiêu ngày:** xem KPI toàn khối, can thiệp chiến lược.

1. Login → sidebar **BĐS → Tổng quan**
2. Đọc 4 KPI: **Tiêu thụ**, **GMV HĐ tháng**, **Quá hạn >30 ngày**, **Hold hết hạn 2h**
3. Khu **Inbox hold chờ F1** — bấm link hold → **Hold** hoặc **Việc**
4. **Sell-through theo tòa / đại lý** — xác định tòa/đại lý yếu
5. Cần chi tiết dự án → **BĐS → Dự án** → chọn tên dự án

### 7.2. PM dự án (`pm_du_an`)

**Mục tiêu:** hồ sơ dự án, đợt bán, cổng pháp lý, ra quân.

1. **BĐS → Dự án** → ô **Tìm tên / mã / quận…** → **Tìm**
2. Tạo mới: nhập **Tên dự án mới** → **+ Dự án**
3. Bấm tên dự án → tab **Tổng quan** / **Sản phẩm** / **Tồn kho** / **KPI** …
4. **BĐS → Ra quân** → chọn đợt → **Mở ra quân** (cần cap `bds_launches.open`)
5. Theo dõi war-room: cột **Giữ chỗ / Hàng đợi / Xung đột** (auto refresh ~3s khi đợt `open`)

### 7.3. Giám đốc khối KD (`gdkd`)

**Mục tiêu:** duyệt hold F1, activate CSBH, KPI bán.

1. **BĐS → Tổng quan** — theo dõi inbox hold F1
2. **BĐS → Hold** — duyệt / từ chối (cap `bds_holds.approve`)
3. **Việc → Queue ban** — lọc queue `hold_f1_approve`
4. **BĐS → Giao dịch** — theo dõi pipeline VBTT → HĐMB

### 7.4. Trưởng sản phẩm (`truong_sp`)

**Mục tiêu:** tồn kho căn, trạng thái, import.

1. **BĐS → Dự án** → chọn dự án
2. Tab **Sản phẩm** / **Tồn kho** — xem unit, trạng thái (`available`, `hold`, `sold`…)
3. Import / khóa căn (cap `bds_inventory.import`, `lock`) — thao tác trên tab tương ứng
4. **BĐS → Hạng** — tham chiếu cấu hình hạng (chi tiết tại **Mạng**)

### 7.5. TVV Inhouse (`tvv_inhouse`)

**Mục tiêu:** giữ chỗ, chăm lead.

1. **BĐS → Lead khách mua** — xem lead gán dự án
2. **BĐS → Hold** — tạo phiếu giữ (cap `bds_holds.create`)
3. Nếu có nút **Tạo ticket** → chuyển sang **Việc** với entity hold
4. **Chat → Phòng tôi** — trao đổi nội bộ ban KD

### 7.6. Trưởng kênh / AM đại lý (`truong_kenh`, `am_kenh`)

**Mục tiêu:** mạng đại lý, giỏ căn, hold sàn.

1. **BĐS → Mạng** — danh sách đại lý (Mã, Tên)
2. **BĐS → Hạng** / **Bảng xếp hạng** — điểm hạng tháng
3. Mode hybrid: **Sàn nội bộ** (`/crm/bds/basket`)
4. Mode broker thuần: vào thẳng **Giỏ hàng** từ sidebar

### 7.7. CSKH trước bán (`cskh_lead`)

1. **Việc → Inbound** — queue `cskh_first_touch` (lead MKT mới)
2. **BĐS → Lead khách mua** — cập nhật trạng thái
3. **Chat → Liên phòng** — phòng `x_mkt_cskh` (nếu đã seed chat)

### 7.8. Trưởng pháp chế / CV HĐ (`truong_pc`, `cv_hd`)

1. **Việc** — queue `hdmb_gate_legal`, `legal_gate_phase`, `vbtt_check`
2. **BĐS → Giao dịch** — mở giao dịch theo `?tx=` từ ticket
3. Cổng HĐMB: song song Pháp chế + Collection (không bypass qua GĐKD)

### 7.9. Trưởng công nợ (`truong_collection`)

1. **BĐS → Công nợ** — aging (cần `PTT_BDS_COLLECTION=1`)
2. **Việc** — queue `collection_schedule`, `hdmb_gate_paid`
3. **BĐS → Tổng quan** — KPI **Quá hạn >30 ngày**

### 7.10. CV hoa hồng (`cv_hh`)

1. **BĐS → Hoa hồng** — bảng ledger (ID, %, Số tiền)
2. CTV / đại lý: cột **%** có thể ẩn theo job function

### 7.11. Trưởng sau bán / CV bàn giao (`truong_after`, `cv_ban_giao`)

1. **BĐS → Sau bán** — board SCR-BDS-100
2. Chọn dòng giao dịch → panel phải:
   - **Checklist bàn giao:** Nước / Điện / Nội thất / Biên bản — tick **Pass** hoặc **Waive** (waive cần `bds_aftersales.approve`)
   - **Bàn giao** — xác nhận handover
   - **Sổ hồng:** **Nộp sổ** → **Cấp sổ** → **Giao KH**
   - **Defect** — chỉ sau khi đã bàn giao

---

## 8. Hướng dẫn theo từng ban / phòng ban

### 8.1. Ban Dự án (`ban_du_an`)

| Việc | UI | RACI |
|------|-----|------|
| Tạo / sửa hồ sơ dự án | Dự án → chi tiết | PM (A) |
| Mở đợt / ra quân | Ra quân | PM (A), GĐKD (R) |
| Cổng pháp lý đủ bán | Tab dự án (Project OS) | Pháp chế (A) |

**SLA gợi ý:** lead MKT → CSKH 15 phút; hold F1 → GĐKD 2h/8h.

### 8.2. Ban Sản phẩm – Giỏ hàng (`ban_san_pham`)

| Việc | UI |
|------|-----|
| Import căn | Dự án → Tồn kho |
| Kích hoạt bảng giá / CSBH | Dự án → (policy) + cap `bds_policies` |
| Giỏ allocation hybrid | Sàn nội bộ |

### 8.3. Ban KD Inhouse (`ban_kd`)

| Việc | UI |
|------|-----|
| Gallery bán | Hold + Lead |
| Hold F0 | Hold → tạo |
| Duyệt nội bộ | Việc queue ban |

### 8.4. Ban Kênh (`ban_kenh`)

| Việc | UI |
|------|-----|
| Onboard đại lý | Mạng |
| Cấp giỏ | Basket / Mạng |
| Hold F1 chờ duyệt | Tổng quan inbox + Việc `hold_f1_approve` |

### 8.5. Ban CSKH trước bán (`ban_cskh_presales`)

Ticket tự sinh khi lead buyer mới (`cskh_first_touch`). UI: **Việc → Inbound**.

### 8.6. Ban Marketing (`ban_mkt`)

Lead đổ về **Lead khách mua** / CRM. Handoff sang CSKH qua ticket + phòng chat `x_mkt_cskh`.

### 8.7. Ban Pháp chế (`ban_phap_che`)

Cổng **đủ điều kiện bán** và **HĐMB**. Không duyệt hold/collection.

### 8.8. Ban Tài chính – Công nợ (`ban_tc_collection`)

Phiếu thu, milestone, cổng **% thu tối thiểu HĐMB** (`hdmb_min_paid_pct` trên dự án).

### 8.9. Ban Tài chính – Hoa hồng (`ban_tc_hh`)

**Hoa hồng** + export (cap `export`, `payout`).

### 8.10. Ban CSKH sau bán (`ban_cskh_after`)

Toàn bộ **Sau bán** — checklist, sổ, defect.

### 8.11. Ban HR (`ban_hr`)

**Admin → Org** — gán user vào ban/chức vụ; không thao tác nghiệp vụ bán căn trực tiếp.

---

## 9. Từng màn hình BĐS — thao tác chi tiết

### 9.1. Tổng quan — `/crm/bds`

**Tiêu đề:** BĐS · Tổng quan · Hub điều hành SCR-BDS-001

1. Login user cap `bds_tenant.view`
2. Sidebar **BĐS → Tổng quan**
3. Xem KPI grid (4 ô)
4. **Inbox hold** — bấm từng dòng → sang Hold
5. Link nhanh cuối trang: **Hold**, **Công nợ** (nếu hiển thị)

> Tenant **broker** tự redirect sang **Giỏ hàng**.

### 9.2. Dự án BĐS — `/crm/re-projects`

1. **BĐS → Dự án**
2. Ô tìm kiếm → **Tìm**
3. Bấm tên dự án → `/crm/re-projects/[id]`
4. Tab: **Tổng quan | Sản phẩm | Tồn kho | KPI | Ngân sách | Rủi ro | Kế toán | Nhân sự | Lead config | Quy trình | Export**
5. Tạo dự án: cuối trang — **Tên dự án mới** + **+ Dự án**

### 9.3. Hold — `/crm/bds/holds`

1. **BĐS → Hold**
2. Xem danh sách phiếu (stub + link dự án khi chưa có data)
3. Query `?hold=<uuid>` — mở chi tiết hold (từ ticket / link)
4. **Tạo ticket** (nếu bật staff tickets) → `/crm/work?entity_type=hold&entity_id=...`

### 9.4. Ra quân — `/crm/bds/launches`

1. **BĐS → Ra quân**
2. Bảng đợt: cột trạng thái **Nháp / Đang mở / Đã đóng**
3. Chọn một dòng → panel war-room (khi **Đang mở**)
4. Nút **Mở ra quân** / **Đóng** (cap `open`)
5. Ba cột: **Giữ chỗ | Hàng đợi | Xung đột**

### 9.5. Giao dịch — `/crm/bds/transactions`

1. **BĐS → Giao dịch**
2. Query `?tx=` từ **Việc** hoặc link entity
3. **Tạo ticket** gắn giao dịch

### 9.6. Lead khách mua — `/crm/bds/leads`

1. **BĐS → Lead khách mua**
2. Placeholder P6 — lead theo dự án (bật `PTT_BDS_BUYER=1`)

### 9.7. Mạng / Hạng / BXH

| Màn | URL | Thao tác |
|-----|-----|----------|
| Mạng đại lý | `/crm/bds/agencies` | Xem Mã, Tên |
| Hạng | `/crm/bds/tiers` | Ghi chú: cấu hình tại Mạng |
| Bảng xếp hạng | `/crm/bds/leaderboard` | Điểm tháng theo đại lý |

### 9.8. Công nợ — `/crm/bds/collections`

1. **BĐS → Công nợ**
2. Nếu flag tắt → thông báo «Công nợ chưa bật»

### 9.9. Hoa hồng — `/crm/bds/commissions`

1. **BĐS → Hoa hồng**
2. Bảng ledger — duyệt / export theo cap

### 9.10. Sau bán — `/crm/bds/aftersales`

1. **BĐS → Sau bán**
2. Chọn **transaction** trên list trái
3. Panel phải — thực hiện checklist → handover → title → defect (§7.11)

### 9.11. Giỏ hàng — `/crm/bds/basket`

1. **BĐS → Giỏ hàng** (broker) hoặc **Sàn nội bộ** (hybrid)
2. Nếu trống: «CĐT chưa cấp căn. Liên hệ AM.»

---

## 10. Chat nội bộ & Việc (ticket)

### 10.1. Bật trên UI

- API: `PTT_STAFF_CHAT=1`, `PTT_STAFF_TICKETS=1`
- FE: `NEXT_PUBLIC_PTT_STAFF_CHAT=1`, `NEXT_PUBLIC_PTT_STAFF_TICKETS=1`
- Cap: `staff_chat.view`, `staff_tickets.view`

### 10.2. Chat — `/crm/chat`

**Tiêu đề:** Chat · Phòng tôi · Liên phòng · Huddle

1. Sidebar **BĐS → Chat** (hoặc **Chat** nếu tách nhóm)
2. Tab: **Phòng tôi | Liên phòng | Huddle | DM**
3. Chọn phòng → đọc / gửi tin
4. Chọn tin → **Chuyển thành ticket** (cần cả chat + tickets)

Phòng seed theo 12 ban + 11 phòng liên phòng (`x_mkt_cskh`, `x_kenh_gdkd`, …).

### 10.3. Việc — `/crm/work`

**Tiêu đề:** Việc · Queue ban · Liên phòng · SCR-BDS-120

1. Sidebar **BĐS → Việc**
2. Tab inbox: **Của tôi | Queue ban | Inbound | Outbound**
3. Chọn ticket → panel chi tiết:
   - **SLA** (thanh tiến độ)
   - **Luồng trạng thái** (chip)
   - Chip entity: Giao dịch / Hold / Lead / Dự án / Ra quân / Mốc
4. **Gán** / **Chuyển trạng thái** / **Export CSV**
5. **Mở chat** — nếu ticket có `room_id`
6. Tạo mới: nút tạo ticket hoặc prefill từ Hold/TX

### 10.4. Queue ticket tự sinh từ BĐS

| Sự kiện | Queue |
|---------|-------|
| Lead buyer mới | `cskh_first_touch` |
| Hold F1 chờ duyệt | `hold_f1_approve` |
| Cọc giao dịch | `collection_schedule` |
| Cổng pháp lý đợt | `legal_gate_phase` |
| Mốc thu | `milestone_unlock` |
| Ra quân (tuỳ chọn) | `ops_action` |

---

## 11. Chế độ Sàn (broker)

1. Tenant `mode: broker` — **không seed** 12 ban CĐT
2. Login AM sàn → sidebar **BĐS** chỉ còn: **Giỏ hàng**, **Lead**, **Hold**, **Hoa hồng**, **Chat**
3. Vào `/crm/bds` → redirect **Giỏ hàng**
4. **Dự án BĐS** hiện banner: «Tenant sàn — dùng giỏ hàng…»
5. API ticket platform → **404** cho broker tenant (BDS-44)

---

## 12. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|-------------|-------------|------------|
| Không thấy menu **BĐS** | Flag FE tắt hoặc không có cap | Rebuild ops-web; gán cap; re-login |
| `/crm/bds` «Không tìm thấy» | `NEXT_PUBLIC_PTT_BDS_UI=0` lúc build | Rebuild + deploy lại |
| Hub «Tải hub thất bại» / 404 | `PTT_BDS_UI=0` hoặc `PTT_BDS_PACK=0` | Bật flag API; restart |
| «Sau bán chưa bật» | `PTT_BDS_AFTERSALES=0` | Bật flag; restart API |
| «Việc nội bộ chưa bật» | Flag tickets tắt | Bật `PTT_STAFF_TICKETS` + FE flag |
| Sidebar có BĐS nhưng thiếu link | Cap không đủ | Admin → Ma trận quyền |
| Sau gán quyền vẫn thiếu menu | JWT cũ | Logout → login |
| Hold 409 / xung đột căn | Hai TVV cùng hold | War-room / Ra quân — một 201, một 409 |
| ClickHouse export lỗi | CH chưa chạy / RAM thấp | VPS ≥4GB; xem runbook CH |

---

## Phụ lục A — Checklist go-live staging CĐT

- [ ] Flag API §2.1 + restart
- [ ] Rebuild ops-web §2.2
- [ ] Tạo + activate tenant §3
- [ ] Gán 5 chức vụ bắt buộc + nhân sự pilot
- [ ] Gán cap `bds_*` theo persona §6.4
- [ ] Tạo 1 dự án + 3 căn demo
- [ ] Login từng persona — UAT menu §4.3
- [ ] Tạo hold thử → ticket `hold_f1_approve`
- [ ] Mở ra quân thử → war-room
- [ ] Sau bán: tick checklist → handover

## Phụ lục B — Tài liệu liên quan

| Tài liệu | Nội dung |
|----------|----------|
| [`rbac-hr-org-workflow.md`](./rbac-hr-org-workflow.md) | HR · Org · RBAC chung |
| [`vps-production-operations.md`](./vps-production-operations.md) | Vận hành VPS |
| [`2026-08-21-bds-industry-pack-design.md`](../superpowers/specs/2026-08-21-bds-industry-pack-design.md) | Spec §25 RACI đầy đủ |
| [`2026-08-22-bds-coding-roadmap.md`](../superpowers/plans/2026-08-22-bds-coding-roadmap.md) | Thứ tự bật flag |

---

*Cập nhật: 2026-08-23 · ops-web @ `/crm/bds/*`, tenant seed `bds-org-seed.ts`*
