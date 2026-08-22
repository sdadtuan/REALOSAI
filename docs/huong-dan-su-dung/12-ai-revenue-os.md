# Hướng dẫn — AI Revenue OS

> **Module:** MOD-AI  
> **Đối tượng:** CSKH, Sales, AM, Manager, GDKD  
> **URL:** https://rs.pttads.vn/crm/ai/* · `/crm/automation` · `/crm/playbooks`

---

## 1. Giới thiệu

AI Revenue OS bổ sung **scoring, copilot, coach, automation, playbooks** lên CRM và channel — hỗ trợ quyết định, không thay thế con người.

**Bật module:** `PTT_AI_INTELLIGENCE_ENABLED=1`, `NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=1`

---

## 2. AI Copilot trên Lead

**Route:** `/crm/leads/[id]` — panel Copilot (sidebar/tab)

### CSKH hàng ngày

1. Mở lead detail
2. Panel **Copilot** — xem **Lead brief** tóm tắt AI
3. **Summarize activity** — timeline gọn
4. **Draft follow-up** — email/SMS draft
5. **Review draft** → sửa → **Approve send** (không auto-send)
6. Xem **Lead score** + explainability (factor weights)

### Manager override score

1. Manager mở lead score panel
2. **Override** — nhập lý do bắt buộc
3. Audit ghi nhận override

---

## 3. AI Insights

**Route:** `/crm/ai/insights`

1. Dashboard lead scoring aggregate
2. Filter segment hot/warm/cold
3. Anomaly leads — score thay đổi đột biến
4. Drill → lead detail

---

## 4. NL Analytics Query

**Route:** `/crm/ai/query`

1. Nhập câu hỏi tiếng Việt (VD: "Lead Meta tháng 7 CPL bao nhiêu?")
2. AI trả lời curated — chỉ dataset được phép
3. Link drill tới báo cáo nguồn
4. Không thay thế BI chính thức — dùng hỏi nhanh

---

## 5. Manager Coach

**Route:** `/crm/ai/coach`

1. **Weekly digest** — pipeline risk, deals stalled
2. **NBA** (Next Best Action) trên deal
3. Smart reminders — follow-up quá hạn
4. GDKD filter theo team

---

## 6. Automation Workflows

**Route:** `/crm/automation`

1. **+ Workflow** — trigger: lead status change, score threshold, …
2. Thêm actions: assign, notify, tag, **AI node** (simulate trước)
3. **Publish** workflow — active
4. Monitor run history

**AI node:** Simulate output → human approve trước production (BR-AI).

---

## 7. Playbooks (RAG)

**Route:** `/crm/playbooks`

1. Browse playbook theo ngành/scenario
2. Search semantic — "xử lý lead BĐS không trả lời"
3. Xem steps + scripts gợi ý
4. Apply vào lead note/activity

Admin quản lý registry: `/admin/ai/agents`

---

## 8. Agents backend (tự động)

| Agent | Khi nào chạy | User thấy gì |
|-------|--------------|--------------|
| Lead scoring | Sau lead ingest | Score trên lead |
| Renewal | Trước hạn HĐ | Alert AM / hub |
| Churn | Health score drop | CSKH board flag |
| Upsell | Cross-sell signal | Recommendation panel |
| Forecast | Cuối tháng | `/crm/forecast` |

Tra audit: `/admin/ai/runs`

---

## 9. Portal AI Reports

**API/Portal:** `/api/v1/portal/ai` — summary read-only cho client (nếu bật trong HĐ).

---

## 10. Luồng CSKH với Copilot

```
Lead mới → Copilot brief → Call log → Draft follow-up
    → Approve gửi → Cập nhật B2 → Score refresh
```

---

## 11. Lỗi thường gặp

| Vấn đề | Xử lý |
|--------|-------|
| Copilot trống | Flag off; lead thiếu activity |
| Score không có | Job async delay — refresh 1 phút |
| Query sai số | Verify bằng báo cáo gốc |
| Workflow AI fail | `/admin/ai/runs` — error detail |

---

## 12. Tài liệu tham chiếu

- Actions: [`docs/use-cases/actions/09-AI-ACTIONS.md`](../use-cases/actions/09-AI-ACTIONS.md)
- Use case: [`docs/use-cases/09-AI-REVENUE-OS.md`](../use-cases/09-AI-REVENUE-OS.md)
