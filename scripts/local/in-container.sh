#!/bin/sh
# Inside node:22 (started by start.sh): copy the code into /app (public/ and node_modules/ are mounted there by
# start.sh: Turbopack refuses symlinks that leave the project), install dependencies once into the cached volume,
# generate the Prisma client and run the Next.js dev server.
set -e
cd /work
tar --exclude=./node_modules --exclude=./.next --exclude=./backend --exclude=./public --exclude=./order-flow \
    --exclude=./security-hardening --exclude=./notifications-fix --exclude=./deploy/originals -cf - . | tar -C /app -xf -
cd /app
if ! cmp -s package-lock.json node_modules/.fonzkart-lock 2>/dev/null; then
  echo "[local] installing dependencies (first start only)..."
  find node_modules -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
  npm ci --ignore-scripts --no-audit --no-fund --loglevel=error
  cp package-lock.json node_modules/.fonzkart-lock
fi
node_modules/.bin/prisma generate --schema prisma/schema.prisma >/dev/null
exec node_modules/.bin/next dev -H 0.0.0.0 -p 3000
