# Hướng dẫn setup VPS — RNOSAI (hệ thống hoàn chỉnh)

> **Phiên bản:** 3.1 · **Ngày:** 2026-08-01  
> **Repo:** https://github.com/sdadtuan/RNOSAI · branch `main` @ P1+P2 merged  
> **Thư mục trên VPS:** `/var/www/rnosai`  
> **PostgreSQL (VPS):** `127.0.0.1:5433/rnosaidb` · user `ptt`  
> **Backup:** `/var/backups/rnosai`  
> **User deploy:** `deploy` (group `www-data`)  
> **Runbook cũ (tham chiếu):** [`vps-full-system-deploy.md`](./vps-full-system-deploy.md) · [`vps-production-operations.md`](./vps-production-operations.md)

Tài liệu này là **checklist setup từ VPS trắng → production** cho stack RNOSAI đã hoàn thiện: CRM + Channel OS + Agency + Portal + **AI Revenue OS** (Copilot, forecast, anomaly, adoption dashboard).

---

## Mục lục

1. [Kiến trúc & domain](#1-kiến-trúc--domain)
2. [Checklist trước khi bắt đầu](#2-checklist-trước-khi-bắt-đầu)
3. [Bước 1 — Chuẩn bị VPS](#bước-1--chuẩn-bị-vps)
4. [Bước 2 — Clone repository](#bước-2--clone-repository)
5. [Bước 3 — Python venv & dependencies](#bước-3--python-venv--dependencies)
6. [Bước 4 — Docker (PostgreSQL, Redis, …)](#bước-4--docker-postgresql-redis-)
7. [Bước 5 — PostgreSQL DDL](#bước-5--postgresql-ddl)
8. [Bước 6 — File `.env` production](#bước-6--file-env-production)
9. [Bước 7 — Build Nest API](#bước-7--build-nest-api)
10. [Bước 8 — Build ops-web (staff)](#bước-8--build-ops-web-staff)
11. [Bước 9 — Build portal-web (client)](#bước-9--build-portal-web-client)
12. [Bước 10 — Systemd workers & timers](#bước-10--systemd-workers--timers)
13. [Bước 11 — Nginx & TLS](#bước-11--nginx--tls)
14. [Bước 12 — Khởi động stack](#bước-12--khởi-động-stack)
15. [Bước 13 — AI layer (Revenue OS)](#bước-13--ai-layer-revenue-os)
16. [Bước 14 — Seed users & smoke test](#bước-14--seed-users--smoke-test)
17. [Bước 15 — Gate nghiệm thu](#bước-15--gate-nghiệm-thu)
18. [Deploy bản mới (routine)](#deploy-bản-mới-routine)
19. [Rollback nhanh](#rollback-nhanh)
20. [Xử lý sự cố](#xử-lý-sự-cố)
21. [Tài liệu liên quan](#tài-liệu-liên-quan)

---

## 1. Kiến trúc & domain

```mermaid
flowchart TB
    subgraph staff [Staff — nhân viên PTT]
        RS[https://rs.pttads.vn]
    end
    subgraph client [Client — khách hàng]
        PORTAL[https://portal.pttads.vn]
    end
    subgraph redirect [Redirect]
        OPS[ops.pttads.vn → rs.pttads.vn]
    end
    subgraph localhost [localhost only]
        OW[ops-web :3200]
        PW[portal-web :3100]
        NEST[Nest ptt-crm-api :3000]
        WRK[ptt-worker]
        FB[ptt-fb-autosync]
        TW[ptt-temporal-worker]
    end
    subgraph docker [Docker]
        PG[(PostgreSQL :5433)]
        REDIS[Redis]
        TEMP[Temporal :7233]
    end
    OPS --> RS
    RS --> OW
    RS --> NEST
    PORTAL --> PW
    PORTAL --> NEST
    NEST --> PG
    WRK --> PG
```

| Domain | Vai trò | Routing |
|--------|---------|---------|
| **`https://rs.pttads.vn`** | **Staff console chính** — CRM, Meta, Zalo, Email, SEO, AI insights | `/` → ops-web `:3200` · `/api/` → Nest `:3000` |
| **`https://portal.pttads.vn`** | Client portal — performance, creative approval | `/` → portal-web `:3100` · `/api/` → Nest `:3000` |
| **`https://ops.pttads.vn`** | Bookmark cũ | **301** → `rs.pttads.vn` |

**Webhook công khai (Meta/Zalo/Google/Email):**

```text
POST https://rs.pttads.vn/api/v1/webhooks/{meta|zalo|google|email}
GET  https://rs.pttads.vn/api/v1/channels
```

**Firewall:** chỉ mở **22, 80, 443**. Không public `:3000`, `:3100`, `:3200`, `:5433`.

---

## 2. Checklist trước khi bắt đầu

Điền trước khi SSH:

| Mục | Giá trị |
|-----|---------|
| VPS IP | `________________` |
| Ubuntu | 22.04 / 24.04 LTS |
| RAM / Disk | ≥ 8 GB / ≥ 80 GB SSD |
| DNS `rs.pttads.vn` → IP | ☐ |
| DNS `portal.pttads.vn` → IP | ☐ |
| DNS `ops.pttads.vn` → IP | ☐ (redirect) |
| Meta App verify token + secret | ☐ vault |
| Zalo webhook secret | ☐ vault |
| LLM API key (OpenAI/Azure) | ☐ vault |
| Change window | `________________` |
| On-call | `________________` |

**Thời gian ước lượng:** greenfield lần đầu **4–8 giờ** (DDL + build + TLS + smoke).

---

## Bước 1 — Chuẩn bị VPS

SSH vào VPS với user có `sudo`:

```bash
# 1.1 — Packages cơ bản
sudo apt-get update
sudo apt-get install -y git curl nginx certbot python3-certbot-nginx \
  python3.11 python3.11-venv python3.11-dev build-essential \
  postgresql-client jq

# 1.2 — Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # v22.x
npm -v

# 1.3 — Docker + Compose
sudo apt-get install -y docker.io docker-compose-v2
sudo systemctl enable --now docker

# 1.4 — User deploy
sudo adduser deploy
sudo usermod -aG docker deploy
sudo usermod -aG www-data deploy

# 1.5 — Thư mục app & backup
sudo mkdir -p /var/www/rnosai /var/backups/rnosai
sudo chown deploy:www-data /var/www/rnosai
sudo chmod 775 /var/www/rnosai
```

**Firewall (ufw ví dụ):**

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Bước 2 — Clone repository

```bash
sudo -u deploy -i
cd /var/www/rnosai

git clone https://github.com/sdadtuan/RNOSAI.git .
git checkout main
git log -1 --oneline   # xác nhận commit mới nhất
```

---

## Bước 3 — Python venv & dependencies

Workers Python (`ptt_worker`, jobs, seed scripts) cần venv:

```bash
cd /var/www/rnosai
python3.11 -m venv .venv
source .venv/bin/activate
pip install -U pip wheel
pip install -r requirements.txt
pip install -r requirements-temporal.txt
```

---

## Bước 4 — Docker (PostgreSQL, Redis, …)

Trên **VPS production**, Postgres chạy host port **5433** với database **`rnosaidb`** (container `rnosai-postgres`, map `5433:5432`).

```bash
cd /var/www/rnosai

# Core infra
docker compose up -d postgres redis rabbitmq

# Temporal (workflows agency/onboard)
docker compose -f docker-compose.temporal.yml up -d

# ClickHouse (BI Meta/Email/SEO — bật khi cần analytics)
docker compose -f docker-compose.clickhouse.yml up -d
```

Chờ Postgres:

```bash
docker compose exec -T postgres pg_isready -U ptt -d rnosaidb
# hoặc tên DB trong docker-compose của bạn
```

> **Local dev** và **VPS prod** đều dùng **`rnosaidb`** @ `127.0.0.1:5433` (docker-compose). Thư mục app VPS: **`/var/www/rnosai`**. Luôn set `DATABASE_URL` khớp môi trường thực tế.

---

## Bước 5 — PostgreSQL DDL

Apply **theo thứ tự** (idempotent). Backup trước prod:

```bash
cd /var/www/rnosai
source .venv/bin/activate

export DATABASE_URL=postgresql://ptt:STRONG_PASSWORD@127.0.0.1:5433/rnosaidbdb

# Backup (prod bắt buộc)
pg_dump "$DATABASE_URL" | gzip > /var/backups/rnosai/pre-ddl-$(date +%F).sql.gz

# ── Platform core ──
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

# ── RNOS-01 Revenue OS + AI (16 bảng — BẮT BUỘC trước Copilot) ──
./scripts/apply_pg_ddl_revenue_os_ai.sh
./scripts/rnos01_pg_ddl_gate.sh

# ── Email marketing (nếu dùng module Email) ──
./scripts/apply_pg_ddl_email_mkt.sh
./scripts/apply_pg_ddl_email_mkt_em1.sh
./scripts/apply_pg_ddl_email_mkt_em3.sh

# ── ClickHouse init ──
./scripts/clickhouse_init.sh
```

Verify RNOS-01:

```bash
psql "$DATABASE_URL" -c "SELECT tablename FROM pg_tables WHERE tablename LIKE 'ai_%' ORDER BY 1;"
# Kỳ vọng: ai_agent_runs, ai_prompts, ai_recommendations, ai_scores, ...
```

Chi tiết: [`rnos01-ddl-apply.md`](./rnos01-ddl-apply.md)

---

## Bước 6 — File `.env` production

Tạo **một file master** đọc bởi mọi systemd unit:

```bash
cp deploy/env.phase5-flask-retire.example /var/www/rnosai/.env
chmod 600 /var/www/rnosai/.env
nano /var/www/rnosai/.env
```

### 6.1 — Merge các mẫu

| Mẫu | Nội dung |
|-----|----------|
| `deploy/env.phase5-flask-retire.example` | Flask retired, webhook Nest-only |
| `deploy/env.phase3-prod.example` | Portal JWT, Temporal, SEO portal |
| `deploy/env.ai.example` | AI Copilot, LLM, audit flags |

### 6.2 — Biến bắt buộc (tối thiểu)

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

# ── Staff auth (ops-web / rs.pttads.vn) ──
PTT_STAFF_JWT_SECRET=<random-32-chars-min>
PTT_STAFF_STUB_USERS=
PTT_OPS_CORS_ORIGINS=https://rs.pttads.vn
PTT_OPS_WEB_URL=https://rs.pttads.vn

# ── Portal (portal.pttads.vn) ──
PTT_PORTAL_JWT_SECRET=<random-32-chars-min>
PTT_PORTAL_ALLOW_STUB=0
PTT_PORTAL_CORS_ORIGINS=https://portal.pttads.vn
NEXT_PUBLIC_PTT_API_URL=https://portal.pttads.vn

# ── Channel secrets (prod) ──
CRM_FACEBOOK_VERIFY_TOKEN=...
CRM_FACEBOOK_APP_SECRET=...
CRM_FACEBOOK_PAGE_ACCESS_TOKEN=...
CRM_ZALO_WEBHOOK_SECRET=...
CRM_GOOGLE_LEAD_WEBHOOK_KEY=...
CRM_FACEBOOK_BACKGROUND=1
CRM_FACEBOOK_BACKGROUND_IN_GUNICORN=0

# ── Temporal ──
PTT_TEMPORAL_ADDRESS=127.0.0.1:7233

# ── AI (bật sau smoke — xem Bước 13) ──
PTT_AI_COPILOT_ENABLED=0
PTT_AI_PILOT_USER_IDS=
PTT_AI_LLM_PROVIDER=openai
PTT_AI_LLM_MODEL=gpt-4o-mini
AI_LLM_API_KEY=<vault>
PTT_AI_LOG_PII=0
PTT_AI_LOG_PROMPTS=0
PTT_AI_SCORE_ASYNC=1
```

> **Không commit** `.env` lên git. Secrets lưu vault/password manager.

---

## Bước 7 — Build Nest API

```bash
cd /var/www/rnosai/services/ptt-crm-api
npm ci
npm run build

sudo cp /var/www/rnosai/deploy/ptt-crm-api.service /etc/systemd/system/
sudo systemctl daemon-reload
```

Kiểm tra nhanh (chưa cần start nếu PG chưa sẵn):

```bash
test -f dist/main.js && echo "Nest build OK"
```

---

## Bước 8 — Build ops-web (staff)

Staff UI chạy trên **`rs.pttads.vn`** — API URL phải cùng origin:

```bash
cd /var/www/rnosai/services/ops-web
npm ci

export NEXT_PUBLIC_PTT_API_URL=https://rs.pttads.vn
export NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=0
export NEXT_PUBLIC_PTT_AI_PILOT_USER_IDS=
# export NEXT_PUBLIC_PWA_ENABLED=1

npm run build

# Standalone Next.js — copy static assets
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public 2>/dev/null || true

sudo cp /var/www/rnosai/deploy/ptt-ops-web.service /etc/systemd/system/
sudo systemctl daemon-reload
```

---

## Bước 9 — Build portal-web (client)

```bash
cd /var/www/rnosai/services/portal-web
npm ci

export NEXT_PUBLIC_PTT_API_URL=https://portal.pttads.vn
npm run build

cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public 2>/dev/null || true

sudo cp /var/www/rnosai/deploy/ptt-portal-web.service /etc/systemd/system/
sudo systemctl daemon-reload
```

---

## Bước 10 — Systemd workers & timers

```bash
cd /var/www/rnosai

# Long-running services
sudo cp deploy/ptt-worker.service /etc/systemd/system/
sudo cp deploy/ptt-fb-autosync.service /etc/systemd/system/
sudo cp deploy/ptt-temporal-worker.service /etc/systemd/system/

# Root timers (Facebook sync, Meta insights, alerts)
sudo cp ptt-fb-sync.service ptt-fb-sync.timer /etc/systemd/system/
sudo cp ptt-meta-insights.service ptt-meta-insights.timer /etc/systemd/system/
sudo cp ptt-meta-token-refresh.service ptt-meta-token-refresh.timer /etc/systemd/system/
sudo cp ptt-owner-weekly-alert.service ptt-owner-weekly-alert.timer /etc/systemd/system/
sudo cp ptt-finance-kpi-alert.service ptt-finance-kpi-alert.timer /etc/systemd/system/

# Phase packs
sudo ./scripts/install_phase3_systemd.sh
sudo ./scripts/install_phase2_systemd_timers.sh

# Backup (khuyến nghị)
sudo cp deploy/ptt-backup.service deploy/ptt-backup.timer /etc/systemd/system/

sudo systemctl daemon-reload
```

**Không start `ptt.service`** (Flask đã retired).

| Unit | Vai trò |
|------|---------|
| `ptt-crm-api` | Nest API `:3000` |
| `ptt-ops-web` | Staff UI `:3200` |
| `ptt-portal-web` | Client UI `:3100` |
| `ptt-worker` | Job queue (lead ingest, email) |
| `ptt-fb-autosync` | Facebook lead background |
| `ptt-temporal-worker` | Temporal workflows |

---

## Bước 11 — Nginx & TLS

### 11.1 — Staff: `rs.pttads.vn` (ops-web + Nest)

```bash
sudo cp /var/www/rnosai/deploy/nginx-rs-flask-retired.conf \
        /etc/nginx/sites-available/rs.pttads.vn
sudo ln -sf /etc/nginx/sites-available/rs.pttads.vn /etc/nginx/sites-enabled/
```

File này proxy:
- `/` → ops-web `:3200`
- `/api/` → Nest `:3000`
- `/_next/static/` → disk standalone

### 11.2 — Client: `portal.pttads.vn`

```bash
sudo cp /var/www/rnosai/deploy/nginx-portal.conf \
        /etc/nginx/sites-available/portal.pttads.vn
sudo ln -sf /etc/nginx/sites-available/portal.pttads.vn /etc/nginx/sites-enabled/
```

### 11.3 — Redirect: `ops.pttads.vn` → `rs.pttads.vn`

```bash
sudo cp /var/www/rnosai/deploy/nginx-ops.conf \
        /etc/nginx/sites-available/ops.pttads.vn
sudo ln -sf /etc/nginx/sites-available/ops.pttads.vn /etc/nginx/sites-enabled/
```

### 11.4 — TLS

**Lần đầu** (chưa có cert): comment block `ssl` trong conf → certbot → restore file đầy đủ.

```bash
# Hoặc dùng cert có sẵn tại /etc/nginx/ssl/portalpttadsvn.pem
sudo certbot --nginx -d rs.pttads.vn -d portal.pttads.vn -d ops.pttads.vn
sudo nginx -t && sudo systemctl reload nginx
```

---

## Bước 12 — Khởi động stack

```bash
sudo systemctl enable --now ptt-crm-api
sudo systemctl enable --now ptt-ops-web
sudo systemctl enable --now ptt-portal-web
sudo systemctl enable --now ptt-worker
sudo systemctl enable --now ptt-fb-autosync
sudo systemctl enable --now ptt-temporal-worker

sudo systemctl enable --now ptt-fb-sync.timer
sudo systemctl enable --now ptt-meta-insights.timer
sudo systemctl enable --now ptt-google-insights.timer
sudo systemctl enable --now ptt-backup.timer
```

Verify:

```bash
systemctl is-active ptt-crm-api ptt-ops-web ptt-portal-web ptt-worker
curl -sf http://127.0.0.1:3000/health && echo " Nest OK"
curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK"
curl -sf http://127.0.0.1:3100/login -o /dev/null && echo " portal OK"
```

---

## Bước 13 — AI layer (Revenue OS)

Sau khi CRM smoke PASS, bật AI **từng bước** (flag off lần deploy đầu là best practice).

### 13.1 — Verify DDL & health

```bash
source /var/www/rnosai/.venv/bin/activate
export DATABASE_URL=postgresql://ptt:***@127.0.0.1:5433/rnosaidb

./scripts/rnos01_pg_ddl_gate.sh

curl -s http://127.0.0.1:3000/api/v1/ai/health | jq .
# schema_ready: true, migration: 2026-07-26-revenue-os-ai
```

### 13.2 — Cấu hình LLM trong `.env`

```bash
nano /var/www/rnosai/.env
```

Thêm / sửa (từ `deploy/env.ai.example`):

```bash
AI_LLM_API_KEY=sk-...
PTT_AI_LLM_PROVIDER=openai
PTT_AI_LLM_MODEL=gpt-4o-mini
PTT_AI_LOG_PII=0
PTT_AI_LOG_PROMPTS=0
PTT_AI_SCORE_ASYNC=1
PTT_AI_COPILOT_ENABLED=0          # bật sau UAT
PTT_AI_PILOT_USER_IDS=              # UUID 5–8 CSKH khi pilot
```

Restart API:

```bash
sudo systemctl restart ptt-crm-api
```

### 13.3 — Gate AI an toàn (trước pilot)

```bash
cd /var/www/rnosai
bash scripts/rnos40_gate.sh
bash scripts/rnos39_gate.sh          # E2E copilot (có thể OPS_E2E_SKIP_SERVER=1 trên CI)
bash scripts/rnos_r1_prod_pilot_gate.sh
```

### 13.4 — Bật Copilot pilot (5–8 CSKH)

```bash
cp deploy/pilot-cohort.example.json deploy/pilot-cohort.json
# Điền staff UUID thật — KHÔNG commit

bash scripts/rnos_r1_pilot_enable.sh --apply --cohort deploy/pilot-cohort.json
# Load env snippet → restart

sudo systemctl restart ptt-crm-api

# Rebuild ops-web với NEXT_PUBLIC_* khớp cohort
cd /var/www/rnosai/services/ops-web
export NEXT_PUBLIC_PTT_API_URL=https://rs.pttads.vn
export NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=1
export NEXT_PUBLIC_PTT_AI_PILOT_USER_IDS=uuid1,uuid2,...
npm run build
cp -r .next/static .next/standalone/.next/static
sudo systemctl restart ptt-ops-web
```

**Playbook vận hành 90 ngày:** [`cskh-ai-pilot-90-day-playbook.md`](./cskh-ai-pilot-90-day-playbook.md)

**Dashboard adoption:** `https://rs.pttads.vn/crm/ai/insights`

**Rollback AI ≤5 phút:** `PTT_AI_COPILOT_ENABLED=0` → restart API + ops-web.

---

## Bước 14 — Seed users & smoke test

### 14.1 — Portal pilot users

```bash
cd /var/www/rnosai
source .venv/bin/activate
export DATABASE_URL=postgresql://ptt:***@127.0.0.1:5433/rnosaidb
export PORTAL_PILOT_PASSWORD='<min-8-chars>'

python3 scripts/seed_portal_pilot_users.py --password "$PORTAL_PILOT_PASSWORD"
```

Login thử: `viewer.pilot1@pttads.vn` @ `https://portal.pttads.vn/login`

### 14.2 — Staff users

Production dùng bảng PG `staff_users` — tạo qua quy trình Admin/HR (không dùng stub prod).

### 14.3 — Smoke test (15 phút)

```bash
# Health
curl -sfI https://rs.pttads.vn/login | head -1
curl -sfI https://portal.pttads.vn/login | head -1
curl -sfI https://ops.pttads.vn/crm/leads | head -1    # expect 301 → rs

# API
curl -sf https://rs.pttads.vn/health
curl -sf http://127.0.0.1:3000/api/v1/ai/health | jq .data.schema_ready

# Webhook dry-run (401/403 OK nếu thiếu secret)
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://rs.pttads.vn/api/v1/webhooks/zalo \
  -H 'Content-Type: application/json' -d '{}'
```

| # | Kiểm tra tay | OK |
|---|--------------|-----|
| 1 | Staff login `rs.pttads.vn` → `/crm/leads` | ☐ |
| 2 | Portal login → `/dashboard` | ☐ |
| 3 | Lead mới qua webhook → CRM list | ☐ |
| 4 | `ptt-worker` xử lý `job_queue` | ☐ |
| 5 | Copilot panel (pilot user) → score + brief | ☐ |
| 6 | `/crm/ai/insights` adoption panel load | ☐ |
| 7 | `systemctl is-active ptt.service` → **inactive** | ☐ |

---

## Bước 15 — Gate nghiệm thu

```bash
cd /var/www/rnosai
source .venv/bin/activate
set -a && source .env && set +a

# Platform
./scripts/wave8_gate.sh
./scripts/staging_phase5_gate_pack.sh

# AI R1
./scripts/rnos_r1_prod_pilot_gate.sh

# P1 Revenue OS maturity
./scripts/rnos_p1_revenue_os_maturity_gate.sh

# P2 R4 DoD
./scripts/rnos_p2_r4_dod_gate.sh

# Phase 0 data (timeline + attribution)
./scripts/rnos_phase0_gate.sh
```

Artifact: `.local-dev/*-gate-report.json`

---

## Deploy bản mới (routine)

```bash
cd /var/www/rnosai
./scripts/backup_ptt_data.sh

git pull origin main
source .venv/bin/activate
pip install -r requirements.txt

# Nest
cd services/ptt-crm-api && npm ci && npm run build
sudo systemctl restart ptt-crm-api

# ops-web
cd /var/www/rnosai/services/ops-web
npm ci
export NEXT_PUBLIC_PTT_API_URL=https://rs.pttads.vn
# giữ NEXT_PUBLIC_PTT_AI_* nếu đang pilot
npm run build
cp -r .next/static .next/standalone/.next/static
sudo systemctl restart ptt-ops-web

# portal-web
cd /var/www/rnosai/services/portal-web
npm ci && NEXT_PUBLIC_PTT_API_URL=https://portal.pttads.vn npm run build
cp -r .next/static .next/standalone/.next/static
sudo systemctl restart ptt-portal-web

sudo systemctl restart ptt-worker ptt-fb-autosync ptt-temporal-worker

# DDL mới nếu release có migration
# ./scripts/apply_pg_ddl_*.sh

curl -sf http://127.0.0.1:3000/health && echo OK
```

---

## Rollback nhanh

| Tình huống | Hành động |
|------------|-----------|
| Deploy code lỗi | `git checkout <tag>` → rebuild mục routine |
| AI lỗi | `PTT_AI_COPILOT_ENABLED=0` → restart API + ops-web |
| Nginx lỗi | Restore `.bak` trong `/etc/nginx/sites-available/` |
| DB migration lỗi | **Không** rollback DDL — forward fix; restore `pg_dump` chỉ khi disaster |

```bash
bash scripts/rnos40_rollback_drill.sh   # drill AI rollback
```

---

## Xử lý sự cố

| Triệu chứng | Kiểm tra | Xử lý |
|-------------|----------|-------|
| 502 staff UI | `systemctl status ptt-ops-web` | Rebuild standalone · port `:3200` |
| 502 API | `curl localhost:3000/health` | `journalctl -u ptt-crm-api -n 100` |
| Lead không vào CRM | `job_queue` + worker | `systemctl restart ptt-worker` |
| Webhook 503 | `.env` `PTT_WEBHOOKS_NEST_*` | Bật flag channel tương ứng |
| Copilot 503 | `GET /api/v1/ai/health` | Apply RNOS-01 DDL · check `AI_LLM_API_KEY` |
| AI 403 pilot | JWT `sub` vs `PTT_AI_PILOT_USER_IDS` | Sửa cohort · rebuild ops-web |
| Portal login fail | `portal_client_users` | Re-seed · check JWT secret |

**Log:**

```bash
journalctl -u ptt-crm-api -f --since "30 min ago"
journalctl -u ptt-worker -n 100 --no-pager
journalctl -u ptt-ops-web -n 50 --no-pager
```

---

## Tài liệu liên quan

| Tài liệu | Nội dung |
|----------|----------|
| [`rnosai-vps-operations-guide.md`](./rnosai-vps-operations-guide.md) | **Vận hành hàng ngày** — deploy, backup, sự cố, module ops |
| [`m1-pwa-prod-cutover-checklist.md`](./m1-pwa-prod-cutover-checklist.md) | Cutover PWA M1 prod (RNOS-41) |
| [`vps-full-system-deploy.md`](./vps-full-system-deploy.md) | Runbook deploy gốc (một số URL cần đối chiếu doc này) |
| [`ai-service-operations.md`](./ai-service-operations.md) | Vận hành AI hàng ngày |
| [`cskh-ai-pilot-90-day-playbook.md`](./cskh-ai-pilot-90-day-playbook.md) | Pilot CSKH 90 ngày |
| [`rnos-r1-prod-pilot-gate.md`](./rnos-r1-prod-pilot-gate.md) | Gate R1 sign-off |
| [`rnos01-ddl-apply.md`](./rnos01-ddl-apply.md) | DDL AI tables |
| `deploy/env.phase5-flask-retire.example` | Env platform prod |
| `deploy/env.ai.example` | Env AI |
| `deploy/nginx-rs-flask-retired.conf` | Nginx staff (rs) |
| `deploy/nginx-portal.conf` | Nginx portal |

---

*RNOSAI VPS setup v3.0 — cập nhật khi đổi domain canonical, systemd units, hoặc gate scripts.*
