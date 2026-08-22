# Hướng dẫn vận hành RNOSAI trên VPS

> **Phiên bản:** 1.3 · **Ngày:** 2026-08-01  
> **Changelog v1.4:** PostgreSQL database chuẩn **`rnosaidb`** @ `127.0.0.1:5433` (local + VPS)  
> **Changelog v1.3:** VPS path `/var/www/rnosai` · PostgreSQL `127.0.0.1:5433/rnosaidb`  
> **Changelog v1.2:** §7.7 Giai đoạn 3 Native / Capacitor (RNOS-M3, Phase 5)  
> **Changelog v1.1:** §7.5.1 checklist Giai đoạn 2 Mobile Portal + push (RNOS-M2)  
> **Đối tượng:** DevOps, SysAdmin, on-call vận hành PTT  
> **Thư mục trên VPS:** `/var/www/rnosai`  
> **PostgreSQL (VPS):** `127.0.0.1:5433` · database **`rnosaidb`** · user `ptt`  
> **User deploy:** `deploy` (group `www-data`)  
> **Backup:** `/var/backups/rnosai`  
> **Repo:** https://github.com/sdadtuan/RNOSAI · branch `main`

Tài liệu này là **runbook vận hành tổng hợp** cho hệ thống RNOSAI (PTT Agency Operating Platform) trên VPS production. Nó gom nội dung từ các runbook con và cập nhật theo kiến trúc hiện tại: **Nest API + ops-web + portal-web + Python workers**, Flask monolith **đã retired**.

**Setup greenfield từ VPS trắng:** xem chi tiết từng bước tại [`vps-rnosai-production-setup-complete.md`](./vps-rnosai-production-setup-complete.md) (v3.0).

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Thông tin hạ tầng VPS](#2-thông-tin-hạ-tầng-vps)
3. [Danh mục dịch vụ](#3-danh-mục-dịch-vụ)
4. [Biến môi trường (.env)](#4-biến-môi-trường-env)
5. [Cài đặt lần đầu (tóm tắt)](#5-cài-đặt-lần-đầu-tóm-tắt)
6. [Vận hành hàng ngày](#6-vận-hành-hàng-ngày)
7. [Deploy bản mới](#7-deploy-bản-mới)
8. [Backup & khôi phục](#8-backup--khôi-phục)
9. [Giám sát, log & health check](#9-giám-sát-log--health-check)
10. [SSL/TLS & Nginx](#10-ssltls--nginx)
11. [Vận hành theo module](#11-vận-hành-theo-module)
12. [Xử lý sự cố](#12-xử-lý-sự-cố)
13. [Rollback nhanh](#13-rollback-nhanh)
14. [Bảo mật & checklist định kỳ](#14-bảo-mật--checklist-định-kỳ)
15. [Tài liệu liên quan](#15-tài-liệu-liên-quan)

---

## 1. Tổng quan hệ thống

### 1.1. Kiến trúc production

```mermaid
flowchart TB
    subgraph internet [Internet]
        STAFF[Nhân viên PTT]
        CLIENT[Khách hàng]
        WH[Webhook Meta/Zalo/Google/Email]
    end

    subgraph nginx [Nginx TLS — port 443]
        RS[rs.pttads.vn]
        PORTAL[portal.pttads.vn]
        OPS[ops.pttads.vn → 301 rs]
    end

    subgraph apps [Application — localhost only]
        OW[ops-web :3200]
        PW[portal-web :3100]
        NEST[Nest ptt-crm-api :3000]
        WRK[ptt-worker]
        FB[ptt-fb-autosync]
        TW[ptt-temporal-worker]
    end

    subgraph docker [Docker Compose]
        PG[(PostgreSQL :5433)]
        REDIS[Redis]
        RMQ[RabbitMQ]
        TEMP[Temporal :7233]
        CH[(ClickHouse :8123)]
    end

    STAFF --> RS
    CLIENT --> PORTAL
    WH --> RS
    OPS --> RS
    RS --> OW
    RS --> NEST
    PORTAL --> PW
    PORTAL --> NEST
    NEST --> PG
    WRK --> PG
    FB --> PG
    TW --> TEMP
    TW --> PG
    PG -.-> CH
```

### 1.2. Domain & URL

| Domain | Vai trò | Routing Nginx |
|--------|---------|---------------|
| **`https://rs.pttads.vn`** | **Staff console chính** — CRM, Meta, Zalo, Email, SEO, AI | `/` → ops-web `:3200` · `/api/` → Nest `:3000` |
| **`https://portal.pttads.vn`** | Client portal — performance, creative approval, SEO/Email read-only | `/` → portal-web `:3100` · `/api/` → Nest `:3000` |
| **`https://ops.pttads.vn`** | Bookmark cũ | **301 redirect** → `rs.pttads.vn` |

**Webhook công khai (Meta/Zalo/Google/Email):**

```text
POST https://rs.pttads.vn/api/v1/webhooks/{meta|zalo|google|email}
GET  https://rs.pttads.vn/api/v1/channels
```

**Health endpoints:**

```bash
curl -sf https://rs.pttads.vn/health          # Nest qua Nginx staff
curl -sf https://portal.pttads.vn/health      # Nest qua Nginx portal
curl -sf http://127.0.0.1:3000/health        # Nest trực tiếp
curl -sf http://127.0.0.1:3000/api/v1/ai/health | jq .   # AI layer
```

### 1.3. Stack công nghệ

| Thành phần | Công nghệ | Ghi chú |
|------------|-----------|---------|
| CRM API | NestJS (Node 22) | `services/ptt-crm-api` |
| Staff UI | Next.js standalone | `services/ops-web` |
| Client UI | Next.js standalone | `services/portal-web` |
| Workers | Python 3.11 venv | `ptt_worker`, jobs, seed |
| DB chính | PostgreSQL 15 | `rnosaidb` @ `127.0.0.1:5433` |
| Legacy | SQLite `ptt.db` | Dual-read còn lại; vẫn backup |
| Cache/Queue | Redis 7, RabbitMQ | Docker |
| Workflows | Temporal | Docker `:7233` |
| BI | ClickHouse 24.8 | Export T-1 từ PG |
| Search (tuỳ chọn) | OpenSearch 2.11 | RNOS-11 pilot |

### 1.4. Nguyên tắc vận hành

| Quy tắc | Chi tiết |
|---------|----------|
| **Flask retired** | Không start `ptt.service`. `PTT_FLASK_MONOLITH_MODE=retired` |
| **PG là source of truth** | Leads, portal, webhooks, AI — sau Phase 2 cutover |
| **App localhost-only** | Chỉ Nginx (80/443) public; không mở `:3000`, `:3100`, `:3200`, `:5433` |
| **Backup trước change** | Mọi deploy lớn, DDL, cutover — chạy `backup_ptt_data.sh` trước |
| **DDL forward-only** | Không rollback migration; disaster mới restore `pg_dump` |
| **Secrets vault** | `.env` chmod 600; không commit git |

---

## 2. Thông tin hạ tầng VPS

### 2.1. Yêu cầu tối thiểu

| Mục | Khuyến nghị |
|-----|-------------|
| OS | Ubuntu 22.04 / 24.04 LTS |
| RAM | ≥ 8 GB (Temporal + PG + ClickHouse + build Node) |
| Disk | ≥ 80 GB SSD |
| Python | 3.11+ (scrypt portal users) |
| Node.js | 22 LTS |
| Docker | docker.io + docker-compose-v2 |

### 2.2. DNS bắt buộc

| Record | Trỏ tới | Bắt buộc |
|--------|---------|----------|
| `rs.pttads.vn` | VPS IP | Có — staff console |
| `portal.pttads.vn` | VPS IP | Có — client portal |
| `ops.pttads.vn` | VPS IP | Có — redirect 301 |

Verify trước go-live:

```bash
dig +short rs.pttads.vn A
dig +short portal.pttads.vn A
curl -sfI https://rs.pttads.vn/login | head -1
curl -sfI https://portal.pttads.vn/login | head -1
```

### 2.3. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

| Port | Public | Ghi chú |
|------|--------|---------|
| 22 | Có | SSH |
| 80, 443 | Có | Nginx |
| 3000, 3100, 3200, 5433, 7233, 8123 | **Không** | Chỉ localhost |
| 8088 (Temporal UI) | **Không** | SSH tunnel admin only |

### 2.4. Bảng thông tin host (điền trước vận hành)

| Mục | Giá trị |
|-----|---------|
| VPS IP / hostname | `________________` |
| SSH user | `deploy` |
| Change window (ICT) | `________________` |
| Operator on-call | `________________` |
| Sentry DSN (nếu có) | `________________` |
| LLM provider / key vault | `________________` |

---

## 3. Danh mục dịch vụ

### 3.1. Systemd services (luôn chạy)

| Unit | Port | Mô tả | Restart |
|------|------|-------|---------|
| `ptt-crm-api.service` | `:3000` | Nest CRM/API — webhooks, auth, AI | `sudo systemctl restart ptt-crm-api` |
| `ptt-ops-web.service` | `:3200` | Staff UI (ops-web) | `sudo systemctl restart ptt-ops-web` |
| `ptt-portal-web.service` | `:3100` | Client portal UI | `sudo systemctl restart ptt-portal-web` |
| `ptt-worker.service` | — | Job queue (lead ingest, email jobs) | `sudo systemctl restart ptt-worker` |
| `ptt-fb-autosync.service` | — | Facebook lead background sync | `sudo systemctl restart ptt-fb-autosync` |
| `ptt-temporal-worker.service` | — | Temporal workflow worker | `sudo systemctl restart ptt-temporal-worker` |

**Không dùng:** `ptt.service` (Flask Gunicorn `:8002`) — đã retired.

Kiểm tra trạng thái:

```bash
systemctl is-active ptt-crm-api ptt-ops-web ptt-portal-web ptt-worker ptt-fb-autosync ptt-temporal-worker
systemctl status ptt-crm-api --no-pager -l
```

### 3.2. Systemd timers (cron jobs)

Xem tất cả timer đang active:

```bash
systemctl list-timers --no-pager 'ptt-*'
```

#### Timer nền tảng (repo root)

| Timer | Lịch (ICT) | Chức năng |
|-------|------------|----------|
| `ptt-fb-sync.timer` | theo unit | Facebook page sync |
| `ptt-meta-insights.timer` | 02:00 | Meta → `daily_performance` |
| `ptt-meta-token-refresh.timer` | hàng ngày | Refresh Meta access token |
| `ptt-owner-weekly-alert.timer` | tuần | Alert owner KPI |
| `ptt-finance-kpi-alert.timer` | tuần | Alert finance KPI |
| `ptt-lead-created-capi.timer` | theo unit | CAPI lead events |
| `ptt-backup.timer` | **03:00** | Backup PG + SQLite |

#### Timer Phase 2 (cài: `install_phase2_systemd_timers.sh`)

| Timer | Lịch | Chức năng |
|-------|------|----------|
| `ptt-lead-shadow-sync.timer` | mỗi phút | PG → SQLite shadow (sunset sau soak) |
| `ptt-write-soak.timer` | hourly | Evidence dual-run |

#### Timer Phase 3–4 (cài: `install_phase3_systemd.sh`)

| Timer | Lịch (ICT) | Chức năng |
|-------|------------|----------|
| `ptt-google-insights.timer` | 02:30 | Google → `daily_performance` |
| `ptt-seo-gsc-sync.timer` | 03:00 | GSC OAuth → SEO stats |
| `ptt-seo-ga4-sync.timer` | 03:30 | GA4 OAuth → SEO stats |
| `ptt-seo-freshness-scan.timer` | CN 04:00 | Content decay scan |
| `ptt-seo-serp-capture.timer` | CN 05:00 | SERP scheduled capture |
| `ptt-seo-gate-d.timer` | CN 06:00 | Gate D: CWV + AEO schedule |
| `ptt-seo-clickhouse-export.timer` | 04:00 | SEO facts → ClickHouse |
| `ptt-clickhouse-export.timer` | 04:00 | Platform facts → ClickHouse |
| `ptt-meta-clickhouse-export.timer` | 04:00 | Meta facts → ClickHouse |
| `ptt-email-clickhouse-export.timer` | 04:00 | Email facts → ClickHouse |

#### Timer Email marketing

| Timer | Chức năng |
|-------|----------|
| `ptt-email-campaign-schedule.timer` | Lên lịch gửi campaign |
| `ptt-email-journey.timer` | Journey automation |
| `ptt-email-soak.timer` | Soak test evidence |

Xem log timer vừa chạy:

```bash
journalctl -u ptt-meta-insights.service -n 30 --no-pager
journalctl -u ptt-seo-gsc-sync.service -n 30 --no-pager
journalctl -u ptt-backup.service -n 20 --no-pager
```

Chạy thủ công một lần:

```bash
sudo systemctl start ptt-meta-insights.service
sudo systemctl start ptt-seo-gsc-sync.service
sudo systemctl start ptt-backup.service
```

### 3.3. Docker containers

```bash
cd /var/www/rnosai

# Core infra
docker compose up -d postgres redis rabbitmq
docker compose ps

# Temporal (workflows agency/onboard)
docker compose -f docker-compose.temporal.yml up -d

# ClickHouse (BI — bật khi cần analytics)
docker compose -f docker-compose.clickhouse.yml up -d

# OpenSearch (tuỳ chọn — RNOS-11)
docker compose -f docker-compose.opensearch.yml up -d

# Keycloak (tuỳ chọn — portal auth pilot)
docker compose -f docker-compose.keycloak.yml up -d
```

Kiểm tra Postgres:

```bash
docker exec rnosai-postgres pg_isready -U ptt -d rnosaidb
docker exec -it rnosai-postgres psql -U ptt -d rnosaidb -c '\dt'
```

Temporal UI (chỉ qua SSH tunnel — **không public**):

```bash
ssh -L 8088:127.0.0.1:8088 deploy@YOUR_VPS_IP
# Mở http://127.0.0.1:8088 trên máy local
```

---

## 4. Biến môi trường (.env)

### 4.1. File master

Tất cả systemd units đọc **một file**:

```text
/var/www/rnosai/.env   (chmod 600, owner deploy)
```

Tạo từ template:

```bash
cp deploy/env.phase5-flask-retire.example /var/www/rnosai/.env
chmod 600 /var/www/rnosai/.env
nano /var/www/rnosai/.env
```

### 4.2. Merge các template

| Template | Nội dung |
|----------|----------|
| `deploy/env.phase5-flask-retire.example` | Platform prod, webhook Nest-only, Flask retired |
| `deploy/env.phase3-prod.example` | Portal JWT, Temporal, SEO portal |
| `deploy/env.ai.example` | AI Copilot, LLM, audit flags |
| `deploy/env.observability.example` | Sentry DSN, JSON logs |
| `deploy/env.phase5-prod.example` | SEO governance, portal SEO, experiments |

Repo có **50+ template** trong `deploy/env.*.example` cho Meta, SEO, Email, Zalo, staging gates.

### 4.3. Biến bắt buộc (production tối thiểu)

```bash
# ── Database ──
DATABASE_URL=postgresql://ptt:STRONG_PASSWORD@127.0.0.1:5433/rnosaidb
PTT_SQLITE_PATH=/var/www/rnosai/ptt.db

# ── Nest core ──
PTT_CRM_INTERNAL_KEY=<random-32-chars-min>
PTT_JOBS_ENABLED=1
PTT_WEBHOOK_V1_ENQUEUE=1
PTT_LEADS_READ_SOURCE=pg
PTT_LEADS_WRITE_SOURCE=pg
PTT_LEAD_INGEST_RULES_SOURCE=pg
PTT_FLASK_MONOLITH_MODE=retired

# ── Webhooks Nest-only ──
PTT_WEBHOOKS_NEST_ENABLED=1
PTT_WEBHOOKS_NEST_META=1
PTT_WEBHOOKS_NEST_ZALO=1
PTT_WEBHOOKS_NEST_GOOGLE=1
PTT_WEBHOOKS_NEST_EMAIL=1
PTT_WEBHOOKS_FLASK_FALLBACK=0

# ── Staff auth (rs.pttads.vn) ──
PTT_STAFF_JWT_SECRET=<random-32-chars-min>
PTT_STAFF_STUB_USERS=
PTT_OPS_CORS_ORIGINS=https://rs.pttads.vn
PTT_OPS_WEB_URL=https://rs.pttads.vn

# ── Portal (portal.pttads.vn) ──
PTT_PORTAL_JWT_SECRET=<random-32-chars-min>
PTT_PORTAL_ALLOW_STUB=0
PTT_PORTAL_CORS_ORIGINS=https://portal.pttads.vn
NEXT_PUBLIC_PTT_API_URL=https://portal.pttads.vn

# ── Channel secrets ──
CRM_FACEBOOK_VERIFY_TOKEN=...
CRM_FACEBOOK_APP_SECRET=...
CRM_FACEBOOK_PAGE_ACCESS_TOKEN=...
CRM_ZALO_WEBHOOK_SECRET=...
CRM_GOOGLE_LEAD_WEBHOOK_KEY=...
CRM_FACEBOOK_BACKGROUND=1

# ── Temporal ──
PTT_TEMPORAL_ADDRESS=127.0.0.1:7233

# ── Observability ──
PTT_JSON_LOGS=1
# SENTRY_DSN=...
# SENTRY_ENVIRONMENT=production

# ── AI (bật sau smoke — xem §11.1) ──
PTT_AI_COPILOT_ENABLED=0
PTT_AI_LLM_PROVIDER=openai
PTT_AI_LLM_MODEL=gpt-4o-mini
AI_LLM_API_KEY=<vault>
PTT_AI_LOG_PII=0
PTT_AI_LOG_PROMPTS=0
PTT_AI_SCORE_ASYNC=1
```

### 4.4. Build-time (Next.js — không đọc runtime .env)

**ops-web** (staff):

```bash
export NEXT_PUBLIC_PTT_API_URL=https://rs.pttads.vn
export NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=0   # hoặc 1 khi pilot
export NEXT_PUBLIC_PTT_AI_PILOT_USER_IDS=     # UUID cohort
npm run build
```

**portal-web** (client):

```bash
export NEXT_PUBLIC_PTT_API_URL=https://portal.pttads.vn
npm run build
```

> URL build **phải khớp** domain trình duyệt. Sai URL → login 401/CORS.

### 4.5. Local dev vs VPS prod

| Mục | Local dev | VPS prod |
|-----|-----------|----------|
| Postgres port | `:5433` | `:5433` |
| Database name | `rnosaidb` | `rnosaidb` |
| App root | repo checkout | `/var/www/rnosai` |
| Staff URL | `http://localhost:3200` | `https://rs.pttads.vn` |
| Portal URL | `http://localhost:3100` | `https://portal.pttads.vn` |
| Guard script | `scripts/rnosai_pg_guard.sh` | Chặn apply DDL sai DB |

---

## 5. Cài đặt lần đầu (tóm tắt)

> Chi tiết đầy đủ 15 bước: [`vps-rnosai-production-setup-complete.md`](./vps-rnosai-production-setup-complete.md)

### 5.1. Checklist greenfield

| # | Bước | Lệnh / tham chiếu |
|---|------|-------------------|
| 1 | Chuẩn bị VPS | apt packages, Node 22, Docker, user `deploy`, firewall |
| 2 | Clone repo | `git clone … /var/www/rnosai` |
| 3 | Python venv | `pip install -r requirements.txt requirements-temporal.txt` |
| 4 | Docker infra | `docker compose up -d postgres redis rabbitmq` + Temporal + ClickHouse |
| 5 | PostgreSQL DDL | `./scripts/apply_pg_ddl_*.sh` theo thứ tự (xem §5.2) |
| 6 | `.env` production | Merge templates → `chmod 600` |
| 7 | Build Nest API | `cd services/ptt-crm-api && npm ci && npm run build` |
| 8 | Build ops-web | `NEXT_PUBLIC_PTT_API_URL=https://rs.pttads.vn npm run build` |
| 9 | Build portal-web | `NEXT_PUBLIC_PTT_API_URL=https://portal.pttads.vn npm run build` |
| 10 | Systemd units | Copy `deploy/*.service`, timers, `install_phase3_systemd.sh` |
| 11 | Nginx + TLS | `deploy/nginx-*.conf` + certbot |
| 12 | Start stack | `systemctl enable --now ptt-crm-api ptt-ops-web …` |
| 13 | AI layer | DDL RNOS-01 + gate + pilot cohort (tuỳ chọn) |
| 14 | Seed users | `seed_portal_pilot_users.py` + staff qua Admin |
| 15 | Gate nghiệm thu | `wave8_gate.sh`, `rnos_r1_prod_pilot_gate.sh`, … |

**Thời gian ước lượng:** 4–8 giờ (greenfield lần đầu).

### 5.2. Thứ tự DDL PostgreSQL

Luôn backup trước prod:

```bash
cd /var/www/rnosai
source .venv/bin/activate
export DATABASE_URL=postgresql://ptt:***@127.0.0.1:5433/rnosaidb

pg_dump "$DATABASE_URL" | gzip > /var/backups/rnosai/pre-ddl-$(date +%F).sql.gz

# Platform core
./scripts/apply_pg_ddl_v2_leads.sh
./scripts/apply_pg_ddl_v3.sh
./scripts/apply_pg_ddl_v3_events_idempotency.sh
./scripts/apply_pg_ddl_v3_sprint0.sh
./scripts/apply_pg_ddl_v3_creatives.sh
./scripts/apply_pg_ddl_v3_launch_qa.sh
./scripts/apply_pg_ddl_v3_google_sync.sh
./scripts/apply_pg_ddl_v3_leads_ingest_config.sh
./scripts/apply_pg_ddl_v4_hub_sop.sh
./scripts/apply_pg_ddl_v5_campaign_writes.sh
./scripts/apply_pg_ddl_staff_auth.sh

# AI Revenue OS (bắt buộc trước Copilot)
./scripts/apply_pg_ddl_revenue_os_ai.sh
./scripts/rnos01_pg_ddl_gate.sh

# Email marketing (nếu dùng)
./scripts/apply_pg_ddl_email_mkt.sh
./scripts/apply_pg_ddl_email_mkt_em1.sh
./scripts/apply_pg_ddl_email_mkt_em3.sh

# ClickHouse init
./scripts/clickhouse_init.sh
```

Verify AI tables:

```bash
psql "$DATABASE_URL" -c "SELECT tablename FROM pg_tables WHERE tablename LIKE 'ai_%' ORDER BY 1;"
```

Chi tiết: [`rnos01-ddl-apply.md`](./rnos01-ddl-apply.md)

### 5.3. Cài systemd lần đầu

```bash
cd /var/www/rnosai

# Services
sudo cp deploy/ptt-crm-api.service deploy/ptt-ops-web.service \
        deploy/ptt-portal-web.service deploy/ptt-worker.service \
        deploy/ptt-fb-autosync.service deploy/ptt-temporal-worker.service \
        /etc/systemd/system/

# Timers root
sudo cp ptt-fb-sync.service ptt-fb-sync.timer \
        ptt-meta-insights.service ptt-meta-insights.timer \
        ptt-meta-token-refresh.service ptt-meta-token-refresh.timer \
        /etc/systemd/system/

# Phase packs + backup
sudo ./scripts/install_phase3_systemd.sh
sudo ./scripts/install_phase2_systemd_timers.sh
sudo cp deploy/ptt-backup.service deploy/ptt-backup.timer /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now ptt-crm-api ptt-ops-web ptt-portal-web
sudo systemctl enable --now ptt-worker ptt-fb-autosync ptt-temporal-worker
sudo systemctl enable --now ptt-backup.timer ptt-meta-insights.timer
```

---

## 6. Vận hành hàng ngày

### 6.1. Health check buổi sáng (~5 phút)

```bash
cd /var/www/rnosai

# HTTP public
curl -sf https://rs.pttads.vn/health && echo " staff API OK"
curl -sfI https://rs.pttads.vn/login | head -1
curl -sf https://portal.pttads.vn/health && echo " portal API OK"
curl -sfI https://portal.pttads.vn/login | head -1

# Systemd core
systemctl is-active ptt-crm-api ptt-ops-web ptt-portal-web ptt-worker ptt-temporal-worker

# Flask phải inactive
systemctl is-active ptt.service 2>/dev/null || echo "Flask retired OK"

# Timers 24h tới
systemctl list-timers --no-pager 'ptt-*' | head -20

# Docker
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'ptt|NAMES'

# Backup đêm qua
ls -lt /var/backups/rnosai/ | head -5
```

### 6.2. Smoke test nhanh (15 phút — sau deploy hoặc hàng tuần)

| # | Kiểm tra | OK |
|---|----------|-----|
| 1 | Staff login `rs.pttads.vn` → `/crm/leads` | ☐ |
| 2 | Portal login → `/dashboard` | ☐ |
| 3 | Lead mới qua webhook → CRM list | ☐ |
| 4 | `ptt-worker` xử lý `job_queue` | ☐ |
| 5 | Meta insights timer chạy đêm (journalctl) | ☐ |
| 6 | Backup file mới trong `/var/backups/rnosai/` | ☐ |
| 7 | `systemctl is-active ptt.service` → inactive | ☐ |

```bash
# job_queue backlog
psql "$DATABASE_URL" -c "SELECT status, count(*) FROM job_queue GROUP BY 1 ORDER BY 2 DESC;"

# Webhook dry-run (401/403 OK nếu thiếu secret)
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://rs.pttads.vn/api/v1/webhooks/zalo \
  -H 'Content-Type: application/json' -d '{}'
```

### 6.3. Bảo trì dữ liệu thường xuyên

| Tác vụ | Lệnh |
|--------|------|
| Hub map sync | `./scripts/sync_hub_campaign_map.sh` |
| Hub/SOP → PG backfill | `python3 scripts/migrate_sqlite_hub_sop_to_pg.py` |
| Portal pilot users | `python3 scripts/seed_portal_pilot_users.py --password '…'` |
| Meta insights thủ công | `./scripts/sync_meta_insights.sh` |
| Google insights thủ công | `./scripts/sync_google_insights.sh` |
| SEO GSC sync thủ công | `sudo systemctl start ptt-seo-gsc-sync.service` |
| SEO GA4 sync thủ công | `sudo systemctl start ptt-seo-ga4-sync.service` |

### 6.4. Quản lý user

**Staff (nội bộ):** bảng PG `staff_users` — seed super admin trực tiếp PostgreSQL (không cần `ptt.db`):

```bash
cd /var/www/rnosai
source .venv/bin/activate
export DATABASE_URL=postgresql://ptt:***@127.0.0.1:5433/rnosaidb
export ADMIN_PASSWORD='<min-8-chars>'

./scripts/apply_pg_ddl_staff_auth.sh   # nếu chưa chạy

python3 scripts/seed_super_admin_full_access.py \
  --pg-only \
  --email admin@pttads.vn \
  --password "$ADMIN_PASSWORD"
```

**Không** dùng `PTT_STAFF_STUB_USERS` trên prod.

**Portal (khách hàng):**

```bash
cd /var/www/rnosai
source .venv/bin/activate
export DATABASE_URL=postgresql://ptt:***@127.0.0.1:5433/rnosaidb
export PORTAL_PILOT_PASSWORD='<min-8-chars>'

python3 scripts/seed_portal_pilot_users.py --password "$PORTAL_PILOT_PASSWORD"
```

Kiểm tra user portal:

```sql
SELECT email, role, active FROM portal_client_users WHERE active = true ORDER BY email;
```

---

## 7. Deploy bản mới

### 7.1. Deploy routine (không cutover)

```bash
cd /var/www/rnosai

# 1. Backup
./scripts/backup_ptt_data.sh

# 2. Pull code
git pull origin main
git log -1 --oneline

# 3. Python deps (workers)
source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-temporal.txt

# 4. Nest API
cd services/ptt-crm-api
npm ci && npm run build
sudo systemctl restart ptt-crm-api

# 5. ops-web (staff)
cd /var/www/rnosai/services/ops-web
npm ci
export NEXT_PUBLIC_PTT_API_URL=https://rs.pttads.vn
# Giữ NEXT_PUBLIC_PTT_AI_* nếu đang pilot AI
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public 2>/dev/null || true
sudo systemctl restart ptt-ops-web

# 6. portal-web (client)
cd /var/www/rnosai/services/portal-web
npm ci
export NEXT_PUBLIC_PTT_API_URL=https://portal.pttads.vn
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public 2>/dev/null || true
sudo systemctl restart ptt-portal-web

# 7. Workers
sudo systemctl restart ptt-worker ptt-fb-autosync ptt-temporal-worker

# 8. DDL mới (nếu release có migration)
# source .venv/bin/activate && ./scripts/apply_pg_ddl_*.sh

# 9. Verify
curl -sf http://127.0.0.1:3000/health && echo " Nest OK"
curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK"
curl -sf http://127.0.0.1:3100/login -o /dev/null && echo " portal OK"
```

### 7.2. Deploy có DDL migration

```bash
cd /var/www/rnosai
source .venv/bin/activate
export DATABASE_URL=postgresql://ptt:***@127.0.0.1:5433/rnosaidb

# Backup bắt buộc
./scripts/backup_ptt_data.sh

# Apply script migration của release (đọc CHANGELOG / release notes)
./scripts/apply_pg_ddl_<release>.sh

# Gate nếu có
./scripts/rnos01_pg_ddl_gate.sh   # AI tables
# hoặc gate tương ứng module

# Restart API + workers
sudo systemctl restart ptt-crm-api ptt-worker
```

### 7.3. Gate sau deploy lớn

```bash
cd /var/www/rnosai
source .venv/bin/activate
set -a && source .env && set +a

./scripts/wave8_gate.sh
./scripts/staging_phase5_gate_pack.sh
./scripts/rnos_r1_prod_pilot_gate.sh    # nếu có thay đổi AI
```

Artifact gate: `.local-dev/*-gate-report.json`

### 7.4. Change window checklist

| Trước | Trong | Sau |
|-------|-------|-----|
| Backup `./scripts/backup_ptt_data.sh` | Deploy theo §7.1 | Health check §6.1 |
| Thông báo on-call | Monitor `journalctl -f` | Smoke §6.2 |
| Ghi commit hash | Không cutover + deploy cùng lúc | Gate nếu cần |

### 7.5. Mobile PWA cutover — M2 Approver + M1 CSKH

Cùng VPS (`rs.pttads.vn` / `portal.pttads.vn` → `45.76.157.102`). **Ưu tiên Approver:** chạy M2 trước.

| Track | Host | Script VPS (laptop) | On-box |
|-------|------|---------------------|--------|
| **M2 Portal** | `portal.pttads.vn` | `m2_portal_pwa_staging_cutover_vps.sh` | `m2_portal_pwa_staging_cutover.sh` |
| **M1 Staff** | `rs.pttads.vn` | `m1_pwa_staging_cutover_vps.sh` | `m1_pwa_prod_cutover.sh` |
| **Cả hai** | — | `m1_m2_mobile_parallel_cutover_vps.sh` | — |

```bash
# Từ laptop (SSH deploy@rs.pttads.vn — LOCAL_SYNC=1 nếu code chưa push)
LOCAL_SYNC=1 APPLY=0 ./scripts/m1_m2_mobile_parallel_cutover_vps.sh   # dry-run
LOCAL_SYNC=1 APPLY=1 ./scripts/m1_m2_mobile_parallel_cutover_vps.sh   # apply M2→M1

# Chỉ Approver portal
SKIP_M1=1 LOCAL_SYNC=1 APPLY=1 ./scripts/m1_m2_mobile_parallel_cutover_vps.sh
```

**M2 smoke (Approver):** `/manifest.webmanifest` · `/sw.js` (`ptt-portal-pwa-v1`) · `/api/v1/portal/push/vapid-public-key` · mobile `/creatives` + Settings push.

**M1 smoke (CSKH):** `/manifest.webmanifest` · `/sw.js` (`ptt-ops-pwa-v1`) · mobile `/crm/leads` + `/crm/cskh-board`.

Runbook chi tiết: [`m2-portal-pwa-staging-cutover-checklist.md`](./m2-portal-pwa-staging-cutover-checklist.md) · [`m1-pwa-prod-cutover-checklist.md`](./m1-pwa-prod-cutover-checklist.md).

Rollback: `APPLY=1 ROLLBACK=1` trên script tương ứng (≤5 phút).

### 7.5.1. Giai đoạn 2 — Mobile Portal + thông báo (RNOS-M2)

> **Horizon:** 3–9 tháng · **RNOS:** RNOS-M2 · **Host:** `https://portal.pttads.vn`  
> **Mục tiêu:** Client approver duyệt creative/email trên điện thoại — installable PWA + Web Push, **không** offline phức tạp.  
> **Gate local:** `bash scripts/staging_m2_portal_pwa_kickoff.sh` → 21/21 · Runbook đầy đủ: [`m2-portal-pwa-staging-cutover-checklist.md`](./m2-portal-pwa-staging-cutover-checklist.md)

#### Phạm vi portal (`portal.pttads.vn`)

| UC | Màn | Persona | Route | Mobile ≤768px |
|----|-----|---------|-------|---------------|
| PORTAL-UC-003 | Dashboard KPI | Viewer | `/dashboard` | KPI cards 2 cột |
| PORTAL-UC-006 | Duyệt creative | Approver | `/creatives` | Card inbox + Duyệt/Từ chối |
| PORTAL-UC-008 | Duyệt email | Approver | `/email/approvals` | Approval cards |
| PORTAL-UC-004 | Notification inbox | Approver/Viewer | `/notifications` | Badge trên bottom nav |
| PORTAL-UC-010 | Export PDF | Viewer | Performance | **Stub** — backlog P1 |
| MOB-UC-005 | Cài PWA | Approver | Global | `PortalPwaShell` banner |
| MOB-UC-006/009 | Push subscribe | Approver | `/settings` | `usePortalPush` |

#### Kiến trúc kỹ thuật

| Thành phần | Chi tiết |
|------------|----------|
| **PWA** | `manifest.ts` · `start_url: /dashboard` · SW `ptt-portal-pwa-v1` · build `NEXT_PUBLIC_PWA_ENABLED=1` |
| **Bottom nav** | `PortalMobileBottomNav` @ ≤768px — Home · Creative · Alerts · Email (approver) · Settings |
| **Web Push (chính)** | `PortalPushSenderService` + `web-push` · API `/api/v1/portal/push/*` · bảng `portal_push_subscriptions` |
| **Webhook outbound (phụ)** | `PortalNotifyWebhookService` — POST ra URL ngoài nếu `PTT_PORTAL_NOTIFY_WEBHOOK_URL` cấu hình; **không** thay Web Push |
| **Luồng duyệt** | Ops submit → `emitCreativePending` / `emitEmailPending` → in-app notification + push (nếu subscribed) |
| **Offline** | Chỉ shell cache `/login`, `/dashboard` — **không** cache `/api/*`, không offline write |

**Luồng thông báo «cần duyệt»:**

```
emitCreativePending() / emitEmailPending()
  → INSERT portal_notifications (in-app inbox)
  → PortalNotifyWebhookService.send()     // optional — Slack/email gateway
  → PortalPushSenderService.sendToUsers() // khi PTT_PORTAL_PUSH_ENABLED=1
  → SW push event → notificationclick → /creatives hoặc /email/approvals
```

#### Pre-flight

| # | Mục | OK |
|---|-----|-----|
| 1 | Phase 3 Portal live: login `portal.pttads.vn` OK | ☐ |
| 2 | `PTT_PORTAL_ALLOW_STUB=0` trên prod | ☐ |
| 3 | Approver pilot trong `portal_client_users` (role `approver`) | ☐ |
| 4 | Gate local 21/21: `staging_m2_portal_pwa_kickoff.sh` | ☐ |
| 5 | SSH `deploy@rs.pttads.vn` (VPS `45.76.157.102`) | ☐ |
| 6 | Backup: `./scripts/backup_ptt_data.sh` | ☐ |
| 7 | Nginx snippet PWA: `deploy/nginx-portal-pwa.snippet.conf` | ☐ |

**Kiểm tra approver:**

```bash
cd /var/www/rnosai && source .venv/bin/activate
psql "$DATABASE_URL" -c \
  "SELECT email, role, active FROM portal_client_users WHERE active = true ORDER BY email;"
```

**Seed pilot (nếu cần):**

```bash
export PORTAL_PILOT_PASSWORD='...'   # không commit
python3 scripts/seed_portal_pilot_users.py --password "$PORTAL_PILOT_PASSWORD"
```

#### Hạ tầng một lần (trên VPS)

**Nginx** — merge vào site `portal.pttads.vn` trước `location /`:

```nginx
include /var/www/rnosai/deploy/nginx-portal-pwa.snippet.conf;
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**VAPID keys:**

```bash
cd /var/www/rnosai
./scripts/generate_portal_vapid_keys.sh --write-env /var/www/rnosai/.env
```

Biến `.env` tối thiểu M2:

```bash
NEXT_PUBLIC_PWA_ENABLED=1
PTT_PORTAL_PUSH_ENABLED=1
PTT_PORTAL_VAPID_PUBLIC_KEY=...
PTT_PORTAL_VAPID_PRIVATE_KEY=...
PTT_PORTAL_VAPID_SUBJECT=mailto:portal-push@pttads.vn
PTT_PORTAL_CORS_ORIGINS=https://portal.pttads.vn
NEXT_PUBLIC_PTT_API_URL=https://portal.pttads.vn
# Tuỳ chọn webhook Slack/email gateway (không thay Web Push):
# PTT_PORTAL_NOTIFY_WEBHOOK_URL=https://...
# PTT_PORTAL_EMAIL_NOTIFY_ENABLED=1
```

#### Cutover M2 (change window ~5–8 phút)

**Dry-run:**

```bash
# Laptop — LOCAL_SYNC=1 nếu code chưa push git
LOCAL_SYNC=1 APPLY=0 ./scripts/m2_portal_pwa_staging_cutover_vps.sh

# Hoặc trên VPS
cd /var/www/rnosai
set -a && source deploy/env.staging-m2-portal-pwa-vps.example && set +a
APPLY=0 ./scripts/m2_portal_pwa_staging_cutover.sh
```

Report: `.local-dev/m2-portal-pwa-staging-cutover-preflight.json` → **FAIL=0**.

**Apply:**

```bash
LOCAL_SYNC=1 APPLY=1 ./scripts/m2_portal_pwa_staging_cutover_vps.sh
# Hoặc: APPLY=1 ./scripts/m2_portal_pwa_staging_cutover.sh
sudo systemctl restart ptt-crm-api ptt-portal-web   # nếu script báo thiếu sudo
```

Script tự thực hiện: DDL `portal_push_subscriptions` → cập nhật `.env` → rebuild `ptt-crm-api` → rebuild `portal-web` → restart services.

#### Smoke sau cutover

```bash
curl -sf https://portal.pttads.vn/login >/dev/null && echo "OK /login"
curl -sf https://portal.pttads.vn/health && echo " OK /health"
curl -sf https://portal.pttads.vn/manifest.webmanifest | grep -q PTT && echo "OK manifest"
curl -sf https://portal.pttads.vn/sw.js | grep -q ptt-portal-pwa-v1 && echo "OK sw.js"
curl -sf https://portal.pttads.vn/api/v1/portal/push/vapid-public-key
# Kỳ vọng: {"enabled":true,"publicKey":"..."}
```

**Subscription sau pilot subscribe:**

```bash
psql "$DATABASE_URL" -c "SELECT count(*) FROM portal_push_subscriptions;"
```

#### UAT mobile Approver (pilot 3–5 account)

| # | Scenario | Pass |
|---|----------|------|
| 1 | Mở portal trên Android Chrome / iOS Safari | ☐ |
| 2 | Cài PWA (banner hoặc Add to Home Screen) | ☐ |
| 3 | `/dashboard` KPI @ 390px | ☐ |
| 4 | Bottom nav 4–5 mục visible | ☐ |
| 5 | `/creatives` — duyệt / từ chối creative | ☐ |
| 6 | `/email/approvals` — duyệt campaign | ☐ |
| 7 | `/settings` → Bật thông báo đẩy → Allow | ☐ |
| 8 | Gửi test push → nhận notification | ☐ |
| 9 | Ops submit creative → approver nhận push + in-app | ☐ |
| 10 | Tap notification → mở đúng màn duyệt | ☐ |

#### Pilot timeline (3–9 tháng)

| Tuần | Milestone | Exit |
|------|-----------|------|
| W1 | 3–5 approver cài PWA + subscribe | ≥3 row `portal_push_subscriptions` |
| W2 | E2E creative + email approval mobile | Push + in-app OK |
| W3 | iOS: in-app inbox nếu push hạn chế | Workaround ghi nhận |
| W4 | KPI thời gian duyệt, click-through notification | Sign-off AM |

#### Giám sát sau cutover

```bash
journalctl -u ptt-crm-api --since "1 hour ago" | grep -i push
systemctl is-active ptt-crm-api ptt-portal-web
psql "$DATABASE_URL" -c \
  "SELECT date_trunc('day', created_at) d, count(*) FROM portal_push_subscriptions GROUP BY 1;"
```

#### Rollback M2 (≤5 phút)

```bash
cd /var/www/rnosai
APPLY=1 ROLLBACK=1 ./scripts/m2_portal_pwa_staging_cutover.sh
sudo systemctl restart ptt-crm-api ptt-portal-web
```

> DDL `portal_push_subscriptions` **không** rollback — an toàn giữ bảng.

#### Gap / backlog GĐ2

| Mục | Trạng thái |
|-----|------------|
| PWA + bottom nav + Web Push | ✅ code-complete · prod cần cutover |
| PORTAL-UC-010 Export PDF | ⚠️ stub trên `PerformancePanel` |
| Native store / deep link email | §7.7 M3 Capacitor (scaffold có, store chưa) |

### 7.6. P2 Mobile polish (sau M1/M2 ổn định)

| Track | Nội dung | Script |
|-------|----------|--------|
| **P2** | AI bottom sheet · pull refresh · swipe approve | `mob_p2_polish_staging_cutover_vps.sh` |

```bash
# Sau M1+M2 live (/sw.js OK)
LOCAL_SYNC=1 APPLY=1 ./scripts/mob_p2_polish_staging_cutover_vps.sh
```

Gate: `bash scripts/staging_mob_p2_polish_kickoff.sh` · Runbook: [`mob-p2-polish-staging-cutover-checklist.md`](./mob-p2-polish-staging-cutover-checklist.md).

### 7.7. Giai đoạn 3 — Native / Capacitor (RNOS-M3, Phase 5)

> **Horizon:** tháng **42+** · **Mục tiêu:** App Store / Play Store khi PWA không đủ (push iOS, camera, biometric).  
> **Phụ thuộc:** M2 prod ổn định **≥90 ngày** (§7.5.1) · **As-is:** scaffold `services/mobile-shell/` — **chưa** store release.  
> **Spec:** [`2026-08-01-rnosai-mobile-strategy-spec.md`](../specs/2026-08-01-rnosai-mobile-strategy-spec.md) §6.4, §8.3, §9.3 · **ADR:** ADR-MOB-04 Capacitor trước RN.

#### Mục tiêu & phạm vi M3 v1

| Trong scope v1 | Ngoài scope v1 |
|----------------|----------------|
| Login portal · push native (FCM/APNs) | CSKH ops-web native |
| Duyệt creative + email (reuse portal-web) | Offline write |
| Deep link `pttads://approve/{id}` · MOB-UC-010 | React Native greenfield (chỉ plan B) |
| Biometric unlock (optional v1.1) | Camera nâng cao |

**Persona:** Client **Approver** · App load `https://portal.pttads.vn` trong WebView (Option A).

#### Option A vs B

| | **A. Capacitor wrap PWA** (khuyến nghị) | **B. React Native / Expo** |
|---|----------------------------------------|----------------------------|
| **Ưu** | Reuse ~100% portal-web, ship **6–8 tuần** | UX native, push tốt |
| **Nhược** | WebView — gesture/perf hạn chế | 2 codebase, **3–6 tháng** |
| **Khi chọn** | Kickoff M3 mặc định | Chỉ nếu Capacitor fail KPI sau pilot 8 tuần |

#### Trigger kickoff (cần ≥2/3)

| # | Điều kiện | Cách đo |
|---|-----------|---------|
| T1 | PWA portal conversion duyệt **<60%** iOS Safari (30 ngày) | Funnel approve + `X-PTT-Client` |
| T2 | Khách enterprise yêu cầu **App Store / Play** trong hợp đồng | AM / Legal |
| T3 | Web Push iOS delivery **<80%** hoặc reliability kém | Push logs + `portal_push_subscriptions` |

**Gate cứng:**

| # | Mục | OK |
|---|-----|-----|
| 1 | M2 prod: `/sw.js`, push API, pilot approver ≥3 user | ☐ |
| 2 | M2 soak ≥90 ngày, không P1 mobile portal | ☐ |
| 3 | Apple + Google developer accounts active | ☐ |
| 4 | ADR-MOB-04 accepted (Capacitor trước RN) — [`adr-mob-04-capacitor-before-rn.md`](../specs/adr-mob-04-capacitor-before-rn.md) | ☐ |
| 5 | Privacy policy URL cho store listing | ☐ |

#### Scaffold hiện có (`services/mobile-shell/`)

```bash
cd services/mobile-shell
npm install
npx cap add ios      # một lần
npx cap add android  # một lần
export CAPACITOR_PORTAL_URL=https://portal.pttads.vn   # hoặc staging
npm run cap:sync
npm run cap:open:ios    # hoặc cap:open:android
```

| Thuộc tính | Giá trị |
|------------|---------|
| `appId` | `vn.pttads.portal` |
| `appName` | PTT Portal |
| WebView URL | `CAPACITOR_PORTAL_URL` → mặc định `https://portal.pttads.vn` |
| Plugins | `@capacitor/push-notifications`, `@capacitor/app`, splash, status-bar |

#### Lộ trình triển khai (3–6 tháng)

| Phase | Thời gian | Deliverable |
|-------|-----------|-------------|
| **0 Discovery** | 2 tuần | KPI M2 review · ADR accept · store accounts · privacy/metadata draft |

##### Phase 0 — Discovery & ADR (2 tuần) — chi tiết

> **Runbook:** [`m3-phase0-discovery-adr-checklist.md`](./m3-phase0-discovery-adr-checklist.md) · **Gate:** `bash scripts/staging_m3_phase0_kickoff.sh`

| Deliverable | Owner | Template / artifact |
|-------------|-------|---------------------|
| Báo cáo M2 KPI (iOS vs Android push · approve time · PWA install rate) | **Product** | [`m3-m2-kpi-review-report.md`](../templates/m3-m2-kpi-review-report.md) · `bash scripts/m3_m2_kpi_collect.sh` |
| Chốt Option A + Accept **ADR-MOB-04** | **Tech lead** | [`adr-mob-04-capacitor-before-rn.md`](../specs/adr-mob-04-capacitor-before-rn.md) |
| Store account Apple + Google (org PTT) | **DevOps / Legal** | [`m3-store-accounts-checklist.md`](../templates/m3-store-accounts-checklist.md) |
| Privacy policy + App Store metadata draft | **Legal + AM** | [`m3-privacy-policy-draft-vi.md`](../templates/m3-privacy-policy-draft-vi.md) · [`m3-app-store-metadata-draft.md`](../templates/m3-app-store-metadata-draft.md) |

**Lịch:** Tuần 1 = KPI + push pilot test + enroll stores · Tuần 2 = ADR sign + metadata Legal + gate D10.

**Sign-off:** `.local-dev/m3-phase0-signoff.json` (`adr_mob_04: accepted` bắt buộc trước Phase 1 Build).

| **1 Build** | 4–6 tuần | Capacitor shell · native push · deep link · Nest API |
| **2 Store prep** | 3 tuần | TestFlight + Play Internal · screenshots · gate M3 |
| **3 Pilot** | 4 tuần | 3–5 approver iOS/Android · 1 khách enterprise |
| **4 GA** | 2 tuần | Public listing · monitor crash · force-update |

#### Backend M3 (Nest — Option A code ✅ local gate)

| Endpoint | Mô tả |
|----------|--------|
| `GET /api/v1/mobile/config` | `min_version`, feature flags, force update |
| `POST /api/v1/mobile/device-token` | FCM/APNs token ↔ `portal_user_id` |
| `DELETE /api/v1/mobile/device-token` | Hủy device token |
| `POST /api/v1/mobile/push/test` | Test native push |
| Mở rộng `PortalPushSenderService` | Web-push **+** FCM native fan-out |

DDL: `portal_native_device_tokens` · `bash scripts/apply_pg_ddl_portal_native_m3.sh` · Gate: `rnos_m3_capacitor_gate.sh`

Biến `.env` VPS (khi ship):

```bash
PTT_FCM_SERVER_KEY=...          # hoặc service account JSON path
PTT_APNS_KEY_ID=...
PTT_APNS_TEAM_ID=...
PTT_MOBILE_MIN_VERSION=1.0.0
```

> **VPS:** không deploy binary app lên VPS — chỉ API + portal-web như M2. FCM/APNs secrets trong `.env`, không commit.

#### Phase 1 — Capacitor shell (4–6 tuần)

> **Runbook:** [`m3-phase1-capacitor-shell-checklist.md`](./m3-phase1-capacitor-shell-checklist.md) · **Gate:** `bash scripts/staging_m3_phase1_kickoff.sh`

| # | Task | Chi tiết | Code |
|---|------|----------|------|
| 1.1 | `cap add ios/android` | `bash scripts/m3_mobile_shell_init.sh` · CI: `.github/workflows/rnos-m3-mobile-shell.yml` | ☐ native dirs local |
| 1.2 | WebView → portal URL | `CAPACITOR_PORTAL_URL` · default `https://portal.pttads.vn` | ✅ `capacitor.config.ts` |
| 1.3 | Native push | `@capacitor/push-notifications` → Settings → `/mobile/device-token` | ✅ portal-web hook |
| 1.4 | Deep link | `pttads://approve/{id}` → `/creatives?focus=` · universal links docs | ✅ `CapacitorShellInit` |
| 1.5 | Splash + status bar | `#0f172a` · hide splash on load | ✅ config + runtime |
| 1.6 | Header analytics | `X-PTT-Client: capacitor-portal/1.0` on all fetch | ✅ fetch patch |
| 1.7 | Biometric v1.1 | `@capacitor-community/biometric-auth` — **optional sau pilot** | ⏸ backlog |

```bash
bash scripts/staging_m3_phase1_kickoff.sh   # 23/23 gate artifacts
bash scripts/m3_mobile_shell_sync.sh        # rebuild + cap sync
```

#### Phase 2 — QA & store prep (3 tuần)

> **Runbook:** [`m3-phase2-store-prep-checklist.md`](./m3-phase2-store-prep-checklist.md) · **Gate:** `bash scripts/staging_m3_phase2_kickoff.sh`

| # | Task | Chi tiết | Code |
|---|------|----------|------|
| 2.1 | Gate M3 | Build iOS Simulator + Android debug · deep link smoke | ✅ `rnos_m3_capacitor_gate.sh` |
| 2.2 | TestFlight + Play Internal | Fastlane `ios beta` · `android internal` | ✅ `m3_store_*_upload.sh` |
| 2.3 | Screenshots | 6.7" · 5.5" · iPad 13" | ✅ `m3_store_screenshots_capture.sh` |
| 2.4 | App Review notes | WebView authenticated portal · no arbitrary URL | ✅ `m3-app-store-review-notes.md` |

```bash
# Gate (build + smoke)
bash scripts/staging_m3_phase2_kickoff.sh
RUN_DEEPLINK_SMOKE=1 bash scripts/rnos_m3_capacitor_gate.sh   # strict

# Store uploads (secrets in mobile-shell/.env.local)
bash scripts/m3_store_testflight_upload.sh
bash scripts/m3_store_play_internal.sh
bash scripts/m3_store_screenshots_capture.sh
```

**Sign-off:** `.local-dev/m3-phase2-signoff.json` · Report: `.local-dev/rnos-m3-capacitor-gate-report.json`

#### Phase 3 — Pilot enterprise (4 tuần)

> **Runbook:** [`m3-phase3-pilot-enterprise-checklist.md`](./m3-phase3-pilot-enterprise-checklist.md) · **Gate:** `bash scripts/staging_m3_phase3_kickoff.sh`

| Cohort | Kỳ vọng |
|--------|---------|
| 3–5 approver **iOS** | TestFlight internal |
| 3–5 approver **Android** | Play Internal Testing |
| **1 khách enterprise** | Hợp đồng store · AM champion |

| # | Task | Chi tiết | Code |
|---|------|----------|------|
| 3.0 | Cohort JSON | Enterprise client + approver list | ✅ `deploy/m3-pilot-cohort.example.json` |
| 3.1 | UAT M3 v1 (6 scenarios) | Install · push · deep link · email · universal · force update | ✅ `m3-pilot-uat-v1-checklist.md` |
| 3.2 | UAT probes | Automated deep link + mobile/config | ✅ `m3_pilot_uat_probes.sh` |
| 3.3 | KPI pilot | 4 tuần snapshot | ✅ `m3_pilot_kpi_collect.sh` |
| 3.4 | Sign-off | AM + enterprise sponsor | ✅ `m3-phase3-signoff-template.json` |

```bash
cp deploy/m3-pilot-cohort.example.json deploy/m3-pilot-cohort.json   # fill UUIDs
bash scripts/staging_m3_phase3_kickoff.sh
bash scripts/m3_pilot_uat_probes.sh --force-update
bash scripts/m3_pilot_seed_uat_fixtures.sh   # scenario 2-3 (needs internal key)
DATABASE_URL=... bash scripts/m3_pilot_kpi_collect.sh
```

**Sign-off:** `.local-dev/m3-phase3-signoff.json`

#### Phase 4 — GA store (2 tuần)

> **Runbook:** [`m3-phase4-ga-store-checklist.md`](./m3-phase4-ga-store-checklist.md) · **Gate:** `bash scripts/staging_m3_phase4_kickoff.sh`

| # | Task | Chi tiết | Code |
|---|------|----------|------|
| 4.1 | Public listing | App Store + Play Production «PTT Portal» (client approver B2B) | ✅ `m3_store_ga_release_*.sh` |
| 4.2 | Monitor crash | Sentry `client:capacitor-portal` + WebView · store vitals ≥99.5% | ✅ `m3_ga_sentry_verify.sh` |
| 4.3 | Rollback | Pull listing **hoặc** `min_version` + `force_update` block | ✅ `m3_ga_rollback_*.sh` |

```bash
bash scripts/staging_m3_phase4_kickoff.sh
bash scripts/m3_ga_sentry_verify.sh

# GA release (secrets required)
bash scripts/m3_store_ga_release_ios.sh
bash scripts/m3_store_ga_release_android.sh

# Rollback levers
bash scripts/m3_ga_rollback_min_version_block.sh --min-version 1.0.1
bash scripts/m3_ga_rollback_pull_listing.sh
```

**Env:** [`deploy/env.m3-ga-prod.example`](../deploy/env.m3-ga-prod.example) · **Sentry:** [`m3-sentry-native-webview-monitoring.md`](./m3-sentry-native-webview-monitoring.md)  
**Sign-off:** `.local-dev/m3-phase4-signoff.json`

#### UAT M3 v1

| # | Scenario | Pass |
|---|----------|------|
| 1 | Cài app từ TestFlight / Play Internal → login approver | ☐ |
| 2 | Nhận push **native** khi creative pending | ☐ |
| 3 | Tap push → `/creatives` hoặc deep link đúng item | ☐ |
| 4 | Duyệt email campaign trong app | ☐ |
| 5 | Link email mở app (universal link) | ☐ |
| 6 | Force update khi `min_version` tăng | ☐ |

#### KPI thành công

| KPI | Pilot | GA |
|-----|-------|-----|
| Push delivery native iOS | ≥85% | ≥90% |
| Median time-to-approve mobile | ≤ M2 PWA −20% | ≤ desktop portal |
| Crash-free sessions | ≥99% | ≥99.5% |
| Deep link success | ≥95% | ≥98% |

#### Rủi ro & mitigation

| Rủi ro | Mitigation |
|--------|------------|
| Apple reject WebView-only | Review notes; sẵn sàng 1–2 màn native tối thiểu |
| JWT cookie trong WebView | HTTPS only · SameSite · test IT enterprise |
| Dual push web + native | Dedupe trong sender; user một kênh ưu tiên |
| Capacitor không đạt KPI | Pivot Option B (RN) — chỉ sau pilot 8 tuần |

#### Pivot sang React Native (Option B)

Chỉ khi **đồng thời**: approve completion iOS **<50%** sau pilot Capacitor **và** store reject WebView **≥2 lần**. Effort thêm 3–6 tháng; reuse API Nest, rebuild UI 4–6 màn.

#### Liên kết

| Path | Nội dung |
|------|----------|
| [`m3-phase0-discovery-adr-checklist.md`](./m3-phase0-discovery-adr-checklist.md) | Phase 0 Discovery & ADR (2 tuần) |
| [`m3-phase2-store-prep-checklist.md`](./m3-phase2-store-prep-checklist.md) | Phase 2 QA & store prep |
| [`m3-phase3-pilot-enterprise-checklist.md`](./m3-phase3-pilot-enterprise-checklist.md) | Phase 3 pilot enterprise |
| [`m3-phase4-ga-store-checklist.md`](./m3-phase4-ga-store-checklist.md) | Phase 4 GA store |
| [`m3-sentry-native-webview-monitoring.md`](./m3-sentry-native-webview-monitoring.md) | Sentry native + WebView |
| [`m3-pilot-uat-v1-checklist.md`](../templates/m3-pilot-uat-v1-checklist.md) | UAT M3 v1 sign-off |
| [`m3-app-store-review-notes.md`](../templates/m3-app-store-review-notes.md) | App Review notes (WebView) |
| [`m3-m2-kpi-review-report.md`](../templates/m3-m2-kpi-review-report.md) | Product KPI template |
| [`adr-mob-04-capacitor-before-rn.md`](../specs/adr-mob-04-capacitor-before-rn.md) | ADR Option A |
| `scripts/staging_m3_phase0_kickoff.sh` | Phase 0 gate kickoff |
| `services/mobile-shell/README.md` | Setup Capacitor local |
| `services/mobile-shell/capacitor.config.ts` | `vn.pttads.portal` |
| §7.5.1 | Prerequisite M2 Portal PWA + push |

---

## 8. Backup & khôi phục

### 8.1. Backup tự động

Timer `ptt-backup.timer` chạy **03:00 ICT** hàng ngày.

```bash
sudo systemctl enable --now ptt-backup.timer
systemctl list-timers ptt-backup.timer
```

Script: `scripts/backup_ptt_data.sh`

- Output PG: `/var/backups/rnosai/rnosaidb-YYYYMMDD-HHMM.dump` (format `-Fc`)
- Output SQLite: `/var/backups/rnosai/ptt-YYYYMMDD-HHMM.db`
- Retention: **14 ngày** (biến `PTT_BACKUP_RETENTION_DAYS`)

### 8.2. Backup thủ công

```bash
cd /var/www/rnosai
source .venv/bin/activate
export DATABASE_URL=postgresql://ptt:***@127.0.0.1:5433/rnosaidb

./scripts/backup_ptt_data.sh
ls -lh /var/backups/rnosai/
```

Backup trước mọi cutover / DDL:

```bash
pg_dump "$DATABASE_URL" | gzip > /var/backups/rnosai/manual-$(date +%F-%H%M).sql.gz
```

### 8.3. Khôi phục PostgreSQL (disaster)

> Chỉ khi disaster recovery. DDL thường **forward fix**, không rollback.

```bash
# Dừng services ghi DB
sudo systemctl stop ptt-worker ptt-fb-autosync ptt-crm-api

# Restore
pg_restore -d rnosaidb --clean --if-exists \
  /var/backups/rnosai/rnosaidb-YYYYMMDD-HHMM.dump

# Hoặc qua Docker
docker exec -i rnosai-postgres pg_restore -U ptt -d rnosaidb --clean --if-exists \
  < /var/backups/rnosai/rnosaidb-YYYYMMDD-HHMM.dump

# Khởi động lại
sudo systemctl start ptt-crm-api ptt-worker ptt-fb-autosync
curl -sf http://127.0.0.1:3000/health
```

### 8.4. Khôi phục SQLite (legacy)

```bash
cp /var/backups/rnosai/ptt-YYYYMMDD-HHMM.db /var/www/rnosai/ptt.db
# Chỉ ảnh hưởng module còn dual-read SQLite
```

> Sau Phase 2 cutover, **PG là source of truth** cho leads/portal/webhooks.

---

## 9. Giám sát, log & health check

### 9.1. Log systemd

```bash
# Nest API — webhook, auth, AI
journalctl -u ptt-crm-api -f --since "30 min ago"
journalctl -u ptt-crm-api -n 100 --no-pager

# Workers
journalctl -u ptt-worker -n 100 --no-pager
journalctl -u ptt-fb-autosync -n 50 --no-pager
journalctl -u ptt-temporal-worker -n 100 --no-pager

# Frontend
journalctl -u ptt-ops-web -n 50 --no-pager
journalctl -u ptt-portal-web -n 50 --no-pager

# Timer oneshot
journalctl -u ptt-meta-insights.service -n 30 --no-pager
journalctl -u ptt-seo-gsc-sync.service -n 30 --no-pager
journalctl -u ptt-backup.service -n 20 --no-pager
```

### 9.2. Health endpoints

| Endpoint | Ý nghĩa |
|----------|---------|
| `GET /health` | Nest alive |
| `GET /api/v1/ai/health` | AI schema + migration ready |
| `GET /api/v1/channels` | Channel config (staff auth) |

```bash
curl -s http://127.0.0.1:3000/api/v1/ai/health | jq .
# Kỳ vọng: schema_ready: true
```

### 9.3. Sentry & JSON logs

Cấu hình qua `deploy/env.observability.example`:

```bash
SENTRY_DSN=https://…
SENTRY_ENVIRONMENT=production
PTT_JSON_LOGS=1
```

Sau khi sửa `.env`: `sudo systemctl restart ptt-crm-api`

### 9.4. Grafana dashboards

Dashboard mẫu trong `deploy/grafana/`:

- `meta-ops-dashboard.json`
- `email-ops-dashboard.json`
- `seo-ops-dashboard.json`

Alert rules: `deploy/grafana/alert-rules.yaml`

### 9.5. SQL diagnostics nhanh

```sql
-- Job queue backlog
SELECT status, count(*) FROM job_queue GROUP BY 1;

-- Lead ingest 24h
SELECT count(*) FROM leads WHERE created_at > now() - interval '24 hours';

-- AI runs lỗi 24h
SELECT count(*) FROM ai_agent_runs
WHERE status = 'error' AND created_at > now() - interval '24 hours';

-- Portal users active
SELECT count(*) FROM portal_client_users WHERE active = true;
```

---

## 10. SSL/TLS & Nginx

### 10.1. File cấu hình Nginx

| Site | File deploy | Domain |
|------|-------------|--------|
| Staff | `deploy/nginx-rs-flask-retired.conf` | `rs.pttads.vn` |
| Portal | `deploy/nginx-portal.conf` | `portal.pttads.vn` |
| Redirect | `deploy/nginx-ops.conf` | `ops.pttads.vn` → rs |
| Webhooks | `deploy/nginx-webhooks-v1-*.conf` | upstream Nest |

Cài sites:

```bash
sudo cp /var/www/rnosai/deploy/nginx-rs-flask-retired.conf \
        /etc/nginx/sites-available/rs.pttads.vn
sudo ln -sf /etc/nginx/sites-available/rs.pttads.vn /etc/nginx/sites-enabled/

sudo cp /var/www/rnosai/deploy/nginx-portal.conf \
        /etc/nginx/sites-available/portal.pttads.vn
sudo ln -sf /etc/nginx/sites-available/portal.pttads.vn /etc/nginx/sites-enabled/

sudo cp /var/www/rnosai/deploy/nginx-ops.conf \
        /etc/nginx/sites-available/ops.pttads.vn
sudo ln -sf /etc/nginx/sites-available/ops.pttads.vn /etc/nginx/sites-enabled/

sudo nginx -t && sudo systemctl reload nginx
```

Helper scripts:

```bash
./scripts/apply_nginx_vps_sites.sh
./scripts/apply_nginx_rs_vps_ssl.sh
./scripts/apply_webhooks_upstream.sh
./scripts/patch_nginx_rs_static.sh   # fix Next.js static paths
```

### 10.2. TLS (Let's Encrypt)

Lần đầu (chưa có cert — comment block ssl trong conf trước):

```bash
sudo certbot --nginx -d rs.pttads.vn -d portal.pttads.vn -d ops.pttads.vn
sudo nginx -t && sudo systemctl reload nginx
```

Cert có sẵn (shared):

```text
/etc/nginx/ssl/portalpttadsvn.pem
/etc/nginx/ssl/portalpttadsvn.key
```

Gia hạn tự động:

```bash
sudo certbot renew --dry-run
systemctl list-timers | grep certbot
```

### 10.3. Routing quan trọng

**Staff (`rs.pttads.vn`):**

- `/` → `http://127.0.0.1:3200` (ops-web)
- `/api/` → `http://127.0.0.1:3000` (Nest)
- `/_next/static/` → disk standalone ops-web

**Portal (`portal.pttads.vn`):**

- `/` → `http://127.0.0.1:3100` (portal-web)
- `/api/` → `http://127.0.0.1:3000` (Nest same-origin)

---

## 11. Vận hành theo module

### 11.1. AI Revenue OS (Copilot)

**Runbook chi tiết:** [`ai-service-operations.md`](./ai-service-operations.md)

Bật pilot (sau smoke CRM PASS):

```bash
# 1. Verify DDL
./scripts/rnos01_pg_ddl_gate.sh
curl -s http://127.0.0.1:3000/api/v1/ai/health | jq .

# 2. Cấu hình LLM trong .env
AI_LLM_API_KEY=sk-...
PTT_AI_COPILOT_ENABLED=0          # bật sau UAT
PTT_AI_PILOT_USER_IDS=              # UUID 5–8 CSKH

# 3. Gate an toàn
bash scripts/rnos40_gate.sh
bash scripts/rnos_r1_prod_pilot_gate.sh

# 4. Bật cohort
bash scripts/rnos_r1_pilot_enable.sh --apply --cohort deploy/pilot-cohort.json
sudo systemctl restart ptt-crm-api

# 5. Rebuild ops-web với NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=1
```

Dashboard adoption: `https://rs.pttads.vn/crm/ai/insights`

**Rollback AI ≤5 phút:** `PTT_AI_COPILOT_ENABLED=0` → restart API + ops-web.

Playbook 90 ngày: [`cskh-ai-pilot-90-day-playbook.md`](./cskh-ai-pilot-90-day-playbook.md)

### 11.2. Meta / Facebook Ads

| Tác vụ | Runbook / lệnh |
|--------|----------------|
| Token refresh | [`meta-token-refresh.md`](./meta-token-refresh.md) |
| Insights replay | [`meta-insights-replay.md`](./meta-insights-replay.md) |
| Insights timer log | `journalctl -u ptt-meta-insights.service -n 50` |
| Sync thủ công | `./scripts/sync_meta_insights.sh` |
| Webhook Nest | `.env` `PTT_WEBHOOKS_NEST_META=1` |
| ClickHouse export | `journalctl -u ptt-meta-clickhouse-export.service` |

Staff hub: `https://rs.pttads.vn/crm/facebook-ads`

### 11.3. SEO / AEO

| Tác vụ | Runbook / lệnh |
|--------|----------------|
| GSC/GA4 OAuth cutover | [`seo-aeo-pg-oauth-uat-cutover.md`](./seo-aeo-pg-oauth-uat-cutover.md) |
| Cron timers | [`seo-aeo-cron.md`](./seo-aeo-cron.md) |
| ClickHouse BI | [`seo-aeo-clickhouse-bi.md`](./seo-aeo-clickhouse-bi.md) |
| Gate D | [`seo-aeo-gate-d.md`](./seo-aeo-gate-d.md) |
| Freshness scan | `sudo systemctl start ptt-seo-freshness-scan.service` |

Env cần: `SEO_AEO_DB=pg`, `PTT_GSC_SYNC_ENABLED=1`, `PTT_GA4_SYNC_ENABLED=1`, OAuth credentials.

Checklist in A4: `docs/forms/seo-aeo-ops-checklist-a4.html`

### 11.4. Email Marketing

| Tác vụ | Runbook / lệnh |
|--------|----------------|
| Prod pilot checklist | [`email-marketing-prod-pilot-checklist.md`](./email-marketing-prod-pilot-checklist.md) |
| Deliverability incident | [`email-deliverability-incident.md`](./email-deliverability-incident.md) |
| Campaign schedule timer | `ptt-email-campaign-schedule.timer` |
| Journey timer | `ptt-email-journey.timer` |

Checklist in A4: `docs/forms/email-marketing-ops-checklist-a4.html`

Webhook: `POST https://rs.pttads.vn/api/v1/webhooks/email`

### 11.5. Client Portal

| Tác vụ | Runbook / lệnh |
|--------|----------------|
| Deploy portal | [`deploy-client-portal.md`](./deploy-client-portal.md) |
| Phase 3 cutover | [`vps-phase3-portal-cutover-checklist.md`](./vps-phase3-portal-cutover-checklist.md) |
| Keycloak portal (tuỳ chọn) | [`keycloak-portal-auth.md`](./keycloak-portal-auth.md) |
| Keycloak staff WIN-4 | [`keycloak-staff-auth.md`](./keycloak-staff-auth.md) |
| Seed users | `python3 scripts/seed_portal_pilot_users.py` |

Portal URL: `https://portal.pttads.vn`

Roles: `viewer` (read-only) · `approver` (duyệt creative/email)

### 11.6. Zalo

Runbook cutover: [`zalo-prod-cutover.md`](./zalo-prod-cutover.md)

Webhook: `POST https://rs.pttads.vn/api/v1/webhooks/zalo`  
Env: `CRM_ZALO_WEBHOOK_SECRET`, `PTT_WEBHOOKS_NEST_ZALO=1`

### 11.7. Temporal workflows

Runbook admin: [`temporal-workflow-admin.md`](./temporal-workflow-admin.md)

```bash
journalctl -u ptt-temporal-worker -n 200 --no-pager
docker logs ptt-temporal --tail 50
# UI: ssh -L 8088:127.0.0.1:8088 deploy@VPS
```

---

## 12. Xử lý sự cố

### 12.1. Bảng tra nhanh

| Triệu chứng | Kiểm tra | Xử lý |
|-------------|----------|-------|
| **502 staff UI** | `systemctl status ptt-ops-web` | Rebuild standalone · verify port `:3200` · Nginx upstream |
| **502 portal UI** | `systemctl status ptt-portal-web` | Rebuild · port `:3100` |
| **502 API** | `curl localhost:3000/health` | `journalctl -u ptt-crm-api -n 100` · check `DATABASE_URL` |
| **Lead không vào CRM** | `SELECT * FROM job_queue WHERE status='pending'` | Restart `ptt-worker` · check webhook flags |
| **Webhook 503** | `.env` `PTT_WEBHOOKS_NEST_*` | Bật flag channel · `./scripts/apply_webhooks_upstream.sh` |
| **Portal login 401** | JWT secret · build URL | `PTT_PORTAL_JWT_SECRET` khớp · `NEXT_PUBLIC_PTT_API_URL=https://portal.pttads.vn` |
| **Staff login fail** | `staff_users` table | Không dùng stub prod · check `PTT_STAFF_JWT_SECRET` |
| **Copilot 503** | `GET /api/v1/ai/health` | Apply RNOS-01 DDL · check `AI_LLM_API_KEY` |
| **AI 403 pilot** | JWT `sub` vs cohort | Sửa `PTT_AI_PILOT_USER_IDS` · rebuild ops-web |
| **Meta insights trống** | `journalctl -u ptt-meta-insights` | Token refresh runbook · chạy sync thủ công |
| **SEO sync fail** | `journalctl -u ptt-seo-gsc-sync` | OAuth token · `PTT_GSC_SYNC_ENABLED=1` |
| **Temporal stuck** | worker + docker logs | [`temporal-workflow-admin.md`](./temporal-workflow-admin.md) |
| **Backup fail** | `journalctl -u ptt-backup` | Check `pg_dump` · disk space · `DATABASE_URL` |
| **Next.js static 404** | Browser devtools | `./scripts/patch_nginx_rs_static.sh` · copy `.next/static` |

### 12.2. Portal login 401 — checklist chi tiết

1. `PTT_PORTAL_JWT_SECRET` giống nhau trên Nest và `.env`
2. User trong `portal_client_users` (không stub prod):
   ```sql
   SELECT email, role, active FROM portal_client_users WHERE email = 'user@example.com';
   ```
3. Build portal với `NEXT_PUBLIC_PTT_API_URL=https://portal.pttads.vn`
4. Nginx `/api/` proxy Nest — test: `curl -sf https://portal.pttads.vn/health`
5. Restart sau sửa `.env`: `sudo systemctl restart ptt-crm-api ptt-portal-web`

### 12.3. Job queue kẹt

```bash
# Xem backlog
psql "$DATABASE_URL" -c \
  "SELECT id, job_type, status, attempts, created_at FROM job_queue WHERE status IN ('pending','processing') ORDER BY created_at LIMIT 20;"

# Restart worker
sudo systemctl restart ptt-worker
journalctl -u ptt-worker -f --since "5 min ago"
```

### 12.4. Disk đầy

```bash
df -h
du -sh /var/backups/rnosai /var/www/rnosai /var/lib/docker
docker system prune -f   # cẩn thận — chỉ khi hiểu rõ
find /var/backups/rnosai -mtime +14 -delete   # retention thủ công
```

---

## 13. Rollback nhanh

| Tình huống | Hành động | SLA |
|------------|-----------|-----|
| Deploy code lỗi | `git checkout <tag>` → rebuild §7.1 | ≤ 15 phút |
| AI lỗi | `PTT_AI_COPILOT_ENABLED=0` → restart API + ops-web | ≤ 5 phút |
| Nginx lỗi | Restore `.bak` trong `/etc/nginx/sites-available/` → `nginx -t && reload` | ≤ 5 phút |
| Portal sự cố | `sudo systemctl stop ptt-portal-web` + gỡ nginx site | ≤ 10 phút |
| Meta write lỗi | `PTT_META_CAMPAIGN_WRITE_STUB=1` hoặc tắt pilot flag | ≤ 5 phút |
| SEO module lỗi | Tắt flag: `PTT_SEO_GOVERNANCE_ENABLED=0`, … → restart | ≤ 5 phút |
| DB migration lỗi | **Forward fix** — không rollback DDL | Case-by-case |
| DB disaster | Restore `pg_dump` §8.3 | ≤ 30 phút |

Drill AI rollback:

```bash
bash scripts/rnos40_rollback_drill.sh
```

Rollback code:

```bash
cd /var/www/rnosai
git log --oneline -5
git checkout <known-good-tag-or-commit>
# Rebuild theo §7.1
```

---

## 14. Bảo mật & checklist định kỳ

### 14.1. Bảo mật production

| Mục | Yêu cầu |
|-----|---------|
| `.env` | chmod 600, owner `deploy`, không commit git |
| Stub users | `PTT_PORTAL_ALLOW_STUB=0`, `PTT_STAFF_STUB_USERS=` (empty) |
| PII logging | `PTT_AI_LOG_PII=0`, `PTT_AI_LOG_PROMPTS=0` |
| JWT secrets | ≥ 32 ký tự random, rotate có kế hoạch |
| Webhook secrets | Vault — Meta/Zalo/Google verify tokens |
| Firewall | Chỉ 22, 80, 443 public |
| Flask | `ptt.service` **disabled** |
| Temporal UI | Không public — SSH tunnel only |
| LLM key | Vault — không log trong journalctl |

### 14.2. Checklist hàng tuần

| # | Mục | OK |
|---|-----|-----|
| 1 | Health check §6.1 PASS | ☐ |
| 2 | Backup files ≤ 24h trong `/var/backups/rnosai/` | ☐ |
| 3 | Timer `ptt-meta-insights` chạy OK (journalctl) | ☐ |
| 4 | Job queue không backlog > 100 pending | ☐ |
| 5 | Disk usage < 80% | ☐ |
| 6 | certbot renew dry-run OK | ☐ |
| 7 | Không lỗi Sentry spike (nếu bật) | ☐ |

### 14.3. Checklist hàng tháng

| # | Mục | OK |
|---|-----|-----|
| 1 | Review `git log` — deploy đúng change window | ☐ |
| 2 | Rotate review webhook secrets (nếu policy yêu cầu) | ☐ |
| 3 | Test restore backup trên staging | ☐ |
| 4 | Review AI adoption dashboard | ☐ |
| 5 | Meta token expiry check | ☐ |
| 6 | SEO OAuth token refresh OK | ☐ |
| 7 | Gate report archive `.local-dev/*-gate-report.json` | ☐ |

### 14.4. Không làm trên production

- Start `ptt.service` (Flask)
- Set `PTT_VPS_HOST=127.0.0.1` khi chạy cutover SSH script
- Apply DDL không backup
- Commit `.env`, `pilot-cohort.json`, API keys
- Public port Postgres/Temporal/ClickHouse
- Enable stub users trên prod

---

## 15. Tài liệu liên quan

### Runbook VPS & deploy

| Tài liệu | Nội dung |
|----------|----------|
| [`vps-rnosai-production-setup-complete.md`](./vps-rnosai-production-setup-complete.md) | Setup greenfield v3.0 (15 bước) |
| [`vps-full-system-deploy.md`](./vps-full-system-deploy.md) | Deploy gốc (tham chiếu lịch sử) |
| [`vps-production-operations.md`](./vps-production-operations.md) | Ops phase cũ (một số mục Flask lỗi thời) |

### Module ops

| Tài liệu | Module |
|----------|--------|
| [`ai-service-operations.md`](./ai-service-operations.md) | AI Copilot / Revenue OS |
| [`cskh-ai-pilot-90-day-playbook.md`](./cskh-ai-pilot-90-day-playbook.md) | Pilot CSKH 90 ngày |
| [`meta-token-refresh.md`](./meta-token-refresh.md) | Meta token |
| [`seo-aeo-cron.md`](./seo-aeo-cron.md) | SEO timers |
| [`email-marketing-prod-pilot-checklist.md`](./email-marketing-prod-pilot-checklist.md) | Email prod |
| [`temporal-workflow-admin.md`](./temporal-workflow-admin.md) | Temporal admin |
| [`zalo-prod-cutover.md`](./zalo-prod-cutover.md) | Zalo webhook |

### Spec & chiến lược

| Tài liệu | Nội dung |
|----------|----------|
| [`../specs/2026-08-01-rnosai-mobile-strategy-spec.md`](../specs/2026-08-01-rnosai-mobile-strategy-spec.md) | Mobile M1–M3 · §6.4 M3 Capacitor · §7.7 runbook này |
| [`m1-pwa-prod-cutover-checklist.md`](./m1-pwa-prod-cutover-checklist.md) | M1 Staff PWA cutover (`rs.pttads.vn`) |
| [`m2-portal-pwa-staging-cutover-checklist.md`](./m2-portal-pwa-staging-cutover-checklist.md) | **M2 Portal PWA + push** (`portal.pttads.vn`, Approver) |
| [`mob-p2-polish-staging-cutover-checklist.md`](./mob-p2-polish-staging-cutover-checklist.md) | **P2 polish** sau M1/M2 (bottom sheet, pull refresh, swipe) |

### Bàn giao khách hàng

| Tài liệu | Đối tượng |
|----------|-----------|
| [`../handover/README.md`](../handover/README.md) | Index handover pack |
| [`../handover/04-KIEN-TRUC-TRIEN-KHAI-BAN-GIAO.md`](../handover/04-KIEN-TRUC-TRIEN-KHAI-BAN-GIAO.md) | Kiến trúc bàn giao |

### Config & scripts

| Path | Mô tả |
|------|-------|
| `deploy/env.phase5-flask-retire.example` | Env platform prod |
| `deploy/env.ai.example` | Env AI |
| `deploy/nginx-rs-flask-retired.conf` | Nginx staff |
| `deploy/nginx-portal.conf` | Nginx portal |
| `deploy/grafana/` | Dashboard Grafana |
| `scripts/backup_ptt_data.sh` | Backup PG + SQLite |
| `scripts/rnosai_pg_guard.sh` | Guard DDL sai DB |
| `services/mobile-shell/` | RNOS-M3 Capacitor scaffold (`vn.pttads.portal`) |

### Use case & spec

| Tài liệu | Mô tả |
|----------|-------|
| [`../use-cases/README.md`](../use-cases/README.md) | Catalog 101 UC |
| [`../specs/RNOSAI-BA-Master-Spec.md`](../specs/RNOSAI-BA-Master-Spec.md) | BA Master Spec |

---

## Phụ lục A — Lệnh one-liner hữu ích

```bash
# Trạng thái toàn stack
systemctl is-active ptt-crm-api ptt-ops-web ptt-portal-web ptt-worker ptt-temporal-worker && \
curl -sf http://127.0.0.1:3000/health && echo " ALL OK"

# Xem tất cả lỗi 1h qua (Nest)
journalctl -u ptt-crm-api --since "1 hour ago" -p err --no-pager

# Disk + backup mới nhất
df -h / && ls -lt /var/backups/rnosai/ | head -3

# Commit đang chạy prod
cd /var/www/rnosai && git log -1 --format='%h %ci %s'

# Reload nginx sau sửa conf
sudo nginx -t && sudo systemctl reload nginx
```

## Phụ lục B — Bảng port nội bộ

| Port | Service | Public |
|------|---------|--------|
| 3000 | Nest CRM API | Không |
| 3100 | portal-web | Không |
| 3200 | ops-web | Không |
| 5433 | PostgreSQL | Không |
| 6380 | Redis (local dev) | Không |
| 7233 | Temporal gRPC | Không |
| 8088 | Temporal UI | Không (tunnel) |
| 8123 | ClickHouse HTTP | Không |
| 9200 | OpenSearch | Không |

---

*RNOSAI VPS Operations Guide v1.2 — cập nhật khi đổi domain canonical, systemd units, hoặc kiến trúc stack.*
