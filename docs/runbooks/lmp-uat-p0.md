# Lead Meeting Prep — UAT P0 (S-LMP-2)

> **Mục tiêu:** 3 AM + 1 GDKD xác nhận panel prep đủ dùng trước cuộc gọi đầu (EC-LMP-01…12).  
> **Prerequisite:** `PTT_LEAD_MEETING_PREP_ENABLED=1`, worker chạy, `NEXT_PUBLIC_LEAD_MEETING_PREP=1`, quyền `crm_lmp.view` / `crm_lmp.run`.

---

## 1. Chuẩn bị

| Việc | Ai | Ghi chú |
|---|---|---|
| Tài khoản AM pilot có `crm_lmp.view` + `crm_lmp.run` | Ops | `python3 scripts/seed_staff_lmp_permissions.py` |
| Lead test có `company_name` trong meta | QA | VD Khang Thịnh Land |
| Staging/VPS API + ops-web bản S-LMP-2 | Eng | `bash scripts/deploy_lmp_s2_vps.sh --local` |

**Gate kỹ thuật (Eng):**

```bash
bash scripts/lead_meeting_prep_gate.sh
# E2E đầy đủ (worker + Tavily):
LMP_E2E=1 bash scripts/lead_meeting_prep_gate.sh
```

---

## 2. Kịch bản UAT — AM (15 phút / người)

### Bước A — Tạo lead mới

1. Đăng nhập ops-web → CRM → Tạo lead.
2. Nhập **Họ tên**, **SĐT**, **Tên công ty** (hoặc enrichment có `company_name`).
3. Lưu lead → mở chi tiết lead.

**Pass:** Tab **Chuẩn bị cuộc hẹn** hiển thị (desktop subtab hoặc mobile tab `prep`).

### Bước B — Theo dõi prep

1. Mở tab **Chuẩn bị cuộc hẹn**.
2. Quan sát stepper: Thu thập → Xác minh → Phân tích.
3. Chờ status **Sẵn sàng** (1,5–4 phút).

**Pass:**

- Không crash trang; polling tự cập nhật.
- Funnel chip prep (nếu có) mở đúng tab khi bấm.

### Bước C — Đọc nội dung trước gọi

1. Đọc **Chân dung doanh nghiệp** (facts có badge nguồn / suy luận).
2. Đọc **Đề xuất dịch vụ** (1–3 DV, lý do ngắn).
3. Đọc **Kịch bản mở đầu** + câu hỏi gợi ý.
4. Ghi nhận: có disclaimer “AM xác nhận trước khi trích dẫn”.

**Pass (EC-LMP-01…08):** AM hiểu được công ty làm gì, nên đề xuất DV nào, mở đầu thế nào — **không cần** tra Google thêm cho case đơn giản.

### Bước D — Entity picker (tuỳ chọn)

Nếu lead trùng tên nhiều DN:

1. Status **Chọn doanh nghiệp**.
2. Chọn 1 candidate → prep chạy tiếp → **Sẵn sàng**.

**Pass:** Chọn xong không cần F5; nội dung khớp DN đã chọn.

### Bước E — Chạy lại / lỗi

1. Bấm **Chạy lại** (nếu có quyền `crm_lmp.run`).
2. (Tuỳ chọn) Lead thiếu company → status skipped → nhập website → **Chạy prep**.

**Pass:** Không mất quyền; thông báo lỗi rõ nếu failed.

---

## 3. Kịch bản GDKD (5 phút)

1. Mở lead AM vừa test (read-only `crm_lmp.view`).
2. Xác nhận timeline có event **lead_meeting_prep_ready** (nếu bật timeline UI).
3. Xác nhận không thấy PII cá nhân liên hệ (contact profile luôn `found: false`).

---

## 4. Checklist ký (PO)

In hoặc copy [`lead-meeting-prep-acceptance-checklist.md`](../specs/lead-meeting-prep-acceptance-checklist.md) — mục P0.

| Người | Lead test | Ngày | Pass P0? | Ghi chú |
|---|---|---|---|---|
| AM 1 | | | ☐ | |
| AM 2 | | | ☐ | |
| AM 3 | | | ☐ | |
| GDKD | | | ☐ | |

---

## 5. Escalation

| Triệu chứng | Hướng xử lý |
|---|---|
| Tab prep không hiện | Kiểm tra `NEXT_PUBLIC_LEAD_MEETING_PREP=1` + rebuild ops-web |
| Prep mãi pending | `systemctl status ptt-worker`; `DATABASE_URL` trong unit |
| 403 API | Seed RBAC + đăng nhập lại |
| Gate E2E fail | `LMP_E2E=1` + log worker + `TAVILY_API_KEY` |
