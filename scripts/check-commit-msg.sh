#!/usr/bin/env bash
# Validates Conventional Commits (https://www.conventionalcommits.org) headers.
# The single source of truth for the format: used by the commit-msg hook (.githooks/),
# by CI for every commit in a PR and for the PR title, and by scripts/ci-local.sh.
#
#   scripts/check-commit-msg.sh --file <path>     # commit message file (git hook)
#   scripts/check-commit-msg.sh --header "<text>" # a single header, e.g. a PR title
#   scripts/check-commit-msg.sh --range <a>..<b>  # every non-merge commit in a range
set -euo pipefail

TYPES='feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert'
MAX_HEADER_LENGTH=100
# type, optional (scope), optional ! for breaking changes, ": ", then a description.
PATTERN="^(${TYPES})(\([a-z0-9][a-z0-9._/-]*\))?!?: [^ ].*$"

check_header() { # <header> <label>
  local header="$1" label="$2"
  if [[ ! "$header" =~ $PATTERN ]]; then
    {
      printf '✖ %s is not a Conventional Commit:\n    %s\n' "$label" "$header"
      printf '  Expected: <type>(<optional scope>)!: <description>\n'
      printf '  Types:    %s\n' "${TYPES//|/, }"
      printf '  Example:  fix(backend): map CSV country codes to ISO 3166-1\n'
    } >&2
    return 1
  fi
  if ((${#header} > MAX_HEADER_LENGTH)); then
    printf '✖ %s header is %d characters, max is %d:\n    %s\n' \
      "$label" "${#header}" "$MAX_HEADER_LENGTH" "$header" >&2
    return 1
  fi
}

case "${1:-}" in
  --file)
    # First line that is not a comment (git strips "#" lines after the hook runs).
    header="$(grep -v '^#' "$2" | sed -n '/[^[:space:]]/{p;q;}')"
    # Messages git writes itself; fixup!/squash! must be squashed away before merging,
    # and CI rejects them, so they are fine locally.
    [[ "$header" =~ ^(Merge|Revert\ \"|fixup!|squash!|amend!) ]] && exit 0
    check_header "$header" "Commit message"
    ;;
  --header)
    check_header "$2" "Title"
    ;;
  --range)
    # Not a process substitution: a bad range must fail the check, not pass it.
    commits="$(git log --no-merges --format='%H %s' "$2" --)"
    status=0
    while IFS= read -r line; do
      [[ -n "$line" ]] || continue
      sha="${line%% *}"
      check_header "${line#* }" "Commit ${sha:0:7}" || status=1
    done <<<"$commits"
    exit $status
    ;;
  *)
    sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//' >&2
    exit 2
    ;;
esac
