# MKT-AI P0 Pilot — Walkthrough & PO sign-off

> **Staging:** https://rs.pttads.vn  
> **UAT actions:** [`10-MKTP-ACTIONS.md`](../use-cases/actions/10-MKTP-ACTIONS.md)  
> **API gate:** `./scripts/close_mkt_ai_p0_pilot.sh`  
> **SOP:** [`mkt-ai-planner-delivery-sop.md`](./mkt-ai-planner-delivery-sop.md)

---

## A. Ops checklist (trước walkthrough)

| # | Việc | Lệnh / bằng chứng | ✓ |
|---|------|-------------------|---|
| 1 | Seed lifecycle + official plan | `./scripts/seed_mkt_ai_uat_lifecycle.sh` | |
| 2 | RBAC caps SP/AM | `./scripts/seed_mkt_ai_pilot_rbac.sh --apply` | |
| 3 | API UAT 0 BLOCKED | `./scripts/run_mkt_ai_planner_uat.sh` exit 0 | |
| 4 | Smoke context | `./scripts/smoke_mkt_ai_planner_context.sh` | |
| 5 | Login SP có cap `crm_mkt_ai.generate` | JWT / UI nút Sinh chiến lược enabled | |

**One-shot:**

```bash
cd /var/www/rnosai && source .env
./scripts/close_mkt_ai_p0_pilot.sh
```

---

## B. Walkthrough 21 bước (manual)

**Actors:** Solution Strategist (SP), AM (observer), QA  
**Lifecycle:** `#___` · slug `meta-lead-gen` · stage `onboard`

| # | Gate | Pass | Người ký | Ghi chú |
|---|------|------|----------|---------|
| 1 | Login + cap generate | | | |
| 2 | Mở service-delivery card | | | |
| 3 | Tab AI Planner + gate banner | | | |
| 4 | Brief prefill | | | |
| 5 | Autosave brief | | | |
| 6 | Tiếp tục → Strategy | | | |
| 7 | Sinh chiến lược AI | | | |
| 8 | 4 core prof filled (EC-02) | | | |
| 9 | Sửa draft + autosave (UC-006) | | | |
| 10 | Tiếp tục → Campaign | | | |
| 11 | Sinh chiến dịch ≥2 cards | | | |
| 12 | Tiếp tục → Content | | | |
| 13 | Lịch 30 ngày | | | |
| 14 | Tiếp tục → Apply | | | |
| 15 | Quality ≥70 | | | |
| 16 | Apply TMMT + modal | | | |
| 17 | Gate banner xanh (EC-03) | | | |
| 18 | Tab TMMT đồng bộ draft | | | |
| 19 | Export PDF download | | | |
| 20 | AM: Workflow → Deliver | | | SVC-UC-003 |
| 21 | QA: `mkt_ai_jobs` ≥4 succeeded | | | |

**Nhánh E1 (optional):** Job campaign fail → Thử lại → strategy draft còn (EC-05).

---

## C. Visual QA (VQ-01…10)

| # | Check | Pass | Ghi chú |
|---|-------|------|---------|
| VQ-01 | Tab AI Planner align 5 tabs | | |
| VQ-02 | Gate banner semantic màu | | |
| VQ-03 | Không JSON raw UI | | |
| VQ-04 | Cap-disabled tooltip | | |
| VQ-05 | Job panel không che CTA | | |
| VQ-06 | Apply modal diff ≥1024px | | |
| VQ-07 | Mobile không vỡ layout | | |
| VQ-08 | Dark tokens đồng bộ TMMT | | |
| VQ-09 | Skeleton load, không flash error | | |
| VQ-10 | Label TMMT trùng tab chính thức | | |

---

## D. EC-MKT-AI sign-off (PO)

| EC | Mô tả | API UAT | Manual | PO |
|----|--------|---------|--------|-----|
| EC-01 | Brief validation VI | PATCH brief | Step 5–6 | |
| EC-02 | 4 core prof after strategy | ✓ script | Step 8 | |
| EC-03 | Apply → gate pass | ✓ script | Step 16–17 | |
| EC-04 | Export audit + file OK | ✓ script | Step 19 | |
| EC-05 | Retry giữ draft | RUN_E1=1 | E1 branch | |

**BR-MKTP-01…08:** Verified ☐ · Regression SVC-UC-003 ☐

---

## E. Chữ ký

| Vai trò | Họ tên | Ngày | Chữ ký |
|---------|--------|------|--------|
| Solution Lead | | | |
| PO / Product | | | |
| QA | | | |

**Git staging:** `________` · **Report UAT:** `docs/exports/mkt-ai-uat-results-*.md`

---

*Cập nhật sau khi PO ký — lưu bản scan/PDF vào `docs/exports/` nếu cần.*
