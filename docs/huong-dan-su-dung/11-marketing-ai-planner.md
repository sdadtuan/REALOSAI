# Hướng dẫn — Marketing AI Planner

> **Module:** MOD-MKTP  
> **Đối tượng:** Solution Strategist (SP), AM, MKT Lead  
> **Route:** `/crm/service-delivery/[id]?tab=ai-planner`  
> **Flags:** `PTT_MKT_AI_PLANNER_ENABLED=1`, `NEXT_PUBLIC_MKT_AI_PLANNER=1`

---

## 1. Giới thiệu

AI Planner giúp SP hoàn **TMMT (kế hoạch marketing chính thức)** qua wizard 5 bước: Brief → Strategy → Campaign → Content calendar → Apply. **Human-in-the-loop** — Apply mới ghi TMMT (BR-MKTP-01).

**Điều kiện:** Lifecycle stage ≥ **Onboard**; cap `crm_mkt_ai.view`, `crm_mkt_ai.generate`.

---

## 2. Mở AI Planner

1. `/crm/service-delivery/[id]`
2. Tab **AI Planner**
3. Banner **Gate TMMT** — đỏ (thiếu field) / xanh (pass)
4. Stepper 5 bước — bước 1 Brief active

Tab ẩn nếu stage quá sớm hoặc flag tắt.

---

## 3. Bước 1 — Brief intake

1. Review **prefill** từ consult (brand, budget, mục tiêu)
2. Sửa các field:
   - **Ngân sách tháng** (VND)
   - **Mục tiêu** (Lead / Brand / …)
   - **Thách thức**, **Đối thủ**, **Kênh ưu tiên**
3. Autosave — toast "Đã lưu"
4. Validation lỗi hiển thị **tiếng Việt**
5. **Tiếp tục →** khi brief hợp lệ

---

## 4. Bước 2 — Chiến lược AI

1. Bấm **Sinh chiến lược AI**
2. Job async (~30–60s) — spinner + job panel
3. Kết quả: ICP, persona, pain points, positioning
4. **Sửa tay** từng section — draft lưu local
5. **Thử lại** nếu job failed — draft bước trước **không mất**
6. **Tiếp tục →**

---

## 5. Bước 3 — Chiến dịch AI

1. Bấm **Sinh chiến dịch AI**
2. ≥ 2 campaign cards (kênh, budget split, KPI)
3. Sửa/xóa campaign không phù hợp
4. **Tiếp tục →**

---

## 6. Bước 4 — Lịch nội dung

1. Review **calendar 30 ngày** — chips theo ngày
2. Sửa title/format từng slot
3. **Tiếp tục →**

---

## 7. Bước 5 — Apply TMMT

1. Xem **Quality score** (mục tiêu ≥ 60, khuyến nghị ≥ 70)
2. Preview tổng hợp 4 bước
3. Tick **"Tôi đã review nội dung"**
4. Bấm **Apply vào TMMT** → confirm
5. Toast success — Gate banner → **xanh**
6. Tab **TMMT** — verify fields đồng bộ
7. **Export PDF/DOCX** kế hoạch (cap export)

**Sau Apply:** AM có thể **Chuyển → Triển khai (Deliver)** trên tab Workflow nếu gate TMMT pass.

---

## 8. Budget simulator (P1)

1. Bước 3 hoặc panel phụ — mở simulator
2. Kéo slider budget theo kênh
3. Xem CPL/lead ước tính
4. Apply scenario vào draft campaign

---

## 9. KPI closed-loop (P2)

Khi `PTT_MKT_AI_KPI_ALERT_ENABLED=1`:

- Hệ thống so sánh KPI thực tế (Ops/Meta) vs plan
- Alert drift CPL/ROAS trên hub
- **Optimize copilot** gợi ý điều chỉnh (human quyết định)

---

## 10. Portal plan summary

Khách xem tóm tắt kế hoạch (read-only) trên dashboard nếu `PTT_MKT_AI_PORTAL_SUMMARY=1`.

---

## 11. Walkthrough UAT (45 phút)

| Bước | Kết quả |
|------|---------|
| Brief đầy đủ | Autosave OK |
| Sinh strategy + campaign + calendar | Jobs succeeded |
| Quality ≥ 70 | Apply enabled |
| Apply TMMT | Gate xanh |
| AM advance Deliver | Stage update |

Chi tiết 21 bước: [`docs/use-cases/actions/10-MKTP-ACTIONS.md`](../use-cases/actions/10-MKTP-ACTIONS.md)

---

## 12. Lỗi thường gặp

| Vấn đề | Xử lý |
|--------|-------|
| Apply disabled | Quality < 60 — bổ sung brief/strategy |
| Job failed | Retry; kiểm tra OPENAI_API_KEY |
| Fallback banner | Rule-based draft khi thiếu API key |
| Gate TMMT vẫn đỏ | Tab TMMT — field bắt buộc thiếu |

---

## 13. Tài liệu tham chiếu

- Spec: [`docs/specs/2026-08-08-mkt-ai-planner-integration-spec.md`](../specs/2026-08-08-mkt-ai-planner-integration-spec.md)
- Use case: [`docs/use-cases/10-MKT-AI-PLANNER.md`](../use-cases/10-MKT-AI-PLANNER.md)
