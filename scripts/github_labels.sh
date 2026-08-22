#!/usr/bin/env bash
# Tạo GitHub labels cho RNOSAI — chạy một lần sau gh repo create / push.
# Usage: ./scripts/github_labels.sh [owner/repo]   # default: sdadtuan/RNOSAI
set -euo pipefail

REPO="${1:-sdadtuan/RNOSAI}"

create() {
  gh label create "$1" --repo "$REPO" --color "$2" --description "$3" 2>/dev/null \
    || gh label edit "$1" --repo "$REPO" --color "$2" --description "$3"
}

echo "Creating labels on $REPO ..."

create deliverable 1D76DB "RNOS backlog / feature"
create bug D73A4A "Defect production hoặc regression"
create uat FBCA04 "UAT fail hoặc UC vs UI gap"

create wave-phase-0 5319E7 "DDL, timeline, data readiness"
create wave-r1 0E8A16 "AI Assist — copilot, score"
create wave-r2 006B75 "Workflow, NBA, OpenSearch"
create wave-r3 BFD4F2 "Forecast, renewal, churn"

create ws-data C5DEF5 "DDL, timeline, events"
create ws-be 0366D6 "ptt-crm-api, ai-intelligence"
create ws-fe 7057FF "ops-web, portal-web"
create ws-platform E99695 "Deploy, env, runbook"
create ws-qa FEF2C0 "E2E, UAT sign-off"

create p0 B60205 "Gate / production blocker"
create p1 D93F0B "R1 stretch hoặc R2"
create p2 F9D0C4 "Defer"

create ready 0E8A16 "Spec + UC clear, có thể code"
create blocked 000000 "Chờ dependency RNOS/DDL"
create in-uat FBCA04 "Code done, chờ pilot UAT"

echo "Done. See docs/templates/github-setup.md"
