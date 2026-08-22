# Content Marketing OS — Trạng thái triển khai & Gap Analysis

> **Document ID:** CMKT-STATUS-20260809  
> **Phiên bản:** 1.0 · **Ngày cập nhật:** 2026-08-09  
> **Staging baseline:** `rs.pttads.vn` · git `356ce00` (M6 deployed)  
> **Spec canonical:** [`2026-08-09-content-marketing-os-design.md`](./2026-08-09-content-marketing-os-design.md) v1.5  
> **Kế hoạch thực thi tiếp:** [`../plans/2026-08-09-content-marketing-m7-m12-professionalization.md`](../plans/2026-08-09-content-marketing-m7-m12-professionalization.md)

---

## 1. Tóm tắt

| Khía cạnh | % ước lượng | Ghi chú |
|-----------|-------------|---------|
| Backend P0 (M0–M4) | **~90%** | Workflow, AI text, calendar, publish, audit API |
| Backend P1 (M5–M6) | **~75%** | Bridges + media flow; image provider **stub** (picsum) |
| Frontend UX vs integration spec | **~65%** | Dùng được E2E; thiếu diff, comments, intelligence, drag calendar |
| UAT formal ghi nhận | **Chưa PASS** | Smoke scripts có; manual 18+10 bước chưa sign-off repo |

**Moat đã có:** lifecycle hub + Planner ingest + dual approval (text/visual) + repurpose lineage + SEO/EM bridges.  
**Gap cạnh tranh:** Intelligence closed-loop, UX agency-grade, media production-grade, client gate.

---

## 2. Milestones đã ship (M0–M6)

| ID | Outcome | Commit ref | Smoke |
|----|---------|------------|-------|
| M0 | DDL + flags + `GET /context` | e5738a4 chain | `smoke_content_marketing_m0.sh` |
| M1 | Ideas, items, Board manual | 21059e9 | `smoke_content_marketing_m1.sh` |
| M2 | Planner snapshot ingest | eee35b3 | `smoke_content_marketing_m2.sh` |
| M3 | AI draft + variants + versions | e5738a4 | `smoke_content_marketing_m3.sh` |
| M4 | Review, calendar, publish, audit | cb304b1 | `smoke_content_marketing_p0.sh` |
| M5 | Repurpose, SEO/EM, production | 958c5e4 | `smoke_content_marketing_p1.sh` |
| M6 | Media AI + visual gates | 356ce00 | `smoke_content_marketing_p2_media.sh` |

---

## 3. Ma trận UC (CMKT-UC-001…038)

**Chú thích:** ✅ Done · ⚠️ Partial · ❌ Missing

| UC | Tên | Phase | TT | Gap chính |
|----|-----|-------|-----|-----------|
| 001 | Mở Content Board | P0 | ✅ | — |
| 002 | Ingest Planner | P0 | ✅ | Deep link Planner→Content chưa |
| 003 | Pillars mirror | P0 | ⚠️ | Không UI pillar CRUD |
| 004 | Idea bank | P0 | ⚠️ | Thiếu tag/filter pillar |
| 005 | AI 30 ideas | P1 | ❌ | Job `ideas_bulk` chưa |
| 006 | Tạo item | P0 | ⚠️ | Thiếu + Item modal SCR-011 |
| 007 | AI draft | P0 | ✅ | — |
| 008 | Variants ≥3 | P0 | ✅ | — |
| 009 | Tone/length | P0 | ✅ | — |
| 010 | Regenerate | P0 | ⚠️ | Không endpoint/UI regenerate riêng |
| 011 | Calendar | P0 | ⚠️ | Form schedule; không drag grid |
| 012 | Kanban | P0 | ✅ | Thiếu badge màu status |
| 013 | Assign SP/QA | P0 | ❌ | API filter có; UI chưa |
| 014 | Approve/reject | P0 | ⚠️ | Thiếu diff + confirm modal |
| 015 | Client gate | P1 | ❌ | Flag có; workflow chưa |
| 016 | Comments | P0 | ⚠️ | Insert khi reject visual; không thread UI |
| 017 | Version diff | P0 | ⚠️ | List only |
| 018 | Repurpose | P1 | ✅ | — |
| 019 | SEO bridge | P1 | ⚠️ | Chưa poll URL sync ngược |
| 020 | Email bridge | P1 | ⚠️ | Client UUID thủ công |
| 021 | Mark published | P0 | ✅ | Visual gate M6 OK |
| 022 | Manual metrics | P1 | ❌ | Bảng có; UI chưa |
| 023 | Intelligence | P1 | ❌ | View chưa |
| 024 | Suggest topics | P2 | ❌ | — |
| 025 | Drift alert | P2 | ⚠️ | Banner; diff modal mỏng |
| 026 | Weekly memo | P2 | ❌ | — |
| 027 | Export PDF | P1 | ⚠️ | Text export only |
| 028 | Audit | P0 | ⚠️ | API; không tab FE |
| 029 | AI fallback | P0 | ⚠️ | Stub BE; thiếu Retry UX |
| 030 | Portal summary | P2 | ❌ | — |
| 031 | Assign designer | P1 | ⚠️ | Text staff id |
| 032 | Export design brief | P1 | ⚠️ | Markdown/text |
| 033 | Production phase | P1 | ✅ | — |
| 034 | Link Creatives | P1 | ⚠️ | API có; UX mỏng |
| 035 | AI image/carousel | P1 | ⚠️ | Flow OK; stub provider |
| 036 | Short video | P2 | ❌ | — |
| 037 | Visual QA | P1 | ⚠️ | Rule score; chưa OCR/ΔE |
| 038 | Escalate Design | P1 | ✅ | — |

**Thống kê:** ✅ 11 · ⚠️ 19 · ❌ 8 (trên 38 UC)

---

## 4. Business rules

| Rule | Trạng thái |
|------|------------|
| BR-CMKT-01 publish after approve | ✅ |
| BR-CMKT-02 no auto-post | ✅ |
| BR-CMKT-06 media after copy approved | ✅ |
| BR-CMKT-08 visual before publish | ✅ M6 |
| BR-AI-01 human-in-the-loop | ✅ |
| BR-CMKT-03 brief incomplete modal | ❌ → M8 |
| BR-CMKT-04 PII consent lifecycle | ❌ → M11 |

---

## 5. UX / SCR-CMKT vs thực tế

| SCR | Spec | TT | Ghi chú |
|-----|------|-----|---------|
| 001 Shell | P0 | ⚠️ | Chưa `?view=` URL sync |
| 001a Overview | P0 | ⚠️ | KPI strip cơ bản |
| 001b Ideas | P0 | ✅ | |
| 001c Calendar | P0 | ⚠️ | Không drag-drop |
| 001d Board | P0 | ⚠️ | Thiếu badge + dual gate chip |
| 002 Drawer | P0 | ✅ | |
| 003 Generate | P0 | ✅ | |
| 004 Repurpose | P1 | ✅ | |
| 005 Intelligence | P1 | ❌ | M10 |
| 006 Comments | P0 | ❌ | M8 |
| 007 Review | P0 | ✅ | Visual filter M6 |
| 008 Media AI | P1 | ⚠️ | UI OK; stub assets M9 |
| 009 Production | P1 | ✅ | |
| 010 Banner | P0 | ⚠️ | Drift modal mỏng M11 |
| 011 Channel picker | P0 | ⚠️ | Dropdown; chưa modal matrix |
| 012 Bridge chips | P1 | ✅ | |

**EC-CMKT-UX chưa đạt:** EC-04 (retry UX), EC-07 (publish gate toast), EC-08 (deep link import).

---

## 6. Roadmap milestone tiếp (M7–M12)

| Milestone | Tuần | Mục tiêu | UC / SCR chính |
|-----------|------|----------|----------------|
| **M7** | 1–2 | P0 sign-off + UX polish core | 012, 028, EC-UX-07/08 |
| **M8** | 2–3 | Governance (assign, comments, diff) | 013, 016, 017, 014 |
| **M9** | 3–4 | Media production-grade | 035, 037, EC-MEDIA-01/03/06 |
| **M10** | 4–6 | Intelligence closed-loop | 022, 023, SCR-005 |
| **M11** | 6–8 | Planner glue + export PDF | 002, 003, 005, 027, 019 |
| **M12** | 8–12 | P2 client gate + video | 015, 030, 036 |

Chi tiết task: [`../plans/2026-08-09-content-marketing-m7-m12-professionalization.md`](../plans/2026-08-09-content-marketing-m7-m12-professionalization.md)

---

## 7. Lợi thế cạnh tranh — hành động ưu tiên

| # | Hành động | Thắng ai |
|---|-----------|----------|
| 1 | Real image + CDN + audit provider | Jasper, Copy.ai (text-only) |
| 2 | Intelligence + metrics trong lifecycle | Copy.ai (no ROI loop) |
| 3 | UX dual-gate + diff + drag calendar | HubSpot workflow clarity |
| 4 | Assign/RACI + comments + audit tab | Freelancer AI tools |
| 5 | Client gate + portal | Agency retainer B2B PTT |

---

*Cập nhật file này sau mỗi milestone M7+ khi smoke PASS và PO sign-off.*
