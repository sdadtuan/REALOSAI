#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'rag-reembed-panel' "$ROOT/services/ops-web/src/components/research/ResearchRagReembedPanel.tsx"
grep -q 'ResearchRagReembedPanel' "$ROOT/services/ops-web/src/app/crm/research/analytics/page.tsx"
grep -q 'ragOpenaiEmbedEnabled' "$ROOT/services/ops-web/src/app/crm/research/analytics/page.tsx"
grep -q "crm_research', 'configure'" "$ROOT/services/ops-web/src/app/crm/research/analytics/page.tsx"
echo "OK  P40 M3 panel + analytics gate"
