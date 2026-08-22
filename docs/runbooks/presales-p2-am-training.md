# Training nhanh — Presales P2 (AM B2B)

**Thời lượng:** ~30 phút · **Đối tượng:** AM pilot Meta inbound (`lead-gen`)  
**SOP chi tiết:** [consult-stage-am-sop.md](./consult-stage-am-sop.md) §10  
**Spec:** [2026-08-05-presales-p2-ecosystem-design.md](../specs/2026-08-05-presales-p2-ecosystem-design.md)

---

## 1. Tab Tư vấn (E1)

- Hiện khi lead có **presales** và stage ∈ **consult | proposal**
- Desktop: **Tổng quan | Tư vấn** · Mobile: tab **Tư vấn**
- Workspace: Brief · L2 · task Consult · sticky **Prefill · AI · Tạo Proposal**
- R5 preview **read-only** trên tab Tư vấn — chỉnh field trên **Tổng quan**

---

## 2. Template 4 field (E2)

Sau Ops batch, task Consult `lead-gen` có **4 field** (không còn 1 field `consult_notes`).

- Task đã ✓ **trước batch** có thể thiếu field mới → AM **điền bổ sung** trước Proposal
- Ops chạy batch **off-hours** — AM **không** tự migrate

---

## 3. Metrics — đừng nhầm 7d vs 48h (E5)

| Label | Ý nghĩa |
|-------|---------|
| **Consult → BG ≤48h** | SLA vận hành (sau meeting) |
| **Consult → BG ≤7 ngày** | KPI agency (target 50% pilot) |
| **Go → Consult median** | Thời gian intake Go → vào Consult |

Xem card trên **`/crm/leads/b2b`** và KPI AM trên **`/crm/staff-kpi`**.

---

## 4. Quy trình Consult (nhắc lại)

1. Đọc Brief + Intake Go  
2. Thu L2 checklist  
3. Prefill → điền form → AI Hỗ trợ  
4. Tick ✓ task Consult  
5. **Chuyển → Báo giá** trong **48h**

---

## 5. Escalation

| Tình huống | Liên hệ |
|------------|---------|
| Tab Tư vấn không hiện | Ops — kiểm tra presales stage |
| Batch xong thiếu field | AM bổ sung form; báo Ops nếu lỗi template |
| Metrics = 0 | Cohort chưa có consult/proposal trong kỳ |

---

## 6. E3 — không thuộc P2

Stepper **full B2B bar** song song presales — **chưa** gộp trong sprint này. PO sẽ trigger riêng.

---

*S4 training · kèm [presales-p2-am-signoff.md](../templates/presales-p2-am-signoff.md) sau 2 tuần vận hành*
