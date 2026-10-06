#!/bin/sh
# Runs inside node:22-alpine (started by run.sh). /work is the project, mounted read-only; /deps caches the
# test dependencies between runs. Usage: in-container.sh [--originals] <script.ts> [args...]
set -e

PREPARE_FLAG=""
if [ "$1" = "--originals" ]; then PREPARE_FLAG="--originals"; shift; fi

# Prisma's query engine needs OpenSSL, which the Alpine image does not ship.
apk add --no-cache openssl >/dev/null

if ! cmp -s /work/scripts/security-tests/package.json /deps/package.json 2>/dev/null; then
  echo "installing test dependencies (first run only)..."
  rm -rf /deps/node_modules /deps/package.json /deps/package-lock.json
  cp /work/scripts/security-tests/package.json /deps/package.json
  (cd /deps && npm install --no-audit --no-fund --loglevel=error)
fi
cp -r /work/scripts/security-tests/stubs/. /deps/node_modules/

node /work/scripts/security-tests/prepare.mjs /work /app $PREPARE_FLAG
ln -s /deps/node_modules /app/node_modules
cd /app
/deps/node_modules/.bin/prisma generate --schema prisma/schema.prisma >/dev/null

exec /deps/node_modules/.bin/tsx "$@"
