# Hướng dẫn — Agency & Triển khai dịch vụ

> **Module:** MOD-AGENCY · MOD-SVC  
> **Đối tượng:** AM, SP, Creative Lead, Buyer, Finance  
> **URL:** https://rs.pttads.vn/agency/* · `/crm/service-delivery/*`

---

## 1. Giới thiệu

Domain này quản lý **đa client agency** và **vòng đời triển khai dịch vụ** (lifecycle) — từ onboard đến retain, kèm Launch QA, SOP, Creative, Campaign Write.

---

## 2. Agency Hub

### 2.1. Trang chủ Agency

**Route:** `/agency`

1. Tổng quan client đang active
2. Quick link: ingest health, jobs, KPI definitions
3. Filter theo AM owner

### 2.2. Quản lý Client

**Route:** `/agency/clients/[id]`

| Tab | Thao tác |
|-----|----------|
| **Overview** | Thông tin client, owner AM, industry |
| **Onboard** | Checklist onboard — tick từng mục |
| **Channels** | Map Meta / Google / Zalo ad account + token |
| **Portal** | Tạo user portal viewer/approver, reset MK |
| **Settings** | Branding, caps module |

**Onboard client mới (AM):**

1. Tạo client `/agency/clients/new`
2. Tab **Onboard** — tick: legal, billing, brief
3. Tab **Channels** — Tracking team map ad accounts
4. Tab **Portal** — **+ Portal user** (email, role viewer/approver)
5. Orchestrator panel → **Auto-sync** — verify badge xanh từng bước
6. Checklist **100%** → mới advance lifecycle sang Deliver

### 2.3. Ingest Monitor

**Route:** `/agency/ingest`

1. Xem webhook lead/data health theo client
2. Filter failed/retry
3. Drill-down payload lỗi → escalate Tracking

### 2.4. Agency Jobs

**Route:** `/agency/jobs`

1. Queue job Temporal (sync, campaign write, …)
2. Filter status: pending, running, failed
3. Retry job failed (nếu có cap)

---

## 3. Service Delivery — Lifecycle

### 3.1. Kanban lifecycle

**Route:** `/crm/service-delivery`

1. Board theo **7 giai đoạn**: Prospect → Onboard → Deliver → Optimize → Handover → Retain → Offboarding
2. Filter theo AM, service slug, client
3. Click card → detail `/crm/service-delivery/[id]`

### 3.2. Lifecycle Detail — các tab

**Route:** `/crm/service-delivery/[id]`

| Tab | Chức năng | Hướng dẫn domain |
|-----|-----------|------------------|
| **Workflow** | Advance stage, gate checklist | §3.3 dưới |
| **TMMT** | Marketing plan chính thức | [11-marketing-ai-planner.md](./11-marketing-ai-planner.md) |
| **AI Planner** | Sinh TMMT bằng AI | [11-marketing-ai-planner.md](./11-marketing-ai-planner.md) |
| **Content Board** | Sản xuất content | [10-content-marketing.md](./10-content-marketing.md) |
| **Ops Hub** | Checklist tuần, KPI DV | [04-ops-dv.md](./04-ops-dv.md) |
| **Finance** | Billing/margin lifecycle | §3.5 |
| **SOP** | Chạy quy trình SOP | §4.2 |
| **Launch QA** | Checklist pre-launch | §4.1 |

### 3.3. Advance stage (AM)

1. Mở tab **Workflow** — xem % gate hiện tại
2. Hoàn thành checklist bắt buộc (onboard 100%, TMMT published, Launch QA pass, …)
3. Bấm **Chuyển giai đoạn** → chọn stage tiếp → confirm + lý do
4. Hệ thống ghi **stage history** (không sửa được retroactive)

**Gate Deliver:** Onboard checklist chưa 100% → nút Deliver **disabled**.

**Gate Handover:** Finance gate — còn công nợ → **blocked**.

### 3.4. Luồng Deliver (tóm tắt)

1. Confirm onboard 100%
2. Advance → **Deliver**
3. Publish TMMT (tab TMMT hoặc AI Planner Apply)
4. Pass **Launch QA**
5. Buyer go-live campaign đầu tiên (Meta/Zalo)
6. Ghi hypercare start date trong notes

### 3.5. Service Finance

**Tab Finance** trên lifecycle detail:

1. Xem billing plan, margin theo giai đoạn
2. Ghi nhận milestone billing
3. Finance review trước Handover

---

## 4. Launch QA, SOP, Creative

### 4.1. Launch QA

**Route:** `/crm/launch-qa` hoặc tab trên lifecycle

1. **+ Tạo run** — chọn client, channel (Meta/Zalo/Google)
2. Checklist: pixel/CAPI, creative approved, budget, targeting
3. Tick từng mục — upload evidence nếu cần
4. **Pass** → buyer được launch campaign
5. **Fail** → sửa item đỏ → re-run

Bridge Meta/Zalo: tracking health pull từ `/meta/tracking`.

### 4.2. SOP Library

**Route:** `/crm/sop`

1. Browse template SOP theo dịch vụ
2. **Start run** trên lifecycle — gán checklist SOP
3. Tick hoàn thành từng bước
4. Auto-start on launch (nếu env bật)

### 4.3. Creative Hub

**Route:** `/crm/creatives`

1. **Upload** creative — gán client, campaign, format
2. Internal review → status **pending client approval**
3. Portal khách duyệt tại `/creatives` ([14-client-portal.md](./14-client-portal.md))
4. Approved → link campaign Meta/Zalo

### 4.4. Campaign Write Queue

**Route:** `/crm/campaign-writes`

1. Buyer submit thay đổi campaign (budget, status, …)
2. Queue **pending approval** (Temporal nếu bật)
3. Approver pass → worker ghi lên Meta/Zalo API
4. Theo dõi status: success / failed / rolled back

---

## 5. Map channel account

**Route:** `/agency/clients/[id]?tab=channels`

1. **Meta:** nhập ad account ID, verify token
2. **Google:** OAuth connect
3. **Zalo:** OA + ads account + form lead
4. **Sync** — trigger insights T+1
5. Verify hub CPL hiển thị sau sync

---

## 6. Ma trận ai làm gì

| Việc | Vai trò | Màn hình |
|------|---------|----------|
| Onboard client | AM | `/agency/clients/[id]` |
| Map ad account | Tracking | Channels tab |
| Publish TMMT | SP / AM | lifecycle TMMT / AI Planner |
| Launch QA | Buyer + Tracking | `/crm/launch-qa` |
| Go-live campaign | Buyer | Meta/Zalo Ads Ops |
| Duyệt creative | Client approver | Portal `/creatives` |
| Handover | AM + Finance | lifecycle Workflow |

---

## 7. Lỗi thường gặp

| Vấn đề | Xử lý |
|--------|-------|
| Không advance Deliver | Onboard checklist chưa 100% |
| Launch QA fail pixel | `/meta/tracking` fix CAPI |
| Campaign write stuck | `/agency/jobs` retry Temporal |
| Portal user không login | Tab Portal — reset MK |

---

## 8. Tài liệu tham chiếu

- Actions: [`docs/use-cases/actions/02-SVC-ACTIONS.md`](../use-cases/actions/02-SVC-ACTIONS.md)
- Use case: [`docs/use-cases/02-AGENCY-SERVICE-DELIVERY.md`](../use-cases/02-AGENCY-SERVICE-DELIVERY.md)
