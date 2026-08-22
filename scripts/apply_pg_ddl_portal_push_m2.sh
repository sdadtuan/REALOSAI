#!/usr/bin/env bash
# RNOS-M2 — portal_push_subscriptions DDL
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"

echo "==> Apply M2 portal push DDL"
echo "    DATABASE_URL=$DATABASE_URL"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/docs/specs/ddl-portal-push-subscriptions.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='portal_push_subscriptions';" \
  | grep -q 1

echo "OK  portal_push_subscriptions ready"
