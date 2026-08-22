#!/usr/bin/env bash
# M1 kickoff — RNOS-41 PWA staging gate (NEXT_PUBLIC_PWA_ENABLED=1)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${RNOS41_ENV:-$ROOT/deploy/env.staging-m1-pwa.example}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export NEXT_PUBLIC_PWA_ENABLED=1

echo "== M1 PWA Kickoff (RNOS-41) =="
echo "ENV: $ENV_FILE"
echo "NEXT_PUBLIC_PWA_ENABLED=$NEXT_PUBLIC_PWA_ENABLED"
echo "OPS_E2E_URL=${OPS_E2E_URL:-http://127.0.0.1:3200}"
echo ""

# Postgres + CRM DDL (E2E login + lead list)
if [[ "${SKIP_M1_BOOTSTRAP:-0}" != "1" ]]; then
  echo "==> Bootstrap local PG + leads DDL (rnos39_e2e_bootstrap)"
  RNOS39_ENV="$ENV_FILE" bash "$ROOT/scripts/rnos39_e2e_bootstrap.sh"
else
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx rnosai-postgres; then
    echo "==> Start local Postgres (docker compose)"
    docker compose up -d postgres
  fi
  for _ in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U ptt -d rnosaidb >/dev/null 2>&1; then
      echo "OK  Postgres ready"
      break
    fi
    sleep 1
  done
fi

bash "$ROOT/scripts/rnos41_pwa_gate.sh"

echo ""
echo "OK  M1 kickoff gate complete — see .local-dev/rnos41-pwa-gate-report.json"
