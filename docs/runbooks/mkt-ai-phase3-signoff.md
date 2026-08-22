# MKT-AI Phase 3 — Walkthrough & PO sign-off

> **Staging:** https://rs.pttads.vn  
> **UAT actions:** [`10-MKTP-ACTIONS.md`](../use-cases/actions/10-MKTP-ACTIONS.md) (UC-019…021)  
> **API gate:** `./scripts/close_mkt_ai_p3_signoff.sh` · `./scripts/run_mkt_ai_p3_uat.sh`  
> **Export:** `docs/exports/mkt-ai-p3-signoff-*.md` (auto after P3 UAT pass)
> **GA slug rollout:** [`MKTP-UC-024`](../use-cases/actions/10-MKTP-ACTIONS.md#mktp-uc-024--ga-multi-slug-rollout-phase-4--ws-p4-01)  
> **SOP:** [`mkt-ai-planner-delivery-sop.md`](./mkt-ai-planner-delivery-sop.md)

---

## A. Ops checklist (trước walkthrough)

| # | Việc | Lệnh / bằng chứng | ✓ |
|---|------|-------------------|---|
| 1 | Seed 3 slug lifecycles | `./scripts/seed_mkt_ai_uat_lifecycle.sh` | ✓ auto |
| 2 | Flags 3 slug staging | `PTT_MKT_AI_PLANNER_SLUGS=meta-lead-gen,bds-lead-gen,seo-retainer` | ✓ auto |
| 3 | Multi-slug smoke | `./scripts/smoke_mkt_ai_multi_slug.sh` exit 0 | ✓ auto |
| 4 | P0 regression smoke | `LIFECYCLE_ID=1 ./scripts/smoke_mkt_ai_planner_context.sh` | ✓ auto |
| 5 | RBAC caps SP/AM | `./scripts/seed_mkt_ai_pilot_rbac.sh --apply` | ✓ auto |
| 6 | P3 API UAT UC-019…021 | `./scripts/run_mkt_ai_p3_uat.sh` exit 0 | ✓ auto |
| 7 | Login SP có cap `crm_mkt_ai.generate` | JWT / UI nút Sinh chiến lược enabled | PO manual |

**One-shot:**

```bash
cd /var/www/rnosai && source .env
./scripts/close_mkt_ai_p3_signoff.sh
```

**Seeded lifecycles (tags):**

| Slug | Tag | Lead ID |
|------|-----|---------|
| `meta-lead-gen` | `mkt-ai-smoke-seed` | 900000901 |
| `bds-lead-gen` | `mkt-ai-seed-bds` | 900000902 |
| `seo-retainer` | `mkt-ai-seed-seo` | 900000903 |

---

## B. Walkthrough UC-019 — Multi-agent pipeline

**Lifecycle:** meta `#___` · slug `meta-lead-gen` · stage `onboard`  
**Gate:** `PTT_MKT_AI_MULTI_AGENT_ENABLED=1`

| # | Gate | Pass | Người ký | Ghi chú |
|---|------|------|----------|---------|
| 1 | Mở step **Pipeline AI** | | | 4 agent chips |
| 2 | Brief hợp lệ + chọn playbook | | | |
| 3 | **Chạy pipeline AI** | | | Parent `multi_agent` + 4 child |
| 4 | Draft strategy/campaign/content đầy đủ | | | Tuần tự 4 bước |
| 5 | Job panel parent + child labels | | | |
| 6 | (Optional) Retry từ bước 3 | | | EC-MKT-AI-05 |
| 7 | Link trace admin | | | `/admin/ai/agents?plan=mkt_ai` |
| 8 | `GET multi-agent/status` | | | Step states OK |

---

## C. Walkthrough UC-020 — Industry playbook

**Lặp trên 3 slug** (meta, bds, seo) — xác nhận playbook dropdown + prefill khác nhau.

| # | Slug | Gate | Pass | Ghi chú |
|---|------|------|------|---------|
| 1 | meta-lead-gen | Áp dụng template Meta | | ABC Logistics brief |
| 2 | bds-lead-gen | Template BĐS | | Sunrise Residence · geo HN/BD/ĐN |
| 3 | seo-retainer | Template SEO | | objective awareness |
| 4 | (all) | Sinh chiến lược có playbook hints | | |
| 5 | (all) | Quality ≥70 → Launch QA 200 | | 409 nếu &lt;70 |
| 6 | (all) | Governance notes trên Brief | | 3 bullet BR-MKTP-01 |

---

## D. Walkthrough UC-021 — Governance banner

| # | Gate | Pass | Ghi chú |
|---|------|------|---------|
| 1 | Banner sticky mọi step AI Planner | | |
| 2 | Checkbox Quality gate trước Launch QA | | |
| 3 | Governance notes từ playbook JSON | | |
| 4 | Tab Launch QA — cùng banner + link Apply | | |
| 5 | Score &lt;70 → Launch QA disabled | | |
| 6 | Quality ≥70 → banner xanh | | |
| 7 | Context API `governance{}` block | | smoke OK |
| 8 | Smoke governance | | `smoke_mkt_ai_planner_context.sh` |

---

## E. EC-MKT-AI sign-off (PO)

| EC | Mô tả | API / script | Manual | PO |
|----|--------|--------------|--------|-----|
| EC-01 | Brief validation VI | PATCH brief | UC-020 step 1–3 | |
| EC-02 | 4 core prof after strategy | P0 UAT | UC-019 step 4 | |
| EC-03 | Apply → gate pass | P0 UAT | P0 sign-off step 16–17 | |
| EC-04 | Export audit + file OK | P0 UAT | P0 sign-off step 19 | |
| EC-05 | Retry giữ draft | multi-agent retry | UC-019 step 6 | |
| EC-06 | Playbook quality gate | Launch QA 409/200 | UC-020 step 5–6 | |
| EC-07 | Governance context block | multi-slug smoke | UC-021 step 7–8 | |

**BR-MKTP-01…08:** Verified ☐ · Regression P0 walkthrough ☐ · Multi-slug 3× context 200 ☐

---

## F. Chữ ký

| Vai trò | Họ tên | Ngày | Chữ ký |
|---------|--------|------|--------|
| Solution Lead | | | |
| PO / Product | | | |
| QA | | | |

**Git staging:** `________` · **Multi-slug smoke log:** attach terminal output

---

*Cập nhật sau khi PO ký — lưu bản scan/PDF vào `docs/exports/` nếu cần.*
