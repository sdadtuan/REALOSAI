# Video SOP — Runbook vận hành (Module 7)

Tài liệu xử lý 6 sự cố thường gặp trên pipeline Video chiến dịch (cinematic). Không thay thế monitoring — dùng khi on-call hoặc smoke fail.

## 1. Provider down (Leonardo / Kling / FFmpeg)

**Triệu chứng:** Job `failed`, `error_class=transient` hoặc `auth`; log adapter timeout.

**Kiểm tra:**
```bash
curl -sf http://127.0.0.1:3000/health
bash scripts/smoke_video_sop_s2.sh
journalctl -u ptt-crm-api -n 80 --no-pager | rg -i 'leonardo|kling|ffmpeg|vd'
```

**Hành động:**
- Xác nhận key trong `.env` (`LEONARDO_API_KEY`, `KLING_*`, `PTT_VD_TOPAZ_API_KEY`).
- Retry job qua UI hoặc `POST /api/v1/vd/projects/:id/jobs` với idempotency-key mới.
- Nếu provider outage kéo dài: tạm dừng enqueue motion và thông báo PM.

## 2. Hết credit (BR-06)

**Triệu chứng:** Enqueue 400 `budget_exceeded`; SC-11 Cost cảnh báo ≥70/90/100%.

**Kiểm tra:**
```bash
bash scripts/smoke_video_sop_s7.sh
```

**Hành động:**
- PM tăng `limit_amount` trên `/crm/video/{id}/cost`.
- Export Excel khi đóng project.

## 3. Webhook / poller chết

**Triệu chứng:** Job kẹt `queued` / `running` lâu.

**Kiểm tra:**
```bash
sudo systemctl status ptt-crm-api
journalctl -u ptt-crm-api -n 100 | rg 'VdPoller'
```

**Hành động:** `sudo systemctl restart ptt-crm-api`

## 4. DAG post treo (BR-09)

**Triệu chứng:** SC-09 Post — node `running` không đổi.

**Kiểm tra:** `bash scripts/smoke_video_sop_s8.sh`

**Hành động:** Re-enqueue compose; skip Topaz nếu không có key.

## 5. Storage đầy

**Triệu chứng:** Asset / zip fail; disk alert.

**Kiểm tra:** `df -h /var/www/rnosai`

**Hành động:** Prune releases; archive assets; pause enqueue.

## 6. Model deprecated

**Triệu chứng:** Job fail capability mismatch.

**Kiểm tra:** `/admin/video/providers`

**Hành động:** Cập nhật `vd_models` / capability_json; re-run shots.

---

## Dual studio (AC-R1)

```bash
bash scripts/smoke_video_sop_dual.sh
```

## Production dashboard (SC-16)

```bash
bash scripts/smoke_video_sop_s10.sh
```

UI: `/crm/video/dashboard?lifecycle_id=3`

## E2E stub vs live (AC-11)

- Mặc định: `OK Video SOP S10 stub`
- Live: `VD_E2E_PROVIDERS=1` + API keys (staging only)
