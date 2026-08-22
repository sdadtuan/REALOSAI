#!/usr/bin/env bash
# Apply CMKT Video Social FFmpeg V1 DDL (cmkt_video_licenses)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/postgresql-ddl-cmkt-video-social-v1.sql"

echo "==> Apply CMKT Video Social FFmpeg V1 DDL"
echo "    DATABASE_URL=${DATABASE_URL%%@*}@***"
echo "    DDL=$DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  CMKT Video Social V1 DDL applied (cmkt_video_licenses)"
