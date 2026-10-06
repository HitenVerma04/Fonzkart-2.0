#!/usr/bin/env bash
# Security regression tests for the Next.js website code, plus the golden files the Spring Boot parity tests use.
# Needs Docker. Nothing is installed into the project and the project files are mounted read-only.
#
#   scripts/security-tests/run.sh test        run the security regression tests (default)
#   scripts/security-tests/run.sh originals   run them against the pre-hardening code: they are expected to FAIL
#   scripts/security-tests/run.sh golden      regenerate the Spring Boot parity fixtures in
#   scripts/security-tests/run.sh golden-catalog   regenerate only golden/catalog-api-expected.json
#                                             backend/src/test/resources/golden from the current website code:
#                                             staff-, auth- and pricing-scenario-expected.json, executive-token-fixture.json
set -euo pipefail

MODE="${1:-test}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
GOLDEN="$ROOT/backend/src/test/resources/golden"
DB_SQL="$ROOT/backend/src/test/resources/db"

if command -v cygpath >/dev/null 2>&1; then
  # Git Bash on Windows: Docker needs Windows paths and no MSYS path rewriting.
  export MSYS_NO_PATHCONV=1
  ROOT_MOUNT="$(cygpath -w "$ROOT")"
  GOLDEN_MOUNT="$(cygpath -w "$GOLDEN")"
else
  ROOT_MOUNT="$ROOT"
  GOLDEN_MOUNT="$GOLDEN"
fi

NET=fonzkart-sec-net
PG=fonzkart-sec-pg
MAIL=fonzkart-sec-mail
DEPS=fonzkart-sec-deps
SECRET=scenario-secret   # same AUTH_SECRET as backend/src/test/java/.../PostgresTestBase
# The website falls back to the production mail server when SMTP_HOST is unset: point every run at a closed local
# port instead, so a test can never send real email (start_mail replaces this for the auth golden run).
NO_MAIL=(-e SMTP_HOST=127.0.0.1 -e SMTP_PORT=1)
EXTRA_ENV=("${NO_MAIL[@]}")

cleanup() {
  docker rm -f "$PG" "$MAIL" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

docker network create "$NET" >/dev/null
docker run -d --name "$PG" --network "$NET" -e POSTGRES_PASSWORD=sec -e POSTGRES_DB=fonzkart postgres:15 >/dev/null
until docker logs "$PG" 2>&1 | grep -q "PostgreSQL init process complete"; do sleep 1; done
until docker exec "$PG" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; do sleep 1; done

# reset_db [seed.sql ...]: the Prisma schema plus the given seeds from backend/src/test/resources/db
reset_db() {
  docker exec "$PG" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres \
    -c "DROP DATABASE IF EXISTS fonzkart WITH (FORCE)" -c "CREATE DATABASE fonzkart" >/dev/null
  local files=("$DB_SQL/01-prisma-schema.sql")
  for seed in "$@"; do files+=("$DB_SQL/$seed"); done
  cat "${files[@]}" | docker exec -i "$PG" psql -q -v ON_ERROR_STOP=1 -U postgres -d fonzkart >/dev/null
}

start_mail() {
  docker rm -f "$MAIL" >/dev/null 2>&1 || true
  docker run -d --name "$MAIL" --network "$NET" -e MP_SMTP_AUTH_ACCEPT_ANY=1 -e MP_SMTP_AUTH_ALLOW_INSECURE=1 \
    axllent/mailpit:latest >/dev/null
  until docker logs "$MAIL" 2>&1 | grep -q "accessible via"; do sleep 1; done
  EXTRA_ENV=(-e SMTP_HOST="$MAIL" -e SMTP_PORT=1025 -e SMTP_USER=noreply@fonzkart.in -e SMTP_PASS=x
    -e SMTP_SECURE=false -e NEXT_PUBLIC_APP_URL=https://www.fonzkart.in -e MAILPIT_HOST="$MAIL")
}

run_node() {
  docker run --rm --network "$NET" \
    -v "$ROOT_MOUNT:/work:ro" -v "$DEPS:/deps" -v "$GOLDEN_MOUNT:/golden" \
    -e DATABASE_URL="postgresql://postgres:sec@$PG:5432/fonzkart" -e AUTH_SECRET="$SECRET" ${EXTRA_ENV[@]+"${EXTRA_ENV[@]}"} \
    node:22-alpine sh /work/scripts/security-tests/in-container.sh "$@"
}

G=/work/backend/src/test/resources/golden
case "$MODE" in
  test)
    reset_db 03-staff-seed.sql
    run_node scripts/security-tests/all.test.ts
    ;;
  originals)
    reset_db 03-staff-seed.sql
    run_node --originals scripts/security-tests/all.test.ts
    ;;
  golden-catalog)
    reset_db 02-catalog-data.sql
    run_node scripts/security-tests/catalog-ref.ts "$G/catalog-api-expected.json" /golden/catalog-api-expected.json
    ;;
  golden)
    reset_db 03-staff-seed.sql
    run_node scripts/security-tests/staff-ref.ts "$G/staff-scenario.json" /golden/staff-scenario-expected.json
    reset_db 03-staff-seed.sql 04-pricing-rules-seed.sql
    run_node scripts/security-tests/pricing-ref.ts "$G/pricing-scenario.json" /golden/pricing-scenario-expected.json
    reset_db 02-catalog-data.sql
    run_node scripts/security-tests/catalog-ref.ts "$G/catalog-api-expected.json" /golden/catalog-api-expected.json
    reset_db
    start_mail
    run_node scripts/security-tests/auth-ref.ts "$G/auth-scenario.json" /golden/auth-scenario-expected.json
    EXTRA_ENV=("${NO_MAIL[@]}")
    run_node scripts/security-tests/token-fixture.ts /golden/executive-token-fixture.json
    ;;
  *)
    echo "usage: $0 [test|originals|golden|golden-catalog]" >&2
    exit 2
    ;;
esac
