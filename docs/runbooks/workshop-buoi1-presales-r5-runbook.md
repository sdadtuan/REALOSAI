# Runbook — Workshop Buổi 1: Pre-sales + R5 (90 phút)

> **Môi trường:** https://rs.pttads.vn  
> **Lead sandbox:** `#900000910` — [WORKSHOP B1] ABC Logistics B2B  
> **SOP đầy đủ:** [16-sales-solution-chot-deal-sop.md](../huong-dan-su-dung/16-sales-solution-chot-deal-sop.md) §8

---

## Chuẩn bị (IT / Trainer — trước buổi 30 phút)

| # | Việc | Lệnh / URL |
|---|------|------------|
| 1 | Flag bật | `PTT_PRESALES_ON_LEAD=1` trên VPS (đã bật) |
| 2 | Seed lead sandbox | `ssh deploy@rs.pttads.vn 'cd /var/www/rnosai && git pull && ./scripts/seed_workshop_buoi1_sandbox_lead.sh'` |
| 3 | Verify | `./scripts/verify_workshop_buoi1_sandbox.sh` |
| 4 | Tài khoản | AM + Solution có cap `crm_leads.view/edit`; Solution có `crm_presales_solution.view` |
| 5 | In treo | Bảng gates G0–G4 từ SOP §7 |

**Reset giữa các lớp:**

```bash
ssh deploy@rs.pttads.vn 'cd /var/www/rnosai && ./scripts/seed_workshop_buoi1_sandbox_lead.sh'
```

**Chuẩn bị sẵn tab Tư vấn (bỏ qua demo B2→Pre-sales):**

```bash
./scripts/seed_workshop_buoi1_sandbox_lead.sh --consult
WORKSHOP_MODE=consult ./scripts/verify_workshop_buoi1_sandbox.sh
```

---

## Lead sandbox

| Field | Giá trị |
|-------|---------|
| **Lead ID** | `900000910` |
| **URL** | https://rs.pttads.vn/crm/leads/900000910 |
| **R5 form** | Tab **Tư vấn** → `#funnel-presales-r5` |
| **Dịch vụ pilot** | `meta-lead-gen` (Meta Lead Gen B2B) |
| **Luồng** | `b2b_prospect` |
| **Trạng thái mặc định (reset)** | B2 ✓ · chưa Pre-sales |

---

## Kịch bản 90 phút (AM + Solution)

| Thời gian | Trainer làm gì | Học viên |
|-----------|----------------|----------|
| **0–15p** | Slides: 3 lớp MKT Plan (L1 R5 / L2 TMMT / L3 Ops) + RACI | Nghe + hỏi |
| **15–45p** | **Demo live** trên lead #900000910 | Quan sát |
| **45–75p** | Hướng dẫn form R5; giám sát | **Thực hành** điền R5 |
| **75–90p** | Q&A gates G0–G4; kiểm tra proposal-gate | Trình bày North Star 1 câu |

### Demo live (30p) — thứ tự click

1. Mở https://rs.pttads.vn/crm/leads/900000910 — xác nhận B2 đã ✓ (sau seed).
2. Panel Pre-sales → chọn **meta-lead-gen** → **Bắt đầu pre-sales**.
3. Tab **Lead** → hoàn thành task (hoặc Intake BANT — trainer có thể dùng link Khảo sát BANT trên stepper).
4. **Chuyển → Tư vấn** trên funnel stepper (xác nhận nếu Nurture/BANT thấp).
5. Tab **Tư vấn** → chỉ **giới thiệu** form R5 — **chưa điền hết** (để học viên làm).

### Thực hành R5 (30p) — gate G4

Học viên (Solution lead, AM hỗ trợ) điền **KH Marketing sơ bộ (R5)**:

| Field | Gợi ý nội dung (ABC Logistics) |
|-------|----------------------------------|
| Tên kế hoạch | Meta Lead Gen B2B — ABC Logistics Q4 |
| North Star | CPL ≤ 180k · 80 MQL/tháng · ROAS pipeline 3:1 |
| Mục tiêu chiến lược | Mở rộng lead DN vận tải HCM+HN; giảm lead rác 40% |
| Thông điệp thị trường | “Giải pháp logistics tin cậy — báo giá trong 2h” |
| Kênh tiếp cận | Meta Lead Ads + retargeting + landing A/B |
| Chiến lược chuyển đổi | Form 5 field · telesales SLA 15p · nurture email 7 ngày |

**Quy tắc AI:** bấm **AI draft** → **bắt buộc sửa tay** ≥ 2 field trước **Lưu**.

**Pass G4:** `GET .../presales/proposal-gate` → `gate.ok = true` (hoặc UI không còn validation đỏ trên form).

---

## RACI nhanh (treo phòng)

| Việc | AM | Solution | GDKD |
|------|:--:|:--------:|:----:|
| B2 / Intake | R | C | I |
| Pre-sales Lead tasks | R | C | I |
| R5 (L1) | C | **R** | I |
| Proposal / chốt | **R** | C | A (deal lớn) |

---

## Troubleshooting

| Triệu chứng | Xử lý |
|-------------|--------|
| Không thấy Pre-sales | Kiểm tra `PTT_PRESALES_ON_LEAD=1`; lead phải `b2b_prospect`; B2 chưa xong |
| Nút Pre-sales xám | Hoàn thành B2: báo cáo **Liên hệ OK** + ghi chú ≥ 3 ký tự |
| Không chuyển Consult | Hoàn thành task Lead + Intake completed; BANT Go hoặc confirm Nurture |
| R5 không lưu | Solution cap edit; kiểm tra 3 khối bắt buộc: market_message, media_reach, conversion_strategy |
| Lead “bẩn” sau lớp trước | Chạy lại `seed_workshop_buoi1_sandbox_lead.sh` |

---

## Sau buổi 1

- [ ] Thu 1 screenshot R5 đã lưu / proposal-gate pass (mỗi cặp AM+Solution)
- [ ] Ghi retro: field R5 nào hay kẹt → đưa vào Buổi 2 (chốt deal)
- [ ] Lên lịch Buổi 2 theo SOP §8 (role-play 45p chốt)
