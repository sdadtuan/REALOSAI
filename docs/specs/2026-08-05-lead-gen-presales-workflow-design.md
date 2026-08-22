# Design: Template `lead-gen` — Pre-sales Workflow (Consult form)

> **Phiên bản:** 1.0 · **Ngày:** 2026-08-05  
> **Trạng thái:** Signed-off · **Shipped** in `crm_svc_workflow_steps.py` + Nest export  
> **Epic:** Consult Phase 2 — pilot slug Meta inbound (`#900000002`)  
> **Liên quan:** [Consult form matrix training](../exports/Consult_Form_Matrix_AM_Training.xlsx) · [Phase 2.5 funnel stepper](./2026-08-05-intake-bant-phase25-funnel-stepper-design.md)

---

## 1. Vấn đề

| Hiện trạng | Hệ quả |
|------------|--------|
| Catalog có slug `lead-gen` (default Meta ingest) | Presales seed **GENERIC_STEPS** (`consult_notes` 1 field) |
| Không có trong `SERVICE_WORKFLOW_STEPS` | AM không có form Consult chuẩn cho inbound chưa chọn DV |
| Prefill map thiếu | Intake Go + BANT không chảy vào task Consult |

---

## 2. Mục tiêu

1. Thêm slug **`lead-gen`** vào workflow engine (presales lead/consult/proposal).
2. Consult form **4 field** chuyên môn funnel performance.
3. **Prefill C2** từ Lead task + Intake khi **Chuyển → Tư vấn**.
4. Export Nest `presales-workflow-steps.data.json` (13 slug).

**Out of scope v1:** lifecycle JSON `onboard→retain` export (Python đã có stub cho promote sau).

---

## 3. Template `lead-gen`

### 3.1 Presales stages

| Stage | Task title | Form keys |
|-------|------------|-----------|
| **lead** | Tiếp nhận & qualify lead inbound | `niche`, `channel`, `need`, `budget`, `campaign_goal` |
| **consult** | Discovery funnel & kênh lead generation | `current_status`, `target_audience`, `conversion_metrics`, `scope_recommendation` |
| **proposal** | Draft proposal lead generation | `goal`, `timeline`, `budget` |

### 3.2 Prefill map (`get_crm_field_map`)

| Source (Lead/Intake) | Consult field |
|----------------------|---------------|
| `need` | `current_status` |
| `niche` | `target_audience` |
| `channel` | `current_status` (append label) |
| `budget` / `daily_budget` / `monthly_budget` | `conversion_metrics` |
| `campaign_goal` | `scope_recommendation` |

Auto khi `advance_presales_stage(..., consult)` (Python) và `advancePresales` (Nest).

### 3.3 Tài liệu L2 (AM)

Meta lead export, Ads account read, LP URL, CRM screenshot, spend 3 tháng.

---

## 4. Kiến trúc

```text
crm_svc_workflow_steps.py (lead-gen)
        │
        ▼
export_presales_workflow_steps.py
        │
        ▼
presales-workflow-steps.data.json ──► seedPresalesTasks()
        │
        ▼
crm_lead_presales_tasks (form_fields JSON)
```

**Prefill:**

```text
Intake completed + Lead task form_data
        │
        ▼
get_crm_field_map('lead-gen')
        │
        ▼
prefill_presales_consult_task / prefillPresalesConsultTaskForm
```

---

## 5. Migration lead đã có presales

`seedPresalesTasks` **không ghi đè** task đã seed.

| Tình huống | Hành động |
|------------|-----------|
| Presales mới `lead-gen` | Tự động 4 field Consult |
| Lead #900000002 (generic cũ) | AM điền tay hoặc admin xóa task non-custom → re-seed (pilot) |
| Sau deploy | Hard refresh ops-web · optional re-ensure presales trên lead pilot |

---

## 6. Definition of Done

- [x] `lead-gen` trong `crm_svc_workflow_steps.py` (7 stage Python)
- [x] `SERVICE_LABELS` Python + Nest
- [x] `get_crm_field_map` / `getCrmFieldMap` lead-gen
- [x] Prefill on advance Lead→Consult (Python + Nest)
- [x] Export `presales-workflow-steps.data.json` (13 services)
- [x] Tests Python + Nest
- [ ] Lifecycle JSON export (defer — promote lead-gen chưa pilot)

---

## 7. Tạo lại artifacts

```bash
python3 scripts/export_presales_workflow_steps.py
python3 scripts/generate_consult_runbook_appendix.py
python3 scripts/generate_consult_form_matrix_training.py
```

---

*PO: Quoc Tuan · 2026-08-05*
