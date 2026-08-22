# RNOSAI BA — Mobile Experience Use Cases

## Document control

| Thuộc tính | Giá trị |
| --- | --- |
| Document ID | RNOSAI-BA-MOB-UC |
| Phiên bản | 2.3 |
| Ngày xuất | 2026-08-01 |
| Module | MOD-MOB |
| Số UC | 10 |
| Spec thủ công | 10/10 |
| Master index | [RNOSAI-BA-Master-Spec.md](../RNOSAI-BA-Master-Spec.md) |
| Catalog gốc | [`docs/specs/2026-08-01-rnosai-mobile-strategy-spec.md`](../../use-cases/2026-08-01-rnosai-mobile-strategy-spec.md) |

---

## 1. Tóm tắt module

Module Mobile Experience (cross-cutting): PWA staff lead care (M1), portal PWA + web push + bottom nav (M2), Capacitor native shell draft (M3). Không microservice riêng — logic trong ops-web, portal-web, ptt-crm-api.

### 1.1. Màn hình liên quan

| SCR | Tên | Route | Status | UC liên quan |
| --- | --- | --- | --- | --- |
| SCR-MOB-001 | PWA Install Shell (Staff) | ops-web global | Done | MOB-UC-001 |
| SCR-MOB-002 | Lead List Mobile | /crm/leads @ ≤768px | Done | MOB-UC-002, MOB-UC-004 |
| SCR-MOB-003 | Lead Detail Mobile | /crm/leads/[id] @ mobile | Done | MOB-UC-003, MOB-UC-004 |
| SCR-MOB-004 | CSKH Board Mobile | /crm/cskh-board @ mobile | Done | CRM-UC-008 |
| SCR-MOB-005 | Portal Install Shell | portal-web global | Done | MOB-UC-005 |
| SCR-MOB-006 | Portal Dashboard Mobile | /dashboard @ ≤768px | Done | MOB-UC-008 |
| SCR-MOB-007 | Creative Inbox Mobile | /creatives @ mobile | Done | MOB-UC-006, MOB-UC-007 |
| SCR-MOB-008 | Email Approvals Mobile | /email/approvals @ mobile | Done | MOB-UC-007 |
| SCR-MOB-009 | Notification Center Mobile | /notifications @ mobile | Done | MOB-UC-006 |
| SCR-MOB-010 | Push Settings | /settings (push section) | Done | MOB-UC-009 |

### 1.2. Ma trận UC

| ID | Tên | Priority | Status | Spec |
| --- | --- | --- | --- | --- |
| MOB-UC-001 | Cài PWA staff | High | Done | Thủ công |
| MOB-UC-002 | Xem danh sách lead mobile | High | Done | Thủ công |
| MOB-UC-003 | Xem chi tiết + AI brief lead | High | Done | Thủ công |
| MOB-UC-004 | Offline đọc lead đã cache | Medium | Done | Thủ công |
| MOB-UC-005 | Cài PWA portal | High | Done | Thủ công |
| MOB-UC-006 | Nhận push duyệt creative | High | Done | Thủ công |
| MOB-UC-007 | Duyệt email campaign mobile | High | Done | Thủ công |
| MOB-UC-008 | Xem KPI dashboard mobile | Medium | Done | Thủ công |
| MOB-UC-009 | Quản lý subscription push | Medium | Done | Thủ công |
| MOB-UC-010 | Deep link từ email/SMS | Low | Backlog | Thủ công |

---

## 2. Chi tiết Use Case

### MOB-UC-001 — Cài PWA staff

> 🟢 Spec thủ công

- **Mã use case:** MOB-UC-001
- **Tên use case:** Cài PWA staff
- **Màn hình:** SCR-MOB-001
- **Actor chính:** CSKH / Sales
- **Mục tiêu:** Cài ops-web lên màn hình chính — mở lead nhanh ngoài văn phòng
- **Trigger:** User truy cập rs.pttads.vn trên mobile browser; beforeinstallprompt
- **Pre-condition:** NEXT_PUBLIC_PWA_ENABLED=1; staff JWT login thành công
- **Post-condition:** App standalone; start_url /crm/leads
- **Ưu tiên:** P0
- **Sprint/Wave:** RNOS-M1
- **Trace ref:** RNOS-41, TC-MOB-01
- **API / Integration:** GET /manifest.webmanifest · GET /sw.js · staff auth unchanged

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | User mở ops-web trên viewport ≤768px |
| 2 | PwaShell hiện banner «Thêm vào màn hình chính» |
| 3 | User chấp nhận install hoặc Add to Home Screen thủ công |
| 4 | Service worker register ptt-ops-pwa-v1 |
| 5 | Icon shortcut mở /crm/leads MOB-UC-002 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | PWA disabled env → banner ẩn, SW không register |
| E2 | User dismiss banner → sessionStorage không hiện lại phiên này |
| E3 | iOS Safari không beforeinstallprompt → hướng dẫn Share → Add to Home Screen |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | browser install prompt, NEXT_PUBLIC_PWA_ENABLED |
| Output | installed PWA shell, cached /crm/leads shell |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-MOB-01 | PWA staff chỉ staff JWT — không dùng portal JWT trên ops-web |
| BR-MOB-02 | Offline: chỉ GET; POST/PATCH hiện banner «Cần mạng» |
| BR-PLAT-002 | RBAC cap enforcement 403 trên route/API unauthorized |

### MOB-UC-002 — Xem danh sách lead mobile

> 🟢 Spec thủ công

- **Mã use case:** MOB-UC-002
- **Tên use case:** Xem danh sách lead mobile
- **Màn hình:** SCR-MOB-002
- **Actor chính:** CSKH / Sales
- **Mục tiêu:** Duyệt lead dạng card trên điện thoại; tap mở chi tiết
- **Trigger:** Navigate /crm/leads @ viewport ≤768px
- **Pre-condition:** Staff cap crm_leads.view; PWA hoặc mobile browser
- **Post-condition:** Lead list filtered; tap → MOB-UC-003
- **Ưu tiên:** P0
- **Sprint/Wave:** RNOS-M1
- **Trace ref:** RNOS-41, P0-1, TC-MOB-01
- **API / Integration:** GET /api/v1/leads · GET /api/v1/ai/scores/batch (pilot)

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | CSS ẩn table .crm-leads-table-wrap |
| 2 | Render .crm-leads-cards với tên, SĐT, status, AI score |
| 3 | Filter/search giữ nguyên desktop behavior |
| 4 | Tap card → /crm/leads/[id] |
| 5 | Pull refresh optional P2 — network-first list |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Empty list → empty state card |
| E2 | Offline navigate → SW fallback cached shell + banner mạng |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | JWT staff, filter params |
| Output | lead card list JSON |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-MOB-02 | Offline: chỉ GET; POST/PATCH hiện banner «Cần mạng» |
| BR-MOB-05 | Admin caps (admin_page_permissions) áp dụng identical trên mobile viewport |
| BR-CRM-001 | Một lead active chỉ một owner primary; dedup phone/email |

### MOB-UC-003 — Xem chi tiết + AI brief lead

> 🟢 Spec thủ công

- **Mã use case:** MOB-UC-003
- **Tên use case:** Xem chi tiết + AI brief lead
- **Màn hình:** SCR-MOB-003
- **Actor chính:** CSKH
- **Mục tiêu:** Đọc lead detail + copilot brief trên mobile; không auto-send
- **Trigger:** Tap lead card MOB-UC-002 hoặc deep link /crm/leads/[id]
- **Pre-condition:** Lead exists; owner hoặc cap view team
- **Post-condition:** Activity logged nếu user action; copilot draft copy-only
- **Ưu tiên:** P0
- **Sprint/Wave:** RNOS-M1
- **Trace ref:** AI-UC-002, RNOS-41
- **API / Integration:** GET /api/v1/leads/:id · POST /api/v1/ai/copilot/*

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Load /crm/leads/[id] — @<1024px tab bar Chi tiết/Hoạt động/AI |
| 2 | Tab Chi tiết: DL fields + Copy SĐT/Zalo + status/assign forms |
| 3 | Tab Hoạt động: chọn activity → tab AI summarize |
| 4 | Tab AI: LeadCopilotPanel brief 5 bullets + follow-up draft copy-only |
| 5 | Tablet 1024–1279: FAB → drawer copilot; desktop ≥1280 inline column |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Copilot offline → banner «Copilot cần kết nối mạng» trên tab AI |
| E2 | Pilot flag off → copilot hidden CRM core OK |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | lead_id, staff JWT |
| Output | lead detail, AI brief JSON |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-MOB-04 | AI copilot mobile: draft only — BR-AI-01 không đổi |
| BR-AI-001 | Copilot KHÔNG auto-send Zalo/Email — chỉ draft + copy |
| BR-AI-002 | Lead brief tối đa 5 bullet tiếng Việt; không ghi đè CRM fields |
| BR-MOB-05 | Admin caps (admin_page_permissions) áp dụng identical trên mobile viewport |

### MOB-UC-004 — Offline đọc lead đã cache

> 🟢 Spec thủ công

- **Mã use case:** MOB-UC-004
- **Tên use case:** Offline đọc lead đã cache
- **Màn hình:** SCR-MOB-002, SCR-MOB-003
- **Actor chính:** CSKH
- **Mục tiêu:** Đọc shell lead list/detail đã precache khi mất mạng
- **Trigger:** Navigate offline sau khi đã visit /crm/leads online
- **Pre-condition:** SW installed; /crm/leads cached navigate once
- **Post-condition:** Read-only view; POST/PATCH blocked with banner
- **Ưu tiên:** P1
- **Sprint/Wave:** RNOS-M1
- **Trace ref:** RNOS-41
- **API / Integration:** Không cache /api/* — chỉ shell + static

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | SW navigate network-first fail |
| 2 | Fallback cache /crm/leads hoặc /login |
| 3 | Hiển thị cached HTML shell |
| 4 | Banner «Cần mạng để cập nhật» trên mọi write action |
| 5 | Reconnect → auto refresh list |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Chưa từng online → 503 text/plain VN |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | cached Request navigate |
| Output | cached page or 503 |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-MOB-02 | Offline: chỉ GET; POST/PATCH hiện banner «Cần mạng» |

### MOB-UC-005 — Cài PWA portal

> 🟢 Spec thủ công

- **Mã use case:** MOB-UC-005
- **Tên use case:** Cài PWA portal
- **Màn hình:** SCR-MOB-005
- **Actor chính:** Client Approver
- **Mục tiêu:** Cài portal.pttads.vn PWA — duyệt creative nhanh
- **Trigger:** Approver mở portal mobile; beforeinstallprompt
- **Pre-condition:** NEXT_PUBLIC_PWA_ENABLED=1 portal-web; portal JWT
- **Post-condition:** Standalone app start_url /dashboard
- **Ưu tiên:** P0
- **Sprint/Wave:** RNOS-M2
- **Trace ref:** RNOS-M2, TC-MOB-02
- **API / Integration:** GET /manifest.webmanifest · GET /sw.js ptt-portal-pwa-v1

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | PortalPwaShell banner «Cài PTT Portal» |
| 2 | User install → standalone display |
| 3 | SW register scope / |
| 4 | Bottom nav MOB SCR-MOB-006 visible |
| 5 | Session portal JWT unchanged BR-MOB-01 staff/portal split |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | PWA flag 0 → no banner |
| E2 | iOS manual Add to Home Screen |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | portal build flags |
| Output | installed portal PWA |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-MOB-01 | PWA staff chỉ staff JWT — không dùng portal JWT trên ops-web |
| BR-PLAT-003 | Portal JWT scoped single client_id |

### MOB-UC-006 — Nhận push duyệt creative

> 🟢 Spec thủ công

- **Mã use case:** MOB-UC-006
- **Tên use case:** Nhận push duyệt creative
- **Màn hình:** SCR-MOB-007, SCR-MOB-009
- **Actor chính:** Client Approver
- **Mục tiêu:** Nhận web push khi creative/email pending; tap mở inbox
- **Trigger:** PortalNotificationService.emitCreativePending → PortalPushSenderService
- **Pre-condition:** MOB-UC-009 subscription active; VAPID configured
- **Post-condition:** Notification shown; click → /creatives or /notifications
- **Ưu tiên:** P0
- **Sprint/Wave:** RNOS-M2
- **Trace ref:** PORTAL-UC-006, TC-MOB-02
- **API / Integration:** POST /api/v1/portal/push/subscribe · web-push send

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Staff submit creative → emit notification |
| 2 | Insert portal_notification + push payload |
| 3 | SW push handler showNotification |
| 4 | notificationclick → clients.openWindow link_url |
| 5 | Approver duyệt trên SCR-MOB-007 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | No subscription → in-app only portal_notification |
| E2 | Stale endpoint 410 → auto delete subscription |
| E3 | Push disabled → webhook stub only |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | creative pending event, subscription rows |
| Output | push notification + in-app row |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-MOB-03 | Push portal scoped tenant — payload không chứa PII subscriber |
| BR-PORTAL-006 | Creative approval synced ops-web SYS-UC-004 |
| BR-SYS-004 | Client approver JWT scoped một client_id cross-module |

### MOB-UC-007 — Duyệt email campaign mobile

> 🟢 Spec thủ công

- **Mã use case:** MOB-UC-007
- **Tên use case:** Duyệt email campaign mobile
- **Màn hình:** SCR-MOB-008
- **Actor chính:** Client Approver
- **Mục tiêu:** Approve/reject email campaign trên mobile viewport
- **Trigger:** Navigate /email/approvals @ ≤768px hoặc từ push MOB-UC-006
- **Pre-condition:** email_enabled; role approver; pending campaign exists
- **Post-condition:** Decision recorded EM-UC-007 dual approval flow
- **Ưu tiên:** P0
- **Sprint/Wave:** RNOS-M2
- **Trace ref:** PORTAL-UC-008, EM-UC-007
- **API / Integration:** GET portal email approvals · POST approve/reject

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mobile card list thay table @768px |
| 2 | Tap campaign → preview modal mobile 320px tab |
| 3 | Approve hoặc Reject + comment nếu reject |
| 4 | Toast success + badge bottom nav cập nhật |
| 5 | Temporal/workflow signal nếu configured |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Viewer role → read-only notice |
| E2 | Module disabled → feature flag message |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | campaign_id, decision, comment |
| Output | approval status updated |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-008 | Email campaign dual approval staff + client EM-UC-007 |
| BR-EM-007 | Dual approval staff + client trước ESP send |
| BR-MOB-05 | Admin caps (admin_page_permissions) áp dụng identical trên mobile viewport |

### MOB-UC-008 — Xem KPI dashboard mobile

> 🟢 Spec thủ công

- **Mã use case:** MOB-UC-008
- **Tên use case:** Xem KPI dashboard mobile
- **Màn hình:** SCR-MOB-006
- **Actor chính:** Client Viewer / Approver
- **Mục tiêu:** Xem KPI tiles 2-col grid trên mobile; pending badges
- **Trigger:** Open /dashboard @ ≤768px hoặc bottom nav Home
- **Pre-condition:** Portal JWT; modules enabled
- **Post-condition:** Read-only KPI; tap drill module routes
- **Ưu tiên:** P1
- **Sprint/Wave:** RNOS-M2
- **Trace ref:** PORTAL-UC-002
- **API / Integration:** GET /api/v1/portal/performance · notification summary

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | PortalMobileBottomNav Home active |
| 2 | KPI cards 2-column scroll vertical |
| 3 | Pending creative/email badges on nav |
| 4 | Attribution disclaimer footer visible |
| 5 | Tap module card → /meta /seo /email routes |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Module off → card hidden |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id JWT, date_range |
| Output | KPI summary JSON |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-002 | Dashboard KPI chỉ module enabled cho client |
| BR-SYS-005 | Client-facing report bắt buộc attribution disclaimer |

### MOB-UC-009 — Quản lý subscription push

> 🟢 Spec thủ công

- **Mã use case:** MOB-UC-009
- **Tên use case:** Quản lý subscription push
- **Màn hình:** SCR-MOB-010
- **Actor chính:** Client Approver
- **Mục tiêu:** Bật/tắt web push; test notification; lưu endpoint PG
- **Trigger:** Settings → Bật thông báo đẩy
- **Pre-condition:** Browser Notification + PushManager support; PTT_PORTAL_PUSH_ENABLED
- **Post-condition:** Row portal_push_subscriptions; VAPID subscribe OK
- **Ưu tiên:** P1
- **Sprint/Wave:** RNOS-M2
- **Trace ref:** RNOS-M2, TC-MOB-02
- **API / Integration:** GET push/vapid-public-key · POST/DELETE push/subscribe · POST push/test

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | usePortalPush fetch VAPID public key |
| 2 | Notification.requestPermission granted |
| 3 | pushManager.subscribe → POST subscribe API |
| 4 | Gửi test push verify sender |
| 5 | Tắt → unsubscribe + DELETE endpoint |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Permission denied → inline error |
| E2 | Stub user stub:email → UUID column fail — dùng portal user thật prod |
| E3 | VAPID missing → «Push chưa bật server» |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | PushSubscription JSON, JWT |
| Output | subscription_id stored |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-MOB-03 | Push portal scoped tenant — payload không chứa PII subscriber |
| BR-PLAT-003 | Portal JWT scoped single client_id |

### MOB-UC-010 — Deep link từ email/SMS

> 🟢 Spec thủ công

- **Mã use case:** MOB-UC-010
- **Tên use case:** Deep link từ email/SMS
- **Màn hình:** SCR-MOB-007, SCR-MOB-008
- **Actor chính:** Client Approver
- **Mục tiêu:** Mở thẳng màn duyệt từ link email/SMS hoặc native shell M3
- **Trigger:** Tap link https://portal.pttads.vn/creatives?… hoặc pttads://approve/{id}
- **Pre-condition:** Valid session hoặc login redirect; M3 Capacitor optional
- **Post-condition:** Target approval screen loaded scoped tenant
- **Ưu tiên:** P2
- **Sprint/Wave:** RNOS-M3
- **Trace ref:** Capacitor shell README
- **API / Integration:** Universal link / @capacitor/app App plugin

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | User tap link in email/SMS |
| 2 | Browser or Capacitor opens portal route |
| 3 | Login gate if session expired → return URL preserved |
| 4 | Land creative/email approval detail |
| 5 | Complete decision MOB-UC-006/007 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Expired JWT → /login?next= encoded path |
| E2 | Wrong tenant → 403 archived |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | deep link URL, optional token |
| Output | approval screen rendered |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-MOB-01 | PWA staff chỉ staff JWT — không dùng portal JWT trên ops-web |
| BR-SYS-011 | Multi-tenant isolation — no cross-client data leak |
| BR-PORTAL-001 | Portal login scoped client — không thấy data client khác |

---

## 3. Chi tiết Màn hình module

### SCR-MOB-001 — PWA Install Shell (Staff)

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-MOB-001
- **Tên màn hình:** PWA Install Shell (Staff)
- **Route:** ops-web global
- **Module:** Mobile
- **Ứng dụng:** ops-web (rs.pttads.vn) global
- **Mục đích:** PWA install shell staff — banner + service worker ops-web
- **Vai trò:** CSKH, Sales
- **Điều kiện trước:** NEXT_PUBLIC_PWA_ENABLED=1; ops-web served
- **Điều kiện sau:** SW registered; install banner dismissed or accepted
- **Use case liên quan:** MOB-UC-001
- **API liên quan:** GET /manifest.webmanifest · GET /sw.js · staff auth
- **Parity / RNOS:** RNOS-41
- **Trạng thái triển khai:** Done (deep spec v2.0)
- **Ghi chú:** PwaShell + sw.js ptt-ops-pwa-v1 ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | PwaShell | Banner | Không | Fixed bottom install CTA RNOS-41 |
| 2 | InstallActions | Button | Không | Thêm màn hình chính · Để sau |
| 3 | ServiceWorkerRegister | System | Có | register /sw.js ptt-ops-pwa-v1 |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-MOB-01 | PWA staff chỉ staff JWT — không dùng portal JWT trên ops-web |
| BR-MOB-02 | Offline: chỉ GET; POST/PATCH hiện banner «Cần mạng» |

### SCR-MOB-005 — Portal Install Shell

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-MOB-005
- **Tên màn hình:** Portal Install Shell
- **Route:** portal-web global
- **Module:** Mobile
- **Ứng dụng:** portal-web global
- **Mục đích:** Portal PWA install shell RNOS-M2
- **Vai trò:** Client Approver
- **Điều kiện trước:** NEXT_PUBLIC_PWA_ENABLED=1 portal-web
- **Điều kiện sau:** Portal SW + optional install
- **Use case liên quan:** MOB-UC-005
- **API liên quan:** GET /manifest.webmanifest · GET /sw.js
- **Parity / RNOS:** RNOS-M2
- **Trạng thái triển khai:** Done (deep spec v2.0)
- **Ghi chú:** PortalPwaShell + ptt-portal-pwa-v1 ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | PortalPwaShell | Banner | Không | Above bottom nav offset |
| 2 | InstallActions | Button | Không | Cài PTT Portal |
| 3 | ServiceWorkerRegister | System | Có | ptt-portal-pwa-v1 |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-MOB-01 | PWA staff chỉ staff JWT — không dùng portal JWT trên ops-web |
| BR-PLAT-003 | Portal JWT scoped single client_id |

### SCR-MOB-010 — Push Settings

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-MOB-010
- **Tên màn hình:** Push Settings
- **Route:** /settings (push section)
- **Module:** Mobile
- **Ứng dụng:** portal-web /settings (Push section)
- **Mục đích:** Push notification settings on /settings
- **Vai trò:** Client Approver
- **Điều kiện trước:** Push API enabled; Notification API
- **Điều kiện sau:** Subscription stored PG
- **Use case liên quan:** MOB-UC-009
- **API liên quan:** POST/DELETE /api/v1/portal/push/subscribe · POST push/test
- **Parity / RNOS:** RNOS-M2
- **Trạng thái triển khai:** Done (deep spec v2.0)
- **Ghi chú:** usePortalPush + test push ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | PushNotificationCard | Form | Có | Bật/tắt push MOB-UC-009 |
| 2 | TestPushButton | Button | Không | Gửi test push staging |
| 3 | PermissionStatus | Text | Có | Quyền Notification hiện tại |
| 4 | BrandingSettings | Form | Có | Existing settings below |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-MOB-03 | Push portal scoped tenant — payload không chứa PII subscriber |
| BR-PORTAL-012 | Change password requires current password when logged in |

---

## 4. Business Rules module

| BR | Mô tả | Priority | Status |
| --- | --- | --- | --- |
| BR-MOB-01 | PWA staff chỉ staff JWT — không dùng portal JWT trên ops-web | High | Done |
| BR-MOB-02 | Offline: chỉ GET; POST/PATCH hiện banner «Cần mạng» | High | Done |
| BR-MOB-03 | Push portal scoped tenant — payload không chứa PII subscriber | High | Done |
| BR-MOB-04 | AI copilot mobile: draft only — BR-AI-01 không đổi | High | Done |
| BR-MOB-05 | Admin caps (admin_page_permissions) áp dụng identical trên mobile viewport | High | Done |
| BR-MOB-06 | Session timeout mobile = desktop (staff 8h / portal theo policy) | Medium | Done |
