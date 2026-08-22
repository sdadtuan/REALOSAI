# GDKD Sign-off — CSKH Enterprise Wave E5 (Tuần 12)

**Client / cohort:** Spa Meta 24h (`spa_operational`)  
**Ngày review:** _______________  
**Window KPI:** _____ ngày · **Closed-loop window:** 30 ngày  
**Gate script:** `bash scripts/cskh_enterprise_e5_gate.sh` → ☐ PASS ☐ FAIL

**GDKD:** _________________________ · **Platform:** _________________________  
**Team Lead CSKH:** _______________ · **AI Product:** _____________________

---

## 8 KPI enterprise (target tuần 12)

Ghi snapshot từ `/crm/gdkd-enterprise` hoặc `GET /api/crm/gdkd-enterprise/kpi`.

| # | KPI | Target | Tuần này | Tuần trước | Trend | gate_pass | Ghi chú / action |
|---|-----|--------|----------|------------|-------|-----------|------------------|
| 1 | First call ≤15p | ≥85% | | | ☐ ↑ ☐ → ☐ ↓ | ☐ pass ☐ fail ☐ n/a | |
| 2 | B2 ≤4h | ≥80% | | | ☐ ↑ ☐ → ☐ ↓ | ☐ pass ☐ fail ☐ n/a | |
| 3 | Close ≤24h | ≥70% | | | ☐ ↑ ☐ → ☐ ↓ | ☐ pass ☐ fail ☐ n/a | |
| 4 | Breach backlog cuối ca | ≤0 | | | ☐ ↑ ☐ → ☐ ↓ | ☐ pass ☐ fail ☐ n/a | |
| 5 | Review queue max age | <24h | | | ☐ ↑ ☐ → ☐ ↓ | ☐ pass ☐ fail ☐ n/a | |
| 6 | Copilot DAU (pilot) | ≥60% | | | ☐ ↑ ☐ → ☐ ↓ | ☐ pass ☐ fail ☐ n/a | |
| 7 | NBA acceptance | ≥35% | | | ☐ ↑ ☐ → ☐ ↓ | ☐ pass ☐ fail ☐ n/a | |
| 8 | ROAS VND fill (chốt) | ≥90% | | | ☐ ↑ ☐ → ☐ ↓ | ☐ pass ☐ fail ☐ n/a | |

**Summary API:** pass _____ / fail _____ / n/a _____ (total 8)

---

## Wave delivery checklist

| Wave | Deliverable | Verified |
|------|-------------|----------|
| E0 | Home widgets + home-summary API | ☐ |
| E1 | Copilot rollout + NBA LLM primary | ☐ |
| E2 | SLA predict + SSE alerts + auto-task note | ☐ |
| E3 | Shift handoff + review queue LLM triage | ☐ |
| E4 | Score v2 feedback + playbook rank | ☐ |
| E5 | Enterprise gate + runbook + sign-off | ☐ |

---

## Ops habits confirmed

| Habit | Owner | Confirmed |
|-------|-------|-----------|
| Rep dùng Copilot hàng ngày (không auto-send) | CSKH Rep | ☐ |
| Team Lead handoff markdown cuối ca | Team Lead | ☐ |
| GDKD weekly KPI review + drill fail tiles | GDKD | ☐ |
| BR-AI-01: không auto-send khách | All | ☐ |

---

## Exceptions (nếu có KPI chưa đạt)

| KPI fail | Root cause | Remediation | ETA |
|----------|------------|-------------|-----|
| | | | |
| | | | |

---

## Sign-off

Tôi xác nhận đã review 8 KPI, runbook [cskh-enterprise-ops-runbook.md](../runbooks/cskh-enterprise-ops-runbook.md), và gate E5 trên môi trường staging/prod tương ứng.

| Vai trò | Họ tên | Chữ ký | Ngày |
|---------|--------|--------|------|
| GDKD | | | |
| Platform Lead | | | |
| Team Lead CSKH | | | |

**Release note (tuần 12):** CSKH Enterprise E0–E5 — home widgets, predictive SLA, shift handoff, LLM triage, score v2 feedback, playbook auto-rank, 8 KPI GDKD gate.
