#!/usr/bin/env bash
# One script for every pipeline stage, so a laptop and the runner execute the
# same commands:  bash scripts/ci-site.sh install | lint | build | data | smoke | all
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-4173}"

install() { npm ci; }
lint()    { npx eslint . --max-warnings 43; }
build()   { npm run build; }               # tsc -b, then vite build
data()    { "${PYTHON:-python3}" scripts/check_site_data.py; }

# Serve the built site and open every stage and the named tabs in a headless
# browser, the way a visitor does. Every path returns index.html with status 200
# on this single-page site, so scripts/smoke_site.mjs checks the rendered
# headings, page errors and that each data file is served as JSON.
smoke() {
  node node_modules/vite/bin/vite.js preview --port "$PORT" --strictPort > "${TMPDIR:-/tmp}/site-preview.log" 2>&1 &
  local pid=$!
  trap "kill $pid 2>/dev/null || true" EXIT   # EXIT, not RETURN: set -e leaves the function early on a failure
  local up=
  for _ in $(seq 1 60); do curl -sf "http://localhost:$PORT/" > /dev/null && { up=1; break; } || sleep 1; done
  [ -n "$up" ] || { echo "FAIL preview server did not start" >&2; cat "${TMPDIR:-/tmp}/site-preview.log" >&2; return 1; }
  node scripts/smoke_site.mjs "http://localhost:$PORT"
}

case "${1:-all}" in
  install) install ;;
  lint)    lint ;;
  build)   build ;;
  data)    data ;;
  smoke)   smoke ;;
  all)     lint; build; data; smoke ;;
  *) echo "usage: ci-site.sh install|lint|build|data|smoke|all" >&2; exit 2 ;;
esac
