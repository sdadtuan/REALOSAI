# M2 Portal PWA — Staging cutover checklist (RNOS-M2)

> **Host:** `https://portal.pttads.vn` (staging pilot trên VPS prod host)  
> **Script VPS:** `scripts/m2_portal_pwa_staging_cutover.sh` (on-box) · `scripts/m2_portal_pwa_staging_cutover_vps.sh` (SSH từ laptop)  
> **Song song M1+M2:** `scripts/m1_m2_mobile_parallel_cutover_vps.sh` — **M2 chạy trước** (Approver)  
> **Env template:** `deploy/env.staging-m2-portal-pwa-vps.example`

---

## 0. Cutover từ laptop (SSH → VPS `45.76.157.102`)

Code M2 **chưa push git** → bắt buộc `LOCAL_SYNC=1`.

```bash
cd /path/to/RNOSAI

# Chỉ M2 (Approver ưu tiên)
LOCAL_SYNC=1 PTT_VPS_HOST=rs.pttads.vn APPLY=0 ./scripts/m2_portal_pwa_staging_cutover_vps.sh
LOCAL_SYNC=1 PTT_VPS_HOST=rs.pttads.vn APPLY=1 ./scripts/m2_portal_pwa_staging_cutover_vps.sh

# M2 trước + M1 CSKH sau (cùng change window)
LOCAL_SYNC=1 APPLY=0 ./scripts/m1_m2_mobile_parallel_cutover_vps.sh
LOCAL_SYNC=1 APPLY=1 ./scripts/m1_m2_mobile_parallel_cutover_vps.sh

# Chỉ Approver, bỏ M1
SKIP_M1=1 LOCAL_SYNC=1 APPLY=1 ./scripts/m1_m2_mobile_parallel_cutover_vps.sh
```

**SSH:** user `deploy` · thêm `~/.ssh/id_ed25519.pub` vào `/home/deploy/.ssh/authorized_keys` trên VPS.

**Nginx (một lần):** merge `deploy/nginx-portal-pwa.snippet.conf` vào site `portal.pttads.vn` → `sudo nginx -t && sudo systemctl reload nginx`.

---

## 1. Pre-flight (trên VPS)

```bash
cd /var/www/ptt
git pull
./scripts/backup_ptt_data.sh   # khuyến nghị
```

- [ ] Gate local đã PASS: `bash scripts/staging_m2_portal_pwa_kickoff.sh` (21/21)
- [ ] Nginx include PWA snippet: `deploy/nginx-portal-pwa.snippet.conf` trong `portal.pttads.vn`
- [ ] Pilot approver accounts (UUID thật trong `portal_client_users`, không stub)

---

## 2. Dry-run

```bash
set -a && source deploy/env.staging-m2-portal-pwa-vps.example && set +a
APPLY=0 ./scripts/m2_portal_pwa_staging_cutover.sh
```

Kiểm tra report: `.local-dev/m2-portal-pwa-staging-cutover-preflight.json` — **FAIL=0**.

---

## 3. VAPID keys (một lần)

```bash
./scripts/generate_portal_vapid_keys.sh --write-env /var/www/ptt/.env
# Hoặc paste thủ công:
# PTT_PORTAL_VAPID_PUBLIC_KEY=...
# PTT_PORTAL_VAPID_PRIVATE_KEY=...
# PTT_PORTAL_VAPID_SUBJECT=mailto:portal-push@pttads.vn
```

---

## 4. Apply cutover

```bash
APPLY=1 ./scripts/m2_portal_pwa_staging_cutover.sh
```

Script thực hiện:
1. DDL `portal_push_subscriptions`
2. `.env`: `NEXT_PUBLIC_PWA_ENABLED=1`, `PTT_PORTAL_PUSH_ENABLED=1`
3. Rebuild `ptt-crm-api` (web-push sender)
4. Rebuild `portal-web` (`wave_b2_rebuild_portal_web.sh`)
5. Restart `ptt-crm-api` + `ptt-portal-web`

---

## 5. Smoke sau cutover

```bash
curl -sf https://portal.pttads.vn/manifest.webmanifest | head
curl -sf https://portal.pttads.vn/sw.js | grep ptt-portal-pwa-v1
curl -sf https://portal.pttads.vn/api/v1/portal/push/vapid-public-key
```

**Mobile (approver pilot):**
1. Mở `https://portal.pttads.vn` trên điện thoại
2. Cài PWA (banner hoặc Add to Home Screen)
3. Settings → **Bật thông báo đẩy**
4. **Gửi test push** → nhận notification
5. Submit creative từ ops → approver nhận push + in-app notification

---

## 6. Rollback

```bash
APPLY=1 ROLLBACK=1 ./scripts/m2_portal_pwa_staging_cutover.sh
```

---

## 7. Web Push sender (đã wire)

| Trigger | Service |
|---------|---------|
| Creative pending | `PortalNotificationService.emitCreativePending` → `PortalPushSenderService` |
| Email pending | `emitEmailPending` |
| SEO pending | `emitSeoPending` |
| Milestone | `emitMilestone` |

Package: `web-push` trong `ptt-crm-api`. Subscription stale (410) tự xóa khỏi DB.

---

## Liên quan

- [`m2-portal-pwa-cutover-checklist.md`](./m2-portal-pwa-cutover-checklist.md) — prod checklist
- [`2026-08-01-rnosai-mobile-strategy-spec.md`](../specs/2026-08-01-rnosai-mobile-strategy-spec.md)
