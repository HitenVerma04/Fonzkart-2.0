#!/usr/bin/env bash
# Stops and removes what start.sh started (the dependency cache volume is kept).
docker rm -f fz-local-app fz-local-db fz-local-mail >/dev/null 2>&1 || true
docker network rm fz-local >/dev/null 2>&1 || true
echo "[local] stopped"
