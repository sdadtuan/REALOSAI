#!/usr/bin/env bash
# RNOS-M3 — portal_native_device_tokens DDL
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"

echo "==> Apply M3 portal native device DDL"
echo "    DATABASE_URL=$DATABASE_URL"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/docs/specs/ddl-portal-native-device-tokens.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='portal_native_device_tokens';" \
  | grep -q 1

echo "OK  portal_native_device_tokens ready"
