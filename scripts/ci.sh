#!/usr/bin/env bash
# The deterministic checks CI runs on every PR (.github/workflows/ci.yml calls this
# script, so local and CI runs cannot drift apart). Run it before pushing:
#
#   scripts/ci.sh             # everything: commits, backend, frontend
#   scripts/ci.sh backend     # or any of: commits, backend, frontend
#
# Commits are checked from the merge base with $CI_BASE_REF (default origin/main) to
# HEAD. Dependencies are installed with --frozen-lockfile, as in CI.
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$ROOT"

if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
  group() { echo "::group::$*"; }
  endgroup() { echo "::endgroup::"; }
else
  group() { printf '\n\033[1;34m[ci] %s\033[0m\n' "$*"; }
  endgroup() { :; }
fi

step() { # <title> <command...>
  group "$1"
  shift
  "$@"
  endgroup
}

check_commits() {
  local base="${CI_BASE_REF:-origin/main}"
  step "commits: Conventional Commits since $base" \
    scripts/check-commit-msg.sh --range "$(git merge-base "$base" HEAD)..HEAD"
}

check_backend() {
  cd "$ROOT/backend"
  step "backend: install" pnpm install --frozen-lockfile
  step "backend: generate Prisma client" pnpm gen:prisma
  step "backend: format" pnpm format:check
  step "backend: build" pnpm build
  step "backend: test" pnpm exec vitest run
  cd "$ROOT"
}

check_frontend() {
  cd "$ROOT/frontend"
  step "frontend: install" pnpm install --frozen-lockfile
  step "frontend: format" pnpm format:check
  step "frontend: lint" pnpm lint
  step "frontend: build" pnpm build
  step "frontend: test" pnpm exec vitest run
  cd "$ROOT"
}

targets=("$@")
((${#targets[@]})) || targets=(commits backend frontend)
for target in "${targets[@]}"; do
  case "$target" in
    commits | backend | frontend) "check_$target" ;;
    *)
      echo "unknown target '$target' (expected: commits, backend, frontend)" >&2
      exit 2
      ;;
  esac
done
group "all checks passed: ${targets[*]}"
endgroup
