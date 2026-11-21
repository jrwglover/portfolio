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

# Serve the built site and request every stage and one data file, the way a
# visitor's browser does.
smoke() {
  node node_modules/vite/bin/vite.js preview --port "$PORT" --strictPort > /tmp/site-preview.log 2>&1 &
  local pid=$!
  trap 'kill $pid 2>/dev/null || true' RETURN
  for _ in $(seq 1 30); do curl -sf "http://localhost:$PORT/" > /dev/null && break || sleep 1; done
  for path in / /rates/curves /rates/book /rates/live "/rates/curves?tab=pipelines" "/rates/curves?tab=bonds" "/rates/book?tab=static" "/rates/live?tab=bonds"; do
    curl -sf "http://localhost:$PORT$path" | grep -q '<div id="root">' || { echo "FAIL $path" >&2; return 1; }
    echo "ok   $path"
  done
  local size; size=$(curl -sf -o /dev/null -w '%{size_download}' "http://localhost:$PORT/data/rt_engine/timeline.json")
  [ "${size:-0}" -gt 1000 ] || { echo "FAIL timeline.json" >&2; return 1; }
  echo "ok   /data/rt_engine/timeline.json"
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
