#!/usr/bin/env bash
# E4 — playbook auto-rank + score v2 feedback gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
ok() { echo "OK  $*"; }
bad() { echo "FAIL $*"; fail=1; }

echo "== E4 closed-loop learning gate =="

if [[ -f "$ROOT/services/ptt-crm-api/migrations/20260804100000_ai_score_feedback.sql" ]]; then
  ok "ai_score_feedback migration"
else
  bad "missing ai_score_feedback migration"
fi

if [[ -f "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-score-feedback.repository.ts" ]]; then
  ok "ai-score-feedback.repository.ts"
else
  bad "missing ai-score-feedback.repository"
fi

if grep -q "computeLeadScoreV2" "$ROOT/services/ptt-crm-api/src/ai-intelligence/lead-score.engine.ts" 2>/dev/null; then
  ok "computeLeadScoreV2 engine"
else
  bad "missing computeLeadScoreV2"
fi

if grep -q "scoreV2Enabled" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.config.ts" 2>/dev/null; then
  ok "PTT_AI_SCORE_V2 config"
else
  bad "missing PTT_AI_SCORE_V2 config"
fi

if grep -q "recordOverride" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-lead-score.service.ts" 2>/dev/null; then
  ok "override feedback hook"
else
  bad "missing override feedback hook"
fi

if [[ -f "$ROOT/services/ptt-crm-api/src/playbooks/playbook-closed-loop.util.ts" ]]; then
  ok "playbook-closed-loop.util.ts"
else
  bad "missing playbook-closed-loop.util"
fi

if grep -q "ranked" "$ROOT/services/ptt-crm-api/src/playbooks/playbooks.controller.ts" 2>/dev/null; then
  ok "playbooks ranked route"
else
  bad "missing playbooks ranked route"
fi

if grep -q "playbookRankBoostMap" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-nba.service.ts" 2>/dev/null; then
  ok "NBA RAG rank boost"
else
  bad "missing NBA rank boost"
fi

if (cd "$ROOT/services/ptt-crm-api" && npx jest src/ai-intelligence/lead-score.engine.v2.spec.ts src/playbooks/playbook-closed-loop.util.spec.ts --silent 2>/dev/null); then
  ok "E4 unit specs"
else
  bad "E4 unit tests failed"
fi

if [[ "$fail" -eq 0 ]]; then
  echo "E4 closed-loop learning gate PASSED"
  exit 0
fi
echo "E4 closed-loop learning gate FAILED"
exit 1
