#!/usr/bin/env bash
# Tạo database rnosaidb — KHÔNG thao tác ptt_agency (dự án khác port 5432)
# Usage:
#   ./scripts/create_rnosaidb.sh docker    # RNOSAI container port 5433 (khuyến nghị)
#   ./scripts/create_rnosaidb.sh local    # chỉ khi Postgres RIÊNG, không phải :5432 dự án khác
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${POSTGRES_DB:-rnosaidb}"
DB_USER="${POSTGRES_USER:-ptt}"
DB_PASS="${POSTGRES_PASSWORD:-ptt_dev}"
PG_PORT="${RNOSAI_PG_PORT:-5433}"

mode="${1:-docker}"

echo "== RNOSAI database: ${DB_NAME} (mode=${mode}, port=${PG_PORT}) =="
echo "    KHÔNG dùng postgresql://...:5432/ptt_agency — dự án khác"

if [[ "$mode" == "docker" ]]; then
  if ! docker info >/dev/null 2>&1; then
    echo "FAIL  Docker daemon chưa chạy — mở Docker Desktop: open -a Docker" >&2
    exit 1
  fi
  cd "$ROOT"
  docker compose up -d postgres
  docker compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME"
  echo "OK  ${DB_NAME} on Docker (host port ${PG_PORT})"
  echo ""
  echo "  source deploy/env.local.example"
  echo "  # DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:${PG_PORT}/${DB_NAME}"
  exit 0
fi

# local mode — cảnh báo nếu trỏ port 5432 (thường là dự án khác)
if [[ "$PG_PORT" == "5432" ]]; then
  echo "WARN  Port 5432 thường là ptt_agency dự án khác." >&2
  echo "      Khuyến nghị: ./scripts/create_rnosaidb.sh docker  (port 5433)" >&2
  read -r -p "Tiếp tục trên port 5432? [y/N] " ans
  [[ "$ans" =~ ^[yY]$ ]] || exit 1
fi

ADMIN_URL="${PGADMIN_URL:-postgresql://${DB_USER}@127.0.0.1:${PG_PORT}/postgres}"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found — dùng: ./scripts/create_rnosaidb.sh docker" >&2
  exit 1
fi

if ! psql "$ADMIN_URL" -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null | grep -q 1; then
  echo "==> Creating role ${DB_USER}"
  createuser -s "$DB_USER" 2>/dev/null || true
fi

if psql "$ADMIN_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | grep -q 1; then
  echo "OK  database ${DB_NAME} already exists"
else
  createdb -O "$DB_USER" -p "$PG_PORT" "$DB_NAME" 2>/dev/null || \
    psql "$ADMIN_URL" -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  echo "OK  created ${DB_NAME}"
fi

echo ""
echo "  export DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:${PG_PORT}/${DB_NAME}"
