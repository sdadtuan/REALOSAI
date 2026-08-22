# Hướng dẫn — Email Marketing

> **Module:** MOD-EM  
> **Đối tượng:** Email Strategist, AM, Compliance, Client Approver  
> **URL staff:** https://rs.pttads.vn/email/* · **Portal:** https://portal.pttads.vn/email*

> **Tài liệu chuyên sâu:** [`docs/huong-dan-email-marketing-ops.md`](../huong-dan-email-marketing-ops.md)

---

## 1. Giới thiệu

Email Marketing Enterprise quản lý **broadcast, journey, segment, template, deliverability, governance** — tuân thủ consent và suppression.

---

## 2. Onboard Email client (AM)

### Bước 1 — Workspace

**Route:** `/email/clients/[id]?tab=settings`

1. Tạo workspace gắn client CRM
2. Chọn ESP connector, sending caps
3. Gán approver portal (nếu cần client duyệt)

### Bước 2 — Deliverability

**Route:** `/email/deliverability`

1. **Domain wizard** 3 bước:
   - Bước 1: Nhập domain gửi (VD: mail.khachhang.vn)
   - Bước 2: Copy DNS records (SPF, DKIM, DMARC) → IT khách cấu hình
   - Bước 3: **Verify** — badge xanh
2. Warm-up plan (nếu domain mới)

### Bước 3 — Contacts & Consent

| Route | Thao tác |
|-------|----------|
| `/email/contacts` | Import CSV — map columns |
| `/email/consent` | Verify opted-in records |
| `/email/suppression` | Master suppression list |

---

## 3. Segment

**Route:** `/email/segments`

1. **+ Tạo segment** — chọn type: Lifecycle / RFM / Behavior
2. Định nghĩa rule (VD: opened 30d, purchased 90d)
3. Bấm **Compute** — xem count preview
4. **Save** — dùng cho campaign/journey

---

## 4. Template

**Route:** `/email/templates/[id]`

1. **+ Template** — HTML editor hoặc import
2. Bắt buộc merge tag `{{unsubscribe_url}}`
3. **Preflight** — kiểm link broken, spam score
4. Save version

---

## 5. Campaign broadcast

**Route:** `/email/campaigns`, `/email/campaigns/[id]`

### Strategist — tạo campaign

1. **+ Campaign** — chọn segment + template
2. Điền subject, preheader, from name
3. **Preview** desktop/mobile
4. **Preflight** pass
5. Status **Draft** → **Submit review** (staff internal)

### Approval nội bộ + client

1. Staff approver pass → **Pending client** (nếu Gate A bật)
2. Client portal `/email/approvals` → Approve/Reject
3. Sau approve → **Schedule send** — chọn datetime
4. Worker ESP send → webhook engagement

### Theo dõi sau send

**Route:** `/email/hub`, `/email/reports`

- Open rate, click rate, bounce, complaint
- Pause campaign nếu complaint spike (F3 incident)

---

## 6. Journeys (drip automation)

**Route:** `/email/journeys/[id]`

1. **+ Journey** — trigger: signup, tag, behavior
2. Thêm steps: wait, send email, branch
3. **Activate** — monitor enrollments
4. Deactivate khi cần bảo trì

---

## 7. Governance & Compliance

| Route | Mục đích |
|-------|----------|
| `/email/governance` | Frequency cap, quiet hours, global rules |
| `/email/gate-a` | Gate trước send client mới |
| `/email/suppression` | Unsub, bounce hard, complaint |
| Audit | 50 bản ghi gần nhất trên hub |

**Public pages (subscriber):**

- Unsubscribe one-click
- Preference center
- Double opt-in confirm

---

## 8. Email Hub

**Route:** `/email/hub`

1. Portfolio client email
2. KPI aggregate: sent, OR, CTR
3. Deliverability health per domain
4. Queue lag / worker status

---

## 9. Portal Email (khách hàng)

| Route | Thao tác |
|-------|----------|
| `/email` | Dashboard stats |
| `/email/approvals` | Duyệt campaign chờ |
| `/email/campaigns/[id]` | Preview chi tiết |

**SLA duyệt khuyến nghị:** ≤ 24h giờ hành chính.

Chi tiết: [14-client-portal.md](./14-client-portal.md)

---

## 10. Luồng broadcast tuần (Strategist)

1. Thứ 2: Review segment counts
2. Thứ 3: Draft campaign + preflight
3. Thứ 4: Internal + client approval
4. Thứ 5: Schedule send
5. Thứ 6: Monitor `/email/hub` complaints

**Checklist A4:** [`docs/forms/email-marketing-ops-checklist-a4.html`](../forms/email-marketing-ops-checklist-a4.html)

---

## 11. Lỗi thường gặp

| Vấn đề | Xử lý |
|--------|-------|
| Send blocked Gate A | Client chưa approve |
| High bounce | List hygiene; suppression |
| DNS verify fail | IT khách fix SPF/DKIM |
| Complaint spike F3 | Pause send; deliverability incident runbook |

---

## 12. Tài liệu tham chiếu

- [`huong-dan-email-marketing-ops.md`](../huong-dan-email-marketing-ops.md)
- Actions: [`docs/use-cases/actions/05-EM-ACTIONS.md`](../use-cases/actions/05-EM-ACTIONS.md)
