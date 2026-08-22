# M1 PWA Staff — Production cutover checklist (VPS)

> **RNOS:** RNOS-41 · **Wave:** M1 Mobile Lead Care  
> **Domain:** `https://rs.pttads.vn` (ops-web staff)  
> **Phạm vi:** Bật PWA install + service worker + mobile lead cards — **không** đổi Nest API / Portal  
> **Spec:** [`2026-08-01-rnosai-mobile-strategy-spec.md`](../specs/2026-08-01-rnosai-mobile-strategy-spec.md)  
> **Staging gate:** `bash scripts/staging_m1_pwa_kickoff.sh` → 14/14 PASS  
> **Script cutover:** `scripts/m1_pwa_prod_cutover.sh`

---

## Mục lục

1. [Tóm tắt](#1-tóm-tắt)
2. [Participants & change window](#2-participants--change-window)
3. [Pre-flight (trước change window)](#3-pre-flight-trước-change-window)
4. [Cutover trên VPS (change window)](#4-cutover-trên-vps-change-window)
5. [Smoke test sau cutover](#5-smoke-test-sau-cutover)
6. [Pilot CSKH (2 tuần)](#6-pilot-cskh-2-tuần)
7. [Rollback](#7-rollback)
8. [Sign-off](#8-sign-off)

---

## 1. Tóm tắt

| Mục | Giá trị |
|-----|---------|
| Thay đổi chính | Build ops-web với `NEXT_PUBLIC_PWA_ENABLED=1` |
| Downtime staff UI | ~1–3 phút (restart `ptt-ops-web`) |
| Nest / Portal / Webhook | **Không đổi** |
| Nginx | Không bắt buộc sửa (PWA qua proxy ops-web `:3200`) |
| Rollback SLA | ≤ 5 phút (rebuild `PWA=0` + restart) |

**User-facing:** CSKH thấy banner *「Cài PTT CRM — mở lead nhanh trên điện thoại」* trên Chrome/Android (và tương đương iOS Add to Home Screen).

---

## 2. Participants & change window

| Role | Name | Sign-off |
|------|------|----------|
| DevOps / on-call | | [ ] |
| Product / PO | | [ ] |
| CSKH lead (pilot) | | [ ] |
| QA (smoke mobile) | | [ ] |

| Mục | Giá trị |
|-----|---------|
| Change window (ICT) | `YYYY-MM-DD HH:MM – HH:MM` |
| VPS path | `/var/www/ptt` |
| Git commit trước cutover | `________________` |
| On-call hotline | `________________` |

---

## 3. Pre-flight (trước change window)

### 3.1. Hạ tầng & dịch vụ

- [ ] `rs.pttads.vn` TLS OK — `curl -sfI https://rs.pttads.vn/login`
- [ ] Nest healthy — `curl -sf https://rs.pttads.vn/health`
- [ ] `systemctl is-active ptt-crm-api ptt-ops-web` → active
- [ ] `ptt.service` (Flask) → **inactive** (retired)
- [ ] Staff login prod OK (1 user thật, không stub)

### 3.2. Staging / local gate

```bash
# Trên máy dev hoặc staging mirror
cd /path/to/RNOSAI
python3 scripts/generate_ops_pwa_icons.py   # RNOS-41.1
bash scripts/staging_m1_pwa_kickoff.sh
# Kỳ vọng: PASS=16 FAIL=0
```

- [ ] `.local-dev/rnos41-pwa-gate-report.json` → `"fail": 0`
- [ ] PNG icons `icon-192.png`, `icon-512.png` trong manifest
- [ ] Playwright mobile 390px lead cards PASS

### 3.3. Backup (bắt buộc trên VPS)

```bash
ssh deploy@YOUR_VPS
cd /var/www/ptt
./scripts/backup_ptt_data.sh
ls -lt /var/backups/ptt/ | head -3
```

- [ ] Backup PG + SQLite mới (< 24h)
- [ ] Ghi nhận file backup: `________________`

### 3.4. Pilot cohort (điền trước go-live)

| # | Staff email | UUID (JWT sub) | Thiết bị |
|---|-------------|----------------|----------|
| 1 | | | Android / iOS |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |

- [ ] 5–8 CSKH pilot đã training 15 phút (mở `/crm/leads` mobile, cài PWA)
- [ ] Không dùng `PTT_STAFF_STUB_USERS` trên prod

### 3.5. Env prod — xác nhận trước khi sửa

```bash
grep -E 'NEXT_PUBLIC_PWA|NEXT_PUBLIC_PTT_API|PTT_OPS_WEB' /var/www/ptt/.env || true
```

| Biến | Giá trị prod kỳ vọng | OK |
|------|----------------------|-----|
| `NEXT_PUBLIC_PTT_API_URL` | `https://rs.pttads.vn` | [ ] |
| `NEXT_PUBLIC_PWA_ENABLED` | `1` (sau cutover) hoặc chưa set | [ ] |
| `PTT_OPS_WEB_URL` | `https://rs.pttads.vn` | [ ] |
| `PTT_OPS_CORS_ORIGINS` | `https://rs.pttads.vn` | [ ] |

> **Lưu ý:** `NEXT_PUBLIC_*` là **build-time** — sửa `.env` alone **không đủ**; phải **rebuild ops-web**.

---

## 4. Cutover trên VPS (change window)

### 4.1. Dry-run (không restart)

```bash
ssh deploy@YOUR_VPS
cd /var/www/ptt
git pull origin main
git log -1 --oneline

APPLY=0 ./scripts/m1_pwa_prod_cutover.sh
```

- [ ] Preflight PASS (manifest artifacts, static dir, services active)
- [ ] Artifact `.local-dev/m1-pwa-prod-cutover-preflight.json` OK

### 4.2. Apply cutover

```bash
cd /var/www/ptt
APPLY=1 ./scripts/m1_pwa_prod_cutover.sh
```

Script thực hiện:

1. Ghi `NEXT_PUBLIC_PWA_ENABLED=1` vào `/var/www/ptt/.env` (idempotent)
2. Rebuild ops-web với `NEXT_PUBLIC_PTT_API_URL=https://rs.pttads.vn`
3. Copy `.next/static` + `public/` (gồm `sw.js`, icons) vào standalone
4. `sudo systemctl restart ptt-ops-web`
5. Verify manifest + SW qua HTTPS

**Hoặc thủ công:**

```bash
cd /var/www/ptt

# 1. Env
nano /var/www/ptt/.env
# Thêm hoặc sửa:
# NEXT_PUBLIC_PWA_ENABLED=1

# 2. Rebuild (user deploy)
cd services/ops-web
npm ci
export NEXT_PUBLIC_PTT_API_URL=https://rs.pttads.vn
export NEXT_PUBLIC_PWA_ENABLED=1
# Giữ NEXT_PUBLIC_PTT_AI_* nếu đang pilot AI
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# 3. Restart
sudo systemctl restart ptt-ops-web
```

- [ ] Build không lỗi
- [ ] `test -f services/ops-web/.next/standalone/public/sw.js`
- [ ] `systemctl is-active ptt-ops-web` → active

### 4.3. Nginx (tuỳ chọn — cache SW)

Mặc định `/sw.js` và `/manifest.webmanifest` proxy qua ops-web — **đủ cho M1**.

Nếu CDN/nginx cache SW cũ, thêm block (tuỳ chọn):

```nginx
location = /sw.js {
    proxy_pass http://ptt_ops_web;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
location = /manifest.webmanifest {
    proxy_pass http://ptt_ops_web;
    add_header Cache-Control "no-cache";
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

- [ ] Nginx reload OK (nếu sửa)
- [ ] Hoặc: bỏ qua — proxy mặc định đủ

### 4.4. Gate trên VPS (post-apply)

```bash
cd /var/www/ptt
export OPS_E2E_URL=https://rs.pttads.vn
export OPS_E2E_API_URL=https://rs.pttads.vn
export OPS_E2E_SKIP_SERVER=1
bash scripts/rnos41_pwa_gate.sh
```

> Gate manifest/SW chạy được với `OPS_E2E_SKIP_SERVER=1` nếu ops-web + Nest đã up. Playwright E2E trên VPS cần Chromium — có thể chạy từ máy dev trỏ prod URL thay thế.

- [ ] `curl -sf https://rs.pttads.vn/manifest.webmanifest | jq .start_url` → `"/crm/leads"`
- [ ] `curl -sf https://rs.pttads.vn/sw.js | grep ptt-ops-pwa-v1`
- [ ] `curl -sfI https://rs.pttads.vn/login | head -1` → `200` hoặc `302`

---

## 5. Smoke test sau cutover

### 5.1. Automated (VPS hoặc máy dev → prod URL)

```bash
curl -sf https://rs.pttads.vn/manifest.webmanifest | python3 -m json.tool | head -15
curl -sf https://rs.pttads.vn/sw.js | head -5
curl -sf https://rs.pttads.vn/health
curl -sfI https://rs.pttads.vn/login
```

| # | Check | OK |
|---|-------|-----|
| 1 | manifest `name` chứa "PTT CRM" | [ ] |
| 2 | manifest `start_url` = `/crm/leads` | [ ] |
| 3 | sw.js chứa `ptt-ops-pwa-v1` | [ ] |
| 4 | `/health` 200 | [ ] |
| 5 | Staff desktop `/crm/leads` table vẫn OK (≥769px) | [ ] |

### 5.2. Manual mobile (bắt buộc — 15 phút)

| # | Scenario | Android Chrome | iOS Safari | OK |
|---|----------|----------------|------------|-----|
| 1 | Login staff prod | | | [ ] |
| 2 | `/crm/leads` hiện **card list** (390px) | | | [ ] |
| 3 | Banner / prompt **「Cài PTT CRM」** | | | [ ] |
| 4 | Add to Home Screen → icon mở standalone | | | [ ] |
| 5 | Từ icon → vào `/crm/leads` ≤ 2 tap | | | [ ] |
| 6 | Tap lead → detail load | | | [ ] |
| 7 | Airplane mode → lead list cached (đã mở trước đó) | | | [ ] |
| 8 | Airplane mode → AI copilot banner offline (nếu bật AI) | | | [ ] |

### 5.3. Lighthouse (tuỳ chọn)

Chrome DevTools → Lighthouse → Progressive Web App trên `https://rs.pttads.vn/crm/leads` (mobile emulation).

- [ ] Installable ≥ pass
- [ ] Service worker registered

---

## 6. Pilot CSKH (2 tuần)

| Tuần | Hoạt động | Owner |
|------|-----------|-------|
| W1 | 5–8 CSKH cài PWA; daily standup 5 phút | CSKH lead |
| W1 | Monitor `journalctl -u ptt-ops-web` errors | DevOps |
| W2 | Đo lead response time (so sánh baseline desktop) | Product |
| W2 | Thu feedback UX mobile lead detail | PO |

**KPI M1:**

| Metric | Target |
|--------|--------|
| Pilot install rate | ≥ 30% cohort |
| Mobile lead page views | ≥ 20% tổng lead views (pilot) |
| P0 incident PWA | 0 |
| Rollback | 0 |

- [ ] KPI baseline ghi nhận ngày cutover: `________________`
- [ ] Review tuần 2 scheduled: `________________`

---

## 7. Rollback

**Khi nào rollback:** SW loop / blank screen / login broken trên mobile > 15 phút không fix được.

```bash
ssh deploy@YOUR_VPS
cd /var/www/ptt

# Cách A — script
APPLY=1 ROLLBACK=1 ./scripts/m1_pwa_prod_cutover.sh

# Cách B — thủ công
cd services/ops-web
export NEXT_PUBLIC_PTT_API_URL=https://rs.pttads.vn
export NEXT_PUBLIC_PWA_ENABLED=0
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
sudo systemctl restart ptt-ops-web
```

Verify rollback:

```bash
curl -sf https://rs.pttads.vn/login -o /dev/null && echo OK
# PwaShell không register SW khi NEXT_PUBLIC_PWA_ENABLED=0
```

- [ ] Desktop staff CRM hoạt động bình thường sau rollback
- [ ] Thông báo pilot CSKH đã rollback

**SLA:** ≤ 5 phút từ quyết định rollback → staff desktop OK.

---

## 8. Sign-off

| Gate | Artifact / evidence | OK |
|------|---------------------|-----|
| RNOS-41 gate (staging) | `.local-dev/rnos41-pwa-gate-report.json` | [ ] |
| Prod manifest/SW curl | Screenshot hoặc log change window | [ ] |
| Mobile smoke 5.2 | QA tick ≥ 6/8 scenarios | [ ] |
| Backup pre-cutover | `/var/backups/ptt/` timestamp | [ ] |
| Pilot kickoff | Email/Slack CSKH cohort | [ ] |

**Ký nghiệm thu M1 prod cutover:**

| Role | Chữ ký | Ngày |
|------|--------|------|
| DevOps | | |
| Product | | |
| CSKH lead | | |

---

## Tài liệu liên quan

| Tài liệu | Nội dung |
|----------|----------|
| [`2026-08-01-rnosai-mobile-strategy-spec.md`](../specs/2026-08-01-rnosai-mobile-strategy-spec.md) | Spec M1–M3 |
| [`rnosai-vps-operations-guide.md`](./rnosai-vps-operations-guide.md) | Deploy routine §7 |
| [`vps-rnosai-production-setup-complete.md`](./vps-rnosai-production-setup-complete.md) | Build ops-web §8 |
| `deploy/env.staging-m1-pwa.example` | Env staging reference |
| `scripts/staging_m1_pwa_kickoff.sh` | Staging gate |
| `scripts/m1_pwa_prod_cutover.sh` | Prod cutover script |

---

*M1 PWA prod cutover v1.0 — RNOS-41 · rs.pttads.vn only*
