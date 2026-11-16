#!/usr/bin/env bash
# Releases what scripts/worktree-setup.sh created outside the checkout: the worktree's
# Temporal namespace. Ports and env files go away with the worktree directory itself.
#
# Never fails: Orca blocks the worktree removal when its archive hook fails, and a
# leftover namespace on a dev server is harmless. Refuses to touch the main checkout.
set -uo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)" || exit 0
cd "$ROOT" || exit 0

log() { printf '[worktree-teardown] %s\n' "$*"; }

if [[ "$(git rev-parse --git-dir)" == "$(git rev-parse --git-common-dir)" ]]; then
  log "main checkout, nothing to tear down"
  exit 0
fi

read_var() { sed -n "s/^$1=[\"']\{0,1\}\([^\"']*\)[\"']\{0,1\}$/\1/p" backend/.env 2>/dev/null | tail -n1; }
NAMESPACE="$(read_var TEMPORAL_NAMESPACE)"
ADDRESS="$(read_var TEMPORAL_ADDRESS)"

if [[ -z "$NAMESPACE" || -z "$ADDRESS" || "$NAMESPACE" == "default" ]]; then
  log "no worktree-specific Temporal namespace configured, skipping"
  exit 0
fi

if ! command -v temporal >/dev/null 2>&1; then
  log "temporal CLI not found; namespace $NAMESPACE left in place"
  exit 0
fi

if temporal operator namespace delete --address "$ADDRESS" -n "$NAMESPACE" --yes >/dev/null 2>&1; then
  log "deleted Temporal namespace $NAMESPACE"
else
  log "could not delete Temporal namespace $NAMESPACE (server down or already gone), skipping"
fi
exit 0
