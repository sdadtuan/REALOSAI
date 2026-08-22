#!/usr/bin/env bash
# Smoke P7 M5 — Taxonomy UI + aggregator + deploy + UAT (RES-UC-070…071).
#
# Live API is not required. This milestone ships UI, scripts, and UAT Actions.
#   bash scripts/smoke_market_research_p7_m5.sh
#
# m5 = bash -n + FE contract (plus skip-live contract print when health ≠ 200).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"
PAGE="$ROOT/services/ops-web/src/app/crm/research/page.tsx"
TAX_PAGE="$ROOT/services/ops-web/src/app/crm/research/taxonomy/page.tsx"
PANE="$ROOT/services/ops-web/src/components/research/InsightsRagSearch.tsx"
DRAWER="$ROOT/services/ops-web/src/components/research/InsightDrawer.tsx"
UTIL="$ROOT/services/ops-web/src/components/research/taxonomy-pane.util.ts"
NAV="$ROOT/services/ops-web/src/components/OpsNav.tsx"
API="$ROOT/services/ops-web/src/lib/market-research-api.ts"
DEPLOY="$ROOT/scripts/deploy_market_research_p7_vps.sh"

echo "==> bash -n aggregator + deploy + p7_m1…p7_m5"
bash -n "$ROOT/scripts/smoke_market_research_p7.sh"
bash -n "$ROOT/scripts/deploy_market_research_p7_vps.sh"
bash -n "$ROOT/scripts/smoke_market_research_p7_m1.sh"
bash -n "$ROOT/scripts/smoke_market_research_p7_m2.sh"
bash -n "$ROOT/scripts/smoke_market_research_p7_m3.sh"
bash -n "$ROOT/scripts/smoke_market_research_p7_m4.sh"
bash -n "$ROOT/scripts/smoke_market_research_p7_m5.sh"
echo "OK  bash -n smoke_p7 / deploy_p7 / p7_m1…p7_m5"

echo "==> FE contract (taxonomy page + chips + attach)"
python3 - <<PY
from pathlib import Path
page = Path("$PAGE").read_text()
tax = Path("$TAX_PAGE").read_text()
pane = Path("$PANE").read_text()
drawer = Path("$DRAWER").read_text()
util = Path("$UTIL").read_text()
nav = Path("$NAV").read_text()
api = Path("$API").read_text()
deploy = Path("$DEPLOY").read_text()
banner = "Gắn theme — không sửa nội dung insight."
assert banner in util, "missing taxonomy banner"
assert "TAXONOMY_BANNER" in tax and "TAXONOMY_BANNER" in drawer
assert "shouldShowTaxonomyNav" in util
assert "shouldShowTaxonomyNav" in tax and "shouldShowTaxonomyNav" in page
assert "shouldShowTaxonomyNav" in nav
assert "/crm/research/taxonomy" in page and "/crm/research/taxonomy" in nav
assert "/crm/research/taxonomy" not in pane
assert "fetchResearchTaxonomy" in pane and "theme_code" in pane
assert "searchResearchInsights" in pane
assert "Gắn theme" in drawer and "Lưu" in drawer
attach = drawer.split("Gắn theme", 1)[1].split("</fieldset>", 1)[0]
assert "<textarea" not in attach, "attach control must not have statement textarea"
assert "createInsight" not in pane and "createResearchInsight" not in pane
assert "createResearchInsight" not in attach
assert "apply_pg_ddl_market_research_p7.sh" in deploy
patch = deploy.split("patch_runtime_env()", 1)[1].split("export_public_flag_from_runtime", 1)[0]
assert "RESEARCH_RAG_ENABLED=1" not in patch
assert "RESEARCH_QUALTRICS_ENABLED=1" not in patch
assert "RESEARCH_SPARKTORO_ENABLED=1" not in patch
assert "QUALTRICS_API_KEY" not in patch
assert "SPARKTORO_API_KEY" not in patch
assert "PTT_MARKET_RESEARCH_ENABLED=1" in patch
assert "git pull --ff-only origin main" in deploy
assert "/crm/sales?tab=market" not in page and "/crm/sales?tab=market" not in tax
print("OK  FE taxonomy page + chips + attach (no statement textarea) + deploy gates")
PY

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p7_m5_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p7_m5_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

echo "Contract:"
echo "  bash scripts/smoke_market_research_p7.sh   # p7_m1…p7_m5 if present"
echo "  bash scripts/deploy_market_research_p7_vps.sh  # dry-run unless APPLY=1 / --local"
echo "  step 1/4 P0+P1+P2+P3+P4+P5+P6+P7 DDL (P7 last, before restarts); 2/4 api; 3/4 ops-web; 4/4 worker"
echo "  no portal-web rebuild"
echo "  default no --enable-flags; P0 flags only; never RESEARCH_RAG_ENABLED=1"
echo "  never RESEARCH_QUALTRICS_ENABLED=1 / QUALTRICS_API_KEY; never RESEARCH_SPARKTORO_ENABLED=1 / SPARKTORO_API_KEY"
echo "  APPLY=1 git pull --ff-only origin main (merge-to-main before VPS)"
echo "  npm ci without --omit=dev"
echo "  JEST_WORKER_ID skip of deploy/runtime.env must stay untouched"
echo "  Gates: draft no hit; PII skip embed; 403 no statement; flag off rag_disabled;"
echo "         attach does not change statement; no createInsight"
echo "  UAT 070–071: approve client-facing → F5 embedding → search q hit / no draft → attach PRICE"
echo "               → search theme → statement unchanged → flag off ẩn ô tìm / rag_disabled → F5"
echo "OK  market research P7 M5 smoke"
