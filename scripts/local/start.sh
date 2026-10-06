#!/usr/bin/env bash
# Runs Fonzkart on http://localhost:3000 with a fresh local demo database, entirely in Docker (no Node needed).
#   bash scripts/local/start.sh      start (stays in the foreground; Ctrl+C stops the website)
#   bash scripts/local/stop.sh       stop and remove everything it started
# Mail is caught by Mailpit at http://localhost:8025 — nothing is ever sent for real.
# The database is recreated from the seeds on every start (demo data, see README.md).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DB_SQL="$ROOT/backend/src/test/resources/db"
if command -v cygpath >/dev/null 2>&1; then
  export MSYS_NO_PATHCONV=1
  ROOT_MOUNT="$(cygpath -w "$ROOT")"
  PUBLIC_MOUNT="$(cygpath -w "$ROOT/public")"
else
  ROOT_MOUNT="$ROOT"
  PUBLIC_MOUNT="$ROOT/public"
fi

NET=fz-local
DB=fz-local-db
MAIL=fz-local-mail
APP=fz-local-app
DEPS=fonzkart-local-deps

docker rm -f "$APP" "$DB" "$MAIL" >/dev/null 2>&1 || true
docker network create "$NET" >/dev/null 2>&1 || true

echo "[local] starting PostgreSQL..."
docker run -d --name "$DB" --network "$NET" -e POSTGRES_PASSWORD=local -e POSTGRES_DB=fonzkart postgres:15 >/dev/null
until docker logs "$DB" 2>&1 | grep -q "PostgreSQL init process complete"; do sleep 1; done
until docker exec "$DB" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; do sleep 1; done
echo "[local] loading schema and demo data..."
cat "$DB_SQL/01-prisma-schema.sql" "$DB_SQL/02-catalog-data.sql" "$DB_SQL/03-staff-seed.sql" \
    "$DB_SQL/04-pricing-rules-seed.sql" "$HERE/demo-seed.sql" \
  | docker exec -i "$DB" psql -q -v ON_ERROR_STOP=1 -U postgres -d fonzkart >/dev/null

echo "[local] starting the mail catcher (http://localhost:8025)..."
docker run -d --name "$MAIL" --network "$NET" -p 8025:8025 \
  -e MP_SMTP_AUTH_ACCEPT_ANY=1 -e MP_SMTP_AUTH_ALLOW_INSECURE=1 axllent/mailpit:latest >/dev/null

# A random local session secret, kept in scripts/local/.local-secret (not committed) so logins survive restarts.
SECRET_FILE="$HERE/.local-secret"
[ -s "$SECRET_FILE" ] || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$SECRET_FILE"
SECRET="$(cat "$SECRET_FILE")"

echo "[local] starting the website on http://localhost:3000 (first start installs dependencies: a few minutes)..."
exec docker run --rm --name "$APP" --network "$NET" -p 3000:3000 \
  -v "$ROOT_MOUNT:/work:ro" -v "$PUBLIC_MOUNT:/app/public:ro" -v "$DEPS:/app/node_modules" \
  -e DATABASE_URL="postgresql://postgres:local@$DB:5432/fonzkart" \
  -e AUTH_SECRET="$SECRET" \
  -e NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  -e SMTP_HOST="$MAIL" -e SMTP_PORT=1025 -e SMTP_SECURE=false -e SMTP_USER=noreply@fonzkart.in -e SMTP_PASS=local \
  -e NEXT_TELEMETRY_DISABLED=1 \
  node:22 sh /work/scripts/local/in-container.sh
