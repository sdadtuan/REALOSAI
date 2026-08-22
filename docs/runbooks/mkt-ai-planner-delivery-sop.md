# MKT-AI Planner — Delivery SOP (S4 Polish / UAT sign-off)

> **Module:** AI Marketing Planner · **Parent:** SVC-UC-003, SVC-UC-011  
> **Staging:** https://rs.pttads.vn · **Repo:** `RNOSAI`  
> **UAT script:** [`10-MKTP-ACTIONS.md`](../use-cases/actions/10-MKTP-ACTIONS.md) · **API UAT:** `scripts/run_mkt_ai_planner_uat.sh`

---

## 1. Phạm vi P0

| UC | Mô tả |
|----|--------|
| MKTP-UC-001…010 | Wizard 5 bước, quality gate, apply TMMT, export PDF/DOCX/XLSX |
| EC-MKT-AI-01…05 | Brief VI, 4 core prof, apply gate, export audit, retry giữ draft |

**Không thay đổi:** SVC-UC-003 workflow gate (AM chuyển stage thủ công sau TMMT pass).

---

## 2. Flags & RBAC (bắt buộc trước pilot)

### 2.1 Environment

| Flag | Giá trị staging | File |
|------|-----------------|------|
| `PTT_MKT_AI_PLANNER_ENABLED` | `1` | `.env` / `deploy/runtime.env` |
| `PTT_MKT_AI_PLANNER_SLUGS` | `meta-lead-gen,bds-lead-gen,seo-retainer` | same |
| `PTT_MKT_AI_MULTI_AGENT_ENABLED` | `1` | same |
| `PTT_MKT_AI_PLAYBOOKS_ENABLED` | `1` | same |
| `PTT_MKT_AI_GOVERNANCE_BANNER` | `1` | same |
| `NEXT_PUBLIC_MKT_AI_PLANNER` | `1` | ops-web build env |

```bash
# Kickoff one-shot (VPS)
APPLY=1 ./scripts/deploy_mkt_ai_planner_staging.sh
```

### 2.2 RBAC caps (Solution Strategist pilot)

Gán qua Admin → Permissions hoặc SQL preset:

| Cap | Mục đích |
|-----|----------|
| `crm_mkt_ai.view` | Tab AI Planner |
| `crm_mkt_ai.generate` | Brief, jobs, apply |
| `crm_mkt_ai.export` | PDF/DOCX/XLSX |

**Blocker UAT thường gặp:** caps chưa gán → nút disabled (tooltip hiển thị lý do).

---

## 3. Deploy checklist

```bash
# 1. Pull
ssh deploy@rs.pttads.vn 'cd /var/www/rnosai && git pull --ff-only origin main'

# 2. DDL (lần đầu hoặc sau migration)
bash scripts/apply_pg_ddl_mkt_ai_planner.sh
bash scripts/verify_mkt_ai_ddl.sh

# 3. BE
cd services/ptt-crm-api && npm ci && npm run build
npm test -- --testPathPattern=marketing-ai
sudo systemctl restart ptt-crm-api

# 4. FE
./scripts/deploy_ops_web.sh
sudo ./scripts/deploy_ops_web.sh --restart

# 5. Smoke
PTT_CRM_INTERNAL_KEY=... LIFECYCLE_ID=1 bash scripts/smoke_mkt_ai_planner_context.sh
```

---

## 4. Seed UAT lifecycles (multi-slug · WS-P4-01)

```bash
export DATABASE_URL=postgresql://...
./scripts/seed_mkt_ai_uat_lifecycle.sh
# → meta (tag mkt-ai-smoke-seed), bds (mkt-ai-seed-bds), seo (mkt-ai-seed-seo)
bash scripts/smoke_mkt_ai_multi_slug.sh
```

| Slug | Tag | Lead |
|------|-----|------|
| `meta-lead-gen` | `mkt-ai-smoke-seed` | 900000901 |
| `bds-lead-gen` | `mkt-ai-seed-bds` | 900000902 |
| `seo-retainer` | `mkt-ai-seed-seo` | 900000903 |

Dùng lifecycle meta cho walkthrough P0 (21 bước); lặp UC-020 trên cả 3 slug. Phase 3 sign-off: [`mkt-ai-phase3-signoff.md`](./mkt-ai-phase3-signoff.md) · gate `./scripts/close_mkt_ai_p3_signoff.sh`.

---

## 5. UAT automation (API)

```bash
export DATABASE_URL=...
export PTT_CRM_INTERNAL_KEY=...   # hoặc ADMIN_PASSWORD
export LIFECYCLE_ID=1
./scripts/run_mkt_ai_planner_uat.sh
```

**Exit codes:** `0` pass · `1` fail · `2` blocked (apply 409 — thiếu official plan)

**Report:** `docs/exports/mkt-ai-uat-results-*.md`  
**Artifacts:** `.local-dev/mkt-ai-uat/`

**E1 retry branch:**

```bash
RUN_E1=1 ./scripts/run_mkt_ai_planner_uat.sh
```

---

## 6. Manual walkthrough (21 bước)

Chạy theo bảng trong [`10-MKTP-ACTIONS.md`](../use-cases/actions/10-MKTP-ACTIONS.md#walkthrough-uat--happy-path-onboard--tmmt-gate-45-ph).

### Tiêu chí sign-off

- [ ] 21 bước pass staging
- [ ] Gate TMMT xanh sau Apply (bước 16–17)
- [ ] Export PDF mở được, filename có client slug
- [ ] VQ-01…10 visual QA (§19 integration spec)
- [ ] EC-MKT-AI-01…05 pass API UAT script
- [ ] Không regression tab Workflow / TMMT chính thức
- [ ] SP + PO ký walkthrough

---

## 7. Visual QA (VQ) nhanh

| # | Check |
|---|--------|
| VQ-01 | Tab AI Planner cùng style với Workflow/TMMT |
| VQ-02 | Gate banner xanh/đỏ semantic |
| VQ-03 | Không hiển thị JSON raw |
| VQ-04 | Nút disabled có tooltip cap/stage |
| VQ-05 | Job panel không che footer CTA |
| VQ-06 | Apply modal diff đọc được ≥1024px |
| VQ-07 | `<768px` không vỡ layout (banner mobile) |
| VQ-08 | Token `var(--bg)`, `--border` đồng bộ TMMT |
| VQ-09 | Skeleton load, không flash error rỗng |
| VQ-10 | Label TMMT trùng tab TMMT chính thức |

---

## 8. Quality & export gates (BR-MKTP-05)

| Score | Apply | Export |
|-------|-------|--------|
| &lt;60 | Disabled | Blocked |
| 60–69 | Enabled (confirm) | DOCX only |
| ≥70 | Enabled | PDF + DOCX + XLSX |

Export trước Apply → watermark **DRAFT** trong file.

---

## 9. Rollback

```bash
# Tắt module (không xóa data)
PTT_MKT_AI_PLANNER_ENABLED=0
NEXT_PUBLIC_MKT_AI_PLANNER=0
sudo systemctl restart ptt-crm-api
sudo ./scripts/deploy_ops_web.sh --restart
```

DDL tables giữ nguyên — re-enable bằng flag `=1`.

---

## 10. Troubleshooting

| Triệu chứng | Nguyên nhân | Fix |
|-------------|-------------|-----|
| Tab ẩn | FE flag off | Rebuild ops-web `NEXT_PUBLIC_MKT_AI_PLANNER=1` |
| 404 context | BE flag off | `PTT_MKT_AI_PLANNER_ENABLED=1` + restart API |
| 403 slug | Pilot whitelist | Thêm `service_slug` vào `PTT_MKT_AI_PLANNER_SLUGS` |
| Apply 409 | Không có official plan | Promote presales R5 hoặc chạy seed script |
| Export lỗi binary | FE cũ | Deploy ops-web có `downloadMktAiExportFile` base64 |
| Quality &lt;60 | Brief/ICP thiếu | Hoàn thiện brief + ICP ≥80 ký tự + 2 kênh campaign |

---

## 11. Prod pilot (1 client · P4-01-T7)

Runbook: [`mkt-ai-prod-pilot-checklist.md`](./mkt-ai-prod-pilot-checklist.md)

```bash
export MKT_AI_PILOT_LIFECYCLE_ID=<real lifecycle>
APPLY=1 ./scripts/deploy_mkt_ai_planner_prod_pilot.sh
bash scripts/mkt_ai_prod_pilot_monitor.sh   # daily × 7 days
bash scripts/mkt_ai_prod_pilot_rollback.sh  # emergency
```

---

## 12. Phase 4 GA — ops monitoring & regression (WS-P4-06 · MKTP-UC-025)

Runbook: [`mkt-ai-planner-ga-rollout.md`](./mkt-ai-planner-ga-rollout.md)

```bash
export DATABASE_URL=postgresql://...
export PTT_CRM_INTERNAL_KEY=...   # hoặc ADMIN_PASSWORD
export LIFECYCLE_ID=1

# Full gate trước GA (P0 UAT + P1…P4 blocks + smokes)
./scripts/run_mkt_ai_planner_full_regression.sh

# Weekly ops report (fail rate + apply/gate ratio)
./scripts/report_mkt_ai_ops_weekly.sh
```

| Script | Output | Exit |
|--------|--------|------|
| `run_mkt_ai_planner_full_regression.sh` | orchestrates UAT + smokes | 0 pass |
| `report_mkt_ai_ops_weekly.sh` | `docs/exports/mkt-ai-ops-*.md` | 0 green · 2 SLO alert |
| `run_mkt_ai_planner_uat.sh` | extended §10–§16 P1…P4 | 0 / 1 / 2 |

Cron (prod/staging): `PTT_MKT_AI_OPS_WEEKLY_REPORT=1` — xem GA rollout runbook §3.1.

---

## 13. Liên kết

| Tài liệu | Path |
|----------|------|
| Integration spec | `docs/specs/2026-08-08-mkt-ai-planner-integration-spec.md` |
| Implementation plan | `docs/superpowers/plans/2026-08-08-mkt-ai-planner-module.md` |
| DDL | `docs/specs/2026-08-08-postgresql-ddl-mkt-ai-planner.sql` |
| Smoke | `scripts/smoke_mkt_ai_planner_context.sh` |
| Full regression | `scripts/run_mkt_ai_planner_full_regression.sh` |
| Ops weekly | `scripts/report_mkt_ai_ops_weekly.sh` |
| GA rollout | `docs/runbooks/mkt-ai-planner-ga-rollout.md` |
| Playbook ops | `docs/runbooks/mkt-ai-playbook-ops.md` |
| Verify playbooks | `scripts/verify_mkt_ai_playbooks.sh` |

---

*SOP v1.0 — cập nhật sau UAT walkthrough S4.*
