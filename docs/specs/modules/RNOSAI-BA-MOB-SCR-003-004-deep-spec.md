# RNOSAI — Deep Spec SCR-MOB-003 / SCR-MOB-004

## Document control

| Thuộc tính | Giá trị |
| --- | --- |
| Document ID | RNOSAI-BA-MOB-SCR-003-004 |
| Phiên bản | 1.0 |
| Ngày | 2026-08-01 |
| Module | MOD-MOB — Mobile Experience |
| Parent SCR | SCR-CRM-001 (lead detail), SCR-CRM-004 (CSKH board) |
| Use cases | MOB-UC-003, MOB-UC-004, CRM-UC-008 |
| Master index | [RNOSAI-BA-Master-Spec.md](../RNOSAI-BA-Master-Spec.md) |
| Mobile strategy | [2026-08-01-rnosai-mobile-strategy-spec.md](../2026-08-01-rnosai-mobile-strategy-spec.md) §8.1.5–8.1.7 |

---

## 1. SCR-MOB-003 — Lead Detail Mobile + AI Copilot

### 1.1. Mục tiêu

Cho phép CSKH xem chi tiết lead, timeline hoạt động và AI Copilot trên viewport mobile/tablet của ops-web (`rs.pttads.vn`), giữ parity RBAC và BR-AI-01 (draft-only, không auto-send).

### 1.2. Route & shell

| Thuộc tính | Giá trị |
| --- | --- |
| Route | `/crm/leads/[id]` |
| App | `ops-web` — `services/ops-web/src/app/crm/leads/[id]/page.tsx` |
| Auth | Staff JWT + cap `crm_leads.view` (edit/assign theo cap) |
| Copilot gate | `aiCopilotEnabled()` — ẩn toàn bộ copilot khi pilot flag off |

### 1.3. Breakpoints (as-implemented)

Hook `useLeadDetailLayout()` — **khác** breakpoint lead list (`768px`):

| Viewport | Alias | Copilot UX | Layout |
| --- | --- | --- | --- |
| `≥1280px` | `desktop` | Inline column 380px (`LeadCopilotPanel` variant `column`) | 3-col grid: main · timeline · copilot |
| `1024–1279px` | `tablet` | FAB `lead-copilot-fab` → drawer `ai-copilot-panel--drawer` 92vw | 2-col: main · timeline |
| `<1024px` | `mobile` | Tab bar **Chi tiết · Hoạt động · AI** — copilot full-width tab | Single column; panes toggle `.lead-detail-pane--hidden` |

**Gap vs mobile strategy §8.1.5:** strategy ghi «bottom sheet» cho tab AI; **as-is dùng full-width tab**, không có `position:fixed` bottom sheet. Target P2: optional swipe-up sheet overlay tab AI (giữ tab bar).

### 1.4. Tab mobile (`<1024px`, copilot on)

| Tab | `mobileTab` | Nội dung visible |
| --- | --- | --- |
| Chi tiết | `detail` | `.lead-detail-main` — profile, funnel, contract, status, assign, add activity |
| Hoạt động | `activity` | `.lead-detail-timeline` — activity list, entity timeline, audit |
| AI | `ai` | `LeadCopilotPanel` variant `column` (scroll trong tab, không drawer) |

Khi `aiCopilotEnabled() === false`: không render tab bar; chỉ main + timeline stack (desktop layout collapsed).

### 1.5. Thành phần UI — tab Chi tiết

| STT | Component | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | OpsNav | Navigation | Có | Staff shell |
| 2 | BackLink | Link | Có | `← Danh sách leads` → `/crm/leads` |
| 3 | LeadDetailTabs | Tab bar | Có* | *Chỉ khi mobile + copilot on |
| 4 | LeadHeaderCard | Card | Có | `#id · full_name`, attribution chips |
| 5 | IntakeLink | Link | Có | `/crm/intake?lead_id=` |
| 6 | LeadDetailDl | DL grid | Có | SĐT, email, nguồn, owner, ngày — `lead-detail-dl` 120px/1fr |
| 7 | ContactCopyActions | Button group | Có | Copy SĐT · Copy Zalo (`data-testid=lead-contact-copy`) — **chưa có `tel:` Gọi (M1.1 backlog)** |
| 8 | LeadFunnelPanel | Panel | Không | Funnel stage — cap theo CRM |
| 9 | LeadContractPanel | Panel | Không | Contract sub-panel |
| 10 | StatusForm | Form | Có | Select status + audit note + Lưu — cap `crm_leads.edit` |
| 11 | AssignForm | Form | Có | Staff select + lý do ≥3 ký tự — cap `crm_leads.assign` |
| 12 | AddActivityForm | Form | Có | Loại + nội dung — cap `crm_leads.edit` |

### 1.6. Thành phần UI — tab Hoạt động

| STT | Component | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 13 | ActivityList | List | Có | `.lead-activity-list` — click chọn activity cho summarize |
| 14 | ActivitySelectHint | Text | Có | «Chọn activity để tóm tắt trong AI Copilot» |
| 15 | LeadEntityTimelinePanel | Timeline | Không | Customer timeline enrich |
| 16 | AuditSection | Panel | Có | Status logs + assignment logs |

### 1.7. Thành phần UI — AI Copilot (`LeadCopilotPanel`)

| STT | Section | API (via `ai-api.ts`) | Ghi chú |
| --- | --- | --- | --- |
| 17 | ConfidenceBanner | — | Hiện khi score có confidence |
| 18 | ScoreCard | `GET /api/v1/ai/scores`, poll | Override cap `crm_leads.assign` |
| 19 | LeadRouteRepSection | `POST /api/v1/ai/route/lead` | Gợi ý phân lead |
| 20 | LeadNbaSection | `POST /api/v1/ai/next-best-action` | NBA → tạo activity |
| 21 | LeadBriefSection | recommendation/brief endpoints | 5 bullets BR-AI-02 |
| 22 | SummarizeSection | `POST /api/v1/ai/summarize` | Activity đã chọn từ tab Hoạt động |
| 23 | FollowUpDraftSection | recommendation draft | Copy-only BR-AI-01 |
| 24 | CopilotTrustFooter | Footer | `data-testid=copilot-trust-footer` |

Tablet drawer: thêm nút **Đóng** + backdrop click dismiss.

### 1.8. API contract

| Method | Path (ops-web proxy) | Khi nào |
| --- | --- | --- |
| GET | `/api/crm/leads/:id` | Load lead |
| GET | `/api/crm/leads/:id/attribution` | Attribution chips |
| GET | `/api/crm/leads/:id/activities` | Timeline |
| GET | `/api/crm/leads/:id/audit` | Audit bundle |
| PATCH | `/api/crm/leads/:id` (legacy patch) | Status update |
| POST | assign endpoint | Phân lead |
| POST | activity create | Thêm hoạt động |
| GET/POST | `/api/v1/ai/*` | Copilot sections — **network required** |

SW **không cache** `/api/*` (BR-MOB-02).

### 1.9. Trạng thái màn hình

| State | UI | Recovery |
| --- | --- | --- |
| Loading | «Đang tải lead #…» | — |
| Error auth | Redirect `/login` | Refresh token |
| Error cap | «Không có quyền xem CRM leads» | — |
| Error load | `.error` message | Retry navigate |
| Empty activity | «Chưa có hoạt động» | Add activity |
| Copilot 403 | Section error via `onCopilotError` | — |
| Copilot offline | **Backlog** — banner «Copilot cần kết nối mạng» (MOB-UC-003 E1) | Reconnect |
| Pilot off | Copilot hidden; CRM forms OK | — |
| Offline shell | MOB-UC-004 — cached HTML; API fail | Banner «Cần mạng» on write |

### 1.10. Luồng chính (MOB-UC-003)

1. User tap card SCR-MOB-002 → `/crm/leads/[id]`.
2. `@<1024px`: tab bar hiện; default tab **Chi tiết**.
3. User đọc fields, copy SĐT/Zalo, cập nhật status nếu có cap.
4. Tab **Hoạt động** → chọn activity.
5. Tab **AI** → brief / summarize / follow-up draft; user copy thủ công.
6. Back → lead list.

### 1.11. Acceptance / gate

| ID | Tiêu chí | Evidence |
| --- | --- | --- |
| AC-003-01 | Tab bar 3 tab @ viewport 390px | Manual / Playwright resize |
| AC-003-02 | Tab AI render ScoreCard + Brief | `LeadCopilotPanel` visible |
| AC-003-03 | Tablet FAB opens drawer | `@1024–1279px` |
| AC-003-04 | Copy SĐT không gọi API send | BR-AI-01 footer + no Zalo API |
| AC-003-05 | `crm_leads.edit` disabled without cap | MOB-UC-003 + BR-MOB-05 |
| AC-003-06 | Copilot trust footer present | `data-testid=copilot-trust-footer` |

**Trạng thái triển khai:** In progress **0.95** — core tabs + copilot ✅; backlog: `tel:` quick call, offline copilot banner.

### 1.12. File map

| File | Vai trò |
| --- | --- |
| `services/ops-web/src/app/crm/leads/[id]/page.tsx` | Page + layout logic |
| `services/ops-web/src/components/ai/LeadCopilotPanel.tsx` | Copilot sections |
| `services/ops-web/src/app/globals.css` | `.lead-detail-*`, `.lead-copilot-*`, `.ai-copilot-panel*` |

---

## 2. SCR-MOB-004 — CSKH Board Mobile

### 2.1. Mục tiêu

Cho CSKH theo dõi SLA first-call (15 phút) trên mobile: lọc breach/warning, xem lead nhanh, tap vào detail — parity dữ liệu với SCR-CRM-004 desktop.

### 2.2. As-is vs target

| Khía cạnh | As-is (code) | Target M1.2 (SCR-MOB-004) |
| --- | --- | --- |
| Route | `/crm/cskh-board` | Same |
| Layout `@≤768px` | Desktop **table** trong `.table-wrap` — scroll ngang | **Card list** `.cskh-board-cards` |
| Filters | Full form luôn hiện | Collapsible «Bộ lọc» accordion |
| SLA summary | Text line trong filter card | Sticky chips: Breach / Warning / OK |
| Bulk actions | Card riêng (checkbox table) | Bottom sheet hoặc FAB «Bulk (n)» — cap assign |
| Row → detail | Link trong table | Tap card → `/crm/leads/[id]` |
| Export CSV | Header button | Giữ; optional share sheet P2 |
| Kanban columns | **Không có** (catalog SCR-CRM-004 mô tả Kanban; impl = SLA table) | **Không** — giữ list/card theo SLA state badge |

### 2.3. Route & auth

| Thuộc tính | Giá trị |
| --- | --- |
| Route | `/crm/cskh-board` |
| Component | `services/ops-web/src/app/crm/cskh-board/CskhBoardContent.tsx` |
| Auth | Staff JWT + cap xem board (same as desktop) |
| Bulk assign | cap `crm_leads.assign` |

### 2.4. Breakpoints

| Viewport | Layout |
| --- | --- |
| `≥769px` | `.cskh-board-table-wrap` — table hiện tại |
| `≤768px` | Ẩn table; render `.cskh-board-cards` (target) |

Align với SCR-MOB-002 (`768px` boundary).

### 2.5. Thành phần UI — target mobile

| STT | Component | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | OpsNav | Navigation | Có | Staff shell |
| 2 | PageHeader | Header | Có | «Bảng CSKH — SLA first call» + subtitle CRM-UC-008 |
| 3 | HeaderActions | Toolbar | Có | Link Quản lý Lead · Export CSV |
| 4 | SlaSummaryChips | Chip row | Có | Sticky top — breach/warning/ok counts từ `summary` |
| 5 | FilterAccordion | Collapsible | Có | SLA filter · Owner ID · Search · Lọc |
| 6 | CskhLeadCard | Card | Có | Name link · phone · status · owner · SLA badge · minutes |
| 7 | SlaBadge | Badge | Có | `ok` / `warning` / `breach` / `na` — class `row-danger` tương đương |
| 8 | CardMetaRow | Text | Có | Received · First call · Follow-up (rút gọn) |
| 9 | BulkActionSheet | Sheet | Không | Chỉ `@assign cap`; reassign + reschedule |
| 10 | PaginationBar | Pager | Có | ← Trước · range · Sau → (PAGE_SIZE=50) |
| 11 | EmptyState | Alert | Có | «Không có lead phù hợp bộ lọc» |
| 12 | LoadingState | Text | Có | «Đang tải…» |

### 2.6. Card field mapping (`CskhBoardRow`)

| Card field | API field | Format |
| --- | --- | --- |
| Title | `full_name` hoặc `#id` | Link `/crm/leads/{id}` |
| Subtitle | `phone` | muted |
| Status | `status` | text |
| Owner | `owner_name` ?? `owner_id` | — |
| SLA | `sla_state` + `sla_minutes_elapsed` | Badge + «· Nm» |
| Received | `received_at` | slice 0,16 |
| First call | `first_call_at` | slice 0,16 hoặc «—» |
| Follow-up | `next_follow_up_at` | slice 0,16 |

### 2.7. API contract (reuse — không endpoint mới)

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/crm/cskh-board` | `sla_filter`, `owner_id`, `q`, `limit`, `offset` |
| POST | `/api/crm/cskh-board/bulk-assign` | `{ lead_ids, to_user_id, reason }` |
| POST | `/api/crm/cskh-board/bulk-reschedule` | `{ lead_ids, follow_up_at }` |
| GET | `/api/crm/cskh-board/export` | CSV download |
| GET | `/api/crm/staff` (catalog) | Staff dropdown bulk assign |

Response: `{ items[], total, summary: { total, breach, warning, ok } }`.

### 2.8. SLA filter semantics

| `sla_filter` | Default | Ý nghĩa |
| --- | --- | --- |
| `breach` | ✓ (page default) | Quá 15 phút chưa first call |
| `warning` | | Sắp breach |
| `open` | | ok + warning |
| `all` | | Tất cả |

### 2.9. Trạng thái màn hình

| State | UI |
| --- | --- |
| Loading | «Đang tải…» trong list area |
| Error | `.error` — bulk/load fail message |
| Success bulk | `.ok-text` — «Đã phân lại N/M lead» |
| Empty | «Không có lead phù hợp bộ lọc» |
| No assign cap | Ẩn bulk card / sheet |

### 2.10. Luồng chính (CRM-UC-008 @ mobile)

1. CSKH mở `/crm/cskh-board` trên PWA/mobile.
2. Sticky chips hiện breach count — tap chip có thể preset filter (target).
3. Lọc breach → card list sorted by urgency (server order).
4. Tap card → SCR-MOB-003 lead detail → log first call activity.
5. Optional bulk reassign (cap assign).

### 2.11. CSS sketch (target)

```css
@media (max-width: 768px) {
  .cskh-board-table-wrap { display: none; }
  .cskh-board-cards { display: grid; gap: 0.75rem; }
  .cskh-board-summary-chips {
    position: sticky; top: 0; z-index: 10;
    display: flex; gap: 0.5rem; overflow-x: auto;
  }
  .cskh-board-card--breach { border-left: 4px solid var(--danger); }
}
```

### 2.12. Acceptance / gate (khi implement M1.2)

| ID | Tiêu chí |
| --- | --- |
| AC-004-01 | `@390px` table hidden, ≥1 card visible |
| AC-004-02 | Breach card có visual highlight |
| AC-004-03 | Tap card → `/crm/leads/[id]` |
| AC-004-04 | Filter breach giữ default behavior |
| AC-004-05 | Bulk assign disabled without cap (BR-MOB-05) |
| AC-004-06 | Export CSV vẫn hoạt động mobile browser |

**Trạng thái triển khai:** Backlog **0.5** — deep spec ✅; implementation chưa bắt đầu.

### 2.13. File map

| File | Vai trò |
| --- | --- |
| `CskhBoardContent.tsx` | Page logic — thêm mobile branch |
| `globals.css` | `.cskh-board-*` mobile block |
| `lib/api.ts` | `fetchCskhBoard`, bulk helpers |

---

## 3. Quy tắc nghiệp vụ (chung)

| Mã | Áp dụng |
| --- | --- |
| BR-MOB-02 | Offline read-only; POST/PATCH banner |
| BR-MOB-04 | Copilot draft-only (003) |
| BR-MOB-05 | Caps identical mobile/desktop |
| BR-AI-001 | Không auto-send Zalo/Email |
| BR-AI-002 | Brief 5 bullets format |
| BR-CRM-008 | SLA breach highlight (004) |

---

## 4. Traceability

| SCR | UC | Test case | Gate script |
| --- | --- | --- | --- |
| SCR-MOB-003 | MOB-UC-003, MOB-UC-004 | TC-MOB-01 | `rnos41_pwa_gate.sh` (extend) |
| SCR-MOB-004 | CRM-UC-008 | TC-CSKH-01 | `cskh_board_gate.sh` + mobile viewport |
