#!/usr/bin/env bash
# RNOS-M3 Phase 4 — Verify Sentry WebView + Capacitor tags wired
#   bash scripts/m3_ga_sentry_verify.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pass=0
fail=0

ok() { pass=$((pass + 1)); echo "PASS  $1"; }
bad() { fail=$((fail + 1)); echo "FAIL  $1"; }

echo "== RNOS-M3 GA Sentry verify =="

SENTRY="$ROOT/services/portal-web/src/lib/sentry.client.ts"
if grep -q 'capacitor-portal' "$SENTRY" && grep -q 'native-webview' "$SENTRY"; then
  ok "sentry-tags-source"
else
  bad "sentry-tags-source — missing capacitor-portal / native-webview tags"
fi

if grep -q 'getPortalSentryContext' "$SENTRY"; then
  ok "sentry-context-fn"
else
  bad "sentry-context-fn"
fi

if [[ -f "$ROOT/deploy/env.m3-ga-prod.example" ]] && grep -q 'NEXT_PUBLIC_SENTRY_DSN' "$ROOT/deploy/env.m3-ga-prod.example"; then
  ok "ga-env-template"
else
  bad "ga-env-template"
fi

if [[ -f "$ROOT/docs/runbooks/m3-sentry-native-webview-monitoring.md" ]]; then
  ok "sentry-runbook"
else
  bad "sentry-runbook"
fi

if grep -q 'initPortalSentry' "$ROOT/services/portal-web/src/app/providers.tsx"; then
  ok "providers-init"
else
  bad "providers-init"
fi

echo ""
echo "== Summary: $pass pass / $fail fail =="
echo "    Production: set NEXT_PUBLIC_SENTRY_DSN + rebuild portal-web"
echo "    Dashboard filter: client:capacitor-portal"
[[ "$fail" -eq 0 ]]
