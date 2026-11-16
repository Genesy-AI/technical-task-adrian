#!/usr/bin/env bash
# Creates this checkout's Temporal namespace (TEMPORAL_NAMESPACE) if it does not exist.
# Idempotent. Safe to run before every `pnpm dev`: the dev server keeps namespaces in
# memory unless started with --db-filename, so they vanish when it restarts.
set -euo pipefail

cd "$(dirname "$0")/.."

# Same precedence as src/config.ts: variables already in the environment win over .env.
if [[ -f .env ]]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
    [[ -n "${!key+x}" ]] && continue
    value="${value%\"}" && value="${value#\"}"
    export "$key=$value"
  done < .env
fi

: "${TEMPORAL_ADDRESS:?TEMPORAL_ADDRESS is not set (see backend/.env.example)}"
: "${TEMPORAL_NAMESPACE:?TEMPORAL_NAMESPACE is not set (see backend/.env.example)}"

if ! command -v temporal >/dev/null 2>&1; then
  echo "temporal CLI not found; install it: https://docs.temporal.io/cli" >&2
  exit 1
fi

if temporal operator namespace describe --address "$TEMPORAL_ADDRESS" -n "$TEMPORAL_NAMESPACE" >/dev/null 2>&1; then
  exit 0
fi

if ! temporal operator cluster health --address "$TEMPORAL_ADDRESS" >/dev/null 2>&1; then
  echo "Temporal is not reachable at $TEMPORAL_ADDRESS. Start it with:" >&2
  echo "  temporal server start-dev   # add --db-filename <file> to keep state across restarts" >&2
  exit 1
fi

temporal operator namespace create --address "$TEMPORAL_ADDRESS" -n "$TEMPORAL_NAMESPACE" --retention 72h >/dev/null
# Registration is normally instant, but wait briefly in case the server lags.
for _ in $(seq 1 20); do
  temporal operator namespace describe --address "$TEMPORAL_ADDRESS" -n "$TEMPORAL_NAMESPACE" >/dev/null 2>&1 && break
  sleep 0.5
done
echo "Created Temporal namespace $TEMPORAL_NAMESPACE"
