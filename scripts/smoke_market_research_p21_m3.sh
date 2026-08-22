#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'parseConjointCsv' "$ROOT/services/ptt-crm-api/src/market-research/survey-codebook.util.ts"
grep -q 'crm_research_cj_summaries' "$ROOT/docs/specs/2026-08-15-postgresql-ddl-market-research-p21.sql"
grep -q 'format=conjoint' "$ROOT/docs/superpowers/plans/2026-08-15-market-research-os-p21.md"
test -f "$ROOT/scripts/fixtures/research-conjoint.sample.csv"
echo "OK  P21 M3 import + DDL + fixture"
