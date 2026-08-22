#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'footerLine' "$ROOT/services/ptt-crm-api/src/market-research/market-research-docx.util.ts"
grep -q 'footer1.xml' "$ROOT/services/ptt-crm-api/src/market-research/market-research-docx.util.ts"
grep -q 'buildResearchReportDocx(sections, footer)' "$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
echo "OK  P31 M3 DOCX footer wiring"
