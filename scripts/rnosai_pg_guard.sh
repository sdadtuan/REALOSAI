#!/usr/bin/env bash
# Refuse accidental DDL on foreign / shared production databases (RNOSAI safety)
# Usage: rnosai_assert_database_url "$DATABASE_URL"
rnosai_assert_database_url() {
  local url="${1:-}"
  if [[ -z "$url" ]]; then
    echo "FAIL  DATABASE_URL empty" >&2
    return 1
  fi
  local db_path
  db_path="$(python3 - <<PY
from urllib.parse import urlparse
u = urlparse("$url")
print((u.path or "").lstrip("/").split("?")[0])
PY
)"
  local blocked=(ptt_agency ptt_crm postgres template0 template1)
  local b
  for b in "${blocked[@]}"; do
    if [[ "$db_path" == "$b" ]]; then
      echo "FAIL  DATABASE_URL trỏ database '$db_path' — RNOSAI chỉ được thao tác trên rnosaidb." >&2
      echo "      Dùng: source deploy/env.local.example  (port 5433)" >&2
      return 1
    fi
  done
  if [[ "$db_path" != "rnosaidb" ]]; then
    echo "WARN  DATABASE_URL database='$db_path' (expected rnosaidb for local RNOSAI)" >&2
    if [[ "${RNOSAI_ALLOW_NON_RNOSAIDB:-0}" != "1" ]]; then
      echo "FAIL  Set RNOSAI_ALLOW_NON_RNOSAIDB=1 để override (staging tên khác)" >&2
      return 1
    fi
  fi
  return 0
}
