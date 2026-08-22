# Pack BĐS — Coding Roadmap (toàn hệ thống)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. **Không code cả pack trong một PR.** Mỗi pha một plan chi tiết riêng. P0 triển khai: [`2026-08-22-bds-p0-trien-khai.md`](./2026-08-22-bds-p0-trien-khai.md). TDD rút gọn: [`2026-08-22-bds-p0-tenant-pg-org.md`](./2026-08-22-bds-p0-tenant-pg-org.md).

**Goal:** Ship Industry Pack BĐS trên RNOSAI theo spec Q1–Q29: tenant CĐT/sàn, tồn kho khóa, hành trình VBTT→HĐMB, đại lý/giỏ/hạng, collection, after-sales, chat, ticket việc.

**Architecture:** Bounded context mới `services/ptt-crm-api/src/bds/` + platform `staff-chat/` + `staff-tickets/`. `re-projects/` giữ khi `PTT_BDS_PACK=0`. OLTP pack trên PostgreSQL (`rnosaidb`). ops-web skin theo `tenant.mode`. Không gộp `crm_b2b_projects`. Không dùng `tickets` khách / `crm_b2b_conversation_*` / `crm_b2b_commission_ledger`.

**Tech Stack:** NestJS + Jest (`ptt-crm-api`), PostgreSQL (`pg` Pool như video-sop), SQLite `ptt.db` dual-write rồi cắt, Next.js ops-web, Playwright E2E staging.

**Spec / UX / UC:**
- [2026-08-21-bds-industry-pack-design.md](../specs/2026-08-21-bds-industry-pack-design.md)
- [2026-08-22-bds-ux-ui-design.md](../specs/2026-08-22-bds-ux-ui-design.md)
- [13-BDS-INDUSTRY-PACK.md](../../use-cases/13-BDS-INDUSTRY-PACK.md)
- [13-BDS-ACTIONS.md](../../use-cases/actions/13-BDS-ACTIONS.md)

## Global Constraints

- Flag mặc định **tắt**: `PTT_BDS_PACK=0` → mọi `POST /api/v1/bds/*` **404**.
- GET ngoài scope = **404**, không 403, body không PII (BR-BDS-05).
- `re_buyer` **cấm** `b2b_project_id` (BR-BDS-06).
- HĐMB: GĐKD **không** bypass cổng PC hoặc Collection (BR-BDS-35).
- `one_price`: net ≠ CSBH → 400 (BR-BDS-26).
- Không xóa `re-projects/`. Không ghi hoa hồng BĐS vào `crm_b2b_commission_ledger`.
- Không commit trừ khi user yêu cầu (user git rule).
- TDD: test đỏ → code → test xanh. Một pha đỏ không mở pha sau.
- Tiếng Việt nghiệp vụ trên UI: giữ chỗ · cọc · VBTT · HĐMB. Không Deal Room trên `re_buyer`.
- `DATABASE_URL` mặc định script: `postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb`.

---

## 1. Thứ tự pha (cổng)

```
P0  tenant + PG + org seed          ← CHẶN P1 (staging 2 tenant, BDS-20)
 ├─ P1   inventory OS
 ├─ P1b  Project OS (song song P1)
 ├─ P6   buyer CRM (sau P0, không chờ P1)
 │
 P1 + P1b → P2 hold+TTL
 P1b → P3 CSBH
 P2 + P3 → P4 TX → P4b collection (CHẶN HĐMB prod)
 P2 → P5 Agency OS
 P4 + P5 → P7 hoa hồng
 P5 + P6 + P1b → P8 UI nav
 P4b → P9 after-sales
 P2 + P3 → P10 launch
 P0 + P8 → P11 chat · P12 tickets (P11 không chặn P12)
```

| Pha | Plan file | Thắng (test) | UC |
|-----|-----------|--------------|-----|
| **P0** | [bds-p0-trien-khai.md](./2026-08-22-bds-p0-trien-khai.md) | BDS-01, BDS-20, BR-34 seed | 004 (tạo tenant), 062 nền |
| **P1** | [bds-p1-inventory-os.md](./2026-08-22-bds-p1-inventory-os.md) | import + `row_version` + lock | 010–012 |
| **P1b** | [bds-p1b-project-os.md](./2026-08-22-bds-p1b-project-os.md) | tòa/khu/đợt/`legal_gate` | 005–008 |
| **P2** | [bds-p2-hold-ttl.md](./2026-08-22-bds-p2-hold-ttl.md) | BDS-02, 03, 05, 06 | 013–016 |
| **P3** | [bds-p3-csbh.md](./2026-08-22-bds-p3-csbh.md) | BDS-12; activate `cdt_sales_dir` | 009 |
| **P4** | [bds-p4-transaction.md](./2026-08-22-bds-p4-transaction.md) | BDS-11, BDS-14 | 017–019, 021 |
| **P4b** | sau P4+P1b | BDS-31/32; phiếu thu | 020, 036–038 |
| **P5** | sau P2 | giỏ, hạng, F2, inhouse 404 | 014, 025–028, 060 |
| **P6** | sau P0 | `re_buyer`, 15p, Deal Room 404 | 003, 031–033 |
| **P7** | sau P4+P5 | statement ±0đ | 048–049 |
| **P8** | sau P5+P6+P1b | nav CĐT/sàn, ẩn Deal Room | 001–003, UX SCR |
| **P9** | sau P4b | checklist BG | 041–043 |
| **P10** | sau P2+P3 | TTL 180s war-room | 045–046 |
| **P11** | sau P0+P8 | room dept/cross, card, BDS-39 | 051–054 |
| **P12** | sau P0+P8 | queue, artifact done | 055–059 |

Demo **khóa căn:** P0–P2. Demo **phòng KD CĐT:** P1b+P4b+P5+P10. After = P9. SaaS đa CĐT = sau P8 + isolation test.

---

## 2. File map (khóa ranh giới)

```
services/ptt-crm-api/src/bds/                 # MỌI nghiệp vụ BĐS
  bds.module.ts
  bds.flags.ts
  industry-pack.ts
  tenant/                                     # P0
  org/                                        # P0 seed §25
  inventory/                                  # P1 + dual-write P0
  project-os/                                 # P1b
  holds/                                      # P2
  policies/                                   # P3
  transactions/                               # P4
  collection/                                 # P4b
  agencies/                                   # P5
  buyers/                                     # P6
  commission/                                 # P7
  launches/                                   # P10
  aftersales/                                 # P9
  reports/                                    # P8 hub

services/ptt-crm-api/src/staff-chat/          # P11 platform
services/ptt-crm-api/src/staff-tickets/       # P12 platform

services/ptt-crm-api/src/re-projects/         # KHÔNG xóa; ủy quyền inventory khi PACK=1
services/ptt-crm-api/src/leads-funnel/lead-flow-kind.util.ts   # + re_buyer
services/ptt-crm-api/src/app.module.ts        # import BdsModule (+ chat/tickets sau)

services/ops-web/src/app/crm/bds/             # P8+ UI
services/ops-web/src/app/crm/chat/            # P11
services/ops-web/src/app/crm/work/            # P12

docs/specs/postgresql-ddl-bds-p0.sql … p12.sql
scripts/apply_pg_ddl_bds_p0.sh …
scripts/backfill_bds_legacy_tenant.py
```

Cấm: nhét hold/TX vào `re-projects-sqlite.repository.ts` khi PACK ON. Cấm bảng B2B.

---

## 3. Việc từng pha (để viết plan con)

### P0 — Tenant + PG + org (đang có plan chi tiết)

`bds_tenants`, flag, guard 404, seed 12 phòng + vị trí, 5 user bắt buộc, `tenant_id` trên RE PG, dual-write, backfill `PTT-RE-LEGACY`, BDS-01/20.

### P1 — Inventory OS

`row_version` bigint, import CSV 409 trùng `unit_code`, `locked`, status + `reserved`, `pool`, `hold_id`. Service `BdsInventoryService`. Test BDS-07, 14, 16.

### P1b — Project OS

`bds_towers`, `bds_zones`, `bds_unit_layouts`, `bds_launch_phases`, `bds_legal_documents`, `legal_gate`, `bds_build_milestones`, `bds_plan_revisions`. `POST /phases/:id/open` → 400 `legal_gate`. Test BDS-21, 25, 29.

### P2 — Hold + TTL

`bds_holds`, job expire 5 phút, inhouse auto / F1 pending, `Idempotency-Key`. Test BDS-02, 03, 05, 06.

### P3 — CSBH

`bds_sales_policies`, activate chỉ `cdt_sales_dir`, snapshot giá đợt. Test BDS-12. BDS-33 HTTP = P4/P5.

### P4 — Transaction

`bds_transactions` stage reservation→deposit→vbtt→contracted (HĐMB API **chưa** enforce đủ BR-27 cho đến P4b — feature-flag `PTT_BDS_COLLECTION`). Convert `Idempotency-Key`. Hủy + căn available. Test BDS-11, 14. BDS-31/32 = P4b.

### P4b — Collection + cổng HĐMB

`bds_receipts`, aging, mortgages, `paid_pct`, BR-27/35. Test BDS-31, 32, 37.

### P5 — Agency OS

`bds_agencies`, tiers, baskets, contracts, F2 tree, one_price 400. Test BDS-04, 08, 17–23, 26, 28, 33–35.

### P6 — Buyer CRM

`resolveLeadFlowKind` + ingest `re_buyer`, board, visits, matching, 15 phút. Test BDS-07 (lead), 18. UC-003 Deal Room 404.

### P7 — Hoa hồng

schemes, ledger, statements ±0đ, clawback, CAPI hook. Test BDS-27. Không payroll.

### P8 — UI + RBAC

Nav UX §2, hub SCR-001, ẩn Deal Room, skin broker. Playwright: login CĐT vs sàn. Cap `bds_*`.

### P9 — After-sales

checklist, defect (không `crm_staff_tickets`), title_status. Test BDS-38.

### P10 — Launch

`bds_launches`, queue, TTL 180s, war-room poll. Test BDS-36.

### P11 — Staff chat

`crm_staff_rooms` seed 12+11, SSE, system card, BR-36…40. Test BDS-39–43.

### P12 — Staff tickets

queues §29.3, auto-create cùng handoff, `close_requires`. Test BDS-44–48.

---

## 4. Flag bật dần (staging)

| Thứ tự | Flag | Điều kiện |
|--------|------|-----------|
| 1 | `PTT_BDS_PG=1` | DDL P0 + backfill; đọc SQLite fallback |
| 2 | Soát BDS-20 | count căn SQLite = PG |
| 3 | Đọc PG, dừng write SQLite tồn kho | |
| 4 | `PTT_BDS_PACK=1` | một tenant CĐT |
| 5 | `PTT_BDS_PROJECT_OS` | cùng hoặc ngay sau PG |
| 6 | `PTT_BDS_HOLD_TTL` | mặc định 0; job no-op. Bật tay staging khi PACK=1 |
| 7 | `PTT_BDS_POLICY` | mặc định 0; CSBH routes 404. Bật sau P1b trên staging |
| 8 | `PTT_BDS_TX` | mặc định 0; TX routes 404. Bật khi PACK=1 + P2 + P3 |
| 9 | `PTT_BDS_AGENCY` | sau PROJECT_OS |
| 10 | `PTT_BDS_COLLECTION` | **chặn HĐMB prod** |
| 11 | `PTT_BDS_LAUNCH` · `CAPI` | theo demo |
| 12 | `PTT_STAFF_CHAT` · `PTT_STAFF_TICKETS` | sau nav P8 |

Rollback PACK=0: `/api/v1/bds/*` 404. Không xóa dữ liệu PG.

---

## 5. E2E Playwright (staging, sau P8+)

BDS-02, 04, 05, 13, 21, 22, 23, 31, 32, 39, 44. File dự kiến: `services/ops-web/e2e/bds/*.spec.ts`.

---

## 6. Việc cố ý không làm trong pack v1

eSign, CAD, app CTV store, cọc online, MLS, pack spa/edu/gym, gộp B2B OS, payroll từ ledger, voice/video chat, Jira sprint, ticket khách `/crm/tickets` cho CĐT.

---

## 7. Cách chạy

1. Duyệt spec (vẫn **Chờ duyệt** — user đã yêu cầu plan).  
2. Chạy **P0** theo file plan P0 (TDD).  
3. Khi P0 xanh + BDS-20 pass: plan P1 đã có; viết P1b (file riêng), rồi mới code.  
4. Lặp: plan pha → TDD → DoD test ID → pha sau.

**Không** bắt đầu P2 khi P1 hoặc P1b đỏ.
