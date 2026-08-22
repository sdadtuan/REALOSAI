#!/usr/bin/env bash
# Exit 0 when pgvector extension + embedding_vec column exist; 1 otherwise.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

read -r ext_ok col_ok <<<"$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At -c "
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector'),
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'crm_research_insight_embeddings'
             AND column_name = 'embedding_vec'
         );
")"

if [[ "$ext_ok" == "t" && "$col_ok" == "t" ]]; then
  echo "OK  pgvector extension + embedding_vec column ready"
  exit 0
fi

echo "FAIL  pgvector not ready (ext_ok=${ext_ok} col_ok=${col_ok})"
echo "      Run: bash scripts/install_pgvector_vps.sh"
exit 1
