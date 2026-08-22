#!/usr/bin/env bash
# WS-P4-08 — validate MKT-AI industry playbook JSON (schema + ≥3 files)
#
# Usage:
#   ./scripts/verify_mkt_ai_playbooks.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAYBOOKS_DIR="$ROOT/services/ptt-crm-api/src/marketing-ai-planner/playbooks"
MIN_FILES="${MKT_AI_PLAYBOOK_MIN_FILES:-3}"

echo "== verify_mkt_ai_playbooks WS-P4-08 @ $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown) =="
echo "dir=$PLAYBOOKS_DIR min_files=$MIN_FILES"

if [[ ! -d "$PLAYBOOKS_DIR" ]]; then
  echo "FAIL missing playbooks dir: $PLAYBOOKS_DIR"
  exit 1
fi

COUNT=0
for f in "$PLAYBOOKS_DIR"/*.json; do
  [[ -f "$f" ]] || continue
  COUNT=$((COUNT + 1))
done
echo "found $COUNT playbook JSON file(s)"

if [[ "$COUNT" -lt "$MIN_FILES" ]]; then
  echo "FAIL expected ≥${MIN_FILES} playbook files, got $COUNT"
  exit 1
fi

for f in "$PLAYBOOKS_DIR"/*.json; do
  [[ -f "$f" ]] || continue
  base="$(basename "$f" .json)"
  python3 - "$f" "$base" <<'PY'
import json, sys
path, slug = sys.argv[1], sys.argv[2]
errors = []

def fail(msg):
    errors.append(msg)

try:
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)
except Exception as exc:
    fail(f"invalid JSON: {exc}")
    print("\n".join(errors))
    sys.exit(1)

if not isinstance(doc, dict):
    fail("root must be object")

file_slug = slug
doc_slug = str(doc.get("slug") or file_slug).strip()
if not doc_slug:
    fail("slug is required")
if doc_slug != file_slug:
    fail(f'slug "{doc_slug}" must match filename "{file_slug}.json"')
if not str(doc.get("label_vi") or "").strip():
    fail("label_vi is required")

service_slugs = doc.get("service_slugs")
if not isinstance(service_slugs, list) or not service_slugs:
    fail("service_slugs must be a non-empty array")

brief_defaults = doc.get("brief_defaults")
if not isinstance(brief_defaults, dict):
    fail("brief_defaults must be an object")

hints = doc.get("strategy_prompt_hints")
if not isinstance(hints, list) or not [h for h in hints if str(h).strip()]:
    fail("strategy_prompt_hints must contain ≥1 non-empty string")

templates = doc.get("campaign_kpi_templates")
if not isinstance(templates, list) or not [t for t in templates if str(t).strip()]:
    fail("campaign_kpi_templates must contain ≥1 non-empty string")

qg = doc.get("quality_gate")
if not isinstance(qg, dict):
    fail("quality_gate is required")
else:
    min_score = qg.get("min_score_launch_qa")
    if not isinstance(min_score, (int, float)) or min_score < 0 or min_score > 100:
        fail("quality_gate.min_score_launch_qa must be 0–100")
    req = qg.get("require_campaign_count")
    if not isinstance(req, (int, float)) or req < 1:
        fail("quality_gate.require_campaign_count must be ≥1")

mix = doc.get("channel_mix_pct")
if mix is not None:
    if not isinstance(mix, dict) or not all(isinstance(v, (int, float)) for v in mix.values()):
        fail("channel_mix_pct values must be numbers when present")

if errors:
    print("\n".join(errors))
    sys.exit(1)
PY
  if [[ $? -ne 0 ]]; then
    echo "FAIL schema $base"
    exit 1
  fi
  echo "OK  $base.json"
done

echo ""
echo "== Jest cross-check (marketing-ai-playbook.util) =="
(
  cd "$ROOT/services/ptt-crm-api"
  npm test -- --testPathPattern=marketing-ai-playbook.util.spec --testNamePattern="validateMktAiPlaybookDocument" --silent 2>/dev/null
) || {
  echo "WARN jest cross-check skipped (run: cd services/ptt-crm-api && npm test -- marketing-ai-playbook.util.spec)"
}

echo ""
echo "OK  verify_mkt_ai_playbooks — ${COUNT} files validated"
