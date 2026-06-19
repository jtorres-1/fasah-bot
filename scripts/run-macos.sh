#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install LTS from https://nodejs.org/"
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found. Reinstall Node.js LTS from https://nodejs.org/"
  exit 1
fi

NEED_INSTALL=0
if [[ ! -d node_modules ]]; then
  NEED_INSTALL=1
fi
if [[ "$NEED_INSTALL" -eq 0 ]] && ! npm ls prompts --omit=dev >/dev/null 2>&1; then
  NEED_INSTALL=1
fi

if [[ "$NEED_INSTALL" -eq 1 ]]; then
  echo "Installing dependencies..."
  if ! npm ci --omit=dev; then
    echo "npm ci failed, trying npm install --omit=dev"
    npm install --omit=dev
  fi
fi

exec node dist/index.js
