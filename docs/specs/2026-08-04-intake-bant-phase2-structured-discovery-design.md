# Spec Phase 2 — Khảo sát BANT Intake: câu trả lời có cấu trúc + Stakeholder + Cam kết + Red flags

> **Document ID:** INT-P2-20260804  
> **Phiên bản:** 1.0 · **Ngày:** 2026-08-04  
> **Trạng thái:** Implemented  
> **Parent:** [`2026-08-04-intake-bant-phase1-professional-ui-design.md`](2026-08-04-intake-bant-phase1-professional-ui-design.md)

---

## 1. Tóm tắt

Phase 2 bổ sung **dữ liệu có cấu trúc** cho handoff Consult/Proposal, trên nền Phase 1:

- Ô trả lời ngắn **từng câu discovery** (key ổn định + confidence)
- **Red flags** checklist từ definitions
- **Ma trận stakeholder** (4 vai trò — cột DB sẵn có)
- **3 cam kết khách hàng** (cột DB sẵn có)
- Validate mở rộng + downstream recap/consult prefill

**Không mở:** form 12 `service_slug` riêng (giữ `_common`).

---

## 2. Schema `answers_json` (backward compatible)

```json
{
  "crm_fields": { "need": "<p>…</p>" },
  "discovery_checklist": {
    "mode": "phone",
    "checked": { "phone_budget": true, "phone_pain_point": true },
    "notes": "…"
  },
  "discovery_responses": {
    "phone_budget": {
      "asked": true,
      "answer": "15–25tr/tháng",
      "confidence": "confirmed"
    }
  },
  "red_flags": {
    "checked": { "rf_no_budget": true },
    "notes": "…"
  }
}
```

**Migration:** phiên Phase 1 dùng `checked["0"]` → UI migrate sang `question_key` khi load definitions v2.

**Cột riêng (PATCH):**

- `stakeholders_json`: `[{ role, role_label, name, title, influence, notes }]`
- `commitments_json`: `[{ label, detail, deadline }]`

---

## 3. Definitions API v2

`GET /api/crm/intake/definitions/_common` thêm:

| Field | Mô tả |
|-------|--------|
| `phone_question_items` | `{ key, text, critical? }[]` |
| `inperson_question_items` | idem |
| `red_flag_items` | `{ key, text }[]` |
| `schema_version` | `2` |

Giữ `phone_questions[]` string cho client cũ.

**Critical keys (phone):** `phone_pain_point`, `phone_budget`, `phone_decision_maker`  
**Critical keys (in_person):** `ip_pain_solutions`, `ip_budget_approved`, `ip_timeline`

---

## 4. UI sections

| Section | Component | Lưu |
|---------|-----------|-----|
| B. Discovery | `IntakeDiscoveryChecklist` | tick + answer + confidence |
| G. Red flags | `IntakeRedFlagsSection` | `answers_json.red_flags` |
| C. BANT | (Phase 1) | — |
| E. Stakeholder | `IntakeStakeholderMatrix` | `stakeholders_json` |
| F. Cam kết KH | `IntakeCommitmentsSection` | `commitments_json` |
| D. AI summary | (Phase 1) | — |

---

## 5. Validate Complete (bổ sung)

| Rule | Mức |
|------|-----|
| Câu critical đã tick nhưng thiếu answer | Warn |
| ≥2 red flags tick | Warn (+ warn riêng nếu decision=go) |
| Go nhưng thiếu tên Decision Maker | Warn |

Giữ nguyên rules Phase 1 (contact, decision, BANT, checklist count).

---

## 6. Downstream

| Bước | Dùng Phase 2 data |
|------|-------------------|
| Phone → in_person recap | `discovery_responses` snippets |
| Consult prefill hints | `discovery_responses` → `_extract_intake_keyword_hints` |
| Lead task merge | `crm_fields`, BANT (unchanged) |
| AI summary (future) | full `answers_json` |

---

## 7. Backlog delivered

| ID | Deliverable |
|----|-------------|
| INT-P2-01 | Definitions `question_key` + `red_flag_items` |
| INT-P2-02 | `discovery_responses` lib + migration index→key |
| INT-P2-03 | Checklist UI expand-on-check |
| INT-P2-04 | Red flags section |
| INT-P2-05 | Stakeholder matrix UI |
| INT-P2-06 | Commitments UI |
| INT-P2-07 | Validation + save patch |
| INT-P2-08 | Recap/consult bridge |
| INT-P2-09 | E2E `intake-bant-phase2.spec.ts` |

---

*Changelog: v1.0 — Phase 2 implementation (2026-08-04).*
