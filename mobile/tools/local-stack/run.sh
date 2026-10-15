#!/usr/bin/env bash
# Local end-to-end stack for the apps: PostgreSQL with the backend's test seed (catalog, staff, riders, cities, pricing
# rules; every account's password is "pw", rider Ravi +917000000001 / "riderpw"), the Spring Boot backend built from
# backend/, and one app's web build behind a same-origin proxy at http://localhost:8099. Nothing touches staging or
# production; no mail leaves the machine (SMTP points at a closed port).
#   mobile/tools/local-stack/run.sh up [customer|partner|admin]   start (or rebuild the app and restart the proxy)
#   mobile/tools/local-stack/run.sh down                          stop and remove everything
# Needs Docker, Maven + JDK 17 on the host, and the workspace installed in the fz-mobile volume (mobile/README.md).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
NET=fz-local
PG=fz-local-pg
API=fz-local-api
WEB=fz-local-web
APP="${2:-customer}"
win() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else echo "$1"; fi; }
# Git Bash would rewrite the container paths below; only the docker calls get MSYS_NO_PATHCONV.
docker() { MSYS_NO_PATHCONV=1 command docker "$@"; }

down() {
  docker rm -f "$WEB" "$API" "$PG" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}

if [ "${1:-}" = "down" ]; then down; exit 0; fi
[ "${1:-}" = "up" ] || { echo "usage: $0 up [customer|partner|admin] | down" >&2; exit 2; }

docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null
if ! docker ps --format '{{.Names}}' | grep -qx "$PG"; then
  docker rm -f "$PG" >/dev/null 2>&1 || true
  docker run -d --name "$PG" --network "$NET" -e POSTGRES_PASSWORD=local -e POSTGRES_DB=fonzkart \
    -v "$(win "$ROOT/backend/src/test/resources/db"):/docker-entrypoint-initdb.d:ro" postgres:15 >/dev/null
  until docker logs "$PG" 2>&1 | grep -q "PostgreSQL init process complete"; do sleep 1; done
  until docker exec "$PG" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; do sleep 1; done
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$API"; then
  (cd "$ROOT/backend" && mvn -q -B -DskipTests package)
  JAR=$(ls "$ROOT"/backend/target/fonzkart-backend-*.jar | head -1)
  docker rm -f "$API" >/dev/null 2>&1 || true
  docker run -d --name "$API" --network "$NET" -p 8080:8080 \
    -e DB_URL="jdbc:postgresql://$PG:5432/fonzkart" -e DB_USERNAME=postgres -e DB_PASSWORD=local \
    -e AUTH_SECRET=local-stack-secret -e SMTP_HOST=127.0.0.1 -e SMTP_PORT=1 -e UPLOAD_DIR=/tmp/uploads \
    -v "$(win "$JAR"):/app.jar:ro" eclipse-temurin:17-jre java -jar /app.jar >/dev/null
  until curl -sf http://localhost:8080/actuator/health/liveness >/dev/null 2>&1; do sleep 2; done
fi

# The app's web build, pointed at the proxy's own origin.
docker run --rm -v fz-mobile:/work -v "$(win "$ROOT/mobile"):/src:ro" -e EXPO_PUBLIC_API_URL=http://localhost:8099 node:22-alpine sh -c "
  cd /src && tar --exclude=./node_modules --exclude='*/node_modules' --exclude=./builds --exclude='*/android' --exclude='*.pdf' -cf - . | tar -C /work -xf - &&
  cd /work/apps/$APP && rm -rf /work/web-dist/$APP && npx expo export --platform web --output-dir /work/web-dist/$APP >/dev/null"
docker rm -f "$WEB" >/dev/null 2>&1 || true
docker run -d --name "$WEB" --network "$NET" -p 8099:8099 -v fz-mobile:/work:ro -v "$(win "$HERE"):/tools:ro" \
  node:22-alpine node /tools/proxy.mjs "/work/web-dist/$APP" "http://$API:8080" 8099 >/dev/null
echo "$APP app: http://localhost:8099  (backend http://localhost:8080)"
