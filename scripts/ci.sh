#!/usr/bin/env bash
# The deterministic checks CI runs on every PR. Each step of .github/workflows/ci.yml
# calls one check of this script, so local and CI runs cannot drift apart. Run it
# before pushing:
#
#   scripts/ci.sh                      # everything: commits, backend, frontend
#   scripts/ci.sh frontend             # every check of one target
#   scripts/ci.sh frontend lint test   # specific checks of one target
#
# Targets and their checks, in order:
#   commits:  conventional            (merge base with $CI_BASE_REF, default origin/main, to HEAD)
#   backend:  install prisma format build test
#   frontend: install format lint build test
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$ROOT"

checks_of() { # <target>: prints its checks in run order, fails for unknown targets
  case "$1" in
    commits) echo conventional ;;
    backend) echo install prisma format build test ;;
    frontend) echo install format lint build test ;;
    *) return 1 ;;
  esac
}

commits_conventional() {
  local base="${CI_BASE_REF:-origin/main}"
  scripts/check-commit-msg.sh --range "$(git merge-base "$base" HEAD)..HEAD"
}

# Shared by both packages; run from inside the package directory.
pkg_install() { pnpm install --frozen-lockfile; }
pkg_format() { pnpm format:check; }
pkg_lint() { pnpm lint; }
pkg_build() { pnpm build; }
pkg_test() { pnpm exec vitest run; }

backend_prisma() { pnpm gen:prisma; }

run_check() { # <target> <check>
  local target="$1" check="$2" fn
  printf '\n\033[1;34m[ci] %s: %s\033[0m\n' "$target" "$check"
  if [[ $target == commits ]]; then
    fn="commits_$check"
  else
    cd "$ROOT/$target"
    fn="pkg_$check"
    declare -F "${target}_$check" >/dev/null && fn="${target}_$check"
  fi
  "$fn"
  cd "$ROOT"
}

run_target() { # <target> [check...]
  local target="$1" valid check
  shift
  if ! valid="$(checks_of "$target")"; then
    echo "unknown target '$target' (expected: commits, backend, frontend)" >&2
    exit 2
  fi
  # shellcheck disable=SC2086 # split the space-separated check list
  (($#)) || set -- $valid
  for check in "$@"; do
    if [[ " $valid " != *" $check "* ]]; then
      echo "unknown check '$check' for $target (expected: $valid)" >&2
      exit 2
    fi
    run_check "$target" "$check"
  done
}

if (($#)); then
  run_target "$@"
else
  for target in commits backend frontend; do run_target "$target"; done
fi
printf '\n\033[1;32m[ci] passed: %s\033[0m\n' "${*:-all checks}"
