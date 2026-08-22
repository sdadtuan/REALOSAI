#!/usr/bin/env bash
# DEPRECATED — disk alias for /_next/static/ caused ChunkLoadError after partial deploys.
# Use instead:
#   ./scripts/deploy_ops_web.sh && sudo ./scripts/deploy_ops_web.sh --restart
echo "DEPRECATED: $0 no longer patches nginx static alias."
echo "Run: cd /var/www/rnosai && ./scripts/deploy_ops_web.sh && sudo ./scripts/deploy_ops_web.sh --restart"
exit 1
