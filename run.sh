#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Нужны Node.js 20.19+ и npm."
  exit 1
fi
if [ ! -f web/node_modules/vite/bin/vite.js ]; then
  npm --prefix web ci
fi
npm --prefix web run build
exec python3 server.py "$@"
